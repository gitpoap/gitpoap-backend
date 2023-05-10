# Testing

## Unit Testing

Unit tests are stored in the `__tests__/unit` folder. The structure of the inside of this folder should mirror that in `src/`.

To run the unit tests:

```sh
yarn test:unit
```

Please keep all common mocks used in tests within `__mocks__`. The structure of the inside of this folder should mirror that in `src/`.

## Integration Testing

Integration tests are stored in the `__tests__/integration` folder. The structure of the inside of this folder should mirror that in `src/`.

To run the integration tests:

```sh
yarn test:integration
```

For a quicker loop when developing tests (the builds can take a while) you can use:

```sh
# Leave this running in one terminal tab:
yarn test:background

# Repeat this as needed in another terminal tab:
yarn test:quick-integration
```

Note that the later command will not work unless all the docker services in the `public-api` profile are up (this is what the first command accomplishes).
Furthermore, note that you will need to rerun the first command if you need to make changes to some source location other than `__tests__` or `__mocks__`.

## Run all tests

To run all tests you can simply use:
```sh
yarn test:all
```
