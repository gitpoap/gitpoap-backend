FROM node:18.17.1

WORKDIR /usr/src/fake-poap-auth

COPY .dockerfiles/fake-poap-auth/package.json .dockerfiles/fake-poap-auth/yarn.lock .

RUN yarn install

COPY .dockerfiles/fake-poap-auth/ .
COPY tsconfig.json .

CMD ["yarn", "run", "dev"]
