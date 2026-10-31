/* 光电效应模型单元测试：node --test tests/physics.test.cjs */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../physics.js');
const cfg = require('../config.js');

const CS = cfg.metals.find(m => m.symbol === 'Cs').workEv;
const ZN = cfg.metals.find(m => m.symbol === 'Zn').workEv;

function near(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol,
    label + ' 期望 ' + expected + ' ±' + tol + '，实际 ' + actual);
}

test('1. Cs / 400 nm：能量、初动能、遏止电压、饱和电流', () => {
  near(P.photonEnergyEv(400), 3.10, 0.01, 'E');
  near(P.maxKineticEv(400, CS), 0.96, 0.01, 'Ek');
  near(P.stoppingVoltage(400, CS), 0.96, 0.01, 'U0');
  near(P.currentUa({ lambdaNm: 400, workEv: CS, biasV: 0, intensityPct: 100 }), 5.00, 0.02, 'I');
});

test('2. Cs / 600 nm：低于截止频率，不发射', () => {
  near(P.photonEnergyEv(600), 2.07, 0.01, 'E');
  assert.equal(P.emits(600, CS), false);
  assert.equal(P.currentUa({ lambdaNm: 600, workEv: CS, biasV: 0, intensityPct: 100 }), 0);
  near(P.thresholdNm(CS), 579.4, 0.1, 'lambda0');
});

test('3. Cs / 400 nm / −0.50 V：反向电流线性衰减', () => {
  near(P.currentUa({ lambdaNm: 400, workEv: CS, biasV: -0.5, intensityPct: 100 }), 2.39, 0.02, 'I');
});

test('4. Cs / 400 nm / −1.20 V：超过遏止电压，电流为零', () => {
  assert.equal(P.currentUa({ lambdaNm: 400, workEv: CS, biasV: -1.2, intensityPct: 100 }), 0);
});

test('5. Zn / 250 nm：紫外才能打出电子', () => {
  near(P.photonEnergyEv(250), 4.96, 0.01, 'E');
  near(P.maxKineticEv(250, ZN), 0.63, 0.01, 'Ek');
  near(P.stoppingVoltage(250, ZN), 0.63, 0.01, 'U0');
  near(P.currentUa({ lambdaNm: 250, workEv: ZN, biasV: 0, intensityPct: 100 }), 5.00, 0.02, 'I');
});

test('6. Cs / 400 nm：光强减半只改电流，不改初动能', () => {
  const iFull = P.currentUa({ lambdaNm: 400, workEv: CS, biasV: 0, intensityPct: 100 });
  const iHalf = P.currentUa({ lambdaNm: 400, workEv: CS, biasV: 0, intensityPct: 50 });
  near(iHalf, iFull / 2, 0.02, 'I 随光强线性减半');
  near(P.maxKineticEv(400, CS), 0.96, 0.01, 'Ek 不随光强变');
});

test('7. Cs / 579.37 nm：临界点按不发射处理', () => {
  const e = P.photonEnergyEv(579.37);
  near(e, CS, 0.01, 'E 接近 W');
  assert.equal(P.emits(579.37, CS), false);
  assert.equal(P.stoppingVoltage(579.37, CS), 0);
});

test('8. 频率换算与 I–U 采样', () => {
  near(P.frequencyTHz(400), 749.5, 0.5, 'nu');
  const s = P.ivSeries({ lambdaNm: 400, workEv: CS, intensityPct: 100 }, -3, 3, 121);
  assert.equal(s.v.length, 121);
  assert.equal(s.i.length, 121);
  assert.ok(s.i.every(x => x >= 0 && x <= 5.0000001));
});
