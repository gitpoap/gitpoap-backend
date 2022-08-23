import fetch from 'cross-fetch';
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

const PUBLIC_API_URL = 'http://public-api-server:3122';

describe('public-api/v1/poap-event/:poapEventId/is-gitpoap', () => {
  it('Returns false for a non-GitPOAP POAP Event ID', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap-event/2344444/is-gitpoap`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.isGitPOAP).toEqual(false);
  });

  it('Returns true and the GitPOAP Event ID for a GitPOAP POAP Event ID', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap-event/1/is-gitpoap`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.isGitPOAP).toEqual(true);
    expect(data.gitPOAPId).toEqual(1);
  });
});

describe('public-api/v1/poap-event/gitpoap-event-ids', () => {
  it('Returns IDs for all GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap-event/gitpoap-event-ids`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.poapEventIds).not.toEqual(null);
    expect(data.poapEventIds.length).toEqual(16);
    expect(data.poapEventIds).toContainEqual(event1.id);
    expect(data.poapEventIds).toContainEqual(event2.id);
    expect(data.poapEventIds).toContainEqual(event3.id);
    expect(data.poapEventIds).toContainEqual(event19375.id);
    expect(data.poapEventIds).toContainEqual(event29009.id);
    expect(data.poapEventIds).toContainEqual(event34634.id);
    expect(data.poapEventIds).toContainEqual(event36568.id);
    expect(data.poapEventIds).toContainEqual(event36569.id);
    expect(data.poapEventIds).toContainEqual(event36570.id);
    expect(data.poapEventIds).toContainEqual(event36571.id);
    expect(data.poapEventIds).toContainEqual(event36572.id);
    expect(data.poapEventIds).toContainEqual(event37428.id);
    expect(data.poapEventIds).toContainEqual(event37429.id);
    expect(data.poapEventIds).toContainEqual(event37430.id);
    expect(data.poapEventIds).toContainEqual(event36573.id);
    expect(data.poapEventIds).toContainEqual(event36574.id);
  });
});

describe('public-api/v1/poap-event/gitpoap-event-fancy-ids', () => {
  it('Returns Fancy IDs for all GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap-event/gitpoap-event-fancy-ids`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.poapEventFancyIds).not.toEqual(null);
    expect(data.poapEventFancyIds.length).toEqual(16);
    expect(data.poapEventFancyIds).toContainEqual(event1.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event2.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event3.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event19375.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event29009.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event34634.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36568.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36569.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36570.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36571.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36572.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event37428.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event37429.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event37430.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36573.fancy_id);
    expect(data.poapEventFancyIds).toContainEqual(event36574.fancy_id);
  });
});
