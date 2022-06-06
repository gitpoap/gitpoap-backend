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
