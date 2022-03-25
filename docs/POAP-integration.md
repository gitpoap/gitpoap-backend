# POAP Integration

We will briefly describe our integration with GitPOAP and how we
are going (to have to) handle creating (Git)POAPs, retrieving
codes to mint them, and then actually minting them.

## Creating GitPOAPs

When creating GitPOAPs we first need to consider whether the
distribution is "ongoing" or not. By that we mean whether there
are new contributions that will warrant issuance of additional
Claims for this particular GitPOAP.

If the distribution is not ongoing, then we should calculate
the exact number of Claims we will need to issue, and then we
should provide that number as the "Requested Codes" field, and mark
that the GitPOAP is NOT ongoing during its creation.

On the other hand, if the GitPOAP is ongoing, we should try to make
a reasonable estimate of how many Claims we will distribute until
it is no longer ongoing and include that number when creating as
"Requested Codes".

## After Creating GitPOAPs

After we've created the GitPOAPs on our end, they are marked as
`UNAPPROVED` in our DB. We will need to wait around 24 hours for
someone on the POAP team to approve our new (Git)POAP. When that
happens, we will receive an email to the address we used when
creating the GitPOAP with an attachment named `links.txt` that
contains URLs with claim codes.

This file will be uploaded to the site by an Admin so that we
can load these codes into our database so that they can be used
in user's claims later on.

After uploading these codes, the GitPOAP will be marked as `APPROVED`
in our database.

## When a User Claims a GitPOAP

When a user claims a GitPOAP, they will use up one of the codes we
have stored in our DB. For GitPOAPs that are not ongoing we do not
need to do anything, but for GitPOAPs that are ongoing, we will:

- Check after _every_ claim to see if we have gone below a
  `MINIMUM_REMAINING_REDEEM_CODES`.
- If so we will make a request to POAP to provide us with
  `REDEEM_CODE_STEP_SIZE` additional codes and mark the GitPOAP
  as `REDEEM_CODES_PENDING` so that we don't make multiple requests
- After about 24 hours, someone on the POAP team will approve our
  request for additional codes and we will receive another email
  with `links.txt`, containing more claim URLs
- An admin will once again upload this file to our site so that these
  new codes can be added to the DB, and the GitPOAP will move back
  into the `ACCEPTED` state
