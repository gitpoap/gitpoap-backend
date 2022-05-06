const { aws_lambda: lambda, aws_logs: logs, Stack } = require('aws-cdk-lib');
const path = require('path');

class DbMigratorStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, 'BashDemoFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '..'), {
        file: 'Dockerfile',
      }),
      logRetention: logs.RetentionDays.ONE_DAY,
    });
  }
}

module.exports = { DbMigratorStack };
