# Maintainer View Schema Changes

## Steps for DB Migration to new Schema

### Stage 1

- Create Address table
- Create OrganizationMembership Table
- Add MembershipRole enum
- Change userId field on Claim to githubUserId

- Add new optional field ~ email to Claim
- Rename address to oldMintedAddress on Claim
- Rename address to oldAddress on Profile
- Add uniqueness constraints to claim

### Stage 2

- Add optional addressId to Profile
- Add optional addressId to Claim
- Add optional mintedAddressId to Claim

### Stage 3

- Run script to populate Address records ~ iterate through all profiles and all claims & create Address records for each
- Run script to populate optional addressId on Profile
- Run script to populate optional addressId on Claim
- Run script to populate optional mintedAddressId on Claim

### Stage 4

- Remove oldAddress from Profile
- Remove oldMintedAddress from Claim
- Convert optional addressId on Profile to be required / not null
- Convert required githubUserId on Claim to optional
