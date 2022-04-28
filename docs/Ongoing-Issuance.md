# Ongoing Issuance

This document describes how we plan on implementing ongoing issuance for onboarded GitHub repositories.

Since setting up webhooks requires some owner to approve our setting up of a webhook for events on their
own project, instead we will create a batch process that will run a job periodically to check for newly
merged PRs.

# Explicit Plan

Since the order of merged PRs is not necessarily the same order in which the PRs are created (e.g. the
PR number is not necessarily increasing for each PR that is merged), we will instead store on a per-project
basis the datetime of the `"updated_at"` field for the last PR that was handled. This will be stored on the
`GitPOAP` table as `lastPRUpdatedAt`. (We need to use `"updated_at"` since we cannot sort by `"merged_at"`
in the GitHub Repositories API, but we can for `"updated_at"`.)

The process every time (every 12 hours) the ongoing issuance process is run will then be:

1. Query the GitHub API for closed PRs sorted by `updated` time, via the endpoint:
   ```
   https://api.github.com/repos/OWNER/REPO/pulls?state=closed&sort=updated&per_page=100&page=PAGE_NUM
   ```
   Note that we should stop asking for additional pages after the final item in the page is before
   `lastPRUpdatedAt`.
2. Collect any PRs that were newly merged after `lastPRUpdatedAt`.
3. For each PR, create a new claim for the GitHub user so long as they do not already have a claim for that
   year.
4. Update the `lastPRUpdatedAt` to the most recently merged PR.
