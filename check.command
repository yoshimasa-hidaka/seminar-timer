#!/bin/bash
# 環境チェック — このアプリを動かす準備ができているか確認する（サーバは起動しない）。
# 受け取った人がまず実行すると、何が足りないか分かる。
cd "$(dirname "$0")"

# Homebrew など一般的な場所も PATH に追加（Finder 起動は PATH が最小のため）
for d in /opt/homebrew/bin /usr/local/bin; do
  [ -x "$d/node" ] && export PATH="$d:$PATH"
done

echo "======================================================"
echo "  研究会 講演タイマー — 環境チェック"
echo "======================================================"

ok=1

# 1) Node.js
if command -v node >/dev/null 2>&1; then
  v=$(node --version 2>/dev/null)
  major=$(echo "$v" | sed 's/^v//; s/\..*//')
  if [ "${major:-0}" -ge 14 ] 2>/dev/null; then
    echo "  [OK] Node.js: $v"
  else
    echo "  [△] Node.js: $v（古い可能性。LTS 版への更新を推奨）"
  fi
else
  echo "  [NG] Node.js が見つかりません"
  echo "       → https://nodejs.org/ の LTS 版をインストールしてください"
  echo "         （インストール後、もう一度この check.command を実行）"
  ok=0
fi

# 2) アプリのファイルがそろっているか
missing=""
for f in server.js public/control.html public/display.html public/bell.js public/qr.js; do
  [ -f "$f" ] || missing="$missing $f"
done
if [ -z "$missing" ]; then
  echo "  [OK] アプリのファイル: そろっています"
else
  echo "  [NG] 不足ファイル:$missing"
  echo "       → フォルダごと展開し直してください（一部だけのコピーは不可）"
  ok=0
fi

# 3) start.command に実行権限があるか
if [ -x start.command ]; then
  echo "  [OK] start.command: 実行できます"
else
  echo "  [△] start.command: 実行権限がありません"
  echo "       → このターミナルで  chmod +x start.command  を実行、"
  echo "         または start.command を右クリック→「開く」で起動できます"
fi

echo "------------------------------------------------------"
if [ "$ok" = 1 ]; then
  echo "  準備OK。start.command をダブルクリックで起動できます。"
else
  echo "  上の [NG] を解消してから start.command を起動してください。"
fi
echo "======================================================"
echo ""
read -n 1 -s -r -p "Enter キーで閉じます…"
