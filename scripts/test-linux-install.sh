#!/usr/bin/env bash
set -euo pipefail
binary="$(realpath "$1")"
asar="$(realpath "$2")"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/discord/resources"
printf 'original Discord test fixture' > "$fixture/discord/resources/app.asar"
cp "$fixture/discord/resources/app.asar" "$fixture/original"
export EQUICORD_DIRECTORY="$asar" EQUICORD_DEV_INSTALL=1 EQUICORD_USER_DATA_DIR="$fixture/config"
"$binary" --version | tee "$fixture/version.txt"
grep -F 'ByaFluxInstaller CLI' "$fixture/version.txt"
"$binary" --install --location "$fixture/discord"
test -f "$fixture/discord/resources/_app.asar"
cmp "$fixture/original" "$fixture/discord/resources/_app.asar"
"$binary" --uninstall --location "$fixture/discord"
cmp "$fixture/original" "$fixture/discord/resources/app.asar"
test ! -e "$fixture/discord/resources/_app.asar"
printf 'PASS Linux CLI: install, loader backup, uninstall and byte-for-byte restoration.\n'
