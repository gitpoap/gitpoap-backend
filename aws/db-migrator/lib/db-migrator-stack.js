const { aws_ec2: ec2, aws_lambda: lambda, aws_logs: logs, Stack } = require('aws-cdk-lib');
const path = require('path');

const VPC_ID = process.env.VPC_ID;

if (!VPC_ID) {
  console.log('Required ENV variable VPC_ID is not set');
  process.exit(1);
}

const SECURITY_GROUP_ID = process.env.SECURITY_GROUP_ID;

if (!SECURITY_GROUP_ID) {
  console.log('Required ENV variable SECURITY_GROUP_ID is not set');
  process.exit(2);
}

const GITHUB_OAUTH_TOKEN = process.env.GITHUB_OAUTH_TOKEN;

if (!GITHUB_OAUTH_TOKEN) {
  console.log('Required ENV variable GITHUB_OAUTH_TOKEN is not set');
  process.exit(3);
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('Required ENV variable DATABASE_URL is not set');
  process.exit(4);
}

const STAGE_TAG = process.env.STAGE_TAG || '';

console.log(`VPC_ID = "${VPC_ID}"`);
console.log(`SECURITY_GROUP_ID = "${SECURITY_GROUP_ID}"`);
console.log(`STAGE_TAG = "${STAGE_TAG}"`);

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
      vpcId: VPC_ID,
    });

    const sg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      `gitpoap-backend${STAGE_TAG}-security-group`,
      SECURITY_GROUP_ID,
    );

    const lambdaName = `gitpoap-migration${STAGE_TAG}-lambda`;
    const fn = new lambda.DockerImageFunction(this, lambdaName, {
      functionName: lambdaName,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '..'), {
        file: 'Dockerfile',
      }),
      vpc: vpc,
      securityGroup: sg,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        GITHUB_OAUTH_TOKEN,
        DATABASE_URL,
      },
    });
  }
}

module.exports = { DbMigratorStack };
