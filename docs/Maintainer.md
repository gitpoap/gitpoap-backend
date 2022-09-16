## Maintainer View Schema Changes

### Steps for DB Migration to new Schema

#### Stage 1

- [x] Create Address table
- [x] Create OrganizationMembership Table
- [x] Add MembershipRole enum
- [x] Add new optional field ~ email to Claim
- [x] Rename address to oldMintedAddress on Claim
- [x] Rename address to oldAddress on Profile

#### Stage 2

- [ ] Add uniqueness constraints to Claim
- [ ] Add optional `addressId` & `address` to Profile
- [ ]  Add optional `addressId` & `address` to Claim
- [ ] Add optional `mintedAddressId` and `mintedAddress` to Claim

#### Stage 3

- [ ] Run script to migrate over `ensName` & `ensImageUrl` fields to address table
- [ ] Run script to populate Address records ~ iterate through all profiles and all claims
- [ ] Run script to populate optional `addressId` on Profile
- [ ] Run script to populate optional `addressId` on Claim
- [ ] Run script to populate optional `mintedAddressId` on Claim

#### Stage 4

- [ ] Remove `oldAddress` from Profile
- [ ] Remove `oldMintedAddress` from Claim
- [ ] Convert optional `addressId` on Profile to be required
