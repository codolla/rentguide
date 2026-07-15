#!/bin/sh
set -eu

mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

attempt=0
until php artisan migrate --force; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Database did not become ready after 30 attempts." >&2
    exit 1
  fi
  sleep 2
done

php artisan config:cache
php artisan route:cache

exec "$@"

