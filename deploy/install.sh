#!/bin/zsh
# Установка avtoball.ru на VPS Beget (повторный запуск безопасен): пользователь выкладки с ограниченным ключом,
# папка выкладок, контейнер статики, блок в общем Caddy (с проверкой и откатом).
# Сами выкладки делает GitHub Actions (.github/workflows/deploy.yml): tar dist | ssh avtoball-deploy "deploy <sha>".
set -euo pipefail
HOST="root@45.12.72.227"
KEY="$HOME/.ssh/seo_factory_tunnel_ed25519"
DEPLOY_PUB="${DEPLOY_PUB:-$HOME/.config/avtoball/deploy_ed25519.pub}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

# 1. Пользователь, папки, приёмник, ключ (может только то, что разрешает receive.sh), контейнер
"${SSH[@]}" "id avtoball-deploy >/dev/null 2>&1 || useradd --system --create-home --shell /bin/sh avtoball-deploy
  mkdir -p /opt/avtoball/releases /home/avtoball-deploy/.ssh
  chown avtoball-deploy:avtoball-deploy /opt/avtoball/releases && chmod 755 /opt/avtoball /opt/avtoball/releases"
scp -q -i "$KEY" "$HERE/compose.yml" "$HERE/nginx.conf" "$HOST:/opt/avtoball/"
scp -q -i "$KEY" "$HERE/receive.sh" "$HOST:/usr/local/bin/avtoball-receive"
"${SSH[@]}" "chmod 755 /usr/local/bin/avtoball-receive
  printf 'command=\"/usr/local/bin/avtoball-receive\",restrict %s\n' \"$(cat "$DEPLOY_PUB")\" > /home/avtoball-deploy/.ssh/authorized_keys
  chown -R avtoball-deploy:avtoball-deploy /home/avtoball-deploy/.ssh && chmod 700 /home/avtoball-deploy/.ssh && chmod 600 /home/avtoball-deploy/.ssh/authorized_keys
  cd /opt/avtoball && docker compose up -d --remove-orphans >/dev/null && docker ps --filter name=avtoball --format '{{.Names}} {{.Status}}'"

# 2. Блок в общем Caddy: только при парных метках, с проверкой конфигурации и откатом при неудачной перезагрузке
cat "$HERE/avtoball.caddy" | "${SSH[@]}" '
  set -e
  F=/opt/dzenbot/Caddyfile
  BAK=/opt/dzenbot/Caddyfile.bak-avtoball-$(date +%Y%m%d%H%M%S)
  cp "$F" "$BAK"
  [ "$(grep -c "^# >>> avtoball" "$F")" = "$(grep -c "^# <<< avtoball" "$F")" ] || { echo "Caddy: метки без пары, файл не изменён" >&2; exit 1; }
  awk "/^# >>> avtoball/{skip=1} !skip{print} /^# <<< avtoball/{skip=0}" "$F" > /tmp/Caddyfile.avtoball
  cat >> /tmp/Caddyfile.avtoball
  if docker exec -i dzenbot-caddy-1 caddy validate --adapter caddyfile --config /dev/stdin < /tmp/Caddyfile.avtoball >/tmp/caddy-validate-avtoball.log 2>&1; then
    cat /tmp/Caddyfile.avtoball > "$F"
    if docker exec dzenbot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
      echo "Caddy: блок avtoball применён"
    else
      cat "$BAK" > "$F"; docker exec dzenbot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
      echo "Caddy: перезагрузка не прошла, прежний файл возвращён" >&2; exit 1
    fi
  else
    echo "Caddy: проверка не прошла, файл не изменён" >&2; tail -5 /tmp/caddy-validate-avtoball.log >&2; exit 1
  fi'
