<p align="center">
  <img src="img/bookMaster_logo.png" alt="BookMaster" width="160">
</p>

# BookMaster

BookMaster is a web app for managing your personal library on top of **Google Books**.
Sign in with Google, search the catalogue, organise books into your *To read*, *Favourites* and *Read* shelves, leave reviews, and add a daily Google Calendar reminder to read 15 pages of the book you are reading.
BookMaster also exposes a small **REST API** for reading the reviews.

Practical project for the *Reti di Calcolatori* (Computer Networks) exam by Rosapia Laudati, Lorenzo Mastrandrea and Lorenzo Frangella.

---

## Contents

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Google Cloud setup](#google-cloud-setup)
- [Configuration](#configuration)
- [REST API](#rest-api)
- [Development](#development)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Architecture

![Architecture diagram](./fotoschema.png)

| Service    | Image / source                      | Role |
|------------|-------------------------------------|------|
| `nginx`    | `containers/nginx` (nginx 1.28)     | HTTPS termination (self-signed certificate created on first start), HTTP→HTTPS redirect, round-robin load balancing across the web replicas |
| `web` ×3   | `containers/node` (Node.js 24)      | Express app: HTML pages, Google OAuth 2.0, Google Books and Calendar calls, REST API |
| `couchdb`  | `couchdb:3.5`                       | Stores reviews (`reviews` database) and users who have already been welcomed (`users`) |
| `rabbitmq` | `rabbitmq:4.1-management-alpine`    | Queue (`mail`) between the web app and the mailer |
| `mailer`   | `containers/mailer` (Node.js 24)    | Consumes the queue and sends the welcome email with Nodemailer |

How a request flows:

1. The browser talks HTTPS to **nginx**, which forwards the request to one of the **web** replicas.
2. The Google tokens are stored in `httpOnly` cookies, so any replica can serve any request without a shared session store.
3. On a user's first login, a replica stores the user in CouchDB and publishes a message to RabbitMQ. The **mailer** consumes it and sends the welcome email.

## Quick start

**Requirements:** [Docker](https://docs.docker.com/get-docker/) with Compose v2 (`docker compose version`).

```bash
git clone https://github.com/RosapiaL/BookMaster.git
cd BookMaster
cp .env.example .env        # then fill in the Google values (see below)
docker compose up --build
```

Open **<https://localhost>**. The certificate is self-signed, so the browser shows a warning the first time; accept it to continue.

The first start pulls the images, builds the Node services, generates the TLS certificate in `./certs`, and creates the CouchDB databases. Later starts take a few seconds.

Without Google credentials the stack still starts: the pages and `GET /status` work, but login, shelves and search need the values from the next section.

Useful commands:

```bash
docker compose up -d --build --wait   # start in the background and wait until healthy
docker compose logs -f web mailer     # follow the logs
docker compose up -d --scale web=5    # change the number of web replicas
docker compose down                   # stop (data is kept in Docker volumes)
docker compose down -v                # stop and delete all data
```

Admin UIs (localhost only): CouchDB Fauxton at <http://localhost:5984/_utils> and RabbitMQ at <http://localhost:15672>, using the credentials from `.env`.

## Google Cloud setup

You need a Google Cloud project. It is free for this use.

1. Create a project at <https://console.cloud.google.com/>.
2. **APIs & Services → Library**: enable the **Books API** and the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and add your Google account as a *test user*.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: **`https://localhost/steps`**

   Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **Credentials → Create credentials → API key**. Restrict it to the Books API and copy it into `GOOGLE_API_KEY`.

## Configuration

Everything is configured through `.env`. [`.env.example`](.env.example) lists every variable with comments.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | – | OAuth 2.0 client (login, shelves, calendar) |
| `GOOGLE_API_KEY` | yes | – | Books API key (search, book details) |
| `PUBLIC_URL` | | `https://localhost` | Public address of the site |
| `GOOGLE_REDIRECT_URI` | | `$PUBLIC_URL/steps` | Must match the redirect URI registered in Google Cloud exactly |
| `COUCHDB_USER`, `COUCHDB_PASSWORD` | yes | – | CouchDB admin, created on first start |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | yes | – | RabbitMQ user, created on first start |
| `MAIL_USER`, `MAIL_PASSWORD` | | – | Gmail address and [app password](https://myaccount.google.com/apppasswords) for the welcome email. If empty, emails are only written to the mailer's log |
| `WEB_REPLICAS` | | `3` | Number of web containers |
| `HTTP_PORT`, `HTTPS_PORT` | | `80`, `443` | Host ports used by nginx |
| `TIME_ZONE`, `PAGES_PER_DAY` | | `Europe/Rome`, `15` | Reading-reminder settings |

To use your own TLS certificate, place `server-cert.crt` and `server-cert.key` in `./certs` before starting.

## REST API

All endpoints return JSON. The full reference is generated with [apiDoc](https://apidocjs.com) in [`apidoc/apidoc/index.html`](apidoc/apidoc/index.html).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Health check; also reports which replica answered |
| `GET` | `/api/getreview/byid/:id` or `/api/getreview/byid?id=` | Reviews of a book, by Google Books id |
| `GET` | `/api/getreview/bytitle/:title` or `/api/getreview/bytitle?title=` | Reviews of the first book matching the title |

```bash
curl -k https://localhost/api/getreview/bytitle/harry+potter
```

```json
{
  "id": "t_i_yQEACAAJ",
  "title": "Come stai?",
  "picture": "http://books.google.com/books/content?id=t_i_yQEACAAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api",
  "number_of_reviews": 1,
  "reviews": [
    { "email": "example@gmail.com", "stars": 5, "text": "Bellissimo", "createdAt": "2026-10-20T14:27:43.719Z" }
  ]
}
```

| Status | Body | When |
|--------|------|------|
| `400` | `{"error": "attribute id not declared"}` / `{"error": "attribute title not declared"}` | Parameter missing |
| `404` | `{"error": "No book for this id in google books"}` / `{"error": "No books with this title"}` | No matching book on Google Books |
| `502` | `{"error": "..."}` | Google Books did not answer |
| `503` | `{"error": "database_unavailable", ...}` | CouchDB is unreachable |

To regenerate the API docs after editing [`apidoc/src/api.js`](apidoc/src/api.js):

```bash
npx apidoc@1 -i apidoc/src -o apidoc/apidoc
```

## Development

### Tests

The tests replace Google, CouchDB and RabbitMQ with in-memory fakes, so they need no network, credentials or running services.

```bash
cd containers/node
npm ci
npm test
```

GitHub Actions ([`.github/workflows/nodetest.yml`](.github/workflows/nodetest.yml)) runs the tests on Node 22 and 24. It then builds the whole stack with Docker Compose and smoke-tests it through nginx.

### Running the web app outside Docker

Start only the infrastructure, then run the app with Node 22 or later. Values set on the command line take precedence over `.env`:

```bash
docker compose up -d couchdb rabbitmq
cd containers/node
npm ci
COUCHDB_URL=http://localhost:5984 RABBITMQ_HOST=localhost:5672 \
  node --env-file=../../.env --watch src/server.js
```

The app listens on <http://localhost:3000>. To test Google login this way, set `PUBLIC_URL=http://localhost:3000` and register `http://localhost:3000/steps` as an extra redirect URI.

## Project structure

```
.
├── docker-compose.yml          # the whole stack
├── .env.example                # configuration template
├── apidoc/                     # REST API docs (src/ = annotations, apidoc/ = generated HTML)
└── containers/
    ├── nginx/                  # reverse proxy + self-signed certificate generator
    ├── mailer/                 # RabbitMQ consumer that sends emails
    └── node/                   # web app
        ├── src/
        │   ├── server.js       # entry point: wires real dependencies, waits for CouchDB
        │   ├── app.js          # Express app factory (dependencies are injected)
        │   ├── config.js       # every environment variable in one place
        │   ├── clients/        # Google Books, Google account (OAuth + Calendar), CouchDB
        │   ├── repositories/   # reviews and users stored in CouchDB
        │   ├── messaging/      # RabbitMQ publisher for the mail queue
        │   ├── middleware/     # cookie-based Google session
        │   ├── routes/         # pages, auth, library (shelves), reviews, REST API
        │   └── lib/
        ├── views/              # Pug templates (shared layout + partials)
        ├── public/             # static files (Bootstrap, CSS, images)
        └── test/               # node:test + supertest
```

## Troubleshooting

- **`Error 400: redirect_uri_mismatch` when logging in**: the redirect URI in Google Cloud must match `GOOGLE_REDIRECT_URI` (default `https://localhost/steps`) character for character.
- **`Error 403: access_denied`**: while the OAuth app is in *Testing* mode, add your account under *OAuth consent screen → Test users*.
- **"I servizi Google non rispondono"**: Google Books answered 429 (quota exceeded, check `GOOGLE_API_KEY`) or 5xx. The Books API sometimes answers `503 backendFailed`. The app already retries a few times, so reloading the page usually works.
- **Port 80 or 443 already in use**: set `HTTP_PORT` / `HTTPS_PORT` in `.env`. Then also change `PUBLIC_URL`, for example `https://localhost:8443`, and the redirect URI to match.
- **Start from a clean state**: run `docker compose down -v`, delete `./certs`, and run `docker compose up --build` again.
