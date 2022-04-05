#!/usr/bin/env python3
import os

import aws_cdk as cdk
from aws_cdk import (
  Stack,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
  aws_memorydb as memorydb,
  aws_rds as rds,
)
from constructs import Construct
import secrets
import os.path
import json

PASSWORD_LENGTH = 53

def generate_and_save_passwords():
  file = './gitpoap-passwords.json'
  if not os.path.isfile(file):
    data = {
      'redis_password': secrets.token_urlsafe(PASSWORD_LENGTH),
      'db_password': secrets.token_urlsafe(PASSWORD_LENGTH),
    }
    with open(file, 'w') as f:
      json.dump(data, f)
    return data
  else:
    with open(file, 'r') as f:
      return json.load(f)

class GitpoapRedisACLStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    redis_user = memorydb.CfnUser(self, 'gitpoap-redis-user',
      user_name='gitpoap-redis-user',
      access_string='on ~* &* +@all',
      authentication_mode={
        'Type': 'password',
        'Passwords': [passwords['redis_password']],
      },
    )

    self.redis_acl = memorydb.CfnACL(self, 'gitpoap-redis-acl',
      acl_name='gitpoap-redis-acl',
      user_names=[redis_user.user_name],
    )

class GitpoapVPCStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    self.vpc = ec2.Vpc(self,
                       "gitpoap-backend-vpc",
                       max_azs=3)

class GitpoapRedisStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    vpc = vpc_stack.vpc

    # Create the redis cluster
    redis_securitygroup = ec2.SecurityGroup(self, 'gitpoap-redis-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-redis-security-group',
    )

    self.redis_client_securitygroup = ec2.SecurityGroup(self, 'gitpoap-redis-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-redis-client-security-group',
    )

    redis_securitygroup.add_ingress_rule(
      peer=self.redis_client_securitygroup,
      connection=ec2.Port.tcp(6379),
    )
    redis_securitygroup.add_ingress_rule(
      peer=redis_securitygroup,
      connection=ec2.Port.all_tcp(),
    )

    redis_subnet_group = memorydb.CfnSubnetGroup(self, 'gitpoap-redis-subnet-group',
      subnet_ids=vpc.select_subnets(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT).subnet_ids,
      subnet_group_name='gitpoap-redis-subnet-group',
    )

    redis_acl = redis_acl_stack.redis_acl

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

class GitpoapDBStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    vpc = vpc_stack.vpc

    db_securitygroup = ec2.SecurityGroup(self, 'gitpoap-db-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-db-security-group',
    )

    self.db_client_securitygroup = ec2.SecurityGroup(self, 'gitpoap-db-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-db-client-security-group',
    )

    db_port = 5432

    db_securitygroup.add_ingress_rule(
      peer=self.db_client_securitygroup,
      connection=ec2.Port.tcp(db_port),
    )
    db_securitygroup.add_ingress_rule(
      peer=db_securitygroup,
      connection=ec2.Port.all_tcp(),
    )

    db_subnet_group = rds.SubnetGroup(self, 'gitpoap-db-subnet-group',
      subnet_group_name='gitpoap-db-subnet-group',
      description='Subnet group for gitpoap-db',
      vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT),
      vpc=vpc,
    )

    db_instance = rds.DatabaseInstance(self, 'gitpoap-db',
      credentials=rds.Credentials.from_password(
        username='gitpoap_db_user',
        password=cdk.SecretValue(passwords['db_password']),
      ),
      engine=rds.DatabaseInstanceEngine.postgres(
        version=rds.PostgresEngineVersion.VER_14_2
      ),
      allocated_storage=100,
      instance_type=ec2.InstanceType('m6g.xlarge'),
      vpc=vpc,
      auto_minor_version_upgrade=True,
      backup_retention=cdk.Duration.days(3),
      cloudwatch_logs_retention=logs.RetentionDays.THREE_DAYS,
      deletion_protection=True,
      instance_identifier='gitpoap-db',
      max_allocated_storage=1000,
      multi_az=True,
      port=db_port,
      security_groups=[db_securitygroup],
      subnet_group=db_subnet_group, 
    )

class GitpoapBackendStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    # Create the ECR Repository
    ecr_repository = ecr.Repository(self, "gitpoap-backend-server-repository",
      repository_name="gitpoap-backend-server-repository",
    )

    vpc = vpc_stack.vpc

    # Create the ECS Cluster
    cluster = ecs.Cluster(self, "gitpoap-backend-server-cluster",
      cluster_name="gitpoap-backend-server-cluster",
      vpc=vpc,
    )

    # Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
    execution_role = iam.Role(self, "gitpoap-backend-server-execution-role",
      assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      role_name="gitpoap-backend-server-execution-role",
    )
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
      ],
    ))
    task_definition = ecs.FargateTaskDefinition(self, "gitpoap-backend-server-task-definition",
      execution_role=execution_role,
      family="gitpoap-backend-server-task-definition",
    )
    container = task_definition.add_container("gitpoap-backend-server",
      image=ecs.ContainerImage.from_registry("amazon/amazon-ecs-sample"),
    )

    backend_securitygroup = ec2.SecurityGroup(self, 'gitpoap-backend-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-backend-security-group',
    )
    self.backend_client_securitygroup = ec2.SecurityGroup(self, 'gitpoap-backend-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-backend-client-security-group',
    )
    self.backend_metrics_securitygroup = ec2.SecurityGroup(self, 'gitpoap-backend-metrics-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name='gitpoap-backend-metrics-security-group',
    )

    backend_securitygroup.add_ingress_rule(
      peer=self.backend_client_securitygroup,
      connection=ec2.Port.tcp(3001),
    )
    backend_securitygroup.add_ingress_rule(
      peer=self.backend_metrics_securitygroup,
      connection=ec2.Port.tcp(8080),
    )
    backend_securitygroup.add_ingress_rule(
      peer=backend_securitygroup,
      connection=ec2.Port.all_tcp(),
    )

    redis_client_securitygroup = redis_stack.redis_client_securitygroup
    db_client_securitygroup = db_stack.db_client_securitygroup

    # Create the ECS Service
    service = ecs.FargateService(self, "gitpoap-backend-server-service",
      task_definition=task_definition,
      security_groups=[
        backend_securitygroup,
        redis_client_securitygroup,
        db_client_securitygroup,
      ],
      vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT),
      cluster=cluster,
      desired_count=2,
      service_name="gitpoap-backend-server-service",
    )

app = cdk.App()

passwords = generate_and_save_passwords()

redis_acl_stack = GitpoapRedisACLStack(app, "RedisACLStack")

vpc_stack = GitpoapVPCStack(app, 'VPCStack')

redis_stack = GitpoapRedisStack(app, 'RedisStack')

db_stack = GitpoapDBStack(app, 'DBStack')

GitpoapBackendStack(app, "GitpoapBackendStack")

app.synth()
