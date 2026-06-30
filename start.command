#!/bin/bash
# 研究会 講演タイマー — ダブルクリックで起動。
# 動作には Node.js が必要です（無ければ下に案内が出ます）。
cd "$(dirname "$0")"

# Homebrew など一般的な場所も PATH に追加（Finder からの起動は PATH が最小のため）
for d in /opt/homebrew/bin /usr/local/bin; do
  [ -x "$d/node" ] && export PATH="$d:$PATH"
done

if ! command -v node >/dev/null 2>&1; then
  echo "======================================================"
  echo "  Node.js が見つかりません（このアプリの動作に必要です）"
  echo "------------------------------------------------------"
  echo "  1) https://nodejs.org/ を開き、LTS 版をインストール"
  echo "  2) インストール後、この start.command を再度ダブルクリック"
  echo "======================================================"
  echo ""
  read -n 1 -s -r -p "Enter キーで閉じます…"
  exit 1
fi

# Node が古すぎる場合は警告（動作には 14 以上を推奨）
major=$(node --version 2>/dev/null | sed 's/^v//; s/\..*//')
if [ "${major:-0}" -lt 14 ] 2>/dev/null; then
  echo "  [注意] Node.js $(node --version) は古い可能性があります。"
  echo "         不具合が出たら https://nodejs.org/ の LTS 版へ更新してください。"
  echo ""
fi

# 使用中は Mac をスリープさせない（スリープすると Node が凍結しタイマーが止まるため）。
# caffeinate はサーバ(node)が動いている間だけ -d 画面/-i アイドル/-s システム のスリープを抑止し、
# Ctrl+C で node が終われば自動で解除される（macOS 標準・追加インストール不要）。
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -dis node server.js
else
  node server.js
fi
echo ""
read -n 1 -s -r -p "サーバを終了しました。Enter キーで閉じます…"
