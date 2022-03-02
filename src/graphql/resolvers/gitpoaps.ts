import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import fetch from 'cross-fetch';
import { ClaimStatus, GitPOAP } from '@generated/type-graphql';
import { getLastWeekStartDatetime } from './util';
import { Context } from '../../context';
import { POAPToken } from '../types/poap';

@ObjectType()
class FullGitPOAPData {
  @Field(() => GitPOAP)
  gitPOAP: GitPOAP;

  @Field(() => POAPToken)
  POAP: POAPToken;
}

@ObjectType()
class UserPOAPs {
  @Field(() => [FullGitPOAPData])
  gitPOAPs: FullGitPOAPData[];

  @Field(() => [POAPToken])
  POAPs: POAPToken[];
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
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
  ): Promise<UserPOAPs | null> {
    // TODO: accept ENS + handle errors gracefully
    try {
      const poapResponse = await fetch(`${process.env.POAP_URL}/actions/scan/${address}`);

      if (poapResponse.status >= 400) {
        console.log(await poapResponse.text());

        return null;
      }

      const poaps = await poapResponse.json();

      console.log(poaps);

      const gitPOAPs = await prisma.claim.findMany({
        where: {
          address: address,
          status: ClaimStatus.CLAIMED,
        },
      });

      let foundGitPOAPIds = {};
      for (let gitPOAP of gitPOAPs) {
        foundGitPOAPIds[gitPOAP.poapTokenId] = gitPOAP;
      }

      let gitPOAPsOnly = [];
      let poapsOnly = [];
      for (let poap of poaps) {
        if (foundGitPOAPIds.hasOwnProperty(poap.tokenId)) {
          gitPOAPsOnly.push({
            gitPOAP: foundGitPOAPIds[poap.tokenId],
            POAP: poap,
          });
        } else {
          poapsOnly.push(poap);
        }
      }

      return {
        gitPOAPs: gitPOAPsOnly,
        POAPs: poapsOnly,
      };
    } catch (err) {
      console.log(err);

      return null;
    }
  }
}
