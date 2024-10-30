import {
  Duration,
  Stack,
  type StackProps,
  aws_iam,
  aws_ssm,
} from 'aws-cdk-lib';
import lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export class lambdaEdgeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const lambdaEdgeFunction = new NodejsFunction(this, 'LambdaEdgeFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: './src/lambda-edge/calculate-content-hash.ts',
      handler: 'handler',
      memorySize: 1769,
      timeout: Duration.seconds(5),
      role: new aws_iam.Role(this, 'LambdaEdgeFunctionRole', {
        assumedBy: new aws_iam.CompositePrincipal(
          new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
          new aws_iam.ServicePrincipal('edgelambda.amazonaws.com')
        ),
        managedPolicies: [
          aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
          aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            'AWSLambda_FullAccess'
          ),
        ],
      }),
    });

    new aws_ssm.StringParameter(this, 'LambdaEdgeCurrentVersion', {
      parameterName: '/axumOnLambda/LambdaEdgeArn',
      stringValue: lambdaEdgeFunction.currentVersion.functionArn,
    });
  }
}
