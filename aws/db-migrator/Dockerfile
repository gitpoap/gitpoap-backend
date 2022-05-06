# Modified from the Dockerfile provided by cdk-lambda-bash

FROM public.ecr.aws/lambda/provided:al2

RUN yum install -y \
  gzip \
  jq \
  tar \
  unzip

# Install latest version of node and npm
RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n
RUN bash n lts

RUN npm install -g yarn

# install aws-cli v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
  unzip awscliv2.zip && \
  ./aws/install

COPY cdk-lambda-bash/bootstrap /var/runtime/bootstrap
COPY cdk-lambda-bash/function.sh /var/task/function.sh
COPY cdk-lambda-bash/main.sh /var/task/main.sh
RUN chmod +x /var/runtime/bootstrap /var/task/function.sh /var/task/main.sh

WORKDIR /var/task
CMD [ "function.sh.handler" ]
