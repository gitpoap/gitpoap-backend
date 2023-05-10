# Running Locally with docker-compose

## Setting up the .env

Example `.env`:

```sh
APP_NAME=gitpoap-backend

JWT_SECRET=heyhey

AWS_PROFILE=default

NODE_ENV=local

DATABASE_URL="postgresql://postgres:foobar88@localhost:5432"

POAP_API_URL="http://localhost:4004"
POAP_AUTH_URL="http://localhost:4005"
POAP_CLIENT_ID="a good client id"
POAP_CLIENT_SECRET="super secret!"
POAP_API_KEY="some-api-key"

GITHUB_URL="https://github.com"
GITHUB_API_URL="https://api.github.com"

GITHUB_APP_CLIENT_ID="some-client-id"
GITHUB_APP_CLIENT_SECRET="some-client-secret"
GITHUB_APP_REDIRECT_URL="http://localhost:3000/login"

REDIS_URL="redis://gitpoap-redis:ICanHazASecurePassword@localhost:6379"

METRICS_PORT=8080

POSTMARK_SERVER_TOKEN="fake"

GRAPHIQL_PASSWORD=gitpoap

PRIVY_APP_ID="some-privy-id"
PRIVY_APP_SECRET="some-app-secret"
PRIVY_APP_PUBLIC_KEY="some-privy-public-key"
```

## Entire Backend

To run all of the services (`fake-poap-api`, `fake-poap-auth`, `db`, `redis`, and `server`) locally
(with seeded data), we can run:

```sh
yarn docker:server
```

## Everything but the Server

To run background services (`fake-poap-api`, `fake-poap-auth`, `db`, and `redis`), we can run:

```sh
yarn docker:background
```

then you can easily work on the backend API while making code changes locally (which will restart after any changes) via:

```sh
# First time to migrate and seed the DB:
yarn dev:first-time
# After we've already seeded the DB but want to restart the server for some reason:
yarn dev
```

## Changing the Logging Level

You can change the logging level by specifying one option (`debug`, `info`, `warn`, `error`) to the `--level` option
on the command line. For example:

```sh
yarn run dev --level debug
```
