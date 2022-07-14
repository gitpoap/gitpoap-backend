# Setting ENV Variables

Suppose you are adding a new ENV variable to either the `server` or the `public-api-server`, how do you do it?
(Note that any secrets should be set via ENV, **not** checked in to the repo!)

Here's the steps:

1. Add the new environment variable to [`environment.d.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/environment.d.ts)
2. Add the new environment variable to both [`.dockerfiles/server.env`](https://github.com/gitpoap/gitpoap-backend/blob/main/.dockerfiles/server.env)
    and [`.dockerfiles/public-api-server.env`](https://github.com/gitpoap/gitpoap-backend/blob/main/.dockerfiles/server.env). Note that, if it is
    not used in one of the two, then it should be dummied out with a fake value, and also to not use a real value in these locations!
3. Update [`src/environment.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/environment.ts) to validate its type and require it to
    be present when running the servers.
4. Test that the servers still startup correctly, by running
    ```sh
    docker-compose up --build --force-recreate -V db fake-poap-a{pi,uth} redis server public-api-server
    ```
5. Add the *real* secret to the environment files in our secrets bucket on S3 for **both** production and staging. If it is for:
    * An ENV variable related to AWS: set it in
        [`gitpoap-backend-aws-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-backend-aws-secrets.env),
        [`gitpoap-backend-staging-aws-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-backend-staging-aws-secrets.env),
        [`gitpoap-public-api-aws-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-public-api-aws-secrets.env), and
        [`gitpoap-public-api-staging-aws-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-public-api-staging-aws-secrets.env)
    * An ENV variable for some external service: set it in
        [`gitpoap-backend-external-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-backend-external-secrets.env),
        [`gitpoap-backend-staging-external-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-backend-staging-external-secrets.env),
        and [`gitpoap-public-api-external-secrets.env`](https://s3.console.aws.amazon.com/s3/object/gitpoap-secrets?region=us-east-2&prefix=gitpoap-public-api-external-secrets.env)
