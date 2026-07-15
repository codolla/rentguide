# Temporary Dokploy deployment

This repository deploys as one public web service plus two private services:

- `frontend`: React static build and reverse proxy, port `80`
- `rentguide-backend`: Laravel API, internal port `80`
- `database`: MariaDB with a persistent named volume

The frontend proxies `/api` and `/storage` to Laravel, so only the `frontend`
service needs a Dokploy domain.

## 1. Install Dokploy on the VPS

Use an Ubuntu or Debian VPS with at least 2 GB RAM and 30 GB disk. Ports 80,
443, and 3000 must be free and allowed through the firewall.

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Open `http://VPS_IP:3000` and create the Dokploy administrator account.

## 2. Add this repository

1. Create a project and a production environment.
2. Add a **Compose** service and select **Docker Compose** (not Stack).
3. Select the GitHub/Git repository and branch containing this project.
4. Set **Compose Path** to `./docker-compose.dokploy.yml`.
5. Enable isolated deployments if it is offered.

## 3. Add environment variables

In the Compose service **Environment** tab, add the variables from
`.env.dokploy.example`. Generate secrets locally:

```bash
printf 'APP_KEY=base64:%s\n' "$(openssl rand -base64 32)"
printf 'DB_PASSWORD=%s\n' "$(openssl rand -hex 24)"
printf 'DB_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 24)"
```

`APP_URL` must be the final public URL including `https://`. `APP_HOST` is the
same hostname without the scheme or path.

## 4. Add the domain

In **Domains**, add a domain for service `frontend`, container port `80`, and
path `/`. For a temporary deployment, Dokploy can generate a `traefik.me`
hostname. For HTTPS, point a real domain's `A` record to the VPS and enable a
Let's Encrypt certificate.

After choosing the hostname, update `APP_URL` and `APP_HOST`, then redeploy.
Compose domain changes only take effect after a redeploy.

## 5. Initialize demo data once

The backend runs migrations automatically on every release. For the first
temporary deployment, open the `rentguide-backend` service terminal and run:

```bash
php artisan db:seed --force
```

This creates the existing demo users. Change their passwords immediately if
the URL is public; the repository seeder currently uses `password`.

## 6. Verify

```bash
curl -I https://YOUR_HOST/
curl https://YOUR_HOST/api/listings
```

Also verify login, an image upload, and that the image still exists after a
redeploy. MariaDB data and uploads are held in the named volumes
`database_data` and `uploads`.
