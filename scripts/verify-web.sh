#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../web"

npm install
npm ls postcss
npm audit
npm run typecheck
npm run build
node -p '"Installed Next.js " + require("next/package.json").version'
