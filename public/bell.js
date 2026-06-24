// ベル音（WebAudio 合成・外部ファイル/依存なし）。iPad・操作画面で共有。
// bellType（warn/talkEnd/final）= 鳴らす回数＋基本周波数。soundName = 音色プリセット。
(function (root) {
  'use strict';

  // 音色プリセット：wave=波形, dur=各打の減衰長, interval=打の間隔,
  // partials=[倍率, ゲイン]（ベル系は非整数倍音で金属質に）
  const SOUNDS = {
    beep:  { wave: 'sine',     dur: 0.5, interval: 0.55, partials: [[1, 1.0]] },
    chime: { wave: 'triangle', dur: 0.9, interval: 0.50, partials: [[1, 0.9], [2, 0.32]] },
    bell:  { wave: 'sine',     dur: 1.3, interval: 0.50, partials: [[1, 1.0], [2.76, 0.5], [5.4, 0.25]] },
  };
  const ORDER = ['beep', 'chime', 'bell'];
  const LABELS = {
    beep:  { ja: 'ビープ', en: 'Beep' },
    chime: { ja: 'チャイム', en: 'Chime' },
    bell:  { ja: 'ベル', en: 'Bell' },
  };
  // 鈴の作法：1鈴(予鈴)/2鈴(講演終了)/3鈴(全体終了)
  const BELLS = {
    warn:    { times: 1, freq: 880 },
    talkEnd: { times: 2, freq: 660 },
    final:   { times: 3, freq: 523 },
  };

  function playBell(ctx, bellType, soundName) {
    if (!ctx) return;
    const s = SOUNDS[soundName] || SOUNDS.beep;
    const b = BELLS[bellType];
    if (!b) return;
    let t = ctx.currentTime;
    for (let i = 0; i < b.times; i++) {
      for (const [ratio, g] of s.partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = s.wave;
        osc.frequency.value = b.freq * ratio;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.5 * g, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + s.dur);
      }
      t += s.interval;
    }
  }

  const api = { SOUNDS, ORDER, LABELS, BELLS, playBell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bell = api;
})(typeof window !== 'undefined' ? window : null);
