FROM node:16.15.1

WORKDIR /usr/src/server

COPY package.json yarn.lock ./

# the schema needs to be available to install node_modules
RUN mkdir prisma
COPY prisma/schema.prisma prisma/schema.prisma

RUN yarn install

COPY ./ ./

RUN yarn build

EXPOSE 3122 8080

CMD ["yarn", "start-api"]
