import { ClaimStatus } from '@generated/type-graphql';

export class ClaimFactory {
  static createClaim = (
    gitPOAPId: number,
    userId: number,
    status?: ClaimStatus,
    address?: string,
    poapTokenId?: string,
  ) => ({
    gitPOAP: {
      connect: {
        id: gitPOAPId,
      },
    },
    user: {
      connect: {
        id: userId,
      },
    },
    status,
    address,
    poapTokenId,
  });
}
