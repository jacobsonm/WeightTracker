import * as path from 'node:path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib/core';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class InfraStack extends cdk.Stack {
  public readonly weighInsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.weighInsTable = new dynamodb.Table(this, 'WeighInsTable', {
      tableName: 'WeighIns',
      partitionKey: {
        name: 'Username',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'DateTime',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, 'WeighInsTableName', {
      value: this.weighInsTable.tableName,
      description: 'DynamoDB table name for weigh-in data',
    });

    new cdk.CfnOutput(this, 'WeighInsTableArn', {
      value: this.weighInsTable.tableArn,
      description: 'DynamoDB table ARN for weigh-in data',
    });

    const addWeighInFunction = new NodejsFunction(this, 'AddWeighInFunction', {
      entry: path.join(__dirname, '../lambda/add-weigh-in/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      description: 'Creates or replaces a weigh-in record in DynamoDB',
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: this.weighInsTable.tableName,
      },
    });

    this.weighInsTable.grantWriteData(addWeighInFunction);

    const listWeighInsFunction = new NodejsFunction(this, 'ListWeighInsFunction', {
      entry: path.join(__dirname, '../lambda/list-weigh-ins/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      description: 'Lists weigh-in records for a user from DynamoDB',
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: this.weighInsTable.tableName,
      },
    });

    this.weighInsTable.grantReadData(listWeighInsFunction);

    const getWeighInFunction = new NodejsFunction(this, 'GetWeighInFunction', {
      entry: path.join(__dirname, '../lambda/get-weigh-in/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      description: 'Gets a single weigh-in record from DynamoDB',
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: this.weighInsTable.tableName,
      },
    });

    this.weighInsTable.grantReadData(getWeighInFunction);

    const deleteWeighInFunction = new NodejsFunction(this, 'DeleteWeighInFunction', {
      entry: path.join(__dirname, '../lambda/delete-weigh-in/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      description: 'Deletes a weigh-in record from DynamoDB',
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: this.weighInsTable.tableName,
      },
    });

    this.weighInsTable.grantWriteData(deleteWeighInFunction);

    const api = new apigateway.RestApi(this, 'WeighInApi', {
      restApiName: 'WeightTrackerApi',
      description: 'Weight Tracker REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['DELETE', 'GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      },
    });

    const weighInsResource = api.root.addResource('weigh-ins');
    weighInsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(addWeighInFunction),
    );
    weighInsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listWeighInsFunction),
    );

    const weighInByDateTime = weighInsResource.addResource('{dateTime}');
    weighInByDateTime.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getWeighInFunction),
    );
    weighInByDateTime.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteWeighInFunction),
    );

    new cdk.CfnOutput(this, 'AddWeighInFunctionName', {
      value: addWeighInFunction.functionName,
      description: 'Lambda function that adds a weigh-in record',
    });

    new cdk.CfnOutput(this, 'ListWeighInsFunctionName', {
      value: listWeighInsFunction.functionName,
      description: 'Lambda function that lists weigh-in records',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Base URL for the Weight Tracker API',
    });

    new cdk.CfnOutput(this, 'WeighInsEndpoint', {
      value: `${api.url}weigh-ins`,
      description: 'Weigh-ins collection (POST add, GET list)',
    });

    new cdk.CfnOutput(this, 'WeighInByDateTimeEndpoint', {
      value: `${api.url}weigh-ins/{dateTime}`,
      description:
        'Single weigh-in (GET with Username query param, DELETE; URL-encode dateTime)',
    });

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const webDistribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      comment: 'Weight Tracker web client',
    });

    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../web')),
        s3deploy.Source.data(
          '/config.js',
          `window.APP_CONFIG = ${JSON.stringify({ apiBaseUrl: api.url })};`,
        ),
      ],
      destinationBucket: webBucket,
      distribution: webDistribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'WebBucketName', {
      value: webBucket.bucketName,
      description: 'S3 bucket for web client assets',
    });

    new cdk.CfnOutput(this, 'WebUrl', {
      value: `https://${webDistribution.distributionDomainName}`,
      description: 'HTTPS URL for the web client (CloudFront)',
    });
  }
}
