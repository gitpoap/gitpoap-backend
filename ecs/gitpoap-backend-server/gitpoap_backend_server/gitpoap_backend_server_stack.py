from aws_cdk import (
  Stack,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_ec2 as ec2,
  aws_iam as iam,
)
from constructs import Construct

class GitpoapBackendServerStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    # The code that defines your stack goes here

    # Create the ECR Repository
    ecr_repository = ecr.Repository(self,
                                    "gitpoap-backend-server-repository",
                                    repository_name="gitpoap-backend-server-repository")

    # Create the ECS Cluster (and VPC)
    vpc = ec2.Vpc(self,
                  "gitpoap-backend-server-vpc",
                  max_azs=3)
    cluster = ecs.Cluster(self,
                          "gitpoap-backend-server-cluster",
                          cluster_name="gitpoap-backend-server-cluster",
                          vpc=vpc)

    # Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
    execution_role = iam.Role(self,
                              "gitpoap-backend-server-execution-role",
                              assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
                              role_name="gitpoap-backend-server-execution-role")
    execution_role.add_to_policy(iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        resources=["*"],
        actions=[
            "ecr:GetAuthorizationToken",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
            ]
    ))
    task_definition = ecs.FargateTaskDefinition(self,
                                                "gitpoap-backend-server-task-definition",
                                                execution_role=execution_role,
                                                family="gitpoap-backend-server-task-definition")
    container = task_definition.add_container(
        "gitpoap-backend-server",
        image=ecs.ContainerImage.from_registry("amazon/amazon-ecs-sample")
    )

    # Create the ECS Service
    service = ecs.FargateService(self,
                                 "gitpoap-backend-server-service",
                                 cluster=cluster,
                                 task_definition=task_definition,
                                 service_name="gitpoap-backend-server-service")
