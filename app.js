/* 光电效应实验台：控件绑定、读数、Canvas 动画、Chart.js 曲线、记录导出。 */
(function () {
  'use strict';

  const cfg = window.PHOTO_CONFIG;
  const P = window.PhotoPhysics;
  if (!cfg || !P) {
    (window.__errors = window.__errors || []).push('config.js 或 physics.js 未加载');
    return;
  }

  const $ = function (id) { return document.getElementById(id); };
  const MAX_I = cfg.maxCurrentUa;

  const state = {
    lambda: cfg.ranges.lambda.default,
    intensity: cfg.ranges.intensity.default,
    bias: cfg.ranges.bias.default,
    metal: cfg.metals[0].symbol,
    records: []
  };

  let chart = null;
  let current = null;
  let rafId = 0;
  let lastTs = 0;
  let canvas = null;
  let ctx = null;
  let viewW = 0;
  let viewH = 0;
  let dpr = 1;
  const photons = [];
  const electrons = [];
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function metal() {
    for (let i = 0; i < cfg.metals.length; i++) {
      if (cfg.metals[i].symbol === state.metal) return cfg.metals[i];
    }
    return cfg.metals[0];
  }

  function model() {
    const m = metal();
    const E = P.photonEnergyEv(state.lambda);
    const emitting = P.emits(state.lambda, m.workEv);
    const u0 = P.stoppingVoltage(state.lambda, m.workEv);
    const ek = P.maxKineticEv(state.lambda, m.workEv);
    const i = P.currentUa({
      lambdaNm: state.lambda,
      workEv: m.workEv,
      biasV: state.bias,
      intensityPct: state.intensity,
      maxUa: MAX_I
    });
    return {
      m: m,
      E: E,
      ek: ek,
      u0: u0,
      i: i,
      emitting: emitting,
      lambda0: P.thresholdNm(m.workEv),
      nu: P.frequencyTHz(state.lambda)
    };
  }

  function fmt(value, digits) {
    if (!isFinite(value)) return '—';
    return Number(value).toFixed(digits);
  }

  function paintRange(el) {
    if (!el) return;
    const min = Number(el.min);
    const max = Number(el.max);
    const value = Number(el.value);
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--fill', pct.toFixed(2) + '%');
  }

  /* ---------- 初始化 ---------- */

  function init() {
    try {
      buildMetalOptions();
      bindControls();
      initCanvas();
      initChart();
      renderFormulas();
      renderTable();
      syncControls();
      update();
      initReveal();
      startLoop();
    } catch (err) {
      window.__errors.push('init: ' + (err && err.message ? err.message : String(err)));
      if (window.console) console.error(err);
    }
  }

  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (let k = 0; k < els.length; k++) els[k].classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (let k = 0; k < els.length; k++) io.observe(els[k]);
    setTimeout(function () {
      for (let k = 0; k < els.length; k++) els[k].classList.add('is-visible');
    }, 2400);
  }

  function buildMetalOptions() {
    const select = $('metal');
    select.innerHTML = '';
    cfg.metals.forEach(function (m) {
      const opt = document.createElement('option');
      opt.value = m.symbol;
      opt.textContent = m.name + ' ' + m.symbol + ' · W=' + m.workEv.toFixed(2) + ' eV';
      select.appendChild(opt);
    });
    select.value = state.metal;
  }

  function bindControls() {
    $('lambda').addEventListener('input', function (e) {
      clearPresetActive();
      state.lambda = Number(e.target.value);
      update();
    });
    $('intensity').addEventListener('input', function (e) {
      clearPresetActive();
      state.intensity = Number(e.target.value);
      update();
    });
    $('bias').addEventListener('input', function (e) {
      clearPresetActive();
      state.bias = Number(e.target.value);
      update();
    });
    $('metal').addEventListener('change', function (e) {
      clearPresetActive();
      state.metal = e.target.value;
      update();
    });

    cfg.presets.forEach(function (p) {
      const btn = $('preset-' + p.id);
      if (!btn) return;
      btn.addEventListener('click', function () { applyPreset(p); });
    });

    $('record').addEventListener('click', recordRow);
    $('export').addEventListener('click', exportCsv);
  }

  function clearPresetActive() {
    const buttons = document.querySelectorAll('.presets .btn-preset');
    for (let k = 0; k < buttons.length; k++) {
      buttons[k].classList.remove('is-active');
      buttons[k].setAttribute('aria-pressed', 'false');
    }
  }

  function setPresetActive(id) {
    clearPresetActive();
    const btn = $('preset-' + id);
    if (!btn) return;
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
  }

  function applyPreset(p) {
    state.metal = p.metal;
    state.lambda = p.lambda;
    state.intensity = p.intensity;
    state.bias = p.bias;
    syncControls();
    setPresetActive(p.id);
    update();
  }

  function syncControls() {
    $('lambda').value = String(state.lambda);
    $('intensity').value = String(state.intensity);
    $('bias').value = String(state.bias);
    $('metal').value = state.metal;
  }

  /* ---------- 读数与状态 ---------- */

  function update() {
    current = model();
    const c = current;

    // 不发射或电流为零时，清掉上一状态残留的电子，避免画面与读数矛盾
    if (!c.emitting || c.i <= 0) electrons.length = 0;

    $('lambda-out').textContent = state.lambda + ' nm';
    $('intensity-out').textContent = state.intensity + '%';
    $('bias-out').textContent = fmt(state.bias, 2) + ' V';
    paintRange($('lambda'));
    paintRange($('intensity'));
    paintRange($('bias'));
    $('hud-lambda').textContent = state.lambda + ' nm';
    $('hud-energy').textContent = fmt(c.E, 2) + ' eV';

    $('r-lambda').textContent = state.lambda + ' nm';
    $('r-nu').textContent = fmt(c.nu, 1) + ' THz';
    $('r-energy').textContent = fmt(c.E, 2) + ' eV';
    $('r-work').textContent = fmt(c.m.workEv, 2) + ' eV';
    $('r-kinetic').textContent = fmt(c.ek, 2) + ' eV';
    $('r-u0').textContent = fmt(c.u0, 2) + ' V';
    $('r-current').textContent = fmt(c.i, 2) + ' μA';

    $('metal-hint').textContent =
      c.m.name + '：逸出功 ' + c.m.workEv.toFixed(2) + ' eV，截止波长 ' + fmt(c.lambda0, 1) + ' nm';

    updateStatus(c);
    updateChart(c);
    drawStage(c);
  }

  function updateStatus(c) {
    const status = $('status');
    const detail = $('status-detail');
    let kind = 'none';
    let text = '';
    let note = '';

    if (state.intensity === 0) {
      kind = 'none';
      text = '光强为 0';
      note = '没有光子到达金属，电流为零；但光子能量的读数仍然有效。';
    } else if (!c.emitting) {
      const gap = c.m.workEv - c.E;
      if (Math.abs(gap) <= 0.005) {
        kind = 'critical';
        text = '临界截止';
        note = '光子能量恰好等于逸出功，最大初动能约为 0；按截止处理。';
      } else {
        kind = 'none';
        text = '无光电子发射';
        note = '光子能量 E=' + fmt(c.E, 2) + ' eV 小于逸出功 W=' + fmt(c.m.workEv, 2) +
          ' eV。把波长调到 ' + fmt(c.lambda0, 0) + ' nm 以下才可能发射。';
      }
    } else if (c.i <= 1e-9) {
      kind = 'critical';
      text = '电子被遏止';
      note = '电子已逸出，但反向电压达到 ' + fmt(c.u0, 2) + ' V，电流被完全阻止。';
    } else {
      kind = 'ok';
      text = '有光电流';
      note = 'E=' + fmt(c.E, 2) + ' eV > W=' + fmt(c.m.workEv, 2) + ' eV，最大初动能 ' +
        fmt(c.ek, 2) + ' eV；反向电压加至 −' + fmt(c.u0, 2) + ' V 时电流归零。';
    }

    status.textContent = text;
    status.setAttribute('data-state', kind);
    const hudStatus = $('hud-status');
    if (hudStatus) {
      hudStatus.textContent = text;
      hudStatus.setAttribute('data-state', kind);
    }
    detail.textContent = note;
  }

  /* ---------- 图表 ---------- */

  function initChart() {
    if (!window.Chart) {
      window.__errors.push('Chart.js 未加载');
      return;
    }
    const el = $('iv-chart');
    if (!el) return;
    chart = new window.Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'I–U 曲线',
            data: [],
            borderColor: '#3fd8e8',
            backgroundColor: function (context) {
              const chart = context.chart;
              const area = chart.chartArea;
              if (!area) return 'rgba(63, 216, 232, 0.06)';
              const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              g.addColorStop(0, 'rgba(63, 216, 232, 0.30)');
              g.addColorStop(1, 'rgba(63, 216, 232, 0.01)');
              return g;
            },
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0
          },
          {
            label: '工作点',
            data: [],
            borderColor: '#071321',
            backgroundColor: '#f5a524',
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            showLine: false
          },
          {
            label: '遏止电压',
            data: [],
            borderColor: '#ff6b6b',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(5, 14, 26, 0.94)',
            borderColor: 'rgba(104, 210, 235, 0.35)',
            borderWidth: 1,
            titleColor: '#e8f4fb',
            bodyColor: '#a9bfd2',
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function (item) {
                return item.dataset.label + '：' + Number(item.parsed.y).toFixed(2) + ' μA';
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: -3,
            max: 3,
            border: { display: false },
            title: { display: true, text: '电压 U / V', color: '#6f879c', font: { size: 10 } },
            grid: { color: 'rgba(104, 190, 220, 0.08)' },
            ticks: { color: '#6f879c', stepSize: 1, font: { size: 10 } }
          },
          y: {
            min: 0,
            max: MAX_I * 1.08,
            border: { display: false },
            title: { display: true, text: '光电流 I / μA', color: '#6f879c', font: { size: 10 } },
            grid: { color: 'rgba(104, 190, 220, 0.08)' },
            ticks: { color: '#6f879c', stepSize: 1, font: { size: 10 } }
          }
        }
      }
    });
  }

  function updateChart(c) {
    if (!chart) return;
    const series = P.ivSeries({
      lambdaNm: state.lambda,
      workEv: c.m.workEv,
      intensityPct: state.intensity,
      maxUa: MAX_I
    }, -3, 3, 121);

    chart.data.datasets[0].data = series.v.map(function (v, k) {
      return { x: v, y: series.i[k] };
    });
    chart.data.datasets[1].data = [{ x: state.bias, y: c.i }];
    chart.data.datasets[2].data = c.emitting
      ? [{ x: -c.u0, y: 0 }, { x: -c.u0, y: MAX_I * 1.04 }]
      : [];
    chart.update('none');
  }

  /* ---------- Canvas ---------- */

  function initCanvas() {
    canvas = $('lab-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }
    for (let k = 0; k < 14; k++) {
      photons.push({ t: Math.random(), spread: Math.random() * 2 - 1, speed: 0.35 + Math.random() * 0.18 });
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    if (!viewW || !viewH) return;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (current) drawStage(current);
  }

  function wavelengthColor(nm) {
    if (nm < 380) return { r: 126, g: 96, b: 210, uv: true };
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else { r = 1; }
    let f = 1;
    if (nm < 420) f = 0.35 + 0.65 * (nm - 380) / 40;
    else if (nm > 700) f = 0.35 + 0.65 * (780 - nm) / 80;
    const gamma = 0.85;
    return {
      r: Math.round(255 * Math.pow(Math.max(0, r) * f, gamma)),
      g: Math.round(255 * Math.pow(Math.max(0, g) * f, gamma)),
      b: Math.round(255 * Math.pow(Math.max(0, b) * f, gamma)),
      uv: false
    };
  }

  function drawStage(c) {
    if (!ctx || !viewW || !viewH) return;
    ctx.clearRect(0, 0, viewW, viewH);

    const pad = Math.max(26, viewW * 0.05);
    const lampX = pad + 8;
    const lampY = viewH * 0.42;
    const plateX = viewW * 0.45;
    const anodeX = viewW * 0.79;
    const topY = viewH * 0.22;
    const bottomY = viewH * 0.78;
    const color = wavelengthColor(state.lambda);

    // 光源
    const glow = ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 42);
    glow.addColorStop(0, 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',0.55)');
    glow.addColorStop(1, 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lampX, lampY, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
    ctx.beginPath();
    ctx.arc(lampX, lampY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8fa8bd';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('光源', lampX, lampY + 30);
    if (color.uv) {
      ctx.fillStyle = '#a98bff';
      ctx.fillText('紫外', lampX, lampY + 46);
    }

    // 阴极板
    const plateGrad = ctx.createLinearGradient(plateX, 0, plateX + 12, 0);
    plateGrad.addColorStop(0, '#3fd8e8');
    plateGrad.addColorStop(1, '#0b6f86');
    ctx.fillStyle = plateGrad;
    roundRect(plateX, topY, 12, bottomY - topY, 6);
    ctx.fill();

    // 阳极
    ctx.fillStyle = '#405a70';
    roundRect(anodeX, topY, 7, bottomY - topY, 3);
    ctx.fill();

    // 导线与电流表
    ctx.strokeStyle = 'rgba(104, 190, 220, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plateX + 6, bottomY + 6);
    ctx.lineTo(plateX + 6, viewH - 34);
    ctx.lineTo(anodeX + 3, viewH - 34);
    ctx.lineTo(anodeX + 3, bottomY + 6);
    ctx.stroke();

    // 标签
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a9bfd2';
    ctx.fillText('金属（阴极）', plateX + 6, topY - 12);
    ctx.fillStyle = '#6f879c';
    ctx.fillText('阳极', anodeX + 3, topY - 12);

    // 光子
    const activePhotons = Math.max(0, Math.round(state.intensity / 100 * 12));
    const beamTop = lampY - 26;
    const beamBottom = lampY + 26;
    for (let k = 0; k < activePhotons && k < photons.length; k++) {
      const ph = photons[k];
      const x = lampX + (plateX - lampX) * ph.t;
      const y = lampY + ph.spread * 24 * (1 - ph.t * 0.25);
      ctx.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (0.35 + 0.55 * ph.t) + ')';
      ctx.beginPath();
      ctx.arc(x, y, color.uv ? 3 : 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (color.uv) {
        ctx.strokeStyle = 'rgba(126, 96, 210, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 电子
    for (let k = electrons.length - 1; k >= 0; k--) {
      const e = electrons[k];
      const x = plateX + 12 + (anodeX - plateX - 12) * e.t;
      const y = e.y + Math.sin(e.t * Math.PI) * e.bend;
      ctx.fillStyle = 'rgba(63, 216, 232, ' + (0.35 + 0.45 * (1 - e.t)) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(63, 216, 232, 0.25)';
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x - 2, y);
      ctx.stroke();
    }

    // 电流表
    const meterW = 128;
    const meterH = 46;
    const mx = viewW - meterW - 16;
    const my = viewH - meterH - 14;
    ctx.fillStyle = 'rgba(4, 12, 22, 0.88)';
    ctx.strokeStyle = 'rgba(104, 210, 235, 0.35)';
    ctx.lineWidth = 1;
    roundRect(mx, my, meterW, meterH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6f879c';
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText('光电流 I', mx + 12, my + 16);
    ctx.fillStyle = c && c.i > 0 ? '#3fd8e8' : '#6f879c';
    ctx.font = '600 16px "Cascadia Code", Consolas, monospace';
    ctx.fillText((c ? c.i.toFixed(2) : '0.00') + ' μA', mx + 12, my + 36);

    // 无发射提示
    if (c && !c.emitting) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 107, 107, 0.9)';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText('光子能量不足，无电子逸出', (plateX + anodeX) / 2, viewH - 54);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function startLoop() {
    if (reduceMotion) return;
    const loop = function (ts) {
      rafId = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      step(dt);
      if (current) drawStage(current);
    };
    rafId = requestAnimationFrame(loop);
  }

  function step(dt) {
    if (!current) return;
    const activePhotons = Math.max(0, Math.round(state.intensity / 100 * 12));

    for (let k = 0; k < photons.length; k++) {
      const ph = photons[k];
      if (k >= activePhotons) { ph.t = 0; continue; }
      ph.t += dt * ph.speed;
      if (ph.t >= 1) {
        ph.t = 0;
        ph.spread = Math.random() * 2 - 1;
        if (current.emitting && current.i > 0 && electrons.length < 14) {
          if (Math.random() < 0.25 + (current.i / MAX_I) * 0.55) {
            electrons.push({
              t: 0,
              y: viewH * 0.42 + (Math.random() * 2 - 1) * (viewH * 0.16),
              bend: (Math.random() * 2 - 1) * 18,
              speed: 0.45 + 0.5 * Math.sqrt(current.ek / 1.6)
            });
          }
        }
      }
    }

    for (let k = electrons.length - 1; k >= 0; k--) {
      electrons[k].t += dt * electrons[k].speed;
      if (electrons[k].t >= 1) electrons.splice(k, 1);
    }
  }

  /* ---------- 公式 ---------- */

  function renderFormulas() {
    if (!window.katex) return;
    const nodes = document.querySelectorAll('[data-tex]');
    for (let k = 0; k < nodes.length; k++) {
      const el = nodes[k];
      const tex = el.getAttribute('data-tex');
      if (!tex) continue;
      try {
        window.katex.render(tex, el, {
          displayMode: el.classList.contains('formula') && !el.classList.contains('inline-formula'),
          throwOnError: false
        });
      } catch (err) {
        window.__errors.push('katex: ' + (err && err.message ? err.message : String(err)));
      }
    }
  }

  /* ---------- 记录与导出 ---------- */

  function recordRow() {
    const c = current || model();
    state.records.push({
      metal: c.m.symbol,
      lambda: state.lambda,
      intensity: state.intensity,
      bias: state.bias,
      energy: c.E,
      kinetic: c.ek,
      current: c.i
    });
    renderTable();
  }

  function renderTable() {
    const tbody = $('data-table').querySelector('tbody');
    tbody.innerHTML = '';
    if (state.records.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'empty';
      td.textContent = '还没有记录。调好参数后点“记录当前参数”。';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      const labels = ['序号', '金属', 'λ / nm', '光强 / %', 'U / V', 'E / eV', 'Eₖ / eV', 'I / μA'];
      state.records.forEach(function (r, idx) {
        const tr = document.createElement('tr');
        [
          String(idx + 1), r.metal, String(r.lambda), String(r.intensity),
          r.bias.toFixed(2), r.energy.toFixed(2), r.kinetic.toFixed(2), r.current.toFixed(2)
        ].forEach(function (text, cellIndex) {
          const td = document.createElement('td');
          td.textContent = text;
          td.setAttribute('data-label', labels[cellIndex]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    $('data-count').textContent = state.records.length + ' 条记录';
  }

  function exportCsv() {
    if (state.records.length === 0) recordRow();
    const rows = [['序号', '金属', '波长/nm', '光强/%', '电压/V', '光子能量/eV', '最大初动能/eV', '光电流/uA']];
    state.records.forEach(function (r, idx) {
      rows.push([idx + 1, r.metal, r.lambda, r.intensity, r.bias.toFixed(2), r.energy.toFixed(2), r.kinetic.toFixed(2), r.current.toFixed(2)]);
    });
    const csv = '\uFEFF' + rows.map(function (row) { return row.join(','); }).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photoelectric-data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- 自动化辅助 ---------- */

  window.__read = function () {
    const c = current || model();
    return {
      lambda: state.lambda,
      intensity: state.intensity,
      bias: state.bias,
      metal: state.metal,
      energyEv: c.E,
      kineticEv: c.ek,
      u0V: c.u0,
      currentUa: c.i,
      emitting: c.emitting,
      status: ($('status') || {}).textContent || '',
      errors: window.__errors.slice()
    };
  };

  init();
})();
