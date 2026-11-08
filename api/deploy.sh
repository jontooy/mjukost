#!/usr/bin/env bash
# Runs on the Raspberry Pi after /srv/mjukost has been updated to the commit to deploy.
set -euo pipefail
cd "$(dirname "$0")"

composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
php artisan migrate --force
php artisan optimize
