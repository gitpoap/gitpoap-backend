FROM node:16.13.1

WORKDIR /usr/src/db-migrator

RUN apt update && apt install git

# Update npm to silence some warnings in output
RUN npm install -g npm@8.9.0

COPY run-migrations.sh ./

# Should be specified for the run step
ENV GITHUB_OAUTH_TOKEN foobar
ENV DATABASE_URL postgresql://postgres:foobar88@localhost:5432

CMD ["./run-migrations.sh"]
