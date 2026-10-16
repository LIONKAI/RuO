#!/bin/sh
# Pre-deploy de Railway: migra la base de datos y cachea la configuración.
set -e

php artisan migrate --force

if [ "$RUO_SEED_DEMO" = "true" ]; then
    php artisan db:seed --class=RuoSeeder --force
fi

php artisan optimize:clear
php artisan config:cache
php artisan event:cache
php artisan route:cache
php artisan view:cache
