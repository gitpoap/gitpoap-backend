# API

## Update Profile

`POST /profiles`

Data:

```json
{
  "data": {
    "bio": "something cool, I guess"
  }
}
```

Note that the `"data"` object can accept additional (nullable) fields to update. Fields
that are not specified in `"data"` will not be updated (or made to be `null`).
`"createdAt"` should be the number returned by `Date.now()`.

Note that this endpoint requires an address-based JWT to be provided.

## Claim GitPOAPs

`POST /claims`

Data:

```json
{
  "claimIds": [4, 5]
}
```

`"createdAt"` should be the number returned by `Date.now()`.

Note that this endpoint requires an address-based JWT to be provided where the user is logged into GitHub
(i.e. both `githubId` and `githubHandle` are non-null).

## Feature a POAP

`PUT /featured/:poapTokenId`

Note that this endpoint requires an address-based JWT to be provided.

## Remove a Featured POAP

`DELETE /featured/:id` - where `:id` is the ID of the POAP (A.K.A. its `poapTokenId`)

Note that this endpoint requires an address-based JWT to be provided.

## Create a GitPOAP

`POST /gitpoaps`

This endpoint should receive the data as `multipart/form-data` with fields like the following (shown in JSON
for convenience):

```json
{
  "project": {
    "projectName": "some name",
    "githubRepoIds": [9001]
  }, // This should be a JSON string
  "name": "GitPOAP Contributor 2022",
  "description": "You contributed to GitPOAP in 2022!\nCongrats, you are a super cool person!",
  "year": 2022,
  "eventUrl": "https://github.com/gitpoap/gitpoap-backend",
  "numRequestedCodes": 10,
  "isOngoing": false,
  "canRequestMoreCodes": false,
  "city": "London", // optional
  "country": "UK" // optional
}
```

to create a project, or for an existing project:

```json
{
  "project": {
    "id": 5
  }, // This should be a JSON string
  "name": "GitPOAP Contributor 2022",
  "description": "You contributed to GitPOAP in 2022!\nCongrats, you are a super cool person!",
  "year": 2022,
  "eventUrl": "https://github.com/gitpoap/gitpoap-backend",
  "numRequestedCodes": 10,
  "isOngoing": false,
  "canRequestMoreCodes": false,
  "city": "London", // optional
  "country": "UK" // optional
}
```

Furthermore, there should be a part of the `multipart/form-data` named `"image"` that contains an uploaded
image.

Note that this endpoint requires an address-based JWT to be provided where the user is logged into GitHub
(i.e. both `githubId` and `githubHandle` are non-null) and that the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_GITHUB_IDS` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## **[DEPRECATED]** Create Claims for a GitPOAP

`POST /claims/create`

Data:

```json
{
  "gitPOAPId": 6,
  "recipientGithubIds": [1555326]
}
```

Note that this endpoint requires an address-based JWT to be provided where the user is logged into GitHub
(i.e. both `githubId` and `githubHandle` are non-null) and that the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_GITHUB_IDS` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Create Claims for a GitPOAP

`PUT /gitpoaps/:gitPOAPId/claims`

This endpoint allows the creator of a `CUSTOM` GitPOAP, or a site admin for some other `GitPOAPType` to create new Claims.

Data:

```json
{
  "contributors": {
    "githubHandles": ["burz"],
    "emails": ["burz@gitpoap.io"],
    "ethAddresses": ["0xAe95f7e7fb2FCF86148ef832FAeD2752Ae5A358a"],
    "ensNames": ["burz.eth"]
  }
}
```

Note that for the admin functionality of this endpoint requires an address-based JWT where the authenticated user is an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Upload GitPOAP Codes

`POST /gitpoaps/codes`

To upload GitPOAPs from the `list.txt` file received from POAP in an email after
either (1) a GitPOAP has been approved or (2) after a successful `redeem-request`,
we can upload it to this endpoint via `multipart/form-data` with two input fields:

- `id`: the (our DB) ID of the GitPOAP we are uploading codes for
- `codes`: the `link.txt` file

Note that this endpoint requires an address-based JWT where the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Check if a POAP is a GitPOAP

`GET /gitpoaps/poap-token-id/:id`

To check whether or not a POAP with `:id` is a GitPOAP or not. If not it will return a 404 status,
but if found it will return specific extra metadata like:

```JSON
{
  "year": 2020,
  "organization": "gitpoap",
  "repository": "gitpoap-backend"
}
```

## Add Repos to an Existing Project

`POST /projects/add-repos`

Data:

```json
{
  "projectId": 2342,
  "githubRepoIds": [2]
}
```

