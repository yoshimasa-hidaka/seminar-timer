#!/usr/bin/env node
// 研究会 講演タイマー — 依存パッケージ不要（Node 標準ライブラリのみ）
// Mac でこのサーバを起動し、iPad は表示ページ、Mac はコントロールページを開く。
// 同期は SSE（Server-Sent Events）。サーバが毎秒、全クライアントへ現在状態を配信する。

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const TimerCore = require('./public/timer-core.js'); // 状態機械の正本（solo.html と共用）

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, 'public');

// ---- 権威ある状態（サーバが唯一の真実。クライアントは描画するだけ） ----
// 素の状態はコアの既定から。サーバ固有のフィールド（ベル発火 id・LAN IP・port）だけ足す。
const state = Object.assign(TimerCore.defaultState(), {
  bellEvent: { id: 0, type: null }, // id をインクリメントして1回だけ鳴らす
  lanIp: '',                        // 起動時に確定（コントロールが iPad 用 URL/QR を作るため）
  port: 0,
});

const clients = new Set(); // SSE 接続中の response 群

const { clampSec, normalizePresets } = TimerCore; // loadConfig 用（型/範囲の矯正）

// ---- 設定の永続化（config.json に保存し再起動で復元。走行中の時計は保存しない）----
const CONFIG_FILE = path.join(__dirname, 'config.json');
const CONFIG_KEYS = TimerCore.CONFIG_KEYS; // 保存対象キー（コアと共用＝ドリフト防止）
// config.json は手編集/破損もありうるので、ロード時に型・範囲を検証（不正値は既定のまま＝fail-closed）
function loadConfig() {
  let data = null;
  try { data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}
  if (data && typeof data === 'object') {
    const sec = (v) => { const n = Number(v); return Number.isFinite(n) ? clampSec(n) : null; };
    const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
    let x;
    if ((x = sec(data.talkSec)) != null) state.talkSec = Math.max(60, x);
    if ((x = sec(data.qaSec)) != null) state.qaSec = x;
    if ((x = sec(data.talkWarnSec)) != null) state.talkWarnSec = x;
    if ((x = sec(data.talkWarn2Sec)) != null) state.talkWarn2Sec = x;
    if ((x = num(data.volume, 0, 1)) != null) state.volume = x;
    if ((x = num(data.pitch, 0.25, 4)) != null) state.pitch = x;
    if (TimerCore.SOUNDS.includes(data.bellSound)) state.bellSound = data.bellSound;
    if (typeof data.ipadBell === 'boolean') state.ipadBell = data.ipadBell;
    if (['ja', 'en'].includes(data.lang)) state.lang = data.lang;
    if (['phase', 'total'].includes(data.clockScope)) state.clockScope = data.clockScope;
    const ps = normalizePresets(data.presets);
    if (ps) state.presets = ps;
  }
  state.remainingSec = state.talkSec; // 復元した持ち時間で待機状態に
}
let saveTimer = null;
function saveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const out = {};
    for (const k of CONFIG_KEYS) out[k] = state[k];
    fs.writeFile(CONFIG_FILE, JSON.stringify(out, null, 2), () => {});
  }, 400); // デバウンス
}
loadConfig();

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

// ---- 毎秒の tick：コアが running 時だけ減算し、跨いだしきい値のベル名を返す ----
setInterval(() => {
  const bells = TimerCore.tick(state);
  if (state.phase === 'running') {
    for (const b of bells) ringBell(b);
    broadcast();
  }
}, 1000);

// ---- コマンド処理（コントロールページからの POST）。状態機械はコアに委譲 ----
function applyCommand(cmd) {
  const { ok, bells, persist } = TimerCore.applyCommand(state, cmd);
  if (!ok) return false;
  for (const b of bells) ringBell(b);
  if (persist) saveConfig(); // 設定変更は永続化
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
  if (file === '/solo') file = '/solo.html'; // iPad 単体モード（同期不要・ローカル完結）
  const full = path.join(PUBLIC, path.normalize(file));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(full);
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript'
      : ext === '.css' ? 'text/css'
      : ext === '.png' ? 'image/png'
      : ext === '.webmanifest' ? 'application/manifest+json'
      : 'application/octet-stream';
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
