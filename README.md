# gitpoap-backend

[![Deploy to Amazon ECS (PROD)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-server.yml)
[![Deploy Public API to Amazon ECS (PROD)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-server.yml)

[![Deploy Backend to Amazon ECS (STAGING)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-staging-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-staging-server.yml)
[![Deploy Public API to Amazon ECS (STAGING)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-staging-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-staging-server.yml)

## Running Locally with docker-compose

Example `.env`:
```sh
APP_NAME=gitpoap-backend

JWT_SECRET=yoyo

AWS_PROFILE=docker-agent

NODE_ENV=local

DATABASE_URL="postgresql://postgres:foobar88@localhost:5432"

POAP_API_URL="http://localhost:4004"
POAP_AUTH_URL="http://localhost:4005"
POAP_CLIENT_ID="a good client id"
POAP_CLIENT_SECRET="super secret!"
POAP_API_KEY="key to the city"

GITHUB_URL="https://github.com"
GITHUB_API_URL="https://api.github.com"

GITHUB_APP_CLIENT_ID="foobar"
GITHUB_APP_CLIENT_SECRET="whoville"
GITHUB_APP_REDIRECT_URL="http://localhost:3000/login"

REDIS_URL="redis://gitpoap-redis:ICanHazASecurePassword@localhost:6379"
MAILCHIMP_API_KEY="fake-key-us14"
SENTRY_DSN="https://test.ingest.sentry.io/12345"
POSTMARK_SERVER_TOKEN="fake-token"
```

### Entire Backend

To run all of the services (`fake-poap-api`, `fake-poap-auth`, `db`, `redis`, and `server`) locally
(with seeded data), we can run:
```sh
yarn docker:server
```

### Everything but the Server

To run background services (`fake-poap-api`, `fake-poap-auth`, `db`, and `redis`), we can run:
```sh
yarn docker:background
```
then you can easily work on the backend API while making code changes locally (which will restart after any changes) via:
```sh
# First time to migrate and seed the DB:
yarn first-time-dev
# After we've already seeded the DB but want to restart the server for some reason:
yarn dev
```

## Changing the Logging Level

You can change the logging level by specifying one option (`debug`, `info`, `warn`, `error`) to the `--level` option
on the command line. For example:
```sh
yarn run dev --level debug
```

## Testing

### Unit Testing

Unit tests are stored in the `__tests__/unit` folder. The structure of the inside of this folder should mirror that in `src/`.

To run the unit tests:
```sh
yarn test
```

Please keep all common mocks used in tests within `__mocks__`. The structure of the inside of this folder should mirror that in `src/`.

### Integration Testing

Integration tests are stored in the `__tests__/integration` folder. The structure of the inside of this folder should mirror that in `src/`.

To run the integration tests:
```sh
yarn integration-test
```

For a quicker loop when developing tests (the builds can take a while) you can use:
```sh
# Leave this running in one terminal tab:
yarn docker:public-api

# Repeat this as needed in another terminal tab:
yarn quick-integration-test
```
Note that the later command will not work unless all the docker services in the `public-api` profile are up (this is what the first command accomplishes).
Furthermore, note that you will need to rerun the first command if you need to make changes to some source location other than `__tests__` or `__mocks__`.

## Extra Resources

* https://www.pullrequest.com/blog/intro-to-using-typescript-in-a-nodejs-express-project/
* https://github.com/auth0/node-jsonwebtoken/
* https://github.com/auth0/express-jwt
* https://stackoverflow.com/questions/42406913/nodejs-import-require-conversion
* https://javascript.plainenglish.io/how-to-get-typescript-type-completion-by-defining-process-env-types-6a5869174f57
* https://stackoverflow.com/questions/66328425/jwt-argument-of-type-string-undefined-is-not-assignable-to-parameter-of-typ
* [prisma migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
* [relational queries (creation)](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#create-a-related-record)
