FROM node:17.4.0

WORKDIR /usr/src/fake-poap-api

COPY package.json yarn.lock .

RUN yarn install

COPY index.js .

CMD ["node", "index.js"]
