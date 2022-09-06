import 'reflect-metadata';
import { addPRCountData } from '../../../../../src/graphql/resolvers/gitpoaps';

describe('addPRCountData', () => {
  it('Can handle when the list of GitPOAPs is empty', async () => {
    const result = await addPRCountData([]);

    expect(result.length).toEqual(0);
  });
});
