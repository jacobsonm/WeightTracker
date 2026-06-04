// Copy to config.js for local development, or let CDK inject config.js on deploy.
window.APP_CONFIG = {
  apiBaseUrl: 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod/',
  auth: {
    region: 'YOUR_REGION',
    userPoolId: 'YOUR_USER_POOL_ID',
    clientId: 'YOUR_APP_CLIENT_ID',
    cognitoDomain: 'weighttracker-YOUR_ACCOUNT_ID.auth.YOUR_REGION.amazoncognito.com',
    redirectUri: 'http://localhost:3000/auth/callback.html',
    logoutUri: 'http://localhost:3000/',
  },
};
