#!/bin/sh
# Приёмник выкладки avtoball.ru (forced command ключа avtoball-deploy, ставит deploy/install.sh).
# Ключ умеет только: deploy <sha> (архив dist в stdin), status, rollback. Хранятся 3 последние выкладки.
set -eu
R=/opt/avtoball/releases
set -- ${SSH_ORIGINAL_COMMAND:-}
swap() { ln -sfn "$1" "$R/current.new" && mv -T "$R/current.new" "$R/current"; }
case "${1:-}" in
  deploy)
    sha=$(printf %s "${2:-}" | tr -cd 'a-f0-9')
    [ ${#sha} -ge 7 ] || { echo "нужен sha коммита" >&2; exit 2; }
    d="$R/$sha"
    rm -rf "$d.tmp" && mkdir "$d.tmp"
    tar -xzf - -C "$d.tmp" --no-same-owner --no-same-permissions
    [ -f "$d.tmp/index.html" ] && [ -f "$d.tmp/404.html" ] || { rm -rf "$d.tmp"; echo "в архиве нет index.html или 404.html" >&2; exit 3; }
    chmod -R a+rX "$d.tmp"
    rm -rf "$d" && mv "$d.tmp" "$d" && touch "$d"
    swap "$sha"
    ls -1t "$R" | grep -v '^current' | tail -n +4 | while read -r old; do rm -rf "${R:?}/$old"; done
    echo "ok $sha" ;;
  status) readlink "$R/current" ;;
  rollback)
    cur=$(readlink "$R/current")
    prev=$(ls -1t "$R" | grep -v '^current' | grep -vx "$cur" | head -1)
    [ -n "$prev" ] || { echo "откатываться некуда" >&2; exit 4; }
    swap "$prev" && echo "ok $prev" ;;
  *) echo "команды: deploy <sha>, status, rollback" >&2; exit 1 ;;
esac
