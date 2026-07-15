# AAMUSTED Rent Guide API

Laravel API backend for the React/Vite frontend.

Local setup:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Default local MySQL database:

```txt
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=aamusted_rentguide
DB_USERNAME=rentguide_user
DB_PASSWORD="RentGuide@2026!"
```

Default API base URL:

```txt
http://127.0.0.1:8000/api
```

Frontend integration:

```bash
cp .env.example ../.env
```

The React app reads:

```txt
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

The listings page already calls `GET /api/listings`. If the API is not running, it falls back to the demo listings.

The login screen calls `POST /api/auth/login`, and signup calls `POST /api/auth/register`. If the API is not running, the selected dashboard opens in demo mode.

Authenticated account endpoints used by the portal:

```txt
GET /api/me
PUT /api/profile
PUT /api/password
GET /api/saved-listings
POST /api/listings/{id}/save
DELETE /api/listings/{id}/save
GET /api/messages
POST /api/messages
GET /api/reviews
POST /api/reviews
PUT /api/reviews/{id}
DELETE /api/reviews/{id}
GET /api/landlord/listings
POST /api/landlord/listings
PUT /api/landlord/listings/{id}
POST /api/landlord/verification
```

Seeded login accounts:

```txt
student@aamustedrentguide.edu.gh / password
landlord@aamustedrentguide.edu.gh / password
admin@aamustedrentguide.edu.gh / password
```

Core resources:

- Users
- Hostels/listings
- Rooms
- Facilities
- Saved listings
- Messages
- Reviews
- Reports
- Verification requests
