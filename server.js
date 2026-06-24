#!/usr/bin/env node
// 研究会 講演タイマー — 依存パッケージ不要（Node 標準ライブラリのみ）
// Mac でこのサーバを起動し、iPad は表示ページ、Mac はコントロールページを開く。
// 同期は SSE（Server-Sent Events）。サーバが毎秒、全クライアントへ現在状態を配信する。

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, 'public');

// ---- 権威ある状態（サーバが唯一の真実。クライアントは描画するだけ） ----
const state = {
  phase: 'idle',        // idle | running | paused
  title: '',
  talkSec: 20 * 60,     // 講演の持ち時間
  qaSec: 10 * 60,       // 質疑応答の持ち時間（0 なら質疑なし）
  talkWarnSec: 5 * 60,  // 講演の予鈴（講演終了の何秒前に鳴らすか）
  qaWarnSec: 2 * 60,    // 質疑応答の予鈴（質疑終了の何秒前に鳴らすか）
  segment: 'talk',      // 'talk'（講演）| 'qa'（質疑応答）
  remainingSec: 20 * 60,// 現フェーズの残り。負になると超過（overtime）
  message: '',          // 司会から speaker へのメッセージ
  lang: 'ja',           // 表示言語 'ja' | 'en'（コントロールから切替・両画面で同期）
  clockScope: 'phase',  // iPad の大きい時計 'phase'（現フェーズ）| 'total'（全体=質疑込み）
  bellSound: 'beep',    // ベル音色 'beep' | 'chime' | 'bell'（両画面で同期）
  bellEvent: { id: 0, type: null }, // id をインクリメントして1回だけ鳴らす
  lanIp: '',            // 起動時に確定（コントロールが iPad 用 URL/QR を作るため）
  port: 0,
};

const clients = new Set(); // SSE 接続中の response 群

function snapshot() {
  return JSON.stringify({ ...state, serverTime: Date.now() });
}

