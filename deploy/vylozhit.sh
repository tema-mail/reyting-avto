#!/bin/zsh
# Выкладка avtoball.ru с мака: сборка для корня домена (индексация открыта) и архив dist в приёмник avtoball-deploy.
# ./deploy/vylozhit.sh – выложить текущий коммит (рабочая копия должна быть чистой); ./deploy/vylozhit.sh rollback – откат.
set -euo pipefail
cd "$(dirname "$0")/.."
SSH=(ssh -i "$HOME/.config/avtoball/deploy_ed25519" -o BatchMode=yes avtoball-deploy@168.113.179.49)
if [[ "${1:-}" == rollback ]]; then "${SSH[@]}" rollback; exit; fi
[[ -z "$(git status --porcelain)" ]] || { echo "есть незакоммиченные правки – сначала коммит" >&2; exit 1; }
export PATH="$HOME/.local/node/bin:$PATH"
# старая карта сайта – чтобы после выкладки отправить в IndexNow только новые адреса
OLD_SM=$(mktemp); curl -s --max-time 30 https://avtoball.ru/sitemap.xml > "$OLD_SM" || true
PUBLIC_BASE=/ PUBLIC_SITE_URL=https://avtoball.ru PUBLIC_FORM_ENDPOINT=/api/lead npm run build >/tmp/avtoball-build.log 2>&1 || { tail -20 /tmp/avtoball-build.log; exit 1; }
grep -E "page\(s\)|Проверено" /tmp/avtoball-build.log
# кабинет /admin/ – весь за логином и паролем (вход – ~/.config/avtoball/admin-login, admin-pass)
node scripts/lock-admin.mjs
COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C dist . | "${SSH[@]}" "deploy $(git rev-parse --short=12 HEAD)"
code=$(curl -sk -o /dev/null -w '%{http_code}' https://avtoball.168.113.179.49.nip.io/novosibirsk/)
echo "проверочный адрес: $code"; [[ "$code" == 200 ]]
# новые адреса – в Яндекс и Bing через IndexNow (пустая старая карта – значит, не скачалась: тогда не шлём всё подряд)
if grep -q "<loc>" "$OLD_SM"; then node scripts/indexnow.mjs --novye "$OLD_SM" || echo "IndexNow: не отправлено"; fi
