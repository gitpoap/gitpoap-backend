# db-migrator lambda

This includes the code for setting up the db-migrator lambdas
on AWS that we use to run our migrations in CI/CD.

To set up the lambda or to rebuild and redeploy, the following ENV variables must be used:

Name | Description
-----|------------
`VPC_ID` | The ID of the VPC for the stage (Production or Staging)
`SECURITY_GROUP_ID` | The ID of the Security Group for the stage's `db-client` Security Group
`GITHUB_OAUTH_TOKEN` | A token with read-access to this repository
`REPO_BRANCH` | The branch of the this repository the lambda will check out before migrating
`DATABASE_URL` | A URL for the database of that stage
`STAGE_TAG` | `""` for Production or `"-staging"` for staging

Then one can run `yarn run check` to check what will be produced after the lambda is deployed
or `yarn run deploy` to redeploy the lambda.