Note that this endpoint requires an address-based JWT to be provided where the user is logged into GitHub
(i.e. both `githubId` and `githubHandle` are non-null) and that the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_GITHUB_IDS` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Submit an onboarding request via the onboarding intake form

`POST /onboarding/intake-form`

This endpoint should receive the data as `multipart/form-data` with fields like the following:

Data:

```json
{
  "name": "John Doe",
  "email": "blah@gitpoap.io",
  "notes": "I am a cool person",
  "githubHandle": "johndoe",
  "shouldGitPOAPDesign": "true",
  "isOneGitPOAPPerRepo": "true",
  "repos": [
    {
      "full_name": "gitpoap/gitpoap-backend",
      "githubRepoId": "123456789",
      "permissions": {
        "admin": true,
        "maintain": true,
        "push": true,
        "triage": true,
        "pull": true
      }
    },
    {
      "full_name": "gitpoap/gitpoap-frontend",
      "githubRepoId": "987654321",
      "permissions": {
        "admin": true,
        "maintain": true,
        "push": true,
        "triage": true,
        "pull": true
      }
    }
  ],
  "images": [
    {
      "filename": "image.png",
      "content": "base64-encoded-image-data"
    }
  ]
}
```

```json
{
  "formData": <form-data>,
  "queueNumber": 10,
  "msg": "Successfully submitted intake form"
}
```

## Fetch the repos that a user is an admin or maintainer of

`GET /onboarding/github/repos`

This endpoint fetches these repos using the provided accessToken which maps to a GitHub OAuth token stored for the user on the backend.

Data:

```json
{
  "repos": [
    {
      "full_name": "gitpoap/gitpoap-backend",
      "githubRepoId": "123456789",
      "permissions": {
        "admin": true,
        "maintain": true,
        "push": true,
        "triage": true,
        "pull": true
      }
    },
    {
      "full_name": "gitpoap/gitpoap-frontend",
      "githubRepoId": "987654321",
      "permissions": {
        "admin": true,
        "maintain": true,
        "push": true,
        "triage": true,
        "pull": true
      }
    }
  ]
}
```

## Enable a GitPOAP

`PUT /gitpoaps/enable/:id`

This endpoint enables a GitPOAP. This means that after this action, if the GitPOAP were not already enabled,
then users will be able to complete claims on the GitPOAP as well as view the GitPOAP on the site.

Note that this endpoint requires an address-based JWT where the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Enable all GitPOAPs within a Project

`PUT /projects/enable/:id`

This endpoint enables all GitPOAPs that are associated with an individual Project. This means that after this
action, if the GitPOAP were not already enabled, then users will be able to complete claims on the GitPOAPs
within the Project as well as view those GitPOAPs on the site.

Note that this endpoint requires an address-based JWT where the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Revalidate GitPOAPs

`POST /claims/revalidate`

Data:

```json
{
  "claimIds": [4, 5],
  "address": "colfax.eth",
  "signature": {
    "data": "it is STILL me, silly",
    "createdAt": 1647987506199
  }
}
```

`"createdAt"` should be the number returned by `Date.now()`.

Also note that the `"signature"`'s `"data"` field should contain the signature created with the
`"address"` like the following:

```json
{
  "site": "gitpoap.io",
  "method": "POST /claims/revalidate",
  "createdAt": 1647987506199,
  "claimIds": [4, 5]
}
```

Note that this endpoint requires an address-based JWT to be provided where the user is logged into GitHub
(i.e. both `githubId` and `githubHandle` are non-null).

## Deprecate a GitPOAP

`PUT /gitpoaps/deprecate/:id`

This endpoint deprecates a GitPOAP. This means that after this action, the GitPOAP will no longer be
claimable, all existing UNCLAIMED claims will be deleted, and ongoing issuance will skip this GitPOAP.

Note that this endpoint requires an address-based JWT where the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Create a GitPOAPRequest

`POST /gitpoaps/custom`

This endpoint allows external users to submit requests to create new Custom GitPOAPs.
It should receive the data as `multipart/form-data` with fields like the following (shown in JSON
for convenience):

```json
{
  "projectId": 2342, // optional
  "organizationId": 45, // optional
  "name": "GitPOAP Custsom Contributor 2022",
  "contributors": {
    "githubHandles": ["burz"],
    "emails": ["burz@gitpoap.io"],
    "ethAddresses": ["0xAe95f7e7fb2FCF86148ef832FAeD2752Ae5A358a"],
    "ensNames": ["burz.eth"]
  }, // Note that all of the fields in this object are optional and it should be a JSON string
  "description": "You contributed to Custom GitPOAPs in 2022!\nCongrats, you are a super cool person!",
  "startDate": "2022-11-04",
  "endDate": "2022-11-06"
}
```

Furthermore, there should be a part of the `multipart/form-data` named `"image"` that contains an uploaded
image.

Note that this endpoint requires an address-based JWT to be provided.

## Approving a GitPOAPRequest

`PUT /gitpoaps/custom/approve/:id`

This endpoint allows an admin to approve an external user's request to create a Custom GitPOAP. Note that this endpoint will put in a request to create a POAP via the POAP API to create the POAP and will also generate all of the Claims that the submitter requested.

Note that this endpoint requires an address-based JWT where the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Rejecting a GitPOAPRequest

`PUT /gitpoaps/custom/reject/:id`

This endpoint allows an admin to reject an external user's request to create a Custom GitPOAP.

Note that this endpoint requires an address-based JWT where the authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Delete a Claim

`DELETE /claims/:id`

This endpoint users to delete Claims. If the GitPOAP for the claim is `CUSTOM` then only the creator of that Custom GitPOAP
(specified by `creatorAddress`) can delete the Claim, otherwise the user who is attempting to delete a Claim for an `ANNUAL`
GitPOAP must be an admin as defined by
[`ADMIN_ADDRESSES` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts)

Note that the Claim can only be deleted if it is still `UNCLAIMED`.

## Retrieve an Email Connected

`GET /email`

This endpoint allows a user to retrieve the email connection of the currently authenticated user.

Note that this endpoint requires an address-based JWT.

## Create an Email Connection

`POST /email`

This endpoint allows a user to connect an email address to their account. If the email is not already in use, we send an email with a verification token that expires in 24hrs.

Note that this endpoint requires an address-based JWT.

## Resend a Verification Email

`POST /email/resend`

This endpoint allows users to resend a verification email for current email connection attempt, generating a new verification token in the process.

Note that this endpoint requires an address-based JWT.

## Delete an Email

`DELETE /email`

This endpoint allows users to remove an email connection from their account.

Note that this endpoint requires an address-based JWT.

## Verify an Email Connection

`POST /verify/:activeToken`

This endpoint is used to verify an email connection attempt. If the correct active token is provided, the email connection is marked as valid. If an expired token is provided, the email connection attempt is removed.

One of 4 messages are returned based on the success of the endpoint

```typescript
{
  msg: "INVALID" | "USED" | "EXPIRED" | "VALID",
}
```

## Update a GitPOAPRequest

`PATCH /gitpoaps/custom/:gitPOAPRequestId`

This endpoint allows the creator of a GitPOAPRequest to update (non-contributor) fields while the
GitPOAPRequest is _not yet_ `APPROVED`. It should receive the data as `multipart/form-data` with fields like
the following (shown in JSON for convenience):

Data:

```json
{
  "name": "Hi",
  "description": "There",
  "startDate": "2022-11-04",
  "endDate": "2022-11-06",
  "contributors": {
    "githubHandles": ["burz"],
    "emails": ["burz@gitpoap.io"],
    "ethAddresses": ["0xAe95f7e7fb2FCF86148ef832FAeD2752Ae5A358a"],
    "ensNames": ["burz.eth"]
  } // As a JSON string
}
```

Note that all the fields above are optional.

In addition, there can be part of the `multipart/form-data` named `"image"` that contains an uploaded
image that the GitPOAPRequest should update to use.

## Upload a new Team Logo

`POST /teams/logo`

This endpoint allows the admin of a Team to upload a new logo for their team. If the logo is greater than
500px by 500px then it will be resized to fit within that square.

The image is supplied via `multipart/form-data` as a field named `"image"`.

Note that this endpoint requires an address-based JWT to be provided.

## [gitpoap-bot] Create a Claim

`PUT /claims/gitpoap-bot/create`

This endpoint allows the gitpoap-bot to create claims for either a PR or an issue.
The request to this endpoint should contain bodies like the following:

- For a Pull Request:
  ```json
  {
    "pullRequest": {
      "organization": "gitpoap",
      "repo": "gitpoap-backend",
      "pullRequestNumber": 34,
      "contributorGithubIds": [1, 23, 44],
      "wasEarnedByMention": false
    }
  }
  ```
- For an Issue:
  ```json
  {
    "issue": {
      "organization": "gitpoap",
      "repo": "gitpoap-backend",
      "issueNumber": 324,
      "contributorGithubIds": [4],
      "wasEarnedByMention": true
    }
  }
  ```

Note: The returned `ClaimData` of this will only include Claims that have
`wasEarnedByMention` set to the same value as in the request. In this way we can make
(presumably) two separate comments:

1. For any users that were mentined as being contributors to the PR/Issue
2. For the user that was the creator of the merged/closed PR/issue
