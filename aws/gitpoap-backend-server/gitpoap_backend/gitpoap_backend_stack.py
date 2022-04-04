from aws_cdk import (
  Stack,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_rds as rds,
  aws_memorydb as memorydb,
)
from constructs import Construct
import secrets

def generate_and_save_passwords():
  return {
    'redis_password': secrets.token_urlsafe(25),
  }

class GitpoapBackendStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)
    passwords = generate_and_save_passwords()

    # Create the VPC
    vpc = ec2.Vpc(self,
                  "gitpoap-backend-vpc",
                  max_azs=3)

    # Create the redis cluster
    redis_user = memorydb.CfnUser(self, 'gitpoap-redis-user',
      user_name='gitpoap-redis-user',
      access_string='on ~* &* +@all',
      authentication_mode={
        'Type': 'password',
        'Passwords': [passwords['redis_password']],
      },
    )

    redis_acl = memorydb.CfnACL(self, 'gitpoap-redis-acl',
      acl_name='gitpoap-redis-acl',
      user_names=[redis_user.user_name],
    )

    redis_securitygroup = ec2.SecurityGroup(self, 'gitpoap-redis-securitygroup',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-redis-securitygroup',
    )

    redis_client_securitygroup = ec2.SecurityGroup(self, 'gitpoap-redis-client-securitygroup',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-redis-client-securitygroup',
    )

    redis_securitygroup.add_ingress_rule(
      peer=redis_client_securitygroup,
      connection=ec2.Port.tcp(6379),
    )

    redis_subnet_group = memorydb.CfnSubnetGroup(self, 'gitpoap-redis-subnet-group',
      subnet_ids=vpc.select_subnets(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT).subnet_ids,
      subnet_group_name='gitpoap-redis-subnet-group',
    )

    redis_cluster = memorydb.CfnCluster(self, 'gitpoap-redis-cluster',
      cluster_name='gitpoap-redis-cluster',
      acl_name=redis_acl.acl_name,
      auto_minor_version_upgrade=True,
      engine_version='6.2',
      node_type='db.t4g.medium',
      num_replicas_per_shard=1,
      num_shards=1,
      security_group_ids=[redis_securitygroup.security_group_id],
      snapshot_retention_limit=3,
      tls_enabled=True,
      subnet_group_name=redis_subnet_group.subnet_group_name,
    )

    # Create the ECR Repository
    ecr_repository = ecr.Repository(self,
                                    "gitpoap-backend-server-repository",
                                    repository_name="gitpoap-backend-server-repository")

    # Create the ECS Cluster
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
                                 security_groups=[redis_client_securitygroup],
                                 service_name="gitpoap-backend-server-service")
