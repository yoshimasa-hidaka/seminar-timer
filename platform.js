#!/usr/bin/env node
// platform.js — OS に依存する小さな部分をここに隔離する（server.js はこれを呼ぶだけ）。
// 対象：LAN IP の推定（iPad 用 URL/QR）・既定ブラウザで操作画面を開く・OS 別の起動時の注意。
// 依存は Node 標準のみ。どの関数も例外を外に出さず、失敗したら安全側（null／何もしない）に倒す。
'use strict';
const os = require('os');
const { execSync, spawn } = require('child_process');

const EXEC_OPTS = { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true };
function run(cmd) { try { return execSync(cmd, EXEC_OPTS); } catch (_) { return ''; } }

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

// ---- 既定経路のヒント（どの IF／どの IP がインターネット側か）----
// 会場 Wi-Fi に繋がっていれば、既定経路の IF が iPad と同じ LAN にいる可能性が最も高い。
// ホットスポット運用では既定経路が無いことも多く、その時は null を返して名前のヒューリスティクスに任せる。
function parseDarwinRoute(text) {
  // `route -n get default` → "   interface: en0"
  const m = /^\s*interface:\s*(\S+)/m.exec(text || '');
  return m ? { dev: m[1] } : null;
}
function parseLinuxRoute(text) {
  // `ip -o -4 route show default` → "default via 192.168.1.1 dev wlp3s0 proto dhcp src 192.168.1.50 metric 600"
  // 複数行なら先頭（カーネルはメトリック昇順で出す）。
  const line = (text || '').split('\n').find((l) => /^default\b/.test(l));
  if (!line) return null;
  const dev = /\bdev\s+(\S+)/.exec(line);
  const src = /\bsrc\s+(\S+)/.exec(line);
  const hint = {};
  if (dev) hint.dev = dev[1];
  if (src && IPV4.test(src[1])) hint.addr = src[1];
  return hint.dev || hint.addr ? hint : null;
}
function parseWindowsRoute(text) {
  // `route print -4 0.0.0.0` の Active Routes 行（見出しは表示言語で変わるが、行の中身は数値）：
  //   Network Destination   Netmask   Gateway        Interface      Metric
  //   0.0.0.0               0.0.0.0   192.168.1.1    192.168.1.23   35
  // 既定経路が複数（Wi-Fi と有線など）ならメトリック最小の Interface 列（＝その IF の IP）を採る。
  const re = /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+\S+\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d+)\s*$/gm;
  let best = null;
  let m;
  while ((m = re.exec(text || ''))) {
    const metric = Number(m[2]);
    if (!best || metric < best.metric) best = { addr: m[1], metric };
  }
  return best ? { addr: best.addr } : null;
}
function defaultRouteHint(platform = process.platform) {
  if (platform === 'darwin') return parseDarwinRoute(run('route -n get default'));
  if (platform === 'linux') return parseLinuxRoute(run('ip -o -4 route show default'));
  if (platform === 'win32') return parseWindowsRoute(run('route print -4 0.0.0.0'));
  return null;
}

// ---- LAN IP の選択（純関数：テストで差し替えられるよう IF 表とヒントを引数で受ける）----
// 加点：既定経路の IF/IP（+100）→ 実 NIC らしい名前（+20：Mac en*・Linux eth*/wl*・Windows「Wi-Fi」「イーサネット」）
//      → ホットスポット（+10：Mac bridge*・Windows モバイルホットスポットの 192.168.137.x）。
// 減点：仮想アダプタ（−50：Hyper-V/WSL/VirtualBox/VMware/Docker/VPN 等）・リンクローカル 169.254.x（−100：未接続の NIC）。
// 同点は OS の列挙順（Mac なら en0 → en1 …）。候補は全部返し、1 位を URL/QR に使う（他は操作画面で選び直せる）。
const REAL_NIC = /^(en\d|eth\d|eno|enp|ens|wl|wlan|wlp|ath)/i;
const REAL_NIC_WIN = /^(wi-?fi|wlan|ethernet|イーサネット)/i;
const VIRTUAL = /^(veth|virbr|docker|br-|tun|tap|utun|wg\d|tailscale|zt|lxc|lxd|vmnet|vboxnet|awdl|llw|ppp|anpi)/i;
const VIRTUAL_WIN = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|tailscale|zerotier|bluetooth|loopback|npcap|vpn|tap-|wintun|teredo|isatap/i;

