# gitpoap-backend Documentation

## Caveats

Unfortunately there are some external requirements that make it a bit difficult to test things locally via the frontend, namely:
* Most authorization routes require Privy-access, which you would need to have an account via Privy in order to access
* Most GitHub-based data access requires an OAuth app

If you don't have access to either of these, the recommended route is to do a develop-testing loop with either the unit tests
or the integration tests.

If you feel you absolutely need access to these to check a new feature please contact <team@gitpoap.io> and we will potentially
share access on a case-by-case basis.

## Development

Please see the docs on [running the server locally](https://github.com/gitpoap/gitpoap-backend/blob/main/docs/Running-locally.md)

You should be able to easily test things against the [frontend](https://github.com/gitpoap/gitpoap-fe) so long as you don't
need to access authorization-based routes.

## Testing

We use both unit tests and integration tests (within `__tests__/unit/` and `__tests__/integration/`, respectively).
See the [docs on testing](https://github.com/gitpoap/gitpoap-backend/blob/main/docs/Testing.md) for more information.

## Contributing

Please see the [contribution guide](https://github.com/gitpoap/gitpoap-backend/blob/main/CONTRIBUTING.md) for best practices
to have your changes accepted.
