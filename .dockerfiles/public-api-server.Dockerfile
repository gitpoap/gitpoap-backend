FROM node:16.15.1

WORKDIR /usr/src/server

RUN apt update && apt install -y postgresql-client-common postgresql-client

ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh ./wait-for-it.sh
RUN chmod +x ./wait-for-it.sh

COPY package.json yarn.lock ./

# the schema needs to be available to install node_modules
RUN mkdir prisma
COPY prisma/schema.prisma prisma/schema.prisma

RUN yarn install

COPY ./ ./

RUN yarn build

# let's use a .env local to our docker setup
COPY .dockerfiles/public-api-server.env .env

EXPOSE 3122 8080

RUN npx tsc --project ./

CMD ["./.dockerfiles/run-public-api-server.sh"]
