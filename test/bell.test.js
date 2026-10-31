#!/usr/bin/env node
// bell.js の検査（`node test/bell.test.js`）。実機の WebAudio は無いので、偽の AudioContext で
// 「スケジュールが実機で例外になる条件」を調べる：時刻の逆行、指数ランプの 0 到達、音の出ない音色、
// 音色一覧と timer-core の許可リストのずれ。
'use strict';
const assert = require('assert');

const events = [];       // [param, kind, value, time]
let oscillators = 0;
class Param {
  constructor(name) { this.name = name; this.value = 0; }
  setValueAtTime(v, t) { events.push([this.name, 'set', v, t]); }
  exponentialRampToValueAtTime(v, t) { if (!(v > 0)) throw new Error(`exponential ramp to ${v} on ${this.name}`); events.push([this.name, 'ramp', v, t]); }
}
class FakeNode {
  constructor() { this.gain = new Param('gain'); this.frequency = new Param('frequency'); }
  connect(n) { return n; }
  disconnect() {}
  start(t) { this.t0 = t; }
  stop(t) { assert.ok(t > this.t0, 'stop after start'); oscillators++; }
}
class FakeAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 100; this.destination = {}; }
  createOscillator() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  resume() { return Promise.resolve(); }
}
global.window = { AudioContext: FakeAudioContext };
const Bell = require('../public/bell.js');
const TimerCore = require('../public/timer-core.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('  ok', name); }

t('allow-list in timer-core matches the voices in bell.js (same order)', () => {
  assert.deepStrictEqual(TimerCore.SOUNDS, Bell.ORDER);
  assert.ok(Bell.ORDER.includes(Bell.DEFAULT));
  assert.strictEqual(TimerCore.defaultState().bellSound, Bell.DEFAULT);
  for (const name of Bell.ORDER) {
    assert.strictEqual(typeof Bell.VOICES[name], 'function', name);
    assert.ok(Bell.LABELS[name] && Bell.LABELS[name].ja && Bell.LABELS[name].en, `labels for ${name}`);
  }
});

Bell.unlock();
for (const name of Bell.ORDER) {
  for (const type of ['warn', 'talkEnd', 'final']) {
    t(`${name}/${type}: schedules sound without WebAudio-invalid automation`, () => {
      events.length = 0; oscillators = 0;
      Bell.ring(type, name);
      assert.ok(oscillators > 0, 'at least one oscillator');
      // 同じ param への時刻は単調非減少（実機では過去時刻の指定は無視され音が崩れる）
      const byParam = new Map();
      for (const [param, , , time] of events) {
        assert.ok(Number.isFinite(time) && time >= 100, `finite time ${time}`);
        byParam.set(param, (byParam.get(param) || []).concat(time));
      }
      // gain のイベントはオシレータごとに別ノードだが、ここでは全体で「おおむね増加」ではなく各呼び出し内の順序だけを見る：
      // 1 本のゲインに属するイベントは連続して push されるので、隣接ペアで時刻が戻る回数を数える
      let backwards = 0;
      const gains = events.filter((e) => e[0] === 'gain');
      for (let i = 1; i < gains.length; i++) if (gains[i][3] < gains[i - 1][3] - 1e-9 && gains[i][1] !== 'set') backwards++;
      assert.strictEqual(backwards, 0, 'no ramp scheduled before the previous event');
    });
  }
}

t('1/2/3 bells get longer for every voice', () => {
  for (const name of Bell.ORDER) {
    const span = (type) => { events.length = 0; Bell.ring(type, name); return Math.max(...events.map((e) => e[3])); };
    const a = span('warn'), b = span('talkEnd'), c = span('final');
    assert.ok(a < b && b < c, `${name}: ${a} < ${b} < ${c}`);
  }
});

t('rests (0) in a melody are skipped, not played', () => {
  events.length = 0; oscillators = 0;
  Bell.ring('talkEnd', 'doorbell'); // ミ ド 休 ミ ド → 4 音 × 2 オシレータ
  assert.strictEqual(oscillators, 8);
});

t('unknown voice falls back to the default', () => {
  events.length = 0; oscillators = 0;
  Bell.ring('warn', 'no-such-voice');
  assert.ok(oscillators > 0);
});

console.log(`bell.test.js: ${n} tests passed`);
