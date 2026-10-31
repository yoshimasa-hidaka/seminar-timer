#!/bin/bash
# 研究会 講演タイマー — Mac ではこれをダブルクリックで起動。
# 中身は start.sh（macOS / Linux 共通）。bash 経由で呼ぶので start.sh の実行権限は不要。
exec bash "$(dirname "$0")/start.sh"
