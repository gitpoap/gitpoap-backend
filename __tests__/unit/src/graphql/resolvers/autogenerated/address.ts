import supertest from 'supertest';
import { contextMock } from '../../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../../__mocks__/src/app';

const queryData = {
  query: `
  {
    addresses {
      id
      ethAddress
    }
  }
  `,
};

describe('Address Resolver', () => {
  it('returns the correct values', async () => {
    contextMock.prisma.address.findMany.mockResolvedValue([
      {
        id: 1,
        ethAddress: '0x123',
      },
    ] as any);

    const response = await supertest(await setupApp())
      .post('/graphql')
      .set('Authorization', 'Bearer null')
      .send(queryData);

    expect(response.body.data?.addresses[0].id).toBe(1);
    expect(response.body.data?.addresses[0].ethAddress).toBe('0x123');
  });
});
