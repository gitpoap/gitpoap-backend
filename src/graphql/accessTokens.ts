export type GQLAccessTokens = {
  frontend: string;
  user: string | null;
};

function isGQLAccessTokens(payload: any): payload is GQLAccessTokens {
  return (
    typeof payload === 'object' &&
    'frontend' in payload &&
    typeof payload.frontend === 'string' &&
    'user' in payload &&
    (typeof payload.user === 'string' || payload.user === null)
  );
}

export function getGQLAccessTokens(payload: any): GQLAccessTokens {
  if (isGQLAccessTokens(payload)) {
    return payload;
  }

  throw 'Tried to convert payload to GQLAccessTokens but it is not!';
}
