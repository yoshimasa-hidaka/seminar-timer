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

node server.js
echo ""
read -n 1 -s -r -p "サーバを終了しました。Enter キーで閉じます…"
