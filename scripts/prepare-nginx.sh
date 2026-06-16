#!/bin/sh
set -eu

DIST_SOURCE="${DIST_SOURCE:-/tmp/dist}"
HTML_ROOT="${HTML_ROOT:-/usr/share/nginx/html}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/default.conf}"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

normalize_path_prefix() {
  raw="$(printf '%s' "${1:-/}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -n "$raw" ] || raw="/"

  case "$raw" in
    http://*|https://*)
      raw="$(printf '%s' "$raw" | sed -E 's#^https?://[^/]*(/.*)?$#\1#')"
      [ -n "$raw" ] || raw="/"
      ;;
  esac

  case "$raw" in
    /*) ;;
    *) raw="/$raw" ;;
  esac

  while [ "$raw" != "/" ] && [ "${raw%/}" != "$raw" ]; do
    raw="${raw%/}"
  done

  printf '%s\n' "$raw"
}

resolve_api_prefix() {
  raw="$(printf '%s' "${VITE_API_BASE_URL:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [ -z "$raw" ]; then
    printf '%s\n' "$APP_PUBLIC_BASE_PATH"
    return
  fi

  case "$raw" in
    http://*|https://*)
      printf '%s\n' "$APP_PUBLIC_BASE_PATH"
      ;;
    *)
      normalize_path_prefix "$raw"
      ;;
  esac
}

resolve_internal_api_prefix() {
  nginx_api_base="$(printf '%s' "${NGINX_API_BASE_URL:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [ -n "$nginx_api_base" ]; then
    normalize_path_prefix "$nginx_api_base"
    return
  fi

  nginx_base="$(printf '%s' "${NGINX_BASE_URL:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [ -n "$nginx_base" ]; then
    printf '%s\n' "$APP_INTERNAL_BASE_PATH"
    return
  fi

  resolve_api_prefix
}

normalize_upstream() {
  raw="$(printf '%s' "${1:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [ -z "$raw" ]; then
    echo "TRANSIT_HUB_UPSTREAM is required, for example http://transit-hub-server:80" >&2
    exit 1
  fi

  while [ "$raw" != "/" ] && [ "${raw%/}" != "$raw" ]; do
    raw="${raw%/}"
  done

  if [ -z "$raw" ]; then
    echo "TRANSIT_HUB_UPSTREAM is required, for example http://transit-hub-server:80" >&2
    exit 1
  fi

  printf '%s\n' "$raw"
}

write_proxy_headers() {
  cat <<'EOF'
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
EOF
}

write_upgrade_headers() {
  cat <<'EOF'
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
EOF
}

write_admin_locations() {
  prefix="$1"
  cat <<EOF
    location ${prefix}/admin/ {
        proxy_pass ${TRANSIT_HUB_UPSTREAM}/admin/;
EOF
  write_proxy_headers
  write_upgrade_headers
  cat <<EOF
    }

    location = ${prefix}/admin {
        proxy_pass ${TRANSIT_HUB_UPSTREAM}/admin;
EOF
  write_proxy_headers
  cat <<'EOF'
    }

EOF
}

write_api_locations() {
  prefix="$1"
  cat <<EOF
    location ${prefix}/api/ {
        proxy_pass ${TRANSIT_HUB_UPSTREAM}/api/;
EOF
  write_proxy_headers
  cat <<'EOF'
    }

EOF
}

write_v1_locations() {
  prefix="$1"
  cat <<EOF
    location ${prefix}/v1/ {
        proxy_pass ${TRANSIT_HUB_UPSTREAM}/v1/;
EOF
  write_proxy_headers
  write_upgrade_headers
  cat <<'EOF'
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

EOF
}

write_app_locations() {
  if [ "$APP_INTERNAL_BASE_PATH" = "/" ]; then
    cat <<'EOF'
    location / {
        try_files $uri $uri/ /index.html;
    }
EOF
    return
  fi

  cat <<EOF
    location = ${APP_INTERNAL_BASE_PATH} {
        try_files ${APP_INTERNAL_BASE_PATH}/index.html =404;
    }

    location ${APP_INTERNAL_BASE_PATH}/ {
        try_files \$uri \$uri/ ${APP_INTERNAL_BASE_PATH}/index.html;
    }
EOF
}

write_runtime_config() {
  runtime_api_base="${VITE_API_BASE_URL:-}"
  if [ -z "$(printf '%s' "$runtime_api_base" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')" ]; then
    runtime_api_base="$APP_PUBLIC_BASE_PATH"
  fi

  cat > "$INSTALL_PATH/runtime-config.js" <<EOF
window.__TRANSIT_HUB_CONFIG__ = {
  baseUrl: "$(json_escape "$APP_PUBLIC_BASE_PATH")",
  apiBaseUrl: "$(json_escape "$runtime_api_base")"
};
EOF
}

rewrite_index_base() {
  index_file="$INSTALL_PATH/index.html"
  [ -f "$index_file" ] || return 0

  base_href="$APP_PUBLIC_BASE_PATH/"
  [ "$APP_PUBLIC_BASE_PATH" = "/" ] && base_href="/"

  tmp_file="$index_file.tmp"
  sed "s#<base href=\"[^\"]*\" data-runtime-base />#<base href=\"$base_href\" data-runtime-base />#" "$index_file" > "$tmp_file"
  mv "$tmp_file" "$index_file"
}

APP_PUBLIC_BASE_PATH="$(normalize_path_prefix "${VITE_BASE_URL:-/}")"
APP_INTERNAL_BASE_PATH="$(normalize_path_prefix "${NGINX_BASE_URL:-$APP_PUBLIC_BASE_PATH}")"
TRANSIT_HUB_UPSTREAM="$(normalize_upstream "${TRANSIT_HUB_UPSTREAM:-}")"
API_PREFIX="$(resolve_internal_api_prefix)"
if [ "$API_PREFIX" = "/" ]; then
  API_LOCATION_PREFIX=""
else
  API_LOCATION_PREFIX="$API_PREFIX"
fi

rm -rf "${HTML_ROOT:?}"/*
if [ "$APP_INTERNAL_BASE_PATH" = "/" ]; then
  INSTALL_PATH="$HTML_ROOT"
else
  INSTALL_PATH="$HTML_ROOT$APP_INTERNAL_BASE_PATH"
fi

mkdir -p "$INSTALL_PATH" "$(dirname "$NGINX_CONF")"
cp -a "$DIST_SOURCE"/. "$INSTALL_PATH"/
rewrite_index_base
write_runtime_config

{
  cat <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    "" close;
}

server {
    listen 80;
    server_name _;
    client_max_body_size 100m;

    root /usr/share/nginx/html;
    index index.html;

EOF
  write_admin_locations "$API_LOCATION_PREFIX"
  write_api_locations "$API_LOCATION_PREFIX"
  write_v1_locations "$API_LOCATION_PREFIX"
  write_app_locations
  cat <<'EOF'
}
EOF
} > "$NGINX_CONF"
