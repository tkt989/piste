#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo ".env ファイルを作成し、VSCE_PAT を設定してください。" >&2
  exit 1
fi

set -a
. ./.env
set +a

if [ -z "${VSCE_PAT:-}" ]; then
  echo ".env に VSCE_PAT を設定してください。" >&2
  exit 1
fi

docker build --file Dockerfile.vsce --target publish --tag piste-vsce-publish .
docker run --rm --env VSCE_PAT piste-vsce-publish
