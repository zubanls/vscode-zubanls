#!/usr/bin/env bash
set -eu -o pipefail

cd "$(dirname "$0")"

version=$(jq -r .version package.json)

if [[ ! "$version" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
  echo "Invalid version, should not be a prerelease: $version"
  exit 1
fi

git tag "$version"
git push
git push --tags
