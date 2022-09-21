terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 1.13.3"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.31.0"
    }
  }
}

provider "aws" {
  region     = "us-east-2"
  access_key = "<your access key>"
  secret_key = "<your secret key>"
}

resource "aws_vpc" "gitpoap-backend-vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  instance_tenancy     = "default"
  tags = {
    Name = "gitpoap-backend-vpc-stack/gitpoap-backend-vpc"
  }
}

resource "aws_subnet" "gitpoap-backend-vpc_public-subnet-1" {
  vpc_id                  = aws_vpc.gitpoap-backend-vpc.id
  cidr_block              = "10.0.0.0/18"
  availability_zone       = "us-east-2a"
  map_public_ip_on_launch = true

  tags = {
    Name                  = "gitpoap-backend-vpc-stack/gitpoap-backend-vpc/PublicSubnet1"
    "aws-cdk:subnet-name" = "Public"
    "aws-cdk:subnet-type" = "Public"
  }
}

resource "aws_subnet" "gitpoap-backend-vpc_public-subnet-2" {
  vpc_id                  = aws_vpc.gitpoap-backend-vpc.id
  cidr_block              = "10.0.64.0/18"
  availability_zone       = "us-east-2b"
  map_public_ip_on_launch = true

  tags = {
    Name                  = "gitpoap-backend-vpc-stack/gitpoap-backend-vpc/PublicSubnet2"
    "aws-cdk:subnet-name" = "Public"
    "aws-cdk:subnet-type" = "Public"
  }
}

resource "aws_instance" "grafana" {
  ami                         = "ami-0568773882d492fc8"
  instance_type               = "t2.small"
  iam_instance_profile        = "EC2Grafana"
  user_data_replace_on_change = false

  tags = {
    Name = "grafana-3"
  }
}




