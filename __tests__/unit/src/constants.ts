import { GITPOAP_BOT_APP_ID } from '../../../src/constants';

describe('constants', () => {
  it('GITPOAP_BOT_APP_ID should be the correct value', () => {
    /* Ensure that when we do development, we don't accidentally commit the dev APP_ID */
    expect(GITPOAP_BOT_APP_ID).toBe(209535);
  });
});
