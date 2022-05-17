FROM node:17.4.0

WORKDIR /usr/src/server

COPY package.json yarn.lock ./

# the schema needs to be available to install node_modules
RUN mkdir prisma
COPY prisma/schema.prisma prisma/schema.prisma

RUN yarn install

COPY ./ ./

# let's use a .env local to our docker setup
COPY .dockerfiles/public-api-server.env .env

EXPOSE 3122 8080

RUN npx tsc --project ./

CMD ["yarn", "run", "start-api"]
