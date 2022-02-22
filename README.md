# gitpoap-backend

### Resources

* https://www.pullrequest.com/blog/intro-to-using-typescript-in-a-nodejs-express-project/
* https://github.com/auth0/node-jsonwebtoken/
* https://github.com/auth0/express-jwt
* https://stackoverflow.com/questions/42406913/nodejs-import-require-conversion
* https://javascript.plainenglish.io/how-to-get-typescript-type-completion-by-defining-process-env-types-6a5869174f57
* https://stackoverflow.com/questions/66328425/jwt-argument-of-type-string-undefined-is-not-assignable-to-parameter-of-typ
* [prisma migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
* [relational queries (creation)](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#create-a-related-record)

### Running locally with docker-compose

To run a local (seeded) version of the DB as well as the app, run:
```sh
docker-compose up --build --force-recreate --renew-anon-volumes
```