function scoreCandidate(c, hint) {
  let s = 0;
  if (hint && hint.dev && c.name === hint.dev) s += 100;
  if (hint && hint.addr && c.address === hint.addr) s += 100;
  if (REAL_NIC.test(c.name) || REAL_NIC_WIN.test(c.name)) s += 20;
  if (/^bridge\d/i.test(c.name) || c.address.startsWith('192.168.137.')) s += 10;
  if (VIRTUAL.test(c.name) || VIRTUAL_WIN.test(c.name)) s -= 50;
  if (c.address.startsWith('169.254.')) s -= 100;
  return s;
}
function rankLanIps(ifaces, hint) {
  const cands = [];
  for (const [name, addrs] of Object.entries(ifaces || {})) {
    for (const a of addrs || []) {
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal && IPV4.test(a.address)) cands.push({ name, address: a.address });
    }
  }
  return cands
    .map((c, i) => ({ c, s: scoreCandidate(c, hint), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map((x) => x.c);
}
// 戻り値：{ ip, candidates }。候補が無ければ ip は 'localhost'（iPad からは届かないが URL は出す）。
function detectLanIp() {
  let ranked = [];
  try { ranked = rankLanIps(os.networkInterfaces(), defaultRouteHint()); } catch (_) {}
  // 同じ IP が複数 IF に乗ることは稀だが、候補一覧は IP で重複排除する
  const seen = new Set();
  const candidates = ranked.filter((c) => (seen.has(c.address) ? false : seen.add(c.address)));
  return { ip: candidates.length ? candidates[0].address : 'localhost', candidates };
}

// ---- 既定ブラウザで URL を開く（失敗しても例外を出さない。開けたかどうかは原理的に分からない）----
// macOS: open / Windows: cmd /c start / Linux: xdg-open。detached＋unref で、ブラウザの終了を待たない。
function openBrowser(url, platform = process.platform) {
  if (!/^https?:\/\/[A-Za-z0-9.\-:\[\]]+(\/[A-Za-z0-9._\-\/]*)?$/.test(url)) return false; // 想定外の文字列は渡さない
  const [cmd, args] = platform === 'darwin' ? ['open', [url]]
    : platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  try {
    const p = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true });
    p.on('error', () => {});
    p.unref();
    return true;
  } catch (_) { return false; }
}

// ---- 起動ログに出す OS 別の注意（日本語。英語は README 側）----
function startupNotes(platform = process.platform) {
  if (platform === 'win32') {
    return [
      '  [Windows] 初回は「Windows セキュリティの重要な警告」が出ます。',
      '            「プライベート」「パブリック」の両方にチェックして「アクセスを許可する」。',
      '            （会場 Wi-Fi はパブリック扱いが多く、片方だけだと iPad から繋がりません）',
      '  [Windows] 使用中は PC をスリープさせないでください（操作画面を Chrome/Edge で',
      '            表示したままなら画面は消えません。電源設定でスリープを「なし」にすると確実）。',
    ];
  }
  if (platform === 'linux') {
    return ['  [Linux] ファイアウォール（ufw 等）が有効なら、上のポートへの TCP を許可してください。'];
  }
  return [];
}

module.exports = {
  detectLanIp, rankLanIps, defaultRouteHint, openBrowser, startupNotes,
  // テスト用に公開
  parseDarwinRoute, parseLinuxRoute, parseWindowsRoute, scoreCandidate,
};
