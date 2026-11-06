#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "需要 Node.js 22 或更高版本"; exit 1; }
npm ci
npm test
npm run pack:mac
printf '\n构建完成，产物位于：%s/dist\n' "$PWD"
