FROM node:17.4.0

WORKDIR /usr/src/fake-poap-api

COPY .dockerfiles/fake-poap-api/package.json .dockerfiles/fake-poap-api/yarn.lock .

RUN yarn install

COPY .dockerfiles/fake-poap-api/ .
COPY src/types/poap.ts tsconfig.json .

ENV UPLOAD_FOLDER=/var/fake-poap-api/uploads

RUN mkdir -p $UPLOAD_FOLDER

CMD ["yarn", "run", "dev"]
