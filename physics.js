/* 光电效应物理模型：纯函数，不碰 DOM。
 * UMD-lite：浏览器挂到 window.PhotoPhysics，Node 测试可 require。
 *
 * 单位约定：能量 eV，电压 V，波长 nm，频率 THz，电流 μA。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HC_EV_NM = 1239.841984;   // hc, eV·nm
  const C_M_S = 299792458;        // m/s
  const EPS = 1e-9;               // 临界判据容差，eV

  function requirePositive(value, name) {
    if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
      throw new RangeError(name + ' 必须是正数，收到 ' + value);
    }
    return value;
  }

  /** 光子能量 E = hc/λ，单位 eV */
  function photonEnergyEv(lambdaNm) {
    return HC_EV_NM / requirePositive(lambdaNm, 'lambdaNm');
  }

  /** 光频率 ν = c/λ，单位 THz */
  function frequencyTHz(lambdaNm) {
    requirePositive(lambdaNm, 'lambdaNm');
    return (C_M_S / (lambdaNm * 1e-9)) / 1e12;
  }

  /** 截止波长 λ0 = hc/W，单位 nm */
  function thresholdNm(workEv) {
    return HC_EV_NM / requirePositive(workEv, 'workEv');
  }

  /** 最大初动能 Ek = hν - W，小于 0 时钳到 0 */
  function maxKineticEv(lambdaNm, workEv) {
    requirePositive(workEv, 'workEv');
    return Math.max(0, photonEnergyEv(lambdaNm) - workEv);
  }

  /** 是否发生光电子发射：E - W > 容差 */
  function emits(lambdaNm, workEv) {
    requirePositive(workEv, 'workEv');
    return photonEnergyEv(lambdaNm) - workEv > EPS;
  }

  /** 遏止电压 U0，单位 V；不发射时为 0 */
  function stoppingVoltage(lambdaNm, workEv) {
    return emits(lambdaNm, workEv) ? maxKineticEv(lambdaNm, workEv) : 0;
  }

  /** 饱和光电流，单位 μA */
  function saturationUa(intensityPct, maxUa) {
    const max = typeof maxUa === 'number' && maxUa > 0 ? maxUa : 5;
    const pct = Math.min(100, Math.max(0, Number(intensityPct) || 0));
    return max * pct / 100;
  }

  /**
   * 教学简化 I–U 模型：
   *   E<=W: 0；U>=0: I_sat；-U0<U<0: 线性衰减；U<=-U0: 0
   */
  function currentUa(opts) {
    const o = opts || {};
    const lambdaNm = o.lambdaNm;
    const workEv = o.workEv;
    const biasV = typeof o.biasV === 'number' ? o.biasV : 0;
    const intensityPct = typeof o.intensityPct === 'number' ? o.intensityPct : 100;

    if (!emits(lambdaNm, workEv)) return 0;
    const u0 = stoppingVoltage(lambdaNm, workEv);
    const iSat = saturationUa(intensityPct, o.maxUa);
    if (iSat === 0) return 0;
    if (biasV >= 0) return iSat;
    if (biasV <= -u0) return 0;
    return iSat * (1 - Math.abs(biasV) / u0);
  }

  /** 生成 I–U 采样点，返回 { v: number[], i: number[] } */
  function ivSeries(opts, vMin, vMax, n) {
    const lo = typeof vMin === 'number' ? vMin : -3;
    const hi = typeof vMax === 'number' ? vMax : 3;
    const count = typeof n === 'number' && n > 1 ? n : 121;
    const v = [];
    const i = [];
    for (let k = 0; k < count; k++) {
      const x = lo + (hi - lo) * k / (count - 1);
      v.push(x);
      i.push(currentUa(Object.assign({}, opts, { biasV: x })));
    }
    return { v: v, i: i };
  }

  return {
    HC_EV_NM: HC_EV_NM,
    C_M_S: C_M_S,
    photonEnergyEv: photonEnergyEv,
    frequencyTHz: frequencyTHz,
    thresholdNm: thresholdNm,
    maxKineticEv: maxKineticEv,
    emits: emits,
    stoppingVoltage: stoppingVoltage,
    saturationUa: saturationUa,
    currentUa: currentUa,
    ivSeries: ivSeries
  };
});
