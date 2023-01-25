import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../src/environment';
import { GraphQLClient } from 'graphql-request';
import { context } from '../../../src/context';
import {
  AccessTokenPayload,
  AddressPayload,
  DiscordPayload,
  EmailPayload,
  GithubPayload,
} from '../../../src/types/authTokens';

export function genGQLAccessToken(userPayload?: AccessTokenPayload) {
  if (userPayload !== undefined) {
    return sign(userPayload, JWT_SECRET);
  }

  return 'null';
}

export function getGraphQLClient(userPayload?: AccessTokenPayload) {
  return new GraphQLClient('http://server:3001/graphql', {
    headers: {
      authorization: `Bearer ${genGQLAccessToken(userPayload)}`,
    },
  });
}

type AuthSpec = {
  ethAddress?: string;
  githubHandle?: string;
  emailAddress?: string;
  discordHandle?: string;
};

export async function getGraphQLClientWithAuth({
  ethAddress,
  githubHandle,
  emailAddress,
  discordHandle,
}: AuthSpec) {
  let address: AddressPayload | null = null;
  if (ethAddress !== undefined) {
    address = await context.prisma.address.findUnique({
      where: { ethAddress },
    });
    expect(address).not.toEqual(null);
  }

  let github: GithubPayload | null = null;
  if (githubHandle !== undefined) {
    github = await context.prisma.githubUser.findFirst({
      where: { githubHandle },
    });
    expect(github).not.toEqual(null);
  }

  let email: EmailPayload | null = null;
  if (emailAddress !== undefined) {
    email = await context.prisma.email.findUnique({
      where: { emailAddress },
    });
    expect(email).not.toEqual(null);
  }

  let discord: DiscordPayload | null = null;
  if (discordHandle !== undefined) {
    discord = await context.prisma.discordUser.findFirst({
      where: { discordHandle },
    });
    expect(discord).not.toEqual(null);
  }

  return getGraphQLClient({
    privyUserId: 'foobar',
    address,
    github,
    email,
    discord,
    memberships: [],
  });
}
