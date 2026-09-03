#!/usr/bin/env sh
set -eu

mkdir -p dist
docker build \
  --file Dockerfile.vsce \
  --target artifact \
  --output type=local,dest=dist \
  .
