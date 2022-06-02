# DB Notes

## Adding a Non-nullable, no Default Column to Tables with Existing Rows

Suppose that we would like to add a new column to an existing table that already has some rows in it. Due to the
nature of our setup and CI/CD we need to do this in a multi-step process:

1. Add the column to `prisma/schema.prisma` as a _nullable_ column so that we can add the column to the existing
   rows without getting stuck
2. Roll out the migration to staging
3. Run a script/etc to fill out the columns values on the existing rows in the DB (on the staging `db-client` EC2
   instance)
4. Roll out the migration to production
5. Repeat step (3) on the production DB/`db-client`
6. Connect to the `db-client`s and run something like the following in `psql` to ensure there are no null rows left:
   ```sql
   SELECT * FROM "SomeTable" WHERE "columnThatWasAdded" IS NULL;
   ```
7. Change the column in `prisma/schema.prisma` to be non-nullable.
8. Roll out to staging and then production

## Handling Migration Issues

If we run into an issue where the migration fails to deploy via the `db-migrator` (hopefully this failure happened
during the deploy to staging step), we need to do the following:

1. Log into the appropriate `db-client` EC2 instance and run:
   ```sh
   prisma migrate resolve --rolled-back 20201127134938_NAME_OF_FAILED_MIGRATION
   ```
2. Fix the migration locally on Docker:
   - Check out `main` (in the case of staging issues) or the commit before the first commit of the last PR and run
     ```sh
     docker-compose up --force-recreate -V --build db
     ```
   - Run the existing migrations:
     ```sh
     npx prisma migrate dev
     ```
   - Now without stopping the DB checkout `develop` (or `main` in the case of a PROD issue) and remove the failing migration.
     Note that if the failure was because a migration was lost in the history somehow (or renamed/rebased into another one),
     check out the previous migration first.
   - Rerun the migration so that a new fixed migration step is created:
     ```sh
     npx prisma migrate dev
     ```
3. Commit the new migration and ensure that the `db-migrator` succeeds its migration

References:

- [Failed Migrations | Prisma Docs](https://www.prisma.io/docs/guides/database/production-troubleshooting#failed-migration)
