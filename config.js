/* 光电效应页面配置：常数、材料、范围、预设。
 * UMD-lite：浏览器挂到 window.PHOTO_CONFIG，Node 测试可 require。
 */
(function (root, factory) {
  const cfg = factory();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  else root.PHOTO_CONFIG = cfg;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    constants: {
      h: 6.62607015e-34,   // J·s
      c: 299792458,        // m/s
      e: 1.602176634e-19,  // C
      hcEvNm: 1239.841984  // eV·nm
    },

    // 逸出功取 CRC 常用值，不同晶面/测量法有 ±0.1 eV 差异
    metals: [
      { symbol: 'Cs', name: '铯', workEv: 2.14 },
      { symbol: 'K',  name: '钾', workEv: 2.30 },
      { symbol: 'Na', name: '钠', workEv: 2.36 },
      { symbol: 'Zn', name: '锌', workEv: 4.33 },
      { symbol: 'Cu', name: '铜', workEv: 4.65 },
      { symbol: 'Ag', name: '银', workEv: 4.26 }
    ],

    ranges: {
      lambda:    { min: 200, max: 700, step: 5,    default: 400 },
      intensity: { min: 0,   max: 100, step: 1,    default: 100 },
      bias:      { min: -3,  max: 3,   step: 0.05, default: 0 }
    },

    maxCurrentUa: 5,

    presets: [
      { id: 'red',      label: '红光强光', metal: 'Cs', lambda: 650, intensity: 100, bias: 0 },
      { id: 'uv',       label: '紫外弱光', metal: 'Zn', lambda: 250, intensity: 30,  bias: 0 },
      { id: 'cutoff',   label: '刚好截止', metal: 'Cs', lambda: 400, intensity: 100, bias: -0.96 },
      { id: 'reverse',  label: '反向截止', metal: 'Cs', lambda: 400, intensity: 100, bias: -1.2 }
    ]
  };
});