function broadcast() {
  const data = `data: ${snapshot()}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch (_) { /* 切断は次の tick で掃除 */ }
  }
}

function ringBell(type) {
  state.bellEvent = { id: state.bellEvent.id + 1, type };
}

// ---- 毎秒の tick：running の時だけ減算し、しきい値を跨いだらベル ----
setInterval(() => {
  if (state.phase === 'running') {
    const before = state.remainingSec;
    state.remainingSec -= 1;
    const after = state.remainingSec;
    // 予鈴：現フェーズの予鈴秒数を上から跨いだ瞬間（>0 のときのみ）— 講演/質疑で別設定
    const warnSec = state.segment === 'talk' ? state.talkWarnSec : state.qaWarnSec;
    if (warnSec > 0 && before > warnSec && after <= warnSec && after > 0) {
      ringBell('warn');
    }
    // フェーズ終了：0 を上から跨いだ瞬間
    if (before > 0 && after <= 0) {
      if (state.segment === 'talk' && state.qaSec > 0) {
        // 講演終了 → 質疑応答へ自動移行（2鈴）
        ringBell('talkEnd');
        state.segment = 'qa';
        state.remainingSec = state.qaSec;
      } else {
        // 質疑終了（質疑なしなら講演終了）= 全体終了（3鈴）。以降は超過カウント
        ringBell('final');
      }
    }
    broadcast();
  }
}, 1000);

// ---- コマンド処理（コントロールページからの POST） ----
function applyCommand(cmd) {
  switch (cmd.action) {
    case 'start': // 開始/再開
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
    case 'set': { // 講演・質疑・予鈴・タイトルを設定（タイマーは講演フェーズの先頭・idle に戻す）
      const talkMin = Number(cmd.talkMin);
      const qaMin = Number(cmd.qaMin);
      const talkWarnMin = Number(cmd.talkWarnMin);
      const qaWarnMin = Number(cmd.qaWarnMin);
      if (Number.isFinite(talkMin) && talkMin > 0) state.talkSec = Math.round(talkMin * 60);
      if (Number.isFinite(qaMin) && qaMin >= 0) state.qaSec = Math.round(qaMin * 60);
      if (Number.isFinite(talkWarnMin) && talkWarnMin >= 0) state.talkWarnSec = Math.round(talkWarnMin * 60);
      if (Number.isFinite(qaWarnMin) && qaWarnMin >= 0) state.qaWarnSec = Math.round(qaWarnMin * 60);
      if (typeof cmd.title === 'string') state.title = cmd.title.slice(0, 120);
      state.segment = 'talk';
      state.remainingSec = state.talkSec;
      state.phase = 'idle';
      break;
    }
    case 'segment': { // フェーズを手動で切替（講演が早く終わった等）
      const to = cmd.to === 'qa' ? 'qa' : 'talk';
      state.segment = to;
      state.remainingSec = to === 'qa' ? state.qaSec : state.talkSec;
      if (to === 'qa') ringBell('talkEnd'); // 質疑へ進む＝2鈴
      break;
    }
    case 'adjust': { // 時間を ±delta 秒
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
      if (['beep', 'chime', 'bell'].includes(cmd.sound)) state.bellSound = cmd.sound;
      break;
    case 'testBell':
      ringBell(['warn', 'talkEnd', 'final'].includes(cmd.type) ? cmd.type : 'warn');
      break;
    default:
      return false;
  }
  broadcast();
  return true;
}

// ---- HTTP ルーティング ----
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // SSE ストリーム
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${snapshot()}\n\n`); // 接続直後に現状を1回
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // コマンド受信
  if (url.pathname === '/api/cmd' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const ok = applyCommand(JSON.parse(body || '{}'));
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // 静的ファイル（/ は display へ）
  let file = url.pathname === '/' ? '/display.html' : url.pathname;
  if (file === '/control') file = '/control.html';
  if (file === '/display') file = '/display.html';
  const full = path.join(PUBLIC, path.normalize(file));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(full);
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript'
      : ext === '.css' ? 'text/css' : 'application/octet-stream';
    // no-cache＝更新後に古い HTML/JS が残らないよう毎回再検証させる
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// LAN IP を推定。会場 WiFi が無く Mac をホットスポット化（インターネット共有）した場合は
// デフォルト経路が無く、IP は bridge100 等に乗るため、全インターフェイスを列挙して拾う。
// 優先順：デフォルト経路の IF → en*（WiFi/有線）→ bridge*（Mac の共有/ホットスポット）→ 残り全部。
function detectLanIp() {
  const ifaces = os.networkInterfaces();
  const pick = (name) => (ifaces[name] || []).find(a => a.family === 'IPv4' && !a.internal);
  let dev = '';
  try { dev = execSync("route -n get default 2>/dev/null | awk '/interface:/{print $2}'").toString().trim(); } catch (_) {}
  const order = [dev, 'en0', 'en1', 'en2', 'en3', 'en4', 'en5', 'bridge100', 'bridge101', ...Object.keys(ifaces)];
  const seen = new Set();
  for (const name of order) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const a = pick(name);
    if (a) return a.address;
  }
  return 'localhost';
}

function onListen() {
  const port = server.address().port;
  const ip = detectLanIp();
  state.lanIp = ip;
  state.port = port;
  console.log('======================================================');
  console.log('  研究会 講演タイマー — 起動しました');
  console.log('------------------------------------------------------');
  console.log('  操作画面（この Mac）：ブラウザを自動で開きました');
  console.log(`                      http://localhost:${port}/control`);
  console.log(`  iPad（表示）        ：http://${ip}:${port}/display`);
  console.log('                      ↑操作画面の上部に QR も出ます');
  console.log('------------------------------------------------------');
  console.log('  iPad と Mac は同じ WiFi（または Mac のインターネット共有）に。');
  console.log('  終了：このウィンドウで Ctrl+C。');
  console.log('======================================================');
  // 操作画面を既定ブラウザで自動オープン（macOS）。テスト時は SEMINAR_NO_OPEN=1 で抑止。
  if (!process.env.SEMINAR_NO_OPEN) {
    try { execSync(`open "http://localhost:${port}/control"`); } catch (_) {}
  }
}

// ポートが使用中なら自動で次を試す（二重起動・競合でクラッシュさせない）
function startListen(port, triesLeft) {
  const onErr = (e) => {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log(`  ポート ${port} は使用中 → ${port + 1} を試します…`);
      startListen(port + 1, triesLeft - 1);
    } else {
      console.error('起動に失敗しました:', e.message);
      process.exit(1);
    }
  };
  server.once('error', onErr);
  server.listen(port, () => { server.removeListener('error', onErr); onListen(); });
}
startListen(Number(PORT), 10);
