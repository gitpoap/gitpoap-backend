FROM node:17.4.0

WORKDIR /usr/src/fake-poap-auth

COPY .dockerfiles/fake-poap-auth/package.json .dockerfiles/fake-poap-auth/yarn.lock .

RUN yarn install

COPY .dockerfiles/fake-poap-auth/ .
COPY tsconfig.json .

CMD ["yarn", "run", "dev"]
