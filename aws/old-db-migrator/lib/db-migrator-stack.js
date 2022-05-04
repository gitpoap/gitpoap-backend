const { Stack, Duration } = require('aws-cdk-lib');
const { BashExecFunction } = require('cdk-lambda-bash');
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

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'DbMigratorQueue', {
    //   visibilityTimeout: Duration.seconds(300)
    // });

    const fn = new BashExecFunction(this, 'BashDemo', {
      script: path.join(__dirname, '../demo.sh'),
    });

    fn.run();
  }
}

module.exports = { DbMigratorStack };
