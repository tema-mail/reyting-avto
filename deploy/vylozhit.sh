#!/bin/zsh
# Выкладка avtoball.ru с мака: сборка для корня домена (индексация открыта) и архив dist в приёмник avtoball-deploy.
# ./deploy/vylozhit.sh – выложить текущий коммит (рабочая копия должна быть чистой); ./deploy/vylozhit.sh rollback – откат.
set -euo pipefail
cd "$(dirname "$0")/.."
SSH=(ssh -i "$HOME/.config/avtoball/deploy_ed25519" -o BatchMode=yes avtoball-deploy@45.12.72.227)
if [[ "${1:-}" == rollback ]]; then "${SSH[@]}" rollback; exit; fi
[[ -z "$(git status --porcelain)" ]] || { echo "есть незакоммиченные правки – сначала коммит" >&2; exit 1; }
export PATH="$HOME/.local/node/bin:$PATH"
PUBLIC_BASE=/ PUBLIC_SITE_URL=https://avtoball.ru PUBLIC_FORM_ENDPOINT= npm run build >/tmp/avtoball-build.log 2>&1 || { tail -20 /tmp/avtoball-build.log; exit 1; }
grep -E "page\(s\)|Проверено" /tmp/avtoball-build.log
COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C dist . | "${SSH[@]}" "deploy $(git rev-parse --short=12 HEAD)"
code=$(curl -sk -o /dev/null -w '%{http_code}' https://avtoball.45.12.72.227.nip.io/novosibirsk/)
echo "проверочный адрес: $code"; [[ "$code" == 200 ]]
