// ベル音（WebAudio 合成・外部ファイル/依存なし）。iPad・操作画面で共有。
// AudioContext の生成/resume/再生をここに集約し、両ページは Bell.unlock()/ring()/running() を使う。
// soundName = 音色(voice)。bellType(warn/talkEnd/final) = 鳴らすメロディ（音数で 1鈴/2鈴/3鈴）。
(function (root) {
  'use strict';

  // --- 音色（1音をどう鳴らすか） ---

  function voiceBeep(ctx, out, f, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.5);
  }

  // チャイム：グロッケン/鉄琴風の倍音加算（高次倍音ほど速く減衰＝自然な金属打）
  function voiceChime(ctx, out, f, t) {
    const parts = [[1, 1.0, 1.6], [2.01, 0.5, 0.8], [3.0, 0.3, 0.45], [4.2, 0.16, 0.25]];
    for (const [r, a, dec] of parts) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42 * a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05);
    }
  }

  // ベル：FM 合成の金属ベル（チューブラーベル風・長い減衰）
  function voiceBell(ctx, out, f, t) {
    const dur = 1.8, ratio = 1.41;
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * ratio;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.12, t + dur);
    mod.connect(mg); mg.connect(car.frequency);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.34, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(amp).connect(out);
    car.start(t); car.stop(t + dur); mod.start(t); mod.stop(t + dur);
  }

  const VOICES = { chime: voiceChime, bell: voiceBell, beep: voiceBeep };
  const ORDER = ['chime', 'bell', 'beep'];
  const LABELS = {
    chime: { ja: 'チャイム', en: 'Chime' },
    bell:  { ja: 'ベル', en: 'Bell' },
    beep:  { ja: 'ビープ', en: 'Beep' },
  };
  const DEFAULT = 'chime';

  const N = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.0 };
  const SEQ = {
    warn:    [N.A5],                 // 1鈴：高めに1音
    talkEnd: [N.G5, N.E5],           // 2鈴：下降2音（ピンポン）
    final:   [N.G5, N.E5, N.C5],     // 3鈴：下降3音（G-E-C＝終止感）
  };
  const STEP = 0.34;

  // --- AudioContext 管理（集約） ---
  let ctx = null;

  function getCtx() {
    try {
      if (!ctx || ctx.state === 'closed') {           // closed なら作り直す
        const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return null;
        ctx = new AC();
      }
    } catch (_) { return null; }
    return ctx;
  }

  // ユーザー操作のタイミングで呼ぶ：生成＋resume（解錠）
  function unlock() {
    const c = getCtx();
    if (c && c.state !== 'running') { try { c.resume(); } catch (_) {} }
    return c;
  }

  function running() { return !!ctx && ctx.state === 'running'; }

  function playInto(c, bellType, soundName) {
    const voice = VOICES[soundName] || VOICES[DEFAULT];
    const seq = SEQ[bellType];
    if (!seq) return;
    const master = c.createGain();
    master.gain.value = 0.9;
    master.connect(c.destination);
    let t = c.currentTime + 0.02;
    for (const f of seq) { voice(c, master, f, t); t += STEP; }
    // 後始末（master ノードのリーク防止）
    const ms = (seq.length * STEP + 2.5) * 1000;
    try { setTimeout(() => { try { master.disconnect(); } catch (_) {} }, ms); } catch (_) {}
  }

  // ベルを鳴らす。suspended なら resume の完了を待ってから鳴らす（iOS 対策の肝）。
  function ring(bellType, soundName) {
    const c = getCtx();
    if (!c) return;
    const go = () => { try { playInto(c, bellType, soundName); } catch (_) {} };
    if (c.state === 'running') { go(); return; }
    try {
      const p = c.resume();
      if (p && p.then) p.then(go).catch(() => {}); else go();
    } catch (_) { go(); }
  }

  const api = { VOICES, ORDER, LABELS, SEQ, DEFAULT, unlock, ring, running };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bell = api;
})(typeof window !== 'undefined' ? window : null);
