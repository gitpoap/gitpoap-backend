# CI/CD and Deployment Workflow/Infrastructure

We will be setting up an automated CI/CD pipeline for the backend server using
AWS Elastic Container Service (ECS) where we will define GitHub actions
on our `main` branch that will serve as our staging branch.

## Overview of Deployment Choices for Our Backend Services

We will be using the following services (provided by AWS) for our various backend services (as named in
[`docker-compose.yml`](https://github.com/gitpoap/gitpoap-backend/blob/main/docker-compose.yml):
* `db`: We will use a fully-managed PostgreSQL database via [AWS RDS](https://aws.amazon.com/rds/)
* `redis`: We will use a fully-managed redis-compatible database via [AWS MemoryDB](https://aws.amazon.com/memorydb/)
* `server`: We will build the backend server as a Docker container and use [AWS ECS](https://aws.amazon.com/ecs/)
* `prometheus`: We will use a fully-managed Prometheus instance via [AWS Managed Service for Prometheus](https://aws.amazon.com/prometheus/)
* `grafana`: We will use a fully-managed Grafana instance via [AWS Managed Grafana](https://aws.amazon.com/grafana/)

Note that we will use separate `db` and `redis` managed instances for different "stages" (e.g. `staging`, `production`), but we can use
the same `prometheus` and `grafana` instances so long as we tag our metrics by the name of the stage.

## Workflow

### Staging

We will use a GitHub actions to listen to updates to the `main` branch. This process is designed so that there is minimal downtime.
When something new is merged into the branch, we will:
1. Build the `server` container
2. Snapshot the DB
3. Stop the old instances of `server`
4. Run any new migrations on the new DB instance
5. Deploy the new `server` container via ECS

### Production

We will run the same exact process as in staging, except we will listen to changes to the `prod` branch, which will be protected
and require approvals before merging even from admins.

## Resources

* [Create a CI/CD pipeline for Amazon ECS with GitHub Actions and AWS CodeBuild Tests](https://aws.amazon.com/blogs/containers/create-a-ci-cd-pipeline-for-amazon-ecs-with-github-actions-and-aws-codebuild-tests/)
