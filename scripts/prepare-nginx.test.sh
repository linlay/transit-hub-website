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

rm -rf "$HTML_ROOT" "$NGINX_CONF"

DIST_SOURCE="$DIST_SOURCE" \
HTML_ROOT="$HTML_ROOT" \
NGINX_CONF="$NGINX_CONF" \
sh "$ROOT_DIR/scripts/prepare-nginx.sh"

test -f "$HTML_ROOT/index.html"
test -f "$HTML_ROOT/runtime-config.js"
grep -F '<base href="/" data-runtime-base />' "$HTML_ROOT/index.html" >/dev/null
grep -F 'baseUrl: "/"' "$HTML_ROOT/runtime-config.js" >/dev/null
grep -F 'apiBaseUrl: "/"' "$HTML_ROOT/runtime-config.js" >/dev/null
grep -F 'location / {' "$NGINX_CONF" >/dev/null
grep -F 'location /admin/' "$NGINX_CONF" >/dev/null

printf 'prepare-nginx runtime base path test passed\n'
