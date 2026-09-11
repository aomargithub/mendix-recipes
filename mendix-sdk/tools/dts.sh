#!/usr/bin/env bash
# Print the declaration of one or more classes from a mendixmodelsdk .d.ts file.
# Usage: tools/dts.sh <namespace> <ClassName> [ClassName...]
set -euo pipefail
NS="$1"; shift
FILE="$(dirname "$0")/../node_modules/mendixmodelsdk/src/gen/${NS}.d.ts"
for CLS in "$@"; do
    awk -v cls="$CLS" '
        $0 ~ ("^    (abstract )?class " cls " ") || $0 ~ ("^    (abstract )?class " cls "$") || $0 ~ ("^    enum " cls " ") { p=1 }
        p { print }
        p && /^    }/ { p=0 }
    ' "$FILE"
    echo ""
done
