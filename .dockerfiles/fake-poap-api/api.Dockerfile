FROM node:17.4.0

WORKDIR /usr/src/fake-poap-api

COPY .dockerfiles/fake-poap-api/package.json .dockerfiles/fake-poap-api/yarn.lock .

RUN yarn install

COPY .dockerfiles/fake-poap-api/ .
COPY prisma/constants.ts tsconfig.json .
COPY prisma/data.ts ./src
COPY src/types/poap.ts ./src/types

ENV UPLOAD_FOLDER=/var/fake-poap-api/uploads

RUN mkdir -p $UPLOAD_FOLDER

CMD ["yarn", "run", "dev"]
