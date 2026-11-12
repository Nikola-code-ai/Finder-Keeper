#!/usr/bin/env bash
# Deploy Finder-Keeper to AWS (serverless). Idempotent: rerun it to ship a new build.
#
#   infra/aws/deploy.sh        (from a clean main; optional CONTACT_EMAIL, UNPAYWALL_EMAIL, OPENALEX_API_KEY)
#
# Creates billable resources in the project's Region. See infra/aws/README.md for costs and teardown.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Deploy only committed code from main, so every running image maps to a commit on main.
BRANCH="$(git -C "$ROOT" symbolic-ref --quiet --short HEAD || true)"
[ "$BRANCH" = "main" ] || { echo "Deploys run only from main (current: ${BRANCH:-detached HEAD}). Merge first." >&2; exit 1; }
[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ] || { echo "Commit or stash local changes before deploying." >&2; exit 1; }
if git -C "$ROOT" rev-parse --verify --quiet origin/main >/dev/null; then
  git -C "$ROOT" fetch --quiet origin main
  [ "$(git -C "$ROOT" rev-parse HEAD)" = "$(git -C "$ROOT" rev-parse origin/main)" ] || { echo "Local main differs from origin/main. Pull or push first." >&2; exit 1; }
fi

export AWS_PROFILE="${AWS_PROFILE:-finder-keeper}"
export AWS_REGION="${AWS_REGION:-$(aws configure get region || true)}"
STACK="${STACK:-finder-keeper}"
CLUSTER="${DB_CLUSTER:-finder-keeper-db}"
TAG="$(git -C "$ROOT" rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"

: "${AWS_REGION:?Set AWS_REGION to the selected Region of the project}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
echo "Project $ACCOUNT, Region $AWS_REGION, stack $STACK, build $TAG"

# 1. Aurora PostgreSQL serverless, express configuration: no VPC, IAM-only auth through the internet access gateway.
if ! aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER" >/dev/null 2>&1; then
  echo "Creating Aurora express cluster $CLUSTER"
  aws rds create-db-cluster --db-cluster-identifier "$CLUSTER" --engine aurora-postgresql --with-express-configuration \
    --tags Key=project,Value=finder-keeper Key=created_by,Value=aurora-skill Key=generation_model,Value=claude-opus-5-5 >/dev/null
  aws rds wait db-cluster-available --db-cluster-identifier "$CLUSTER"
  # Pause after 10 idle minutes (0 ACU) and stay within the Free plan's 4 ACU ceiling.
  aws rds modify-db-cluster --db-cluster-identifier "$CLUSTER" --apply-immediately \
    --serverless-v2-scaling-configuration MinCapacity=0,MaxCapacity=4,SecondsUntilAutoPause=600 >/dev/null
  aws rds wait db-cluster-available --db-cluster-identifier "$CLUSTER"
fi
# The cluster reports available before its serverless instance does; the bootstrap needs the instance.
aws rds wait db-instance-available --filters "Name=db-cluster-id,Values=$CLUSTER"
read -r DB_ENDPOINT DB_RESOURCE_ID < <(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER" \
  --query 'DBClusters[0].[Endpoint,DbClusterResourceId]' --output text)

# 2. Least-privilege database role, pgvector, and schema (connects with short-lived IAM tokens).
# boto3 cannot read an `aws login` session without botocore[crt], so hand it the CLI's temporary credentials.
(cd "$ROOT/backend" && eval "$(aws configure export-credentials --format env)" && unset AWS_PROFILE \
  && DB_HOST="$DB_ENDPOINT" .venv/bin/python -m app.aws_bootstrap)

# 3. Container images. Lambda needs single-platform Docker v2 manifests, hence --provenance=false.
aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
for name in api web; do
  repo="finder-keeper-$name"
  if ! aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1; then
    aws ecr create-repository --repository-name "$repo" --image-tag-mutability IMMUTABLE \
      --image-scanning-configuration scanOnPush=true --encryption-configuration encryptionType=AES256 >/dev/null
    aws ecr put-lifecycle-policy --repository-name "$repo" --lifecycle-policy-text \
      '{"rules":[{"rulePriority":1,"description":"keep 5 builds","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}' >/dev/null
  fi
  docker build --platform linux/amd64 --provenance=false -f "$ROOT/infra/aws/Dockerfile.$name" -t "$REGISTRY/$repo:$TAG" "$ROOT"
  docker push "$REGISTRY/$repo:$TAG" >/dev/null
done
digest() { aws ecr describe-images --repository-name "$1" --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text; }
API_IMAGE="$REGISTRY/finder-keeper-api@$(digest finder-keeper-api)"
WEB_IMAGE="$REGISTRY/finder-keeper-web@$(digest finder-keeper-web)"
# The images now live in ECR; drop the local copies so repeated deploys do not fill the disk.
docker rmi "$REGISTRY/finder-keeper-api:$TAG" "$REGISTRY/finder-keeper-web:$TAG" >/dev/null 2>&1 || true

# 4. Functions, queue, bucket, sign-in, CDN. Cognito's callback URL needs the CloudFront domain, which exists only
#    after the first create, so the first deploy is followed by a second pass that feeds the domain back in.
output() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text 2>/dev/null || true; }
deploy_stack() {
  aws cloudformation deploy --stack-name "$STACK" --template-file "$ROOT/infra/aws/template.yaml" \
    --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --tags project=finder-keeper \
    --parameter-overrides \
      ApiImageUri="$API_IMAGE" WebImageUri="$WEB_IMAGE" SiteDomain="$1" \
      DbEndpoint="$DB_ENDPOINT" DbClusterResourceId="$DB_RESOURCE_ID" \
      ContactEmail="${CONTACT_EMAIL:-}" UnpaywallEmail="${UNPAYWALL_EMAIL:-}" OpenAlexApiKey="${OPENALEX_API_KEY:-}"
}
SITE_DOMAIN="$(output SiteDomain)"; [ "$SITE_DOMAIN" = "None" ] && SITE_DOMAIN=""
deploy_stack "$SITE_DOMAIN"
if [ "$(output SiteDomain)" != "$SITE_DOMAIN" ]; then
  SITE_DOMAIN="$(output SiteDomain)"
  echo "Registering https://$SITE_DOMAIN with Cognito"
  deploy_stack "$SITE_DOMAIN"
fi

aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
echo "Site: https://$SITE_DOMAIN"
