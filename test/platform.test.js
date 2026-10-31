#!/usr/bin/env node
// platform.js の単体テスト（Node 標準の assert だけ。`node test/platform.test.js` で実行）。
// 実機の無い OS（Windows / Linux）は、実際のコマンド出力の見本と IF 表の見本で振る舞いを固定する。
'use strict';
const assert = require('assert');
const P = require('../platform.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('  ok', name); }

// ---- 既定経路のパース ----
t('darwin: route -n get default', () => {
  const sample = '   route to: default\ndestination: default\n       mask: default\n    gateway: 192.168.86.1\n  interface: en0\n      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>\n';
  assert.deepStrictEqual(P.parseDarwinRoute(sample), { dev: 'en0' });
  assert.strictEqual(P.parseDarwinRoute(''), null);
  assert.strictEqual(P.parseDarwinRoute('route: writing to routing socket: not in table\n'), null);
});
t('linux: ip -o -4 route show default', () => {
  const sample = 'default via 192.168.1.1 dev wlp3s0 proto dhcp src 192.168.1.50 metric 600 \n';
  assert.deepStrictEqual(P.parseLinuxRoute(sample), { dev: 'wlp3s0', addr: '192.168.1.50' });
  assert.deepStrictEqual(P.parseLinuxRoute('default via 10.0.0.1 dev eth0 \n'), { dev: 'eth0' });
  assert.strictEqual(P.parseLinuxRoute(''), null);
  assert.strictEqual(P.parseLinuxRoute('Error: ipv4: FIB table does not exist.\n'), null);
});
t('windows: route print -4 0.0.0.0 (localized headers, two default routes → lowest metric)', () => {
  const sample = [
    '===========================================================================',
    'インターフェイス一覧',
    ' 12...aa bb cc dd ee ff ......Intel(R) Wi-Fi 6 AX201 160MHz',
    '===========================================================================',
    '',
    'IPv4 ルート テーブル',
    '===========================================================================',
    'アクティブ ルート:',
    'ネットワーク宛先        ネットマスク          ゲートウェイ       インターフェイス  メトリック',
    '          0.0.0.0          0.0.0.0      192.168.1.1    192.168.1.23     35',
    '          0.0.0.0          0.0.0.0      10.0.0.1       10.0.0.5         25',
    '===========================================================================',
    '固定ルート:',
    '  なし',
    '',
  ].join('\r\n');
  assert.deepStrictEqual(P.parseWindowsRoute(sample), { addr: '10.0.0.5' });
  assert.strictEqual(P.parseWindowsRoute(''), null);
  assert.strictEqual(P.parseWindowsRoute('Active Routes:\n  None\n'), null);
});

// ---- LAN IP の順位付け ----
const v4 = (address, internal = false) => ({ address, family: 'IPv4', internal });
const v6 = (address) => ({ address, family: 'IPv6', internal: false });
const ips = (ranked) => ranked.map((c) => c.address);

t('mac: venue Wi-Fi → default-route interface wins (same as before)', () => {
  const ifaces = { lo0: [v4('127.0.0.1', true)], en0: [v4('192.168.86.218'), v6('fe80::1')], en5: [v4('169.254.10.1')], utun3: [v4('100.64.0.2')] };
  assert.deepStrictEqual(ips(P.rankLanIps(ifaces, { dev: 'en0' })), ['192.168.86.218', '100.64.0.2', '169.254.10.1']);
});
t('mac: Internet Sharing with no upstream → bridge100 (no default route)', () => {
  const ifaces = { lo0: [v4('127.0.0.1', true)], en0: [v6('fe80::2')], bridge100: [v4('192.168.2.1')], awdl0: [v6('fe80::3')] };
  assert.deepStrictEqual(ips(P.rankLanIps(ifaces, null)), ['192.168.2.1']);
});
t('mac: Internet Sharing with upstream → default route first, bridge second (so it can be picked manually)', () => {
  const ifaces = { en7: [v4('10.1.2.3')], bridge100: [v4('192.168.2.1')] };
  assert.deepStrictEqual(ips(P.rankLanIps(ifaces, { dev: 'en7' })), ['10.1.2.3', '192.168.2.1']);
});
t('windows: Wi-Fi beats WSL/VirtualBox/disconnected Ethernet; hotspot adapter is the runner-up', () => {
  const ifaces = {
    'イーサネット': [v4('169.254.33.7')],
    'vEthernet (WSL (Hyper-V firewall))': [v4('172.28.0.1')],
    'VirtualBox Host-Only Network': [v4('192.168.56.1')],
    'ローカル エリア接続* 12': [v4('192.168.137.1')],
    'Wi-Fi': [v4('192.168.1.23'), v6('fe80::9')],
    'Loopback Pseudo-Interface 1': [v4('127.0.0.1', true)],
  };
  const ranked = ips(P.rankLanIps(ifaces, { addr: '192.168.1.23' }));
  assert.strictEqual(ranked[0], '192.168.1.23');
  assert.strictEqual(ranked[1], '192.168.137.1');
  assert.strictEqual(ranked[ranked.length - 1], '169.254.33.7', 'link-local last');
});
t('windows: no default route (hotspot only) → hotspot adapter, virtual adapters after it', () => {
  const ifaces = { 'vEthernet (Default Switch)': [v4('172.20.0.1')], 'ローカル エリア接続* 3': [v4('192.168.137.1')], 'Ethernet': [v4('169.254.1.2')] };
  assert.deepStrictEqual(ips(P.rankLanIps(ifaces, null)), ['192.168.137.1', '172.20.0.1', '169.254.1.2']);
});
t('windows: English adapter names without any hint', () => {
  const ifaces = { 'VMware Network Adapter VMnet8': [v4('192.168.159.1')], 'Ethernet 2': [v4('10.0.0.7')], 'Bluetooth Network Connection': [v4('169.254.5.5')] };
  assert.strictEqual(ips(P.rankLanIps(ifaces, null))[0], '10.0.0.7');
});
t('linux: docker0 listed first does not win; default-route dev wins', () => {
  const ifaces = { lo: [v4('127.0.0.1', true)], docker0: [v4('172.17.0.1')], 'br-1a2b3c': [v4('172.18.0.1')], wlp3s0: [v4('192.168.1.50')], virbr0: [v4('192.168.122.1')] };
  assert.strictEqual(ips(P.rankLanIps(ifaces, { dev: 'wlp3s0', addr: '192.168.1.50' }))[0], '192.168.1.50');
  assert.strictEqual(ips(P.rankLanIps(ifaces, null))[0], '192.168.1.50', 'name heuristic alone');
});
t('linux: GNOME hotspot on the Wi-Fi card itself (10.42.0.1, no default route)', () => {
  const ifaces = { wlp2s0: [v4('10.42.0.1')], enp0s31f6: [v4('169.254.8.8')] };
  assert.strictEqual(ips(P.rankLanIps(ifaces, null))[0], '10.42.0.1');
});
t('mac: no default route, en1 enumerated before en0 → en0 still first (old en0 → en1 order kept)', () => {
  const ifaces = { lo0: [v4('127.0.0.1', true)], en1: [v4('192.168.1.9')], en0: [v4('192.168.1.5')] };
  assert.deepStrictEqual(ips(P.rankLanIps(ifaces, null)), ['192.168.1.5', '192.168.1.9']);
  assert.deepStrictEqual(ips(P.rankLanIps(ifaces, { dev: 'en1' })), ['192.168.1.9', '192.168.1.5'], 'default route still wins');
});
t('edge: empty / IPv6-only / malformed entries → no candidates', () => {
  assert.deepStrictEqual(P.rankLanIps({}, null), []);
  assert.deepStrictEqual(P.rankLanIps({ en0: [v6('fe80::1')] }, { dev: 'en0' }), []);
  assert.deepStrictEqual(P.rankLanIps({ en0: [{ address: 'garbage', family: 'IPv4', internal: false }], x: undefined }, null), []);
  assert.deepStrictEqual(P.rankLanIps(undefined, undefined), []);
});
t('edge: Node ≤17 reports family as the number 4', () => {
  assert.deepStrictEqual(ips(P.rankLanIps({ eth0: [{ address: '10.0.0.9', family: 4, internal: false }] }, null)), ['10.0.0.9']);
});
t('detectLanIp on this machine returns a string and a consistent candidate list', () => {
  const r = P.detectLanIp();
  assert.strictEqual(typeof r.ip, 'string');
  assert.ok(Array.isArray(r.candidates));
  if (r.candidates.length) assert.strictEqual(r.ip, r.candidates[0].address); else assert.strictEqual(r.ip, 'localhost');
  assert.strictEqual(new Set(r.candidates.map((c) => c.address)).size, r.candidates.length, 'no duplicate IPs');
  console.log('     →', process.platform, JSON.stringify(r), 'hint', JSON.stringify(P.defaultRouteHint()));
});

// ---- ブラウザ起動：不正な URL は実行しない ----
t('openBrowser refuses non-URL strings (nothing is spawned)', () => {
  for (const bad of ['http://localhost:8080/control; rm -rf /', 'file:///etc/passwd', 'http://a b', '', 'localhost:8080', 'http://localhost:8080/control&calc']) {
    assert.strictEqual(P.openBrowser(bad, 'darwin'), false, bad);
  }
});
t('openBrowser accepts the control URL shape', () => {
  // 実際にブラウザを開かないよう、存在しないコマンドに落ちる platform 名で呼ぶ（spawn の ENOENT は握りつぶされる）
  assert.strictEqual(P.openBrowser('http://localhost:8080/control', 'nonexistent-os'), true);
});
t('startupNotes per OS', () => {
  assert.ok(P.startupNotes('win32').some((l) => /ファイアウォール|セキュリティ/.test(l)));
  assert.deepStrictEqual(P.startupNotes('darwin'), []);
  assert.ok(P.startupNotes('linux').length >= 1);
});

console.log(`platform.test.js: ${n} tests passed`);
