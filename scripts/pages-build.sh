#!/bin/bash
# Static build for Cloudflare Pages. The local app keeps its API and SQLite;
# the published site ships data/seed.json and stores "not real" marks in the browser.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public
cp data/seed.json public/datacenters.json
if [ -d app/api ]; then
  rm -rf .api-hold
  mv app/api .api-hold
fi
cleanup() {
  if [ -d .api-hold ]; then
    rm -rf app/api
    mv .api-hold app/api
  fi
}
trap cleanup EXIT
STATIC_EXPORT=1 NEXT_PUBLIC_DATA_SOURCE=static bunx next build
