export const ErrorText = {
  InvalidAuth: 'GQL access token is invalid',
  MissingAuth: 'No authorization provided',
  Internal: 'Internal server error',
  TeamNotFound: 'Team not found',
};

export const MissingAuthError = new Error(ErrorText.MissingAuth);
export const InvalidAuthError = new Error(ErrorText.InvalidAuth);
export const InternalError = new Error(ErrorText.Internal);
export const TeamNotFoundError = new Error(ErrorText.TeamNotFound);
