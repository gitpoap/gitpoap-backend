import '../__mocks__/src/external/slack';
import { MILLISECONDS_PER_SECOND } from '../src/constants';

/* Mock out the slack client for ALL tests */
jest.mock('../__mocks__/src/external/slack');

/* Set a longer timeout for all the tests */
jest.setTimeout(10 * MILLISECONDS_PER_SECOND);
