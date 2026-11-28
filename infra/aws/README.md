# Finder-Keeper on AWS (serverless)

Prepared 2026-11-12 for the AWS project `460370269693`, profile `finder-keeper`, selected Region **us-east-2**, on the **Free plan** ($100 credits, expiring 2027-05-12). Nothing has been deployed yet. `deploy.sh` creates every resource.

```
Browser ──HTTPS──> CloudFront ──> finder-keeper-web (Lambda, Next.js, function URL)
   │                                   │  SigV4-signed (lambda:InvokeFunctionUrl)
   │                                   v
   │                          finder-keeper-api (Lambda, FastAPI, IAM function URL)
   │                                   │ S3 put/get   │ SQS send    │ IAM token
   └──presigned POST──> S3 (private) <─┤              v             v
                                       │      finder-keeper-jobs ──> Aurora PostgreSQL serverless
                                       └──── finder-keeper-worker <┘   (express configuration, pgvector,
                                             (Lambda, same image)        pauses at 0 ACU)
```

| Piece | AWS service | Notes |
| --- | --- | --- |
| Web app | Lambda container (`Dockerfile.web`) + Lambda Web Adapter, response streaming | Public function URL; CloudFront caches `/_next/static/*` only |
| API | Lambda container (`Dockerfile.api`), `AWS_IAM` function URL | Only the web function's role can call it. The reader's Cognito ID token travels in `X-User-Authorization` and is verified against the user pool's keys |
| Jobs | SQS + worker Lambda (same image, `WORKER_MODE=true`) | Batch size 1, 2 concurrent at most, 15 min timeout, 3 attempts and then the dead-letter queue |
| Files | S3, private, SSE-S3, TLS only | Browsers upload straight to `incoming/` with a presigned POST (Lambda requests stop at 6 MB). The API moves the file into the library. Abandoned uploads expire after a day |
| Database | Aurora PostgreSQL serverless, **express configuration** | No VPC and no NAT: the internet access gateway accepts only IAM auth tokens, verified over TLS (`verify-full`). Scales 0–4 ACU and pauses after 10 idle minutes |
| Sign-in | Cognito user pool (Essentials), managed login, email + password | Next.js runs the authorization-code + PKCE exchange on the server. ID (15 min) and refresh (30 days) tokens live only in HttpOnly cookies. Sign-out revokes the refresh token |
| Embeddings | fastembed `bge-small-en-v1.5`, baked into the API image | Answers use grounded extraction; Ollama is off on AWS |

## Deploy

Requirements: AWS CLI v2.33+ signed in (`aws login --profile finder-keeper`), Docker, and the backend venv (`backend/.venv`). Before running, confirm the selected Region in AWS Settings > View all projects > Overview > Additional Info > Region.

```sh
infra/aws/deploy.sh
```

The script runs only from a clean `main`. Optional variables: `CONTACT_EMAIL`, `UNPAYWALL_EMAIL`, `OPENALEX_API_KEY`, and `GOOGLE_CLIENT_ID` (see "Sign in with Google" below).

The script is idempotent. It runs these steps:

1. Creates the Aurora express cluster `finder-keeper-db` if it is missing, then sets 0–4 ACU with auto-pause.
2. Runs `python -m app.aws_bootstrap`. As the IAM-authenticated `postgres` admin, it creates the `finder_keeper` login role (`rds_iam`), its database, and `vector`. Then it creates the schema as that role.
3. Builds both images for `linux/amd64` and pushes them to ECR (immutable tags, keep 5). The stack pins them by digest.
4. Deploys `template.yaml` as stack `finder-keeper`. On the first run it deploys a second time to register the new CloudFront domain as Cognito's callback URL. Then it prints the site URL.

To ship a new build, merge to `main` and run the script again.

### Sign in with Google

Off by default. To show "Continue with Google" on the Cognito sign-in page:

1. In the Google Cloud console, under APIs & Services > Credentials, create an OAuth client ID of type **Web application**. Use these values:
   - Authorized JavaScript origin: `https://finder-keeper-460370269693.auth.us-east-2.amazoncognito.com`
   - Authorized redirect URI: `https://finder-keeper-460370269693.auth.us-east-2.amazoncognito.com/oauth2/idpresponse`
   
   On the OAuth consent screen, add `amazoncognito.com` as an authorized domain.
2. Store the client secret in Secrets Manager. Run this yourself, so the secret never appears on a command line:

   ```sh
   read -rs GS && printf '{"client_secret":"%s"}' "$GS" > /dev/shm/g.json && unset GS && \
     aws secretsmanager create-secret --name finder-keeper/google-oauth --secret-string file:///dev/shm/g.json; rm -f /dev/shm/g.json
   ```

3. Deploy with the client ID: `GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com infra/aws/deploy.sh`.

CloudFormation reads the secret only when the provider changes. After rotating the secret, update the provider in the Cognito console or change the template. The secret costs $0.40 a month.

## Cost (Free plan, light use)

Lambda (1M requests and 400,000 GB-seconds/month), SQS (1M requests), and CloudFront are covered by always-free allowances. Aurora bills ACU-hours only while it is awake, plus storage. On the Free plan it is capped at 4 ACU and **1 GiB of storage per cluster**. Each 384-dimension chunk takes about 1.5 KB of vectors plus its text, so watch storage as the library grows. Everything draws from the $100 credit until 2027-05-12. Create a budget in the Billing and Cost Management console before inviting users.

## Trade-offs to know

- **Cold starts.** The first request after a quiet period can wait for Aurora to resume and for the API to load the embedding model. That can take a few seconds to a few tens of seconds.
- **Session end.** Signing out revokes the refresh token, but the API checks ID tokens locally. A disabled user's current ID token keeps working until it expires, which takes at most 15 minutes.
- **Email delivery.** Cognito sends verification and reset codes from its default sender, which is limited to about 50 emails a day. Before wider sign-ups, switch the user pool to Amazon SES.
- **MFA** is optional and authenticator-app only. It applies to email-and-password readers; Google readers use Google's own protections.
- **Google and email accounts are separate.** A reader who signs up with an email and password and later uses Google with the same address gets a second, empty library. Linking them needs a pre sign-up Lambda trigger.
- **Public web function URL.** CloudFront fronts the web function, but its function URL is also reachable directly. Origin access control is not used, because Lambda OAC requires browsers to sign POST bodies. The API itself accepts only the web function's role.
- **Failed jobs** that exhaust three attempts land in `finder-keeper-jobs-dlq`, and the job record stays "Waiting for an automatic retry". Retry it from the app.

## Logs and teardown

Logs live in CloudWatch under `/finder-keeper/{web,api,worker}` (14-day retention).

Teardown. The bucket and the user pool are retained on purpose; the user pool also has deletion protection.

```sh
aws cloudformation delete-stack --stack-name finder-keeper --profile finder-keeper
aws rds delete-db-cluster --db-cluster-identifier finder-keeper-db --final-db-snapshot-identifier finder-keeper-final --profile finder-keeper
aws ecr delete-repository --repository-name finder-keeper-api --force --profile finder-keeper
aws ecr delete-repository --repository-name finder-keeper-web --force --profile finder-keeper
```

The express cluster is created with exactly one Aurora serverless instance. Delete that instance first if `delete-db-cluster` reports it still has members.
