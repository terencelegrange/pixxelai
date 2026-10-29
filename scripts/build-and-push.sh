#!/usr/bin/env bash
#
# scripts/build-and-push.sh
#
# Local multi-arch build and push script for tlgrange/pixxelai.
# Builds arm64 natively on Apple Silicon and amd64 via Rosetta/QEMU.
#
# Usage:
#   ./scripts/build-and-push.sh          # auto-computed next X.Y version + latest
#   ./scripts/build-and-push.sh 1.0      # explicit version + latest
#
# Requires: `docker login` already done.

set -euo pipefail

IMAGE_NAME="tlgrange/pixxelai"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Verify (tsc, tests)"
npm run db:generate
npx tsc --noEmit
npm test

echo "==> Determine version tag"
if [ "${1:-}" != "" ]; then
  VERSION="$1"
  echo "Using explicit version: $VERSION"
else
  TAGS_JSON="$(curl -sf "https://hub.docker.com/v2/repositories/${IMAGE_NAME}/tags?page_size=100" || echo '{"results":[]}')"
  VERSION="$(python3 -c "
import json, re
try:
    data = json.loads('''$TAGS_JSON''')
    versions = []
    for r in data.get('results', []):
        m = re.fullmatch(r'(\d+)\.(\d+)', r.get('name', ''))
        if m:
            versions.append((int(m.group(1)), int(m.group(2))))
    if not versions:
        print('1.0')
    else:
        versions.sort()
        major, minor = versions[-1]
        print(f'{major}.{minor + 1}')
except Exception:
    print('1.0')
")"
  echo "Computed next version: $VERSION"
fi

echo "==> Ensure a multi-platform-capable builder is active"
docker buildx inspect --bootstrap > /dev/null

NPM_REGISTRY="https://registry.npmjs.org/"
if curl -sf -m 2 "http://192.168.100.223:4873/-/ping" > /dev/null 2>&1; then
  NPM_REGISTRY="http://192.168.100.223:4873"
  echo "Using local Verdaccio mirror for npm ci: $NPM_REGISTRY"
else
  echo "Local Verdaccio mirror unreachable -- using public npm registry"
fi

echo "==> Build and push ${IMAGE_NAME}:${VERSION} + :latest (linux/amd64, linux/arm64)"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg NPM_REGISTRY="$NPM_REGISTRY" \
  -t "${IMAGE_NAME}:${VERSION}" \
  -t "${IMAGE_NAME}:latest" \
  --push \
  .

echo "==> Done: pushed ${IMAGE_NAME}:${VERSION} and ${IMAGE_NAME}:latest"

if [ -f "${REPO_ROOT}/scripts/update-dockerhub-readme.sh" ]; then
  "${REPO_ROOT}/scripts/update-dockerhub-readme.sh" || echo "Warning: Could not update Docker Hub README automatically."
fi

