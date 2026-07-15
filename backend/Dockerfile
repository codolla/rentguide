FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

FROM php:8.4-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libzip-dev unzip \
    && docker-php-ext-install pdo_mysql zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
      /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

WORKDIR /var/www/html
COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY deploy/entrypoint.sh /usr/local/bin/rentguide-entrypoint

RUN chmod +x /usr/local/bin/rentguide-entrypoint \
    && mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache \
    && rm -f public/storage \
    && ln -s /var/www/html/storage/app/public public/storage \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
ENTRYPOINT ["rentguide-entrypoint"]
CMD ["apache2-foreground"]
