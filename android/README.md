# Weight Tracker — Android app

Native **Kotlin + Jetpack Compose** client (roadmap #7). Feature parity with the web app: sign-in, Home (add weigh-in + progress), Profile, History (chart + list + delete).

## Prerequisites

- [Android Studio](https://developer.android.com/studio) (you have API 36 + an emulator)
- Deployed AWS stack with Android Cognito client (`cd infra && npx cdk deploy`)

## Configure

1. Copy `local.properties.example` to `local.properties` in this folder.
2. Ensure **`sdk.dir`** points at your Android SDK. Android Studio usually adds this on first open. If Run fails with “SDK location not found”, add (forward slashes):

   ```properties
   sdk.dir=C\:/Users/YOUR_USER/AppData/Local/Android/Sdk
   ```

3. Fill in CDK values from `cdk deploy` outputs:

| Property | CDK output |
|----------|------------|
| `API_BASE_URL` | **`ApiUrl`** from `cdk deploy` (must end with `/`, e.g. `https://….cloudfront.net/api/`). Using the placeholder or `WebUrl` without `/api/` causes **405** errors on save. |
| `COGNITO_REGION` | your AWS region |
| `COGNITO_DOMAIN` | `CognitoDomain` |
| `COGNITO_CLIENT_ID` | **`AndroidUserPoolClientId`** (not `UserPoolClientId`) |

3. **Sync Gradle** in Android Studio (open the `android/` folder as the project, or open the repo root if Studio detects the module).

4. **Build → Make Project**, then **Run** on your emulator.

## Auth

Uses Cognito Hosted UI via [AppAuth](https://github.com/openid/AppAuth-Android) with redirect `weighttracker://callback` (configured in CDK). The app sends the **ID token** to `/api/...` like the web client.

## Notes

- Online-only for v1; offline sync is roadmap **#11**.
- Reference lines on the chart (target / ideal / goals) may be added in a follow-up; weight trend and table match web core behavior.
- If sign-in fails after deploy, confirm `AndroidUserPoolClientId` and that `cdk deploy` ran after the Android client was added.

See also [`../AUTH.md`](../AUTH.md) and [`../ROADMAP.md`](../ROADMAP.md).
