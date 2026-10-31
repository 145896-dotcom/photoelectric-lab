/* 光电效应自测：6 道单选题、即时解析、本机最佳成绩。 */
(function () {
  'use strict';

  const QUESTIONS = [
    {
      tag: '阈值',
      q: '把红光（650 nm）的强度从 10% 调到 100%，照射 Cs 金属表面，会怎样？',
      options: ['开始发射电子', '仍然不发射电子', '电子最大初动能变大', '遏止电压变大'],
      answer: 1,
      why: 'Cs 的 W = 2.14 eV，650 nm 光子只有 1.91 eV，小于 W；光强只增加光子数，不会让单个光子能量变大。'
    },
    {
      tag: '光强',
      q: '频率不变，只增大光强，下列哪个量保持不变？',
      options: ['饱和电流', '单位时间光子数', '最大初动能 Ek', '光电流'],
      answer: 2,
      why: '光强改变的是单位时间的光子数，饱和电流随之变大；光子能量 hν 不变，所以 Ek 与 U0 都不变。'
    },
    {
      tag: '频率',
      q: '对同一种金属，把波长从 500 nm 调到 400 nm，遏止电压 U0 会怎样？',
      options: ['增大', '减小', '不变', '先增后减'],
      answer: 0,
      why: '波长变短，频率 ν 变大，hν 变大；Ek = hν − W 变大，所以 U0 = Ek/e 也变大。'
    },
    {
      tag: '逸出功',
      q: '换用逸出功更大的金属，截止波长 λ0 会怎样？',
      options: ['变长', '变短', '不变', '只与光强有关'],
      answer: 1,
      why: 'λ0 = hc/W。W 越大，能发生光电效应的最长波长越短，所以截止波长变短。'
    },
    {
      tag: '遏止',
      q: '反向电压刚好等于 −U0 时，光电流为多少？',
      options: ['最大', '一半', '0', '无法确定'],
      answer: 2,
      why: 'U0 的定义就是让最快的光电子也刚好到不了阳极的电压；此时光电流为 0。'
    },
    {
      tag: '计算',
      q: 'Cs 的 W = 2.14 eV，400 nm 光子能量约 3.10 eV，最大初动能 Ek 约为？',
      options: ['0.96 eV', '2.14 eV', '3.10 eV', '5.24 eV'],
      answer: 0,
      why: 'Ek = hν − W = 3.10 − 2.14 = 0.96 eV。'
    }
  ];

  const LETTERS = ['A', 'B', 'C', 'D'];
  const KEY = 'pe.quiz.best.v1';
  const TOTAL = QUESTIONS.length;

  const $ = function (id) { return document.getElementById(id); };
  let idx = 0;
  let score = 0;
  let answered = false;
  let finished = false;
  let best = readBest();

  function readBest() {
    try {
      const v = Number(window.localStorage.getItem(KEY));
      return Number.isFinite(v) && v > 0 ? Math.min(TOTAL, v) : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeBest(v) {
    try { window.localStorage.setItem(KEY, String(v)); } catch (err) { /* file:// 下可能不可用 */ }
  }

  function renderBest() {
    $('quiz-best').textContent = best > 0 ? best + ' / ' + TOTAL : '—';
  }

  function publish() {
    window.__quiz = {
      score: score,
      total: TOTAL,
      index: idx,
      best: best,
      answered: answered,
      finished: finished
    };
  }

  function renderQuestion() {
    const q = QUESTIONS[idx];
    answered = false;
    finished = false;
    $('quiz-question').hidden = false;
    $('quiz-result').hidden = true;
    $('quiz-counter').textContent = 'QUESTION ' + String(idx + 1).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0');
    $('quiz-tag').textContent = q.tag;
    $('quiz-text').textContent = q.q;
    $('quiz-progress').style.width = (idx / TOTAL * 100) + '%';
    $('quiz-feedback').hidden = true;
    $('quiz-feedback').className = 'quiz-feedback';
    $('quiz-next').disabled = true;
    $('quiz-next').textContent = idx === TOTAL - 1 ? '查看结果' : '下一题';
    $('quiz-hint').textContent = '选择一项后查看解析';

    const box = $('quiz-options');
    box.innerHTML = '';
    q.options.forEach(function (text, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      btn.setAttribute('data-index', String(i));
      btn.innerHTML = '<span class="quiz-letter">' + LETTERS[i] + '</span><span class="quiz-option-text">' + text + '</span>';
      btn.addEventListener('click', function () { choose(i); });
      box.appendChild(btn);
    });
    publish();
  }

  function choose(i) {
    if (answered) return;
    answered = true;
    const q = QUESTIONS[idx];
    const correct = i === q.answer;
    const buttons = document.querySelectorAll('.quiz-option');
    for (let k = 0; k < buttons.length; k++) {
      buttons[k].disabled = true;
      if (k === q.answer) buttons[k].classList.add('is-correct');
      if (k === i && !correct) buttons[k].classList.add('is-wrong');
    }
    if (correct) score += 1;

    const fb = $('quiz-feedback');
    fb.hidden = false;
    fb.className = 'quiz-feedback ' + (correct ? 'is-ok' : 'is-bad');
    fb.innerHTML = '<strong>' + (correct ? '答对了' : '再想想') + '</strong><span>' + q.why + '</span>';

    $('quiz-progress').style.width = ((idx + 1) / TOTAL * 100) + '%';
    $('quiz-next').disabled = false;
    $('quiz-hint').textContent = '已作答 · 解析见上';
    publish();
  }

  function next() {
    if (!answered) return;
    if (idx === TOTAL - 1) {
      finish();
      return;
    }
    idx += 1;
    renderQuestion();
    $('quiz-text').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function finish() {
    finished = true;
    answered = true;
    if (score > best) {
      best = score;
      writeBest(best);
    }
    renderBest();
    $('quiz-question').hidden = true;
    $('quiz-result').hidden = false;
    $('result-score').textContent = score + ' / ' + TOTAL;
    let msg = '';
    if (score === TOTAL) msg = '全对。阈值、光强、遏止电压都已经分清了。';
    else if (score >= TOTAL - 1) msg = '只差一点。回实验台把错题对应的参数再拖一遍。';
    else if (score >= 3) msg = '基础还在，建议重点看阈值与遏止电压两组预设。';
    else msg = '先回实验台做三组预设对照，再回来会顺很多。';
    $('result-msg').textContent = msg;
    publish();
  }

  function restart() {
    idx = 0;
    score = 0;
    answered = false;
    finished = false;
    $('quiz-result').hidden = true;
    $('quiz-question').hidden = false;
    renderQuestion();
    $('quiz-text').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('quiz-next').addEventListener('click', next);
  $('quiz-retry').addEventListener('click', restart);
  renderBest();
  renderQuestion();
})();
