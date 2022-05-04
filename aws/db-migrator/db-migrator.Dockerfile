FROM node:16.13.1

WORKDIR /usr/src/db-migrator

RUN apt update && apt install git

# To silence some output in logs
RUN npm install -g npm@8.9.0

COPY package.json yarn.lock ./

RUN yarn install

COPY run-migrations.sh ./

CMD ["./run-migrations.sh"]
