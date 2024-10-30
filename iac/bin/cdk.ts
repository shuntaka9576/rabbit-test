import * as cdk from 'aws-cdk-lib';
import { WebAppStack } from '../lib/api-stack';
import { lambdaEdgeStack } from '../lib/lambda-edge-stack';

const app = new cdk.App();

const lambdaEdge = new lambdaEdgeStack(app, 'lambda-edge-stack', {
  env: { region: 'us-east-1' },
});

new WebAppStack(app, 'web-app-stack').addDependency(lambdaEdge);
