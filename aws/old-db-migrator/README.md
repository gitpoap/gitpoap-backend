# db-migrator

This folder holds the code used in the AWS Lambda function that we use
in our CI/CD pipeline to run DB migrations.

## Local Testing

To test locally, spin up the DB in the typical way in `docker-compose` like
```sh
docker-compose up --build --force-recreate -V db
```
and then you can run the `db-migrator` lambda like:
```sh
docker build -f db-migrator.Dockerfile . -t db-migrator && \
  docker run --network host -e GITHUB_OAUTH_TOKEN=<YOUR_GITHUB_OAUTH_TOKEN_WITH_REPO_ACCESS> db-migrator
```

## Uploading to AWS Lambda
