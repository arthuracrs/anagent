#!/bin/bash
set -e

# verify the build passes before shipping
npm run build

git add -A
git commit -m "${1:-release}"
git push origin main

echo "deployed — users can run: npx github:arthuracrs/anagent"
