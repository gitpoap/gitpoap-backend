import '../../../../__mocks__/src/logging';
import { AuthRoles, authChecker } from '../../../../src/graphql/auth';
import { ADDRESSES } from '../../../../prisma/constants';
import { STAFF_ADDRESSES } from '../../../../src/constants';

jest.mock('../../../../src/logging');

describe('authChecker', () => {
  it('Passes auth when no roles are provided', () => {
    const result = authChecker({} as any, []);

    expect(result).toEqual(true);
  });

  it('Fails auth when Address role required but no UserAccessToken provided', () => {
    const result = authChecker(
      {
        context: { userAccessTokenPayload: null },
        info: 'info',
      } as any,
      [AuthRoles.Address],
    );

    expect(result).toEqual(false);
  });

  it('Passes auth when Address role required and UserAccessToken provided', () => {
    const result = authChecker({ context: { userAccessTokenPayload: true } } as any, [
      AuthRoles.Address,
    ]);

    expect(result).toEqual(true);
  });

  it('Fails auth when Staff role required but no UserAccessToken provided', () => {
    const result = authChecker(
      {
        context: { userAccessTokenPayload: null },
        info: 'info',
      } as any,
      [AuthRoles.Staff],
    );

    expect(result).toEqual(false);
  });

  it('Fails auth when Staff role required but non-staff UserAccessToken provided', () => {
    const result = authChecker(
      {
        context: {
          userAccessTokenPayload: {
            address: ADDRESSES.vitalik,
          },
        },
        info: 'info',
      } as any,
      [AuthRoles.Staff],
    );

    expect(result).toEqual(false);
  });

  it('Passes auth when Staff role required and staff UserAccessToken provided', () => {
    const result = authChecker(
      {
        context: {
          userAccessTokenPayload: {
            address: STAFF_ADDRESSES[0],
          },
        },
      } as any,
      [AuthRoles.Staff],
    );

    expect(result).toEqual(true);
  });
});
