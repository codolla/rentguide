# AAMUSTED Rent Guide Deployment Checklist

## Frontend

- Set `VITE_API_BASE_URL` to the production Laravel API URL, ending with `/api`.
- Set `VITE_GOOGLE_CLIENT_ID` if the frontend should initialize Google Sign-In without fetching backend config first.
- Run `npm install` and `npm run build`.
- Deploy the generated `dist/` folder.

## Backend

- Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` to the production backend URL, and generate `APP_KEY`.
- Set `FRONTEND_URL` to the production frontend URL.
- Set `GOOGLE_CLIENT_ID` to the same OAuth web client used by the frontend.
- Configure MySQL values: `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD`.
- Configure mail for password reset: `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, `MAIL_FROM_ADDRESS`, and `MAIL_FROM_NAME`.
- Keep `FILESYSTEM_DISK=public` for uploaded hostel images and verification documents.
- Set `SANCTUM_STATEFUL_DOMAINS` to the production frontend host when using browser stateful auth.

## Release Commands

```bash
cd backend
composer install --no-dev --optimize-autoloader
php artisan key:generate --force
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
```

```bash
cd ..
npm install
npm run build
```

## Final Smoke Test

- Student registers, saves a verified listing, messages the landlord, posts a review, and files a report.
- Landlord registers, creates a listing with image upload, edits the listing, and submits a verification document.
- Admin approves/rejects listings and verifications with notes, resolves reports, exports CSV data, and checks notifications.
