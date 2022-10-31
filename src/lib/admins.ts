import { ADMIN_ADDRESSES, ADMIN_GITHUB_IDS } from '../constants';

export function isAddressAnAdmin(address: string) {
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

export function isGithubIdAnAdmin(githubId: number) {
  return ADMIN_GITHUB_IDS.includes(githubId);
}
