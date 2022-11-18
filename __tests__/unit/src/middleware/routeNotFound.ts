import request from 'supertest';
import { setupApp as setupServerApp } from '../../../../__mocks__/src/app';
import { setupApp as setupPublicApiApp } from '../../../../__mocks__/src/public-api/app';
import { Express } from 'express';

/* eslint-disable jest/expect-expect */

describe('routeNotFoundHandler', () => {
  type SetupAppType = () => Promise<Express>;

  const runTest = async (setupApp: SetupAppType) => {
    {
      const result = await request(await setupApp())
        .get('/foo/bar')
        .send();
      expect(result.status).toEqual(404);
      expect(result.body).toEqual({
        msg: 'Route GET /foo/bar not found!',
      });
    }
    {
      const response = await request(await setupApp())
        .post('/yeet')
        .send();
      expect(response.status).toEqual(404);
      expect(response.body).toEqual({
        msg: 'Route POST /yeet not found!',
      });
    }
  };

  it("server: Router returns 404 when the route doesn't exist", async () => {
    await runTest(setupServerApp);
  });

  it("public-api: Router returns 404 when the route doesn't exist", async () => {
    const setupApp: SetupAppType = () => new Promise(resolve => resolve(setupPublicApiApp()));

    await runTest(setupApp);
  });
});
