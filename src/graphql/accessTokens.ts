export type GQLAccessToken = {
  user: string | null;
};

function isGQLAccessToken(payload: any): payload is GQLAccessToken {
  return (
    payload &&
    typeof payload === 'object' &&
    'user' in payload &&
    (typeof payload.user === 'string' || payload.user === null)
  );
}

export function getGQLAccessToken(payload: any): GQLAccessToken {
  if (isGQLAccessToken(payload)) {
    return payload;
  }

  throw 'Tried to convert payload to GQLAccessToken but it is not!';
}
