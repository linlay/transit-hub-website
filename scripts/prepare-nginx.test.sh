#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

DIST_SOURCE="$TMP_DIR/dist"
HTML_ROOT="$TMP_DIR/html"
NGINX_CONF="$TMP_DIR/nginx/default.conf"

mkdir -p "$DIST_SOURCE/assets"
cat > "$DIST_SOURCE/index.html" <<'HTML'
<!doctype html>
<html>
  <head>
    <base href="/" data-runtime-base />
    <script src="./runtime-config.js"></script>
    <script type="module" src="./assets/index.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
HTML
printf 'console.log("asset")\n' > "$DIST_SOURCE/assets/index.js"

DIST_SOURCE="$DIST_SOURCE" \
HTML_ROOT="$HTML_ROOT" \
NGINX_CONF="$NGINX_CONF" \
VITE_BASE_URL="/transit-hub" \
VITE_API_BASE_URL="/gateway" \
TRANSIT_HUB_UPSTREAM="http://transit-hub:8080" \
sh "$ROOT_DIR/scripts/prepare-nginx.sh"

test -f "$HTML_ROOT/transit-hub/index.html"
test -f "$HTML_ROOT/transit-hub/runtime-config.js"
test -f "$HTML_ROOT/transit-hub/assets/index.js"

grep -F '<base href="/transit-hub/" data-runtime-base />' "$HTML_ROOT/transit-hub/index.html" >/dev/null
grep -F 'window.__TRANSIT_HUB_CONFIG__' "$HTML_ROOT/transit-hub/runtime-config.js" >/dev/null
grep -F 'baseUrl: "/transit-hub"' "$HTML_ROOT/transit-hub/runtime-config.js" >/dev/null
grep -F 'apiBaseUrl: "/gateway"' "$HTML_ROOT/transit-hub/runtime-config.js" >/dev/null
grep -F 'location /gateway/admin/' "$NGINX_CONF" >/dev/null
grep -F 'try_files $uri $uri/ /transit-hub/index.html;' "$NGINX_CONF" >/dev/null
grep -F 'proxy_pass http://transit-hub:8080/admin/;' "$NGINX_CONF" >/dev/null

rm -rf "$HTML_ROOT" "$NGINX_CONF"

DIST_SOURCE="$DIST_SOURCE" \
HTML_ROOT="$HTML_ROOT" \
NGINX_CONF="$NGINX_CONF" \
VITE_BASE_URL="/transit-hub" \
NGINX_BASE_URL="/" \
TRANSIT_HUB_UPSTREAM="http://transit-hub-server:80" \
sh "$ROOT_DIR/scripts/prepare-nginx.sh"

test -f "$HTML_ROOT/index.html"
test -f "$HTML_ROOT/runtime-config.js"
test -f "$HTML_ROOT/assets/index.js"
test ! -e "$HTML_ROOT/transit-hub"

grep -F '<base href="/transit-hub/" data-runtime-base />' "$HTML_ROOT/index.html" >/dev/null
grep -F 'baseUrl: "/transit-hub"' "$HTML_ROOT/runtime-config.js" >/dev/null
grep -F 'apiBaseUrl: "/transit-hub"' "$HTML_ROOT/runtime-config.js" >/dev/null
grep -F 'location /admin/' "$NGINX_CONF" >/dev/null
grep -F 'proxy_pass http://transit-hub-server:80/admin/;' "$NGINX_CONF" >/dev/null
grep -F 'try_files $uri $uri/ /index.html;' "$NGINX_CONF" >/dev/null

rm -rf "$HTML_ROOT" "$NGINX_CONF"

if DIST_SOURCE="$DIST_SOURCE" \
  HTML_ROOT="$HTML_ROOT" \
  NGINX_CONF="$NGINX_CONF" \
  sh "$ROOT_DIR/scripts/prepare-nginx.sh" 2>"$TMP_DIR/missing-upstream.err"; then
  echo "prepare-nginx.sh should fail when TRANSIT_HUB_UPSTREAM is unset" >&2
  exit 1
fi

grep -F 'TRANSIT_HUB_UPSTREAM is required' "$TMP_DIR/missing-upstream.err" >/dev/null

rm -rf "$HTML_ROOT" "$NGINX_CONF"

DIST_SOURCE="$DIST_SOURCE" \
HTML_ROOT="$HTML_ROOT" \
NGINX_CONF="$NGINX_CONF" \
TRANSIT_HUB_UPSTREAM="http://transit-hub:8080" \
sh "$ROOT_DIR/scripts/prepare-nginx.sh"

test -f "$HTML_ROOT/index.html"
test -f "$HTML_ROOT/runtime-config.js"
grep -F '<base href="/" data-runtime-base />' "$HTML_ROOT/index.html" >/dev/null
grep -F 'baseUrl: "/"' "$HTML_ROOT/runtime-config.js" >/dev/null
grep -F 'apiBaseUrl: "/"' "$HTML_ROOT/runtime-config.js" >/dev/null
grep -F 'location / {' "$NGINX_CONF" >/dev/null
grep -F 'location /admin/' "$NGINX_CONF" >/dev/null

printf 'prepare-nginx runtime base path test passed\n'
