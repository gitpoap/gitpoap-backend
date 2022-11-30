import { STAFF_ADDRESSES, STAFF_GITHUB_IDS } from '../constants';

export function isAddressAStaffMember(address: string) {
  return STAFF_ADDRESSES.includes(address.toLowerCase());
}

export function isGithubIdAStaffMember(githubId: number) {
  return STAFF_GITHUB_IDS.includes(githubId);
}
