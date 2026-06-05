import * as path from 'node:path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib/core';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'WeightTrackerUsers',
      selfSignUpEnabled: false,
      signInAliases: {
        username: true,
        email: true,
      },
      autoVerify: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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

    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      tableName: 'UserProfiles',
      partitionKey: {
        name: 'UserId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const getProfileFunction = new NodejsFunction(this, 'GetProfileFunction', {
      entry: path.join(__dirname, '../lambda/get-profile/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      description: 'Gets the authenticated user profile',
      bundling: { forceDockerBundling: false },
      environment: {
        PROFILE_TABLE_NAME: userProfilesTable.tableName,
      },
    });

    userProfilesTable.grantReadData(getProfileFunction);

    const putProfileFunction = new NodejsFunction(this, 'PutProfileFunction', {
      entry: path.join(__dirname, '../lambda/put-profile/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      description: 'Creates or updates the authenticated user profile',
      bundling: { forceDockerBundling: false },
      environment: {
        PROFILE_TABLE_NAME: userProfilesTable.tableName,
      },
    });

    userProfilesTable.grantWriteData(putProfileFunction);

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'WeighInAuthorizer',
      {
        cognitoUserPools: [userPool],
      },
    );

    const corsResponseHeaders = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers': "'Authorization,Content-Type'",
      'Access-Control-Allow-Methods': "'DELETE,GET,POST,PUT,OPTIONS'",
    };

    const api = new apigateway.RestApi(this, 'WeighInApi', {
      restApiName: 'WeightTrackerApi',
      description: 'Weight Tracker REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['DELETE', 'GET', 'POST', 'PUT', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    api.addGatewayResponse('UnauthorizedWithCors', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: corsResponseHeaders,
    });

    api.addGatewayResponse('Default4xxWithCors', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsResponseHeaders,
    });

    const authorizedMethodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const weighInsResource = api.root.addResource('weigh-ins');
    weighInsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(addWeighInFunction),
      authorizedMethodOptions,
    );
    weighInsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listWeighInsFunction),
      authorizedMethodOptions,
    );

    const weighInByDateTime = weighInsResource.addResource('{dateTime}');
    weighInByDateTime.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getWeighInFunction),
      authorizedMethodOptions,
    );
    weighInByDateTime.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteWeighInFunction),
      authorizedMethodOptions,
    );

    const profileResource = api.root.addResource('profile');
    profileResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getProfileFunction),
      authorizedMethodOptions,
    );
    profileResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(putProfileFunction),
      authorizedMethodOptions,
    );

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const apiStageName = api.deploymentStage.stageName;
    const apiOriginDomain = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`;

    const apiPathRewrite = new cloudfront.Function(this, 'ApiPathRewrite', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/api/') === 0) {
    request.uri = uri.substring(4);
  } else if (uri === '/api') {
    request.uri = '/';
  }
  return request;
}
`.trim()),
    });

    const apiOrigin = new origins.HttpOrigin(apiOriginDomain, {
      originPath: `/${apiStageName}`,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    const webDistribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      comment: 'Weight Tracker web client and /api proxy',
    });

    webDistribution.addBehavior('/api/*', apiOrigin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      functionAssociations: [
        {
          function: apiPathRewrite,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        },
      ],
    });

    const webBaseUrl = `https://${webDistribution.distributionDomainName}`;
    const apiBaseUrl = `${webBaseUrl}/api/`;
    const authCallbackUrl = `${webBaseUrl}/auth/callback.html`;
    const localDevOrigin = 'http://localhost:3000';

    const cognitoDomainPrefix = `weighttracker-${this.account}`;
    const cognitoHostedUiDomain = `${cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com`;

    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: cognitoDomainPrefix,
      },
    });

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: 'WeightTrackerWeb',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [authCallbackUrl, `${localDevOrigin}/auth/callback.html`],
        logoutUrls: [webBaseUrl, `${localDevOrigin}/`],
      },
    });

    const appConfig = {
      apiBaseUrl: '/api/',
      auth: {
        region: this.region,
        userPoolId: userPool.userPoolId,
        clientId: userPoolClient.userPoolClientId,
        cognitoDomain: cognitoHostedUiDomain,
        redirectUri: authCallbackUrl,
        logoutUri: webBaseUrl,
      },
    };

    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../web')),
        s3deploy.Source.data(
          '/config.js',
          `window.APP_CONFIG = ${JSON.stringify(appConfig, null, 2)};`,
        ),
      ],
      destinationBucket: webBucket,
      distribution: webDistribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'WeighInsTableName', {
      value: this.weighInsTable.tableName,
      description: 'DynamoDB table name for weigh-in data',
    });

    new cdk.CfnOutput(this, 'UserProfilesTableName', {
      value: userProfilesTable.tableName,
      description: 'DynamoDB table name for user profiles',
    });

    new cdk.CfnOutput(this, 'ProfileEndpoint', {
      value: `${apiBaseUrl}profile`,
      description: 'User profile via CloudFront (GET, PUT; requires JWT)',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito app client ID for the web app',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: cognitoHostedUiDomain,
      description: 'Cognito Hosted UI hostname (without https://)',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apiBaseUrl,
      description: 'Public API base URL on CloudFront (/api/* → API Gateway)',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description:
        'Direct API Gateway URL (local dev config.js only; browser uses /api/ on WebUrl)',
    });

    new cdk.CfnOutput(this, 'WeighInsEndpoint', {
      value: `${apiBaseUrl}weigh-ins`,
      description: 'Weigh-ins via CloudFront (POST add, GET list; requires JWT)',
    });

    new cdk.CfnOutput(this, 'WebUrl', {
      value: webBaseUrl,
      description: 'HTTPS URL for the web client (CloudFront)',
    });
  }
}
