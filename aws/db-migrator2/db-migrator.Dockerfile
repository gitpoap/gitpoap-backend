FROM public.ecr.aws/lambda/nodejs:14

RUN apt update && apt install git

COPY run-migrations.sh ${LAMBDA_TASK_ROOT}

# Should be specified for the run step
ENV GITHUB_OAUTH_TOKEN foobar
ENV DATABASE_URL postgresql://postgres:foobar88@localhost:5432

CMD ["./run-migrations.sh"]
