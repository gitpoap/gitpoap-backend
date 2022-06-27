# Multi-repo Projects Plan

This document will outline the proposed plan to switch from our *current* DB/backend assumptions
that a GitPOAP is associated with only one repository and change it so that it can be associated
with more than one repo.

## DB Changes

We will introduce a new model, `Project` that will replace the *current* direct relationship between
a `GitPOAP` and a `Repo`:
```prisma
model Project {
  id        Int @id  @default(autoincrement())
  name      String   @db.VarChar(50)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  repos     Repo[]
}
```
and update the `Repo` model so that it references the project (A project will have a
one-to-many relationship with repositories). Note that we will also need to move the
`lastPRUpdatedAt` field from `GitPOAP` to `Repo`:
```prisma
model Repo {
  id                Int                 @id @default(autoincrement())
  name              String              @db.VarChar(50)
  githubRepoId      Int                 @unique
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  organizationId    Int
  organization      Organization        @relation(fields: [organizationId], references: [id])
  GithubPullRequest GithubPullRequest[]
  projectId         Int
  project           Project             @relation(fields: [projectId], references: [id])
  // Default to the beginning of the year, but this will update when contributions
  // are initially uploaded
  lastPRUpdatedAt   DateTime            @default(dbgenerated("date_trunc('year', now())"))
}
```
After this change, `GitPOAP` will look like:
```prisma
model GitPOAP {
  id              Int           @id @default(autoincrement())
  type            ClaimType     @default(ANNUAL)
  year            Int
  poapEventId     Int           @unique
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  claims          Claim[]
  // Hide poapSecret from generated resolvers
  /// @TypeGraphQL.omit(output: true, input: true)
  poapSecret      String        @db.VarChar(6)
  status          GitPOAPStatus @default(UNAPPROVED)
  // If a GitPOAP is marked as ongoing then the backend will automatically
  // request additional codes when we reach a minimum number remaining
  ongoing         Boolean       @default(false)
  redeemCodes     RedeemCode[]
  eventId         Int?
  event           Event?        @relation(fields: [eventId], references: [id])
  projectId       Int
  project         Project       @relation(fields: [projectId], references: [id])
}
```

## Rollout Plan

We will do the rollout in four steps (all within the same day, ideally within the same hour or so -- perhaps late at night):

1. In our first rollout to PROD, we will:
    - Add the `Project` table to the DB
    - Add a nullable `projectId` column to `GitPOAP` (keeping the `repoId` inplace)
    - Add a nullable `projectId` to `Repo`
    - Disable the creation of new Projects/GitPOAPs via the API
2. Run a script on the `db-client` machine that:
    - Creates a new `Project` row for each of the existing `Repo`s and fill in the `Repo` and associated
        `GitPOAP`'s `projectId` fields to point to that row
    - Temporarily sets each `Projects` name to be the `name` (not the owner/`Organization.name`) of the `Repo`
3. In our second rollout to PROD we will:
    - Make the `projectId` fields on `GitPOAP` and `Repo` non-nullable
    - Remove the `repoId` field from `GitPOAP`
    - Re-enable creation of new Projects/GitPOAPs via the API
    - Create an (admin) "Add repo to project" endpoint that accepts repos as a list of "owner/repo"
4. Finally, we can manually (or perhaps create a script ahead of time) update any projects that we need
    to use different names for than the original columns

In this way we get 90% of the work done for free but will need to update the names of a few projects after the fact,
but most everything is completely automated.

Finally we can add the additional repos via the newly created "Add repo to project" endpoint.

This work will all be laid out and tested locally ahead of time, so the outline of what will need to be changed w.r.t. the frontend
will be well known beforehand and we can stage the changes in anticipation.
