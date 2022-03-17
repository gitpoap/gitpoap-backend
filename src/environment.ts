import env from 'env-var';

export const JWT_SECRET = env.get('JWT_SECRET').required().asString();

export const NODE_ENV = env.get('NODE_ENV').required().asString();

export const AWS_PROFILE = env.get('AWS_PROFILE').asString();

export const DATABASE_URL = env.get('DATABASE_URL').required().asString();

export const POAP_API_URL = env.get('POAP_API_URL').required().asString();
export const POAP_AUTH_URL = env.get('POAP_AUTH_URL').required().asString();
export const POAP_CLIENT_ID = env.get('POAP_CLIENT_ID').required().asString();
export const POAP_CLIENT_SECRET = env.get('POAP_CLIENT_SECRET').required().asString();

export const INFURA_API_KEY = env.get('INFURA_API_KEY').asString();

export const GITHUB_URL = env.get('GITHUB_URL').required().asString();
export const GITHUB_API_URL = env.get('GITHUB_API_URL').required().asString();

export const GITHUB_APP_CLIENT_ID = env.get('GITHUB_APP_CLIENT_ID').required().asString();
export const GITHUB_APP_CLIENT_SECRET = env.get('GITHUB_APP_CLIENT_SECRET').required().asString();
export const GITHUB_APP_REDIRECT_URL = env.get('GITHUB_APP_REDIRECT_URL').required().asString();
