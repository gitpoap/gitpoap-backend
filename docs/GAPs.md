# Generalized Accomplishment POAPs Plan

This document describes the plan for implementing Generalized Accomplishment POAPs (GAPs). GAPs are a set of GitPOAPs that have the following properties: (1) They are not specific to users, & open for all GitHub users to claim; (2) They are based on a users total set of contributions on GitHub, not just those specific to a particular project.

That said, the work involved wrt building this feature involves DB changes, the use of a rules engine, and a background process that periodically checks whether a user qualifies for a new GAP or set of GAPs.

## DB Changes

To implement this feature, we will modify the existing `GitPOAP` table to make it more generalized relative to its current state, which is highly-specific to annual contributor & tiered gitPOAPs.

A new enum option, `GENERAL` will be added to the the `ClaimType` enum that is used for `GitPOAP.type`. It will look like the following:

```prisma
enum ClaimType {
  ANNUAL
  QUARTERLY
  MANUAL
  GENERAL // addition
}
```

To support GAPs, a number of fields on `GitPOAP` table will be made optional - namely, `year`, `project`, & `projectId`.

```prisma
model GitPOAP {
  id              Int           @id @default(autoincrement())
  type            ClaimType     @default(ANNUAL)
  year            Int?
  poapEventId     Int           @unique
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  claims          Claim[]
  // Hide poapSecret from generated resolvers
  /// @TypeGraphQL.omit(output: true, input: true)
  poapSecret      String        @db.VarChar(6)
  status          GitPOAPStatus @default(UNAPPROVED)
  // If a GitPOAP is marked as ongoing then the backend will automatically
  // request additional codes when we reach a minimum number remaining
  ongoing         Boolean       @default(false)
  redeemCodes     RedeemCode[]
  eventId         Int?
  event           Event?        @relation(fields: [eventId], references: [id])
  projectId       Int?
  project         Project?       @relation(fields: [projectId], references: [id])
}
```

## Rules Engine

In order to define rules in a structured & declarative way, & minimize the amount of in-line conditionals, we will use a rules engine to define rules for GAPs. After evaluating a number of possible open source rules engine libraries written in JS / TS, we've selected `json-rules-engine` due to it's high usage, & solid documentation. One unfortunate downside is that the library hasn't been updated since June 2021. In the case where bugs are showstoppers, we will fork the code & fix ourselves.

A brief description of how `json-rules-engine` works - 3 primary entities exist: (1) the Engine; (2) a Rules object; & (3) a Fact. A Fact represents a set of structured data that is evaluated by the engine according to the rules object.

The first proof-of-concept GAP that we intend to create is the `Bear Market Builder` GAP - a token that signifies that a holder has merged a PR into any open source repo with > 10 starts since the official start of the crypto bear market.

The rule as defined for `json-rules-engine` would look something like the following:

```typescript
import { Engine } from 'json-rules-engine';

const engine = new Engine();

const bearMarketBuilderRule = {
  conditions: {
    all: [
      {
        fact: 'prs-in-bear-market',
        operator: 'greaterThanInclusive',
        value: 5,
        path: '$.prCount',
      },
    ],
  },
  event: {
    type: 'create-gap-claim',
    params: {
      message: 'current user is eligible for the bear market builder gitpoap',
      gitPOAPId: 10,
    },
  } as GapClaimEvent,
};

engine.addFact('prs-in-bear-market', (params, almanac) => {
  const githubHandle = await almanac.factValue('githubHandle');
  const { issueCount: prCount } = await octokit.graphql(
    `
      query {
        search(query: "merged:>2022-01-01 author:${githubHandle} is:pr is:merged" type: ISSUE, first: 100) {
          issueCount
        }
      }
  `,
  );

  return { prCount };
});

// subscribe directly to the 'create-gap-claim' event
engine.on('create-gap-claim', (params, almanac) => {
  const userId = await almanac.factValue('userId', userId);
  const claim = context.prisma.claim.create({
    gitPOAPId: params.gitPOAPId,
    userId,
    //...
  });
});

const facts = { githubHandle: 'peebeejay', userId: 1, existingGAPs: [...] };
const { events } = await engine.run(facts);
```

## File Structure

```
/gaps
|-- /rules
|       |-- bearMarketBuilder.ts
|       |-- ...
|       `-- openSourceContributor.ts
|-- engine.ts // load all the rules & facts in this file -> create the engine
`-- index.ts // perhaps run the engine for all UserIDs here
```
