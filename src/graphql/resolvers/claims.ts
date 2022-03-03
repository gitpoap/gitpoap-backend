import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, ClaimStatus } from '@generated/type-graphql';
import { Context } from '../../context';
import fetch from 'cross-fetch';
import { POAPEvent } from '../types/poap';

@ObjectType()
class FullClaimData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPEvent)
  event: POAPEvent;
}

@Resolver(of => Claim)
export class CustomClaimResolver {
  @Query(returns => [FullClaimData])
  async userClaims(
    @Ctx() { prisma }: Context,
    @Arg('githubId') githubId: number,
  ): Promise<FullClaimData[] | null> {
    const claims = await prisma.claim.findMany({
      where: {
        user: {
          githubId: githubId,
        },
        status: ClaimStatus.UNCLAIMED,
      },
      include: {
        gitPOAP: {
          select: {
            poapEventId: true,
          },
        },
      },
    });

    let results: FullClaimData[] = [];

    try {
      for (let claim of claims) {
        const { gitPOAP, ...claimData } = claim;

        const poapResponse = await fetch(
          `${process.env.POAP_URL}/events/id/${gitPOAP.poapEventId}`,
        );

        if (poapResponse.status >= 400) {
          console.log(await poapResponse.text());
          return null;
        }

        const event = await poapResponse.json();

        results.push({
          claim: claimData,
          event: event,
        });
      }
    } catch (err) {
      console.log(err);

      return null;
    }

    return results;
  }
}
