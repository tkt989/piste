#!/usr/bin/env sh
set -eu

if [ -z "${VSCE_PAT:-}" ]; then
  echo "VSCE_PAT を環境変数に設定してください。" >&2
  exit 1
fi

docker build --file Dockerfile.vsce --target publish --tag piste-vsce-publish .
docker run --rm --env VSCE_PAT piste-vsce-publish
