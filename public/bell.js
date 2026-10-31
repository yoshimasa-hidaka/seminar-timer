// ベル音（WebAudio 合成・外部ファイル/依存なし）。iPad・操作画面で共有。
// AudioContext の生成/resume/再生をここに集約し、両ページは Bell.unlock()/ring()/running() を使う。
// soundName = 音色(voice)。bellType(warn/talkEnd/final) = 鳴らすメロディ（音数で 1鈴/2鈴/3鈴）。
// 音色の一覧（ORDER）が正本。許可リストは timer-core.js の SOUNDS と一致させる（build-solo と server が両方を読む）。
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

  // タイマー：キッチンタイマー／電子時計のアラーム音（圧電ブザー風「ピピピピ」）。
  // 1鈴＝「ピピピピ」1回、2鈴＝2回、3鈴＝3回。音程はメロディ(f)を使わず一定（pitch スライダーだけ効く）。
  // 矩形波の立ち上がり/立ち下がりはクリック防止に数 ms のランプを入れる。
  function voiceTimer(ctx, out, f, t) {
    const hz = 2200 * pitch, on = 0.06, off = 0.06, pips = 4, lvl = 0.22;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < pips; i++) {
      const s = t + i * (on + off);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(lvl, s + 0.004);
      g.gain.setValueAtTime(lvl, s + on - 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, s + on);
    }
    o.connect(g).connect(out); o.start(t); o.stop(t + pips * (on + off) + 0.05);
  }
  voiceTimer.step = 0.8; // 「ピピピピ」の間隔（他の音色は STEP）

  const VOICES = { timer: voiceTimer, chime: voiceChime, bell: voiceBell, beep: voiceBeep };
  const ORDER = ['timer', 'chime', 'bell', 'beep'];
  const LABELS = {
    timer: { ja: 'タイマー', en: 'Timer' },
    chime: { ja: 'チャイム', en: 'Chime' },
    bell:  { ja: 'ベル', en: 'Bell' },
    beep:  { ja: 'ビープ', en: 'Beep' },
  };
  const DEFAULT = 'timer';

  const N = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.0 };
  const SEQ = {
    warn:    [N.A5],                 // 1鈴：高めに1音
    talkEnd: [N.G5, N.E5],           // 2鈴：下降2音（ピンポン）
    final:   [N.G5, N.E5, N.C5],     // 3鈴：下降3音（G-E-C＝終止感）
  };
  const STEP = 0.34;

  // --- AudioContext 管理（集約） ---
  let ctx = null;
  let volume = 0.9; // 0–1（master gain）
  function setVolume(v) {
    const n = Number(v);
    if (Number.isFinite(n)) volume = Math.max(0, Math.min(1, n));
  }
  let pitch = 1.0; // 全音の周波数倍率（音の高さ）
  function setPitch(p) {
    const n = Number(p);
    if (Number.isFinite(n)) pitch = Math.max(0.25, Math.min(4, n));
  }

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
    master.gain.value = volume;
    master.connect(c.destination);
    const step = voice.step || STEP; // 音色ごとの間隔（タイマー音は 1 音が長い）
    let t = c.currentTime + 0.02;
    for (const f of seq) { voice(c, master, f * pitch, t); t += step; } // ピッチ倍率を適用
    // 後始末（master ノードのリーク防止）
    const ms = (seq.length * step + 2.5) * 1000;
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

  const api = { VOICES, ORDER, LABELS, SEQ, DEFAULT, unlock, ring, running, setVolume, setPitch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bell = api;
})(typeof window !== 'undefined' ? window : null);
