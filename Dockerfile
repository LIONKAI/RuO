# syntax=docker/dockerfile:1

# ---------- assets (Vite: Tailwind + Bootstrap + ruo.js) ----------
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- dependencias PHP (prod) ----------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-scripts
COPY . .
RUN composer dump-autoload --optimize

# ---------- runtime ----------
FROM php:8.3-apache AS app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libzip-dev \
    && docker-php-ext-install pdo_mysql zip opcache \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

# DocumentRoot -> public/ y .htaccess activo (rutas de Laravel)
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

# Directorios de runtime (el .dockerignore excluye su contenido local)
RUN php artisan package:discover --ansi \
 && mkdir -p storage/framework/views storage/framework/sessions \
    storage/framework/cache/data storage/app/public storage/logs \
 && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
CMD ["sh", "docker/start.sh"]
