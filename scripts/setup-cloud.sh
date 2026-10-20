#!/usr/bin/env bash
set -euo pipefail
cd /workspace/siteouvidoria
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Use Node.js 24, conforme .node-version");'
npm ci --include=dev --cache /workspace/.npm-cache --no-audit --no-fund
npm run build
npm test
