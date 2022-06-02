# Tiered Issuance

We will be adding tiered issuance capabilities to the backend. To do this we need to do a number of things.
In summary, we need to:

* Add the concept of levels (1, 2, 3...) to GitPOAPs as well as "thresholds" (number of PRs to a repo required
    for this level)
* Update ongoing issuance to check to check if a contributor has passed a new threshold when they have had a
    new PR merged
* Update the codes-uploading step to create claims for users at the different thresholds after the historical
    PR data has been loaded

## Levels & Thresholds

We will add the following columns to the GitPOAP model:
```
level     Int @default(1) // Levels start at 1
threshold Int @default(1) // The level 1 threshold defaults to 1 PR
```
Note that this allows us to easily roll out these changes to existing GitPOAPs since they are all level 1.

## Ongoing Issuance

Now each time a newly merged PR (i.e. a PR that we did not previously have in *our* database), we will check
how many PRs a user has had merged in the current year, if we find that this number is now equal to one of
the thresholds, we will generate a new claim for that user for that GitPOAP

## Codes-uploading

Currently we are running the backloading of the historical PR data as a background process after POAP claim
codes are uploaded via the `/admin` interface. We will update this background process to also generate the
claims for this GitPOAP.

For the purpose of efficiency, we will add a column to the `Repo` table to mark whether or not the backloader has
been run yet. If it hasn't we can skip rerunning the backloading step and instead skip to the claims generation
process.

This process will run a query like:
```sql
SELECT * FROM "User" AS u
WHERE ${gitPOAP.threshold} <= COUNT(
    SELECT p.id FROM "GithubPullRequest" AS p
    WHERE p."userId" = u.id
      AND p."repoId" = ${gitPOAP.repoId}
      AND EXTRACT(YEAR FROM p."mergedAt") = ${gitPOAP.year}
  )
```
and then create claims for all the users returned.

**Note:** After this change, we will no longer need to run the analyze scripts or upload claims manually!
