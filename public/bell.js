// ベル音（WebAudio 合成・外部ファイル/依存なし）。iPad・操作画面で共有。
// AudioContext の生成/resume/再生をここに集約し、両ページは Bell.unlock()/ring()/running() を使う。
// soundName = 音色(voice)。bellType(warn/talkEnd/final) = 鳴らすメロディ（音数で 1鈴/2鈴/3鈴）。
// 音色の一覧（ORDER）が正本。許可リストは timer-core.js の SOUNDS と一致させる（build-solo と server が両方を読む）。
(function (root) {
  'use strict';

  // --- 音色（1音をどう鳴らすか） ---
  // 各音色は関数 voice(ctx, out, f, t)。省略可能な属性：
  //   voice.step = 音と音の間隔（秒。無ければ STEP）
  //   voice.seq  = { warn, talkEnd, final } 独自のメロディ（周波数の配列。0 は休符。無ければ SEQ）
  // 「f を無視して一定の高さ」で鳴る音色（タイマー・目覚まし・ゴング・ブザー）も pitch 倍率だけは反映する。

  // ピッ ピッ … の連打を 1 本のオシレータで作る共通部品（圧電ブザー系）。freqs は交互に使う周波数。
  function pulses(ctx, out, t, freqs, on, off, n, lvl, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < n; i++) {
      const s = t + i * (on + off);
      o.frequency.setValueAtTime(freqs[i % freqs.length], s);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(lvl, s + 0.004);
      g.gain.setValueAtTime(lvl, s + on - 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, s + on);
    }
    o.connect(g).connect(out); o.start(t); o.stop(t + n * (on + off) + 0.05);
  }

  // 1 音を倍音の足し算で作る共通部品。parts = [[倍率, 相対音量, 減衰秒], ...]。attack は立ち上がり秒。
  function partials(ctx, out, f, t, parts, level, attack) {
    for (const [r, a, dec] of parts) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level * a, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05);
    }
  }

  // 卓上ベル：研究会のタイムキーパーが鳴らす呼び鈴「チーン」。高い基音（約 2.8 kHz）に、わずかにずれた
  // 倍音と打撃の短い金属音を重ね、鋭く立ち上がって 1.5 秒ほどで消える。高さは一定（打つたび同じ音）。
  // 基音を 2 本わずかにずらして重ねると本物のベルのうなりが出る。ずれは 0.07%（約 2 Hz）に抑える＝
  // 大きくすると（0.4% で約 11 Hz）1 打が「チリリリ」と連打に聞こえ、2鈴・3鈴の回数が分からなくなる。
  function voiceDeskBell(ctx, out, f, t) {
    const base = 2800 * pitch;
    partials(ctx, out, base, t, [[1, 1.0, 1.6], [1.0007, 0.7, 1.4], [1.48, 0.35, 1.0], [2.09, 0.22, 0.6], [2.76, 0.14, 0.35]], 0.4, 0.002);
    partials(ctx, out, base, t, [[1.9, 0.5, 0.04], [3.3, 0.3, 0.03]], 0.5, 0.001); // 打撃音（ごく短い）
  }
  voiceDeskBell.step = 0.55;

  // タイマー：キッチンタイマーのアラーム「ピピピピ」（2.2 kHz 矩形波・4 連）。1鈴＝1 回、2鈴＝2 回、3鈴＝3 回。
  function voiceTimer(ctx, out, f, t) { pulses(ctx, out, t, [2200 * pitch], 0.06, 0.06, 4, 0.22, 'square'); }
  voiceTimer.step = 0.8;

  // 目覚まし：高さの違う 2 音を素早く交互に「ピロピロピロ」（8 連）。
  function voiceAlarm(ctx, out, f, t) { pulses(ctx, out, t, [2600 * pitch, 1950 * pitch], 0.045, 0.025, 8, 0.2, 'square'); }
  voiceAlarm.step = 0.9;

  // ビープ：丸い電子音 1 音（正弦波）。
  function voiceBeep(ctx, out, f, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.5);
  }

  // チャイム：グロッケン/鉄琴風の倍音加算（高次倍音ほど速く減衰＝自然な金属打）。sustain で余韻の長さを変える。
  const CHIME_PARTS = [[1, 1.0, 1.6], [2.01, 0.5, 0.8], [3.0, 0.3, 0.45], [4.2, 0.16, 0.25]];
  function voiceChime(ctx, out, f, t, sustain) {
    const k = sustain || 1;
    partials(ctx, out, f, t, CHIME_PARTS.map(([r, a, d]) => [r, a, d * k]), 0.42, 0.004);
  }

  // 学校チャイム：ウェストミンスターの鐘「キーンコーンカーンコーン」。1鈴＝1 節（4 音）、2鈴＝2 節、3鈴＝3 節。
  // 1 音はチャイムの余韻を長くしたもの。節の終わりに休符（0）を 1 つ置く。
  function voiceSchool(ctx, out, f, t) { voiceChime(ctx, out, f, t, 2.0); }
  voiceSchool.step = 0.62;

  // ピンポーン：玄関チャイム／正解音。ミ→ド の 2 音を伸ばす（基音＋オクターブ上を少し）。
  function voiceDoorbell(ctx, out, f, t) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.015);
    g.gain.setValueAtTime(0.4, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); o2.connect(g2).connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.95); o2.start(t); o2.stop(t + 0.95);
  }
  voiceDoorbell.step = 0.42;

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

  // ゴング：低く長く響く銅鑼（非整数倍音・ゆっくり立ち上がる）。高さは一定（G3 基準）。
  function voiceGong(ctx, out, f, t) {
    partials(ctx, out, 196 * pitch, t, [[1, 1.0, 3.5], [1.5, 0.6, 2.8], [2.3, 0.45, 2.2], [3.1, 0.3, 1.6], [4.7, 0.18, 1.0]], 0.5, 0.03);
  }
  voiceGong.step = 1.3;

  // 木琴：乾いた短い木の音（基音＋4 倍音、速い減衰）。
  function voiceMarimba(ctx, out, f, t) {
    partials(ctx, out, f, t, [[1, 1.0, 0.5], [4, 0.35, 0.12], [9.2, 0.12, 0.06]], 0.5, 0.003);
  }
  voiceMarimba.step = 0.28;

  // ブザー：クイズの不正解音風「ブー」（低いのこぎり波）。1鈴＝ブー、2鈴＝ブーブー、3鈴＝ブーブーブー。
  function voiceBuzzer(ctx, out, f, t) {
    const dur = 0.45, lvl = 0.18;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 160 * pitch;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(lvl, t + 0.01);
    g.gain.setValueAtTime(lvl, t + dur - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  voiceBuzzer.step = 0.6;

  const VOICES = {
    deskbell: voiceDeskBell, timer: voiceTimer, alarm: voiceAlarm, school: voiceSchool, doorbell: voiceDoorbell, chime: voiceChime,
    bell: voiceBell, gong: voiceGong, marimba: voiceMarimba, beep: voiceBeep, buzzer: voiceBuzzer,
  };
  const ORDER = ['deskbell', 'timer', 'alarm', 'school', 'doorbell', 'chime', 'bell', 'gong', 'marimba', 'beep', 'buzzer'];
  const LABELS = {
    deskbell: { ja: '卓上ベル', en: 'Desk bell' },
    timer:    { ja: 'タイマー', en: 'Timer' },
    alarm:    { ja: '目覚まし', en: 'Alarm' },
    school:   { ja: '学校チャイム', en: 'School bell' },
    doorbell: { ja: 'ピンポーン', en: 'Doorbell' },
    chime:    { ja: 'チャイム', en: 'Chime' },
    bell:     { ja: 'ベル', en: 'Bell' },
    gong:     { ja: 'ゴング', en: 'Gong' },
    marimba:  { ja: '木琴', en: 'Xylophone' },
    beep:     { ja: 'ビープ', en: 'Beep' },
    buzzer:   { ja: 'ブザー', en: 'Buzzer' },
  };
  const DEFAULT = 'deskbell'; // 研究会で最も標準的な合図（呼び鈴）

  const N = { G4: 392.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0 };
  const SEQ = {
    warn:    [N.A5],                 // 1鈴：高めに1音
    talkEnd: [N.G5, N.E5],           // 2鈴：下降2音（ピンポン）
    final:   [N.G5, N.E5, N.C5],     // 3鈴：下降3音（G-E-C＝終止感）
  };
  // ウェストミンスター（ハ長調に移調）：第 1〜3 節。各節の末尾に休符。
  const W1 = [N.E5, N.C5, N.D5, N.G4, 0], W2 = [N.C5, N.D5, N.E5, N.C5, 0], W3 = [N.E5, N.D5, N.C5, N.G4, 0];
  voiceSchool.seq = { warn: W1, talkEnd: [...W1, ...W2], final: [...W1, ...W2, ...W3] };
  // ピンポーン：ミ→ド。2鈴・3鈴は休符を挟んで繰り返す。
  const DB = [N.E5, N.C5];
  voiceDoorbell.seq = { warn: DB, talkEnd: [...DB, 0, ...DB], final: [...DB, 0, ...DB, 0, ...DB] };
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
  let gap = 1.0; // 2鈴・3鈴の打つ間隔の倍率（音色ごとの基準間隔 × gap）
  function setGap(g) {
    const n = Number(g);
    if (Number.isFinite(n)) gap = Math.max(0.5, Math.min(3, n));
  }
  // 音色 soundName の、いまの設定での打つ間隔（秒）。UI の表示用。
  function interval(soundName) {
    const voice = VOICES[soundName] || VOICES[DEFAULT];
    return (voice.step || STEP) * gap;
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
    const seq = (voice.seq && voice.seq[bellType]) || SEQ[bellType]; // 音色独自のメロディがあればそれを使う
    if (!seq) return;
    const master = c.createGain();
    master.gain.value = volume;
    master.connect(c.destination);
    const step = (voice.step || STEP) * gap; // 音色ごとの基準間隔 × 利用者の倍率
    let t = c.currentTime + 0.02;
    for (const f of seq) { if (f) voice(c, master, f * pitch, t); t += step; } // 0 は休符。ピッチ倍率を適用
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

  const api = { VOICES, ORDER, LABELS, SEQ, DEFAULT, unlock, ring, running, setVolume, setPitch, setGap, interval };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bell = api;
})(typeof window !== 'undefined' ? window : null);
