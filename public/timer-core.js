// 研究会 講演タイマー — 共有コア（状態機械）。
// Node（server.js＝2台同期サーバ）とブラウザ（solo.html＝iPad 単体）の双方が同じ正本を使う。
// ここには I/O を持たない純粋ロジックだけを置く＝モード間でロジックがドリフトしないため。
//   - tick(state)          … running の時だけ1秒進め、跨いだしきい値に応じて鳴らすベル名を返す
//   - applyCommand(state,c)… コマンドを適用し {ok, bells, persist} を返す（ringBell の代わりに bells を返す）
// 鳴らす/配信/保存といった副作用は呼び出し側（server.js / solo.html）が担う。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TimerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_SEC = 36000; // 持ち時間・予鈴の上限（10時間）＝暴走値の sanity cap
  const clampSec = (sec) => Math.max(0, Math.min(MAX_SEC, Math.round(sec)));

  // 既定状態（server.js / solo.html 共通の素の状態。bellEvent/lanIp/port 等の環境固有は呼び出し側が付ける）
  // 音色の許可リスト（bell.js の ORDER と同じ並び。server.js と solo.html の設定復元が参照する）
  const SOUNDS = ['deskbell', 'timer', 'alarm', 'school', 'doorbell', 'chime', 'bell', 'gong', 'marimba', 'beep', 'buzzer'];

  function defaultState() {
    return {
      phase: 'idle',        // idle | running | paused
      title: '',
      talkSec: 20 * 60,     // 講演の持ち時間
      qaSec: 10 * 60,       // 質疑応答の持ち時間（0 なら質疑なし）
      talkWarnSec: 5 * 60,  // 予鈴1（講演終了の何秒前・予鈴は講演のみ）
      talkWarn2Sec: 0,      // 予鈴2（既定オフ）
      segment: 'talk',      // 'talk' | 'qa'
      remainingSec: 20 * 60,// 現フェーズの残り。負で超過
      message: '',
      lang: 'ja',           // 'ja' | 'en'
      clockScope: 'phase',  // 'phase' | 'total'（全体=質疑込み）
      bellSound: 'deskbell', // SOUNDS のいずれか（bell.js の ORDER と一致）
      ipadBell: true,       // iPad でベルを鳴らすか
      volume: 0.9,          // 0–1
      pitch: 1.0,           // 周波数倍率
      bellGap: 1.0,         // 2鈴・3鈴の間隔の倍率（0.5–3）
      presets: [[10, 5, 3, 0], [15, 5, 3, 0], [25, 5, 5, 0], [30, 10, 5, 0], [45, 15, 5, 0]],
    };
  }

  // プリセット正規化（[講演,質疑,予鈴1,予鈴2]・型/範囲を矯正）
  function normalizePresets(arr) {
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [
        Math.max(1, Math.min(600, Math.round(Number(p[0]) || 0))),
        Math.max(0, Math.min(600, Math.round(Number(p[1]) || 0))),
        Math.max(0, Math.min(600, Math.round(Number(p[2] != null ? p[2] : 5) || 0))),
        Math.max(0, Math.min(600, Math.round(Number(p[3] != null ? p[3] : 0) || 0))),
      ])
      .filter((p) => Number.isFinite(p[0]))
      .slice(0, 12);
  }

  // 毎秒の tick：running の時だけ減算し、跨いだしきい値に応じて鳴らすベル名（'warn'|'talkEnd'|'final'）を返す。
  function tick(state) {
    const bells = [];
    if (state.phase !== 'running') return bells;
    const before = state.remainingSec;
    state.remainingSec -= 1;
    const after = state.remainingSec;
    // 予鈴（講演フェーズのみ）：予鈴1・予鈴2 をそれぞれ上から跨いだ瞬間に1鈴。同値は二重鳴り防止で一意化。
    if (state.segment === 'talk') {
      for (const w of new Set([state.talkWarnSec, state.talkWarn2Sec])) {
        if (w > 0 && before > w && after <= w && after > 0) bells.push('warn');
      }
    }
    // フェーズ終了：0 を上から跨いだ瞬間
    if (before > 0 && after <= 0) {
      if (state.segment === 'talk' && state.qaSec > 0) {
        bells.push('talkEnd'); // 講演終了 → 質疑へ自動移行（2鈴）
        state.segment = 'qa';
        state.remainingSec = state.qaSec;
      } else {
        bells.push('final'); // 質疑終了（質疑なしなら講演終了）＝全体終了（3鈴）
      }
    }
    return bells;
  }

  // 設定永続化の対象キー（走行中の時計＝phase/segment/remainingSec/message は保存しない）
  const CONFIG_KEYS = ['talkSec', 'qaSec', 'talkWarnSec', 'talkWarn2Sec', 'bellSound', 'ipadBell', 'volume', 'pitch', 'bellGap', 'presets', 'lang', 'clockScope'];
  const CONFIG_ACTIONS = new Set(['set', 'setBellSound', 'setIpadBell', 'setVolume', 'setPitch', 'setBellGap', 'setPresets', 'setLang', 'setClockScope']);

  // コマンド適用。ringBell の代わりに鳴らすベルを bells に積み、{ok, bells, persist} を返す。
  function applyCommand(state, cmd) {
    const bells = [];
    let ok = true;
    switch (cmd.action) {
      case 'start':
        state.phase = 'running';
        break;
      case 'pause':
        if (state.phase === 'running') state.phase = 'paused';
        break;
      case 'reset':
        state.phase = 'idle';
        state.segment = 'talk';
        state.remainingSec = state.talkSec;
        break;
      case 'set': {
        const talkMin = Number(cmd.talkMin);
        const qaMin = Number(cmd.qaMin);
        const talkWarnMin = Number(cmd.talkWarnMin);
        const talkWarn2Min = Number(cmd.talkWarn2Min);
        if (Number.isFinite(talkMin) && talkMin > 0) state.talkSec = Math.max(1, clampSec(talkMin * 60));
        if (Number.isFinite(qaMin) && qaMin >= 0) state.qaSec = clampSec(qaMin * 60);
        if (Number.isFinite(talkWarnMin) && talkWarnMin >= 0) state.talkWarnSec = clampSec(talkWarnMin * 60);
        if (Number.isFinite(talkWarn2Min) && talkWarn2Min >= 0) state.talkWarn2Sec = clampSec(talkWarn2Min * 60);
        if (typeof cmd.title === 'string') state.title = cmd.title.slice(0, 120);
        state.segment = 'talk';
        state.remainingSec = state.talkSec;
        state.phase = 'idle';
        break;
      }
      case 'segment': {
        const to = cmd.to === 'qa' ? 'qa' : 'talk';
        state.segment = to;
        state.remainingSec = to === 'qa' ? state.qaSec : state.talkSec;
        if (to === 'qa') bells.push('talkEnd'); // 質疑へ進む＝2鈴
        break;
      }
      case 'adjust': {
        const d = Number(cmd.deltaSec);
        if (Number.isFinite(d)) state.remainingSec += Math.round(d);
        break;
      }
      case 'message':
        state.message = typeof cmd.text === 'string' ? cmd.text.slice(0, 200) : '';
        break;
      case 'clearMessage':
        state.message = '';
        break;
      case 'setLang':
        state.lang = cmd.lang === 'en' ? 'en' : 'ja';
        break;
      case 'setClockScope':
        state.clockScope = cmd.scope === 'total' ? 'total' : 'phase';
        break;
      case 'setBellSound':
        if (SOUNDS.includes(cmd.sound)) state.bellSound = cmd.sound;
        break;
      case 'setIpadBell':
        state.ipadBell = !!cmd.on;
        break;
      case 'setVolume': {
        const v = Number(cmd.value);
        if (Number.isFinite(v)) state.volume = Math.max(0, Math.min(1, v));
        break;
      }
      case 'setPitch': {
        const p = Number(cmd.value);
        if (Number.isFinite(p)) state.pitch = Math.max(0.25, Math.min(4, p));
        break;
      }
      case 'setBellGap': {
        const g = Number(cmd.value);
        if (Number.isFinite(g)) state.bellGap = Math.max(0.5, Math.min(3, g));
        break;
      }
      case 'setPresets': {
        const ps = normalizePresets(cmd.presets);
        if (ps) state.presets = ps;
        break;
      }
      case 'testBell':
        bells.push(['warn', 'talkEnd', 'final'].includes(cmd.type) ? cmd.type : 'warn');
        break;
      default:
        ok = false;
    }
    return { ok, bells, persist: ok && CONFIG_ACTIONS.has(cmd.action) };
  }

  return { MAX_SEC, clampSec, defaultState, normalizePresets, tick, applyCommand, CONFIG_KEYS, CONFIG_ACTIONS, SOUNDS };
});
