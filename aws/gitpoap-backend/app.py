#!/usr/bin/env python3

import aws_cdk as cdk
from aws_cdk import (
  Stack,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_memorydb as memorydb,
  aws_rds as rds,
)
from constructs import Construct
import json
import os
import secrets
import sys

STAGE = os.getenv('STAGE')

if STAGE is None:
  print('STAGE must be specified in the ENV')
  sys.exit(1)
if STAGE == 'production':
  STAGE_TAG = ''
elif STAGE == 'staging':
  STAGE_TAG = '-staging'
else:
  print('STAGE must be either "production" or "staging"')
  sys.exit(2)

PASSWORD_LENGTH = 53

def generate_and_save_passwords():
  file = f'./gitpoap{STAGE_TAG}-passwords.json'
  if not os.path.isfile(file):
    data = {
      'db_password': secrets.token_urlsafe(PASSWORD_LENGTH),
    }
    with open(file, 'w') as f:
      json.dump(data, f)
    return data
  else:
    with open(file, 'r') as f:
      return json.load(f)

class GitpoapVPCStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    self.vpc = ec2.Vpc(self, f'gitpoap-backend{STAGE_TAG}-vpc',
      max_azs=3,
    )

class GitpoapRedisStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    vpc = vpc_stack.vpc

    # Create the redis cluster
    redis_securitygroup = ec2.SecurityGroup(self, f'gitpoap{STAGE_TAG}-redis-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap{STAGE_TAG}-redis-security-group',
    )

    self.redis_client_securitygroup = ec2.SecurityGroup(self, f'gitpoap{STAGE_TAG}-redis-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap{STAGE_TAG}-redis-client-security-group',
    )

    redis_securitygroup.add_ingress_rule(
      peer=self.redis_client_securitygroup,
      connection=ec2.Port.tcp(6379),
    )
    redis_securitygroup.add_ingress_rule(
      peer=redis_securitygroup,
      connection=ec2.Port.all_tcp(),
    )

    redis_subnet_group = memorydb.CfnSubnetGroup(self, f'gitpoap{STAGE_TAG}-redis-subnet-group',
      subnet_ids=vpc.select_subnets(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT).subnet_ids,
      subnet_group_name=f'gitpoap{STAGE_TAG}-redis-subnet-group',
    )

    redis_cluster = memorydb.CfnCluster(self, f'gitpoap{STAGE_TAG}-redis-cluster',
      acl_name='open-access',
      cluster_name=f'gitpoap{STAGE_TAG}-redis-cluster',
      node_type='db.t4g.medium',
      auto_minor_version_upgrade=True,
      engine_version='6.2',
      num_replicas_per_shard=1,
      num_shards=1,
      security_group_ids=[redis_securitygroup.security_group_id],
      snapshot_retention_limit=3,
      subnet_group_name=redis_subnet_group.subnet_group_name,
      tls_enabled=False,
    )

class GitpoapDBStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    vpc = vpc_stack.vpc

    db_securitygroup = ec2.SecurityGroup(self, f'gitpoap{STAGE_TAG}-db-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap{STAGE_TAG}-db-security-group',
    )

    self.db_client_securitygroup = ec2.SecurityGroup(self, f'gitpoap{STAGE_TAG}-db-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap{STAGE_TAG}-db-client-security-group',
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

    db_subnet_group = rds.SubnetGroup(self, f'gitpoap{STAGE_TAG}-db-subnet-group',
      subnet_group_name=f'gitpoap{STAGE_TAG}-db-subnet-group',
      description='Subnet group for gitpoap-db',
      vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT),
      vpc=vpc,
    )

    db_instance = rds.DatabaseInstance(self, f'gitpoap{STAGE_TAG}-db',
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
      instance_identifier=f'gitpoap{STAGE_TAG}-db',
      max_allocated_storage=1000,
      multi_az=True,
      port=db_port,
      security_groups=[db_securitygroup],
      subnet_group=db_subnet_group, 
    )

class GitpoapServerStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    # Create the ECR Repository
    ecr_repository = ecr.Repository(self, f'gitpoap-backend{STAGE_TAG}-server-repository',
      repository_name=f'gitpoap-backend{STAGE_TAG}-server-repository',
    )

    vpc = vpc_stack.vpc

    # Create the ECS Cluster
    cluster = ecs.Cluster(self, f'gitpoap-backend{STAGE_TAG}-server-cluster',
      cluster_name=f'gitpoap-backend{STAGE_TAG}-server-cluster',
      vpc=vpc,
    )

    # Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
    execution_role = iam.Role(self, f'gitpoap-backend{STAGE_TAG}-server-execution-role',
      assumed_by=iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      role_name=f'gitpoap-backend{STAGE_TAG}-server-execution-role',
    )
    execution_role.add_to_policy(iam.PolicyStatement(
      effect=iam.Effect.ALLOW,
      resources=['*'],
      actions=[
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
    ))
    execution_role.add_to_policy(iam.PolicyStatement(
      effect=iam.Effect.ALLOW,
      resources=[
        'arn:aws:s3:::gitpoap-secrets/gitpoap-backend-external-secrets.env',
        f'arn:aws:s3:::gitpoap-secrets/gitpoap-backend{STAGE_TAG}-aws-secrets.env',
      ],
      actions=[
        's3:GetObject',
      ],
    ))
    execution_role.add_to_policy(iam.PolicyStatement(
      effect=iam.Effect.ALLOW,
      resources=[
        'arn:aws:s3:::gitpoap-secrets',
      ],
      actions=[
        's3:GetBucketLocation',
      ],
    ))
    execution_role.add_to_policy(iam.PolicyStatement(
      effect=iam.Effect.ALLOW,
      resources=[
        'arn:aws:logs:*:*:*'
      ],
      actions=[
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams'
      ],
    ))
    task_definition = ecs.FargateTaskDefinition(self, f'gitpoap-backend{STAGE_TAG}-server-task-definition',
      execution_role=execution_role,
      family=f'gitpoap-backend{STAGE_TAG}-server-task-definition',
    )
    container = task_definition.add_container(f'gitpoap-backend{STAGE_TAG}-server',
      image=ecs.ContainerImage.from_registry('amazon/amazon-ecs-sample'),
    )
    container.add_port_mappings(
      ecs.PortMapping(container_port=3001, host_port=3001),
      ecs.PortMapping(container_port=8080, host_port=8080),
    )

    backend_securitygroup = ec2.SecurityGroup(self, f'gitpoap-backend{STAGE_TAG}-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap-backend{STAGE_TAG}-security-group',
    )
    self.backend_client_securitygroup = ec2.SecurityGroup(self, f'gitpoap-backend{STAGE_TAG}-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap-backend{STAGE_TAG}-client-security-group',
    )
    self.backend_metrics_securitygroup = ec2.SecurityGroup(self, f'gitpoap-backend{STAGE_TAG}-metrics-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap-backend{STAGE_TAG}-metrics-security-group',
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

    #redis_client_securitygroup = redis_stack.redis_client_securitygroup
    #db_client_securitygroup = db_stack.db_client_securitygroup

    # Create the ECS Service
    service = ecs.FargateService(self, f'gitpoap-backend{STAGE_TAG}-server-service',
      task_definition=task_definition,
      security_groups=[
        backend_securitygroup,
        # Can't be done here due to circular dependencies
        # redis_client_securitygroup,
        # db_client_securitygroup,
      ],
      vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT),
      cluster=cluster,
      desired_count=2,
      service_name=f'gitpoap-backend{STAGE_TAG}-server-service',
    )

    load_balancer = elbv2.ApplicationLoadBalancer(self, f'gitpoap-backend{STAGE_TAG}-balancer',
      security_group=self.backend_client_securitygroup,
      vpc=vpc,
      internet_facing=True,
      load_balancer_name=f'gitpoap-backend{STAGE_TAG}-balancer',
    )
    listener = load_balancer.add_listener(f'gitpoap-backend{STAGE_TAG}-load-balancer-listener',
      certificates=[
        elbv2.ListenerCertificate.from_arn(
          'arn:aws:acm:us-east-2:510113809275:certificate/d077bbf2-ffb3-4e13-b094-5ef51e1ec128'
        ),
      ],
      port=443,
      protocol=elbv2.ApplicationProtocol.HTTPS,
    )
    # Redirect HTTP to HTTPS
    load_balancer.add_redirect()
    listener.add_targets(f'gitpoap-backend{STAGE_TAG}-load-balancer-listener-targets',
      protocol=elbv2.ApplicationProtocol.HTTP,
      targets=[service.load_balancer_target(
        container_name=f'gitpoap-backend{STAGE_TAG}-server',
        container_port=3001,
      )],
    )

app = cdk.App()

passwords = generate_and_save_passwords()

vpc_stack = GitpoapVPCStack(app, f'gitpoap-backend{STAGE_TAG}-vpc-stack')

redis_stack = GitpoapRedisStack(app, f'gitpoap-backend{STAGE_TAG}-redis-stack')
redis_stack.add_dependency(vpc_stack)

db_stack = GitpoapDBStack(app, f'gitpoap-backend{STAGE_TAG}-db-stack')
db_stack.add_dependency(vpc_stack)

server_stack = GitpoapServerStack(app, f'gitpoap-backend{STAGE_TAG}-server-stack')
server_stack.add_dependency(redis_stack)
server_stack.add_dependency(db_stack)

app.synth()
