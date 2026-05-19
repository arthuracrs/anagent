#!/bin/bash
set -e

# verify the build passes before shipping
npm run build

git add -A
git commit -m "${1:-release}"
git push origin main

echo "deployed"
echo "  first install:  npm install -g github:arthuracrs/anagent"
echo "  update:         npm uninstall -g anagent && npm install -g github:arthuracrs/anagent"
