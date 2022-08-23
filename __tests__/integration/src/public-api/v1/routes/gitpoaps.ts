import fetch from 'cross-fetch';
import { ADDRESSES } from '../../../../../../prisma/constants';
import {
  event1,
  event2,
  event3,
  event19375,
  event29009,
  event34634,
  event36568,
  event36569,
  event36570,
  event36571,
  event36572,
  event37428,
  event37429,
  event37430,
  event36573,
  event36574,
} from '../../../../../../prisma/data';
import { POAPEvent } from '../../../../../../src/types/poap';
import { GitPOAPEventResultType } from '../../../../../../src/public-api/v1/types';

const PUBLIC_API_URL = 'http://public-api-server:3122';

describe('public-api/v1/gitpoaps/:gitpoapId/addresses', () => {
  it('Returns a 404 when the GitPOAP ID is not valid', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/990930423/addresses`);

    expect(response.status).toEqual(404);
  });

  it('Returns the addresses of the owners when the GitPOAP ID is valid', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/1/addresses`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.addresses).not.toEqual(null);
    expect(data.addresses.length).toEqual(2);
    expect(data.addresses).toContain(ADDRESSES.test1);
    expect(data.addresses).toContain(ADDRESSES.jay);
  });
});

describe('public-api/v1/gitpoaps/addresses', () => {
  it('Returns all addresses that have claimed GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/addresses`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.addresses).not.toEqual(null);
    expect(data.addresses.length).toEqual(5);
    expect(data.addresses).toContain(ADDRESSES.test1);
    expect(data.addresses).toContain(ADDRESSES.jay);
    expect(data.addresses).toContain(ADDRESSES.colfax);
    expect(data.addresses).toContain(ADDRESSES.burz2);
    expect(data.addresses).toContain(ADDRESSES.anthony2);
    expect(data.addresses).toContain(ADDRESSES.aldo);
  });
});

describe('public-api/v1/gitpoaps/events', () => {
  const genExpectedDataFromEvent = (
    gitPoapEventId: number,
    event: POAPEvent,
    repositories: string[],
    mintedCount: number,
  ): GitPOAPEventResultType => ({
    gitPoapEventId,
    poapEventId: event.id,
    poapEventFancyId: event.fancy_id,
    name: event.name,
    year: event.year,
    description: event.description,
    imageUrl: event.image_url,
    repositories,
    mintedCount,
  });

  it('Returns all the GitPOAP events', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/events`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.gitPoapEvents).not.toEqual(null);
    expect(data.gitPoapEvents.length).toEqual(16);
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      1,
      event1,
      ['org43/repo34'],
      2,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      2,
      event2,
      ['seven-heaven/repo7'],
      2,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      3,
      event3,
      ['some-other-org/repo568'],
      2,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      4,
      event19375,
      ['gitpoap/gitpoap-fe'],
      1,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      5,
      event29009,
      ['gitpoap/gitpoap-backend'],
      3,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      6,
      event34634,
      ['burz/dopex'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      7,
      event36568,
      ['gitpoap/gitpoap-fe'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      8,
      event36569,
      ['gitpoap/gitpoap-fe'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      9,
      event36570,
      ['gitpoap/gitpoap-backend'],
      2,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      10,
      event36571,
      ['gitpoap/gitpoap-backend'],
      1,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      11,
      event36572,
      ['gitpoap/gitpoap-backend'],
      1,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      12,
      event37428,
      ['stake-house/wagyu-installer'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      13,
      event37429,
      ['stake-house/wagyu-installer'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      14,
      event37430,
      ['stake-house/wagyu-installer'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      15,
      event36573,
      ['gitpoap/gitpoap-bot-test-repo'],
      0,
    ));
    expect(data.gitPoapEvents).toContainEqual(genExpectedDataFromEvent(
      16,
      event36574,
      ['gitpoap/gitpoap-bot-test-repo'],
      0,
    ));
  });
});
