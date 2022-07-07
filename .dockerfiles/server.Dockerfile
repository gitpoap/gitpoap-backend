FROM node:17.4.0

WORKDIR /usr/src/server

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
