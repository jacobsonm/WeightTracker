import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../lib/infra-stack';

test('WeighIns DynamoDB table is created with expected keys', () => {
  const app = new cdk.App();
  const stack = new InfraStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'WeighIns',
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'Username', KeyType: 'HASH' },
      { AttributeName: 'DateTime', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'Username', AttributeType: 'S' },
      { AttributeName: 'DateTime', AttributeType: 'S' },
    ],
  });

  template.resourceCountIs('AWS::Lambda::Function', 6);
  template.hasResourceProperties('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        TABLE_NAME: {
          Ref: Match.stringLikeRegexp('WeighInsTable'),
        },
      },
    },
  });

  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Name: 'WeightTrackerApi',
  });

  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'POST',
    AuthorizationType: 'NONE',
  });

  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'DELETE',
    AuthorizationType: 'NONE',
  });

  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256',
          },
        },
      ],
    },
  });

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultRootObject: 'index.html',
    },
  });
});
