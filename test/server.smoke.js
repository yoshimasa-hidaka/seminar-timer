#!/usr/bin/env node
// server.js の起動確認（`node test/server.smoke.js`）。どの OS でも：
//   起動ログに URL が出る → 各ページが 200 → SSE の最初のイベントに lanIp/lanIps/port が入っている
//   → コマンド POST が効く（start → running）→ 終了。config.json は触らない（persist しないコマンドだけ使う）。
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, PORT: '0', SEMINAR_NO_OPEN: '1' }, // PORT=0 → 空きポートを OS に選ばせる
  stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
let done = false;
const deadline = setTimeout(() => fail('server did not print its URL within 20 s'), 20000);
function fail(msg) {
  console.error('FAIL:', msg);
  console.error('--- server output ---\n' + out);
  try { child.kill(); } catch (_) {}
  process.exit(1);
}
child.stderr.on('data', (d) => { out += d; });
child.stdout.on('data', (d) => {
  out += d;
  const m = /http:\/\/localhost:(\d+)\/control/.exec(out);
  if (m && !child.port) {
    child.port = Number(m[1]);
    run(child.port).catch((e) => fail(e && e.stack ? e.stack : String(e)));
  }
});
child.on('exit', (code) => { if (!done) fail(`server exited early (code ${code})`); });

function request(port, method, p, body, raw = false) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: b, type: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    if (body) req.write(raw ? body : JSON.stringify(body));
    req.end();
  });
}
// SSE：最初の `data:` 行を読んだら切る
function firstEvent(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/events' }, (res) => {
      let b = '';
      res.on('data', (c) => {
        b += c;
        const m = /^data: (.*)\n\n/m.exec(b);
        if (m) { req.destroy(); resolve(JSON.parse(m[1])); }
      });
    });
    req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
  });
}

async function run(port) {
  for (const p of ['/', '/control', '/display', '/solo', '/control.html']) {
    const r = await request(port, 'GET', p);
    assert.strictEqual(r.status, 200, `${p} → ${r.status}`);
    assert.ok(r.type.startsWith('text/html'), `${p} content-type ${r.type}`);
  }
  for (const p of ['/timer-core.js', '/bell.js', '/manifest.webmanifest', '/icon-512.png']) {
    assert.strictEqual((await request(port, 'GET', p)).status, 200, p);
  }
  assert.strictEqual((await request(port, 'GET', '/nope.html')).status, 404);
  assert.notStrictEqual((await request(port, 'GET', '/../server.js')).status, 200, 'must not serve outside public/');
  assert.notStrictEqual((await request(port, 'GET', '/..%2fserver.js')).status, 200, 'must not serve outside public/ (encoded)');

  const ev = await firstEvent(port);
  assert.strictEqual(ev.port, port, 'state.port');
  assert.ok(typeof ev.lanIp === 'string' && ev.lanIp.length > 0, 'lanIp present');
  assert.ok(Array.isArray(ev.lanIps), 'lanIps is an array');
  if (ev.lanIps.length) assert.strictEqual(ev.lanIps[0], ev.lanIp, 'lanIp is the first candidate'); else assert.strictEqual(ev.lanIp, 'localhost');
  assert.ok(/^(localhost|\d{1,3}(\.\d{1,3}){3})$/.test(ev.lanIp), `lanIp shape: ${ev.lanIp}`);
  assert.strictEqual(ev.phase, 'idle');

  const r1 = await request(port, 'POST', '/api/cmd', { action: 'start' });
  assert.strictEqual(r1.status, 200, 'start accepted');
  const ev2 = await firstEvent(port);
  assert.strictEqual(ev2.phase, 'running', 'start → running');
  assert.strictEqual((await request(port, 'POST', '/api/cmd', { action: 'no-such-action' })).status, 400, 'unknown action → 400');
  assert.strictEqual((await request(port, 'POST', '/api/cmd', null)).status, 400, 'empty body → 400 (no action)');
  assert.strictEqual((await request(port, 'POST', '/api/cmd', '{not json', true)).status, 400, 'malformed JSON → 400');

  assert.ok(/研究会 講演タイマー — 起動しました/.test(out), 'startup banner');
  assert.ok(!/ブラウザを自動で開きました/.test(out), 'no false "browser opened" claim');
  console.log(`smoke OK on ${process.platform} (port ${port}) lanIp=${ev.lanIp} candidates=${JSON.stringify(ev.lanIps)}`);
  done = true;
  clearTimeout(deadline);
  child.kill();
  process.exit(0);
}
