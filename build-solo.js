#!/usr/bin/env node
// iPad 単体モードの「1ファイル完結 HTML」を生成する。
// public/solo.html の <script src="timer-core.js"> / <script src="bell.js"> を実体で埋め込み、
// 外部依存ゼロの単一 .html を作る＝Node もサーバも無い iPad に AirDrop/メールで渡してそのまま開ける。
// 正本は public/ 側のファイル。これは派生物（編集はせず、ソースを直したら再生成すること）。
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, 'public');
const OUT = path.join(__dirname, 'seminar-timer-ipad.html');

let html = fs.readFileSync(path.join(PUB, 'solo.html'), 'utf8');

function inline(srcName) {
  const code = fs.readFileSync(path.join(PUB, srcName), 'utf8');
  const tag = `<script src="${srcName}"></script>`;
  if (!html.includes(tag)) { console.error(`! ${tag} が solo.html に見つかりません`); process.exit(1); }
  // 埋め込むコードに </script> は含まれない前提（含まれれば早期エラー）
  if (/<\/script>/i.test(code)) { console.error(`! ${srcName} に </script> が含まれ inline 不可`); process.exit(1); }
  html = html.replace(tag, `<script>\n/* ==== inlined: ${srcName} ==== */\n${code}\n</script>`);
}

inline('timer-core.js');
inline('bell.js');

const banner = '<!-- このファイルは build-solo.js が public/solo.html + timer-core.js + bell.js から自動生成した単一ファイル版です。\n'
  + '     編集せず、ソース（public/）を直して `node build-solo.js` で再生成してください。 -->\n';
html = html.replace(/^<!DOCTYPE html>/i, '<!DOCTYPE html>\n' + banner);

fs.writeFileSync(OUT, html);
const externals = (html.match(/<script[^>]*\ssrc=/g) || []).length;
console.log(`✓ 生成: ${path.relative(process.cwd(), OUT)}  (${(html.length / 1024).toFixed(0)} KB, 外部スクリプト参照=${externals})`);
if (externals !== 0) { console.error('! 外部参照が残っています（単一ファイルになっていない）'); process.exit(1); }
