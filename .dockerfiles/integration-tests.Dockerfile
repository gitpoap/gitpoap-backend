FROM node:16.15.1

WORKDIR /usr/src/integration-tests

RUN apt-get update && apt-get install -y curl

ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh ./wait-for-it.sh
RUN chmod +x ./wait-for-it.sh

COPY package.json yarn.lock ./

# the schema needs to be available to install node_modules
RUN mkdir prisma
COPY prisma/schema.prisma prisma/schema.prisma

RUN yarn install

COPY ./ ./

# Steal the .env from the server
COPY .dockerfiles/server.env .env

CMD ["./.dockerfiles/integration-tests.sh"]
