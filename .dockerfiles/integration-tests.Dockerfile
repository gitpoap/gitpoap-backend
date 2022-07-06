FROM node:17.4.0

WORKDIR /usr/src/integration-tests

RUN apt-get update && apt-get install -y curl

COPY package.json yarn.lock ./

# the schema needs to be available to install node_modules
RUN mkdir prisma
COPY prisma/schema.prisma prisma/schema.prisma

RUN yarn install

COPY ./ ./

RUN yarn build

# Steal the .env from the server
COPY .dockerfiles/server.env .env

CMD ["./.dockerfiles/integration-tests.sh"]
