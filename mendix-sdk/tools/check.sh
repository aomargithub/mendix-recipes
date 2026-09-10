#!/usr/bin/env bash
#
# Runs Studio Pro's consistency check over a Team Server branch: the same check F4 runs, and the
# only thing that catches errors the Model SDK is happy to write. Clones the branch to get an
# .mpr, then hands it to `mx check`.
#
# Needs MENDIX_TOKEN and a Studio Pro / mxbuild installation. Point MX_MODELER at its `modeler`
# directory if it is not in the default location.
set -euo pipefail

APP_ID="${MENDIX_APP_ID:-69590a87-1a06-47a2-8bae-aa407a618aa9}"
BRANCH="${1:-${MENDIX_TARGET_BRANCH:-recipes-stories-4-5}}"
MX_MODELER="${MX_MODELER:-/tmp/mx/mxbuild/modeler}"

if [[ -z "${MENDIX_TOKEN:-}" ]]; then
    echo "MENDIX_TOKEN is not set in the environment." >&2
    exit 1
fi
if [[ ! -x "${MX_MODELER}/mx" ]]; then
    echo "No mx executable at ${MX_MODELER}. Set MX_MODELER to the modeler directory." >&2
    exit 1
fi

workspace="$(mktemp -d)"
trap 'rm -rf "${workspace}"' EXIT

# The token goes through an askpass helper rather than the URL, so it stays out of the process
# list and out of the clone's stored remote.
printf '#!/bin/sh\nexec printf "%%s" "$MENDIX_TOKEN"\n' > "${workspace}/askpass.sh"
chmod 700 "${workspace}/askpass.sh"

GIT_ASKPASS="${workspace}/askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git clone --quiet --depth 1 --branch "${BRANCH}" --single-branch \
    "https://pat@git.api.mendix.com/${APP_ID}.git" "${workspace}/app"

cd "${MX_MODELER}"
DOTNET_ROOT="${DOTNET_ROOT:-/tmp/dotnet}" DOTNET_ROLL_FORWARD=LatestMajor \
    ./mx check --warnings --deprecations "${workspace}/app/App.mpr"
