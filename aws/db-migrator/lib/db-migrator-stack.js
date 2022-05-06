const { aws_ec2: ec2, aws_lambda: lambda, aws_logs: logs, Stack } = require('aws-cdk-lib');
const path = require('path');

const VPC_NAME = process.env.VPC_NAME;

if (!VPC_NAME) {
  console.log('Required ENV variable VPC_NAME is not set');
  process.exit(1);
}

const SECURITY_GROUP_ID = process.env.SECURITY_GROUP_ID;

if (!SECURITY_GROUP_ID) {
  console.log('Required ENV variable SECURITY_GROUP_ID is not set');
  process.exit(2);
}

const STAGE_TAG = process.env.STAGE_TAG || '';

console.log(`VPC_NAME = "${VPC_NAME}"\nSTAGE_TAG = "${STAGE_TAG}"`);

class DbMigratorStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, `gitpoap-backend${STAGE_TAG}-vpc`, {
      vpcName: VPC_NAME,
    });

    const sg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      `gitpoap-backend${STAGE_TAG}-security-group`,
      SECURITY_GROUP_ID,
    );

    const fn = new lambda.DockerImageFunction(this, `gitpoap-migration${STAGE_TAG}-lambda`, {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '..'), {
        file: 'Dockerfile',
      }),
      vpc: vpc,
      securityGroup: sg,
      logRetention: logs.RetentionDays.ONE_DAY,
    });
  }
}

module.exports = { DbMigratorStack };
