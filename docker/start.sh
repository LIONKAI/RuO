#!/bin/sh
# Arranque en Render: Apache en $PORT, migraciones, seed demo y cachés.
set -e

PORT="${PORT:-80}"
sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

php artisan storage:link || true
php artisan migrate --force

if [ "$RUO_SEED_DEMO" = "true" ]; then
    php artisan db:seed --class=RuoSeeder --force || true
fi

php artisan optimize:clear
php artisan config:cache
php artisan event:cache
php artisan route:cache
php artisan view:cache

exec apache2-foreground
