import path from 'node:path';
import {
  CfnOutput,
  Duration,
  Stack,
  type StackProps,
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_iam,
  aws_lambda,
} from 'aws-cdk-lib';
import { LambdaEdgeEventType } from 'aws-cdk-lib/aws-cloudfront';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import lambda, {
  Architecture,
  DockerImageCode,
  FunctionUrlAuthType,
  InvokeMode,
} from 'aws-cdk-lib/aws-lambda';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

export class WebAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webApiLambda = new lambda.DockerImageFunction(this, 'webApiLambda', {
      code: DockerImageCode.fromImageAsset(
        path.resolve('__dirname', '../../web-app')
      ),
      memorySize: 512,
      timeout: Duration.seconds(15 * 60),
      architecture: Architecture.ARM_64,
      environment: {
        AWS_LWA_INVOKE_MODE: 'response_stream', // !
      },
    });

    const webAPILambdaFunctionURL = webApiLambda.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM, // !
    });

    const webApiCloudFront = new aws_cloudfront.Distribution(
      this,
      'webApiCloudFront',
      {
        defaultBehavior: {
          origin: new aws_cloudfront_origins.FunctionUrlOrigin(
            webAPILambdaFunctionURL
          ),
          allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_ALL,
          edgeLambdas: [
            {
              eventType: LambdaEdgeEventType.ORIGIN_REQUEST,

              functionVersion: aws_lambda.Version.fromVersionArn(
                this,
                'OriginRequestWithPostPutFn',
                this.getLambdaEdgeArn('/axumOnLambda/LambdaEdgeArn')
              ),
              includeBody: true,
            },
          ],
        },
      }
    );

    (
      webApiCloudFront.node.defaultChild as aws_cloudfront.CfnDistribution
    ).addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      new aws_cloudfront.CfnOriginAccessControl(
        this,
        'webApiCloudFrontOriginAccessControl',
        {
          originAccessControlConfig: {
            name: 'webApiCloudFrontOriginAccessControl',
            originAccessControlOriginType: 'lambda',
            signingBehavior: 'always',
            signingProtocol: 'sigv4',
          },
        }
      ).getAtt('Id')
    );

    webAPILambdaFunctionURL.grantInvokeUrl(
      new aws_iam.ServicePrincipal('cloudfront.amazonaws.com', {
        conditions: {
          ArnLike: {
            'aws:SourceArn': `arn:aws:cloudfront::${
              Stack.of(this).account
            }:distribution/${webApiCloudFront.distributionId}`,
          },
        },
      })
    );

    new CfnOutput(this, 'ApiCommands', {
      value: [
        `CloudFront URL: https://${webApiCloudFront.distributionDomainName}`,
        '',
        'curl commands:',
        `curl -v -H "Content-Type: application/json" -X GET https://${webApiCloudFront.distributionDomainName}/hello`,
        `curl -v -H "Content-Type: application/json" -X GET https://${webApiCloudFront.distributionDomainName}/sse`,
        `curl -v -H "Content-Type: application/json" -d '{"count": 10}' -X POST https://${webApiCloudFront.distributionDomainName}/sse`,
      ].join('\n'),
      description: 'API URL and curl commands for testing',
    });
  }

  getLambdaEdgeArn(lambdaArnParamKey: string): string {
    const lambdaEdgeArnParameter = new AwsCustomResource(
      this,
      'LambdaEdgeCustomResource',
      {
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['ssm:GetParameter*'],
            resources: [
              this.formatArn({
                service: 'ssm',
                region: 'us-east-1',
                resource: '*',
              }),
            ],
          }),
        ]),
        onUpdate: {
          service: 'SSM',
          action: 'getParameter',
          parameters: { Name: lambdaArnParamKey },
          physicalResourceId: PhysicalResourceId.of(
            `PhysicalResourceId-${Date.now()}`
          ),
          region: 'us-east-1',
        },
      }
    );

    return lambdaEdgeArnParameter.getResponseField('Parameter.Value');
  }
}
