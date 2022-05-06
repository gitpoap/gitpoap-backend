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

    const fn = new BashExecFunction(this, 'BashDemo', {
      script: path.join(__dirname, '../demo.sh'),
      dockerfile: path.join(__dirname, '../Dockerfile'),
    });

    fn.run();
  }
}

module.exports = { DbMigratorStack };
