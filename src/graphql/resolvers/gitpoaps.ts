import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import fetch from 'cross-fetch';
import { Claim, ClaimStatus, GitPOAP } from '@generated/type-graphql';
import { getLastWeekStartDatetime } from './util';
import { Context } from '../../context';
import { POAPToken } from '../types/poap';

@ObjectType()
class FullGitPOAPData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPToken)
  poap: POAPToken;
}

@ObjectType()
class UserPOAPs {
  @Field(() => [FullGitPOAPData])
  gitPOAPs: FullGitPOAPData[];

  @Field(() => [POAPToken])
  poaps: POAPToken[];
}

@Resolver(of => GitPOAP)
export class CustomGitPOAPResolver {
  @Query(returns => Number)
  async totalGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.count();
    return result;
  }

  @Query(returns => Number)
  async lastWeekGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastWeekStartDatetime() },
      },
    });
    return result._count.id;
  }

  @Query(returns => UserPOAPs, { nullable: true })
  async userPOAPs(
    @Ctx() { prisma, provider }: Context,
    @Arg('address') address: string,
  ): Promise<UserPOAPs | null> {
    // Resolve ENS if provided
    const resolvedAddress = await provider.resolveName(address);
    if (resolvedAddress !== address) {
      console.log(`Resolved ${address} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        return null;
      }
    }

    try {
      const poapResponse = await fetch(`${process.env.POAP_URL}/actions/scan/${resolvedAddress}`);

      if (poapResponse.status >= 400) {
        console.log(await poapResponse.text());
        return null;
      }

      const poaps = await poapResponse.json();

      const claims = await prisma.claim.findMany({
        where: {
          address: resolvedAddress.toLowerCase(),
          status: ClaimStatus.CLAIMED,
        },
      });

      let foundPOAPIds: Record<string, Claim> = {};
      for (let claim of claims) {
        if (claim.poapTokenId === null) {
          console.log(
            `Found a null poapTokenId, but the Claim has status CLAIMED. id: ${claim.id}`,
          );
          continue;
        }
        foundPOAPIds[claim.poapTokenId] = claim;
      }

      let gitPOAPsOnly = [];
      let poapsOnly = [];
      for (let poap of poaps) {
        if (foundPOAPIds.hasOwnProperty(poap.tokenId)) {
          gitPOAPsOnly.push({
            claim: foundPOAPIds[poap.tokenId],
            poap: poap,
          });
        } else {
          poapsOnly.push(poap);
        }
      }

      return {
        gitPOAPs: gitPOAPsOnly,
        poaps: poapsOnly,
      };
    } catch (err) {
      console.log(err);

      return null;
    }
  }
}
