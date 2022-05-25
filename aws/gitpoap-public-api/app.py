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

VPC_ID = os.getenv('VPC_ID')

if VPC_ID is None:
  print('VPC_ID must be specified in the ENV')
  sys.exit(2)

DB_CLIENT_SECURITY_GROUP_ID = os.getenv('DB_CLIENT_SECURITY_GROUP_ID')

if DB_CLIENT_SECURITY_GROUP_ID is None:
  print('DB_CLIENT_SECURITY_GROUP_ID must be specified in the ENV')
  sys.exit(3)

REDIS_CLIENT_SECURITY_GROUP_ID = os.getenv('REDIS_CLIENT_SECURITY_GROUP_ID')

if REDIS_CLIENT_SECURITY_GROUP_ID is None:
  print('REDIS_CLIENT_SECURITY_GROUP_ID must be specified in the ENV')
  sys.exit(4)

class GitpoapPublicAPIServerStack(Stack):
  def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
    super().__init__(scope, construct_id, **kwargs)

    # Create the ECR Repository
    ecr_repository = ecr.Repository(self, f'gitpoap-public-api{STAGE_TAG}-server-repository',
      repository_name=f'gitpoap-public-api{STAGE_TAG}-server-repository',
    )

    vpc = ec2.Vpc.from_lookup(self, f'gitpoap{STAGE_TAG}-vpc', vpc_id=VPC_ID)

    # Create the ECS Cluster
    cluster = ecs.Cluster(self, f'gitpoap-public-api{STAGE_TAG}-server-cluster',
      cluster_name=f'gitpoap-public-api{STAGE_TAG}-server-cluster',
      vpc=vpc,
    )

    # Create the ECS Task Definition with placeholder container (and named Task Execution IAM Role)
    execution_role = iam.Role(self, f'gitpoap-public-api{STAGE_TAG}-server-execution-role',
      assumed_by=iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      role_name=f'gitpoap-public-api{STAGE_TAG}-server-execution-role',
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
        f'arn:aws:s3:::gitpoap-secrets/gitpoap-public-api{STAGE_TAG}-aws-secrets.env'
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
    task_definition = ecs.FargateTaskDefinition(self, f'gitpoap-public-api{STAGE_TAG}-server-task-definition',
      execution_role=execution_role,
      family=f'gitpoap-public-api{STAGE_TAG}-server-task-definition',
    )
    container = task_definition.add_container(f'gitpoap-public-api{STAGE_TAG}-server',
      image=ecs.ContainerImage.from_registry('amazon/amazon-ecs-sample'),
    )
    container.add_port_mappings(
      ecs.PortMapping(container_port=3122, host_port=3122),
      ecs.PortMapping(container_port=8080, host_port=8080),
    )

    backend_securitygroup = ec2.SecurityGroup(self, f'gitpoap-public-api{STAGE_TAG}-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap-public-api{STAGE_TAG}-security-group',
    )
    self.backend_client_securitygroup = ec2.SecurityGroup(self, f'gitpoap-public-api{STAGE_TAG}-client-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap-public-api{STAGE_TAG}-client-security-group',
    )
    self.backend_metrics_securitygroup = ec2.SecurityGroup(self, f'gitpoap-public-api{STAGE_TAG}-metrics-security-group',
      vpc=vpc,
      allow_all_outbound=True,
      security_group_name=f'gitpoap-public-api{STAGE_TAG}-metrics-security-group',
    )

    backend_securitygroup.add_ingress_rule(
      peer=self.backend_client_securitygroup,
      connection=ec2.Port.tcp(3122),
    )
    backend_securitygroup.add_ingress_rule(
      peer=self.backend_metrics_securitygroup,
      connection=ec2.Port.tcp(8080),
    )
    backend_securitygroup.add_ingress_rule(
      peer=backend_securitygroup,
      connection=ec2.Port.all_tcp(),
    )

    db_client_securitygroup = ec2.SecurityGroup.from_security_group_id(
      self,
      f'gitpoap{STAGE_TAG}-db-client-security-group',
      DB_CLIENT_SECURITY_GROUP_ID,
    )

    redis_client_securitygroup = ec2.SecurityGroup.from_security_group_id(
      self,
      f'gitpoap{STAGE_TAG}-redis-client-security-group',
      REDIS_CLIENT_SECURITY_GROUP_ID,
    )

    # Create the ECS Service
    service = ecs.FargateService(self, f'gitpoap-public-api{STAGE_TAG}-server-service',
      task_definition=task_definition,
      security_groups=[
        backend_securitygroup,
        db_client_securitygroup,
        redis_client_securitygroup,
      ],
      vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_NAT),
      cluster=cluster,
      desired_count=2,
      service_name=f'gitpoap-public-api{STAGE_TAG}-server-service',
    )

    load_balancer = elbv2.ApplicationLoadBalancer(self, f'public-api{STAGE_TAG}-balancer',
      security_group=self.backend_client_securitygroup,
      vpc=vpc,
      internet_facing=True,
      load_balancer_name=f'public-api{STAGE_TAG}-balancer',
    )
    listener = load_balancer.add_listener(f'gitpoap-public-api{STAGE_TAG}-load-balancer-listener',
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
    listener.add_targets(f'gitpoap-public-api{STAGE_TAG}-load-balancer-listener-targets',
      protocol=elbv2.ApplicationProtocol.HTTP,
      targets=[service.load_balancer_target(
        container_name=f'gitpoap-public-api{STAGE_TAG}-server',
        container_port=3122,
      )],
    )

app = cdk.App()

server_stack = GitpoapPublicAPIServerStack(
  app,
  f'gitpoap-public-api{STAGE_TAG}-server-stack',
  env=cdk.Environment(account='510113809275', region='us-east-2'),
)

app.synth()
