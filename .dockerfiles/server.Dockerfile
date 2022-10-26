FROM node:16.15.1

WORKDIR /usr/src/server

ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh ./wait-for-it.sh
RUN chmod +x ./wait-for-it.sh

COPY package.json yarn.lock ./

# the schema needs to be available to install node_modules
RUN mkdir prisma
COPY prisma/schema.prisma prisma/schema.prisma

RUN yarn install

COPY ./ ./

# Let's use a .env local to our docker setup
COPY .dockerfiles/server.env .env

EXPOSE 3001 8080

CMD ["./.dockerfiles/run-server.sh"]
