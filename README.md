# gitpoap-backend

[![Deploy to Amazon ECS (PROD)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-server.yml)
[![Deploy Public API to Amazon ECS (PROD)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-server.yml)

[![Deploy Backend to Amazon ECS (STAGING)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-staging-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-backend-staging-server.yml)
[![Deploy Public API to Amazon ECS (STAGING)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-staging-server.yml/badge.svg)](https://github.com/gitpoap/gitpoap-backend/actions/workflows/deploy-gitpoap-public-api-staging-server.yml)

This repository contains the code for the backend server for GitPOAP as well as the scripts and CI/CD necessary for running the infrastructure and deploying the application to AWS.

## Caveats

Unfortunately there are some external requirements that make it a bit difficult to test things locally via the frontend, namely:
* Most authorization routes require Privy-access, which you would need to have an account via Privy in order to access
* Most GitHub-based data access requires an OAuth app

If you don't have access to either of these, the recommended route is to do a develop-testing loop with either the unit tests
or the integration tests.

If you feel you absolutely need access to these to check a new feature please contact <team@gitpoap.io> and we will potentially
share access on a case-by-case basis.

## Development

Please see the docs on [running the server locally](https://github.com/gitpoap/gitpoap-backend/blob/main/docs/Running-locally.md).
But for most cases you should just be able to run

```bash
yarn docker:server
```

You should be able to easily test things against the [frontend](https://github.com/gitpoap/gitpoap-fe) so long as you don't
need to access authorization-based routes.

## Testing

We use both unit tests and integration tests (within `__tests__/unit/` and `__tests__/integration/`, respectively).
See the [docs on testing](https://github.com/gitpoap/gitpoap-backend/blob/main/docs/Testing.md) for more information.
But for most cases you should just be able to run

```bash
yarn test:all
```

## Contributing

Please see the [contribution guide](https://github.com/gitpoap/gitpoap-backend/blob/main/CONTRIBUTING.md) for best practices
to have your changes accepted, as well as our
[code of conduct](https://github.com/gitpoap/gitpoap-backend/blob/main/CODE_OF_CONDUCT.md) for more information on how we
expect people to behave/hold themselves accountable when interacting with this repository

If you have something you'd like to contribute, please send a Pull Request to our `develop` branch and we'll take a look.

## Credits
A strong token of gratitude goes out to all of the investors, contributors, and supporters who helped build GitPOAP.

## License
This project is licensed under the terms of [the MIT license](LICENSE).
