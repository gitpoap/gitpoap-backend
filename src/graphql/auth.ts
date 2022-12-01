import { AuthChecker, ResolverData } from 'type-graphql';
import { Context } from '../context';
import { createScopedLogger } from '../logging';
import { AccessTokenPayload } from '../types/authTokens';
import { isAddressAStaffMember } from '../lib/staff';

export enum AuthRoles {
  Address,
  Staff,
}

type AuthContext = Context & {
  frontendAuthToken: string;
  userAccessTokenPayload: AccessTokenPayload | null;
};

export const authChecker: AuthChecker<AuthContext, AuthRoles> = (
  { context, info }: ResolverData<AuthContext>,
  roles: AuthRoles[],
) => {
  const logger = createScopedLogger('authChecker');

  // If this only requires the frontend to be authenticated
  if (roles.length === 0) {
    return true;
  }

  // If this requires a user to be logged in
  if (roles.some(v => v === AuthRoles.Address) && context.userAccessTokenPayload !== null) {
    return true;
  }

  // If this requires a staff member to be logged in
  if (
    roles.some(v => v === AuthRoles.Staff) &&
    context.userAccessTokenPayload !== null &&
    isAddressAStaffMember(context.userAccessTokenPayload.address)
  ) {
    return true;
  }

  logger.warn(`User tried to access ${info.fieldName} without any of required roles ${roles}`);

  // None of the roles were satisfied
  return false;
};
