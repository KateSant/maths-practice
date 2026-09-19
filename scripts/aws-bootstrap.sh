#!/usr/bin/env bash
#
# One-time AWS bootstrap for Real Maths, via the AWS CLI.
#
# Creates the three things Terraform cannot create for itself:
#
#   * an S3 bucket for Terraform state (versioned, encrypted, private)
#   * a GitHub OIDC identity provider
#   * an IAM role that GitHub Actions assumes with short-lived credentials,
#     scoped to one branch of one repository
#
# After this, CI runs Terraform with no stored AWS access keys anywhere.
#
# Safe to re-run: every step checks for existing resources first.
#
#   EXPECTED_ACCOUNT_ID=991346485322 \
#   AWS_PROFILE=admin \
#   GITHUB_OWNER=KateSant GITHUB_REPO=real-maths STATE_BUCKET=realmaths-terraform-state \
#   AWS_REGION=eu-west-2 ./scripts/aws-bootstrap.sh
#
# EXPECTED_ACCOUNT_ID is required. AWS_PROFILE is not, but if you have more than
# one account configured it is the difference between creating resources here and
# creating them somewhere else.
#
# Requires an administrator identity. It is deliberately not managed by Terraform,
# because Terraform cannot run until this exists.

set -euo pipefail

# Never let a pager block a non-interactive script.
export AWS_PAGER=""

AWS_REGION="${AWS_REGION:-eu-west-2}"
GITHUB_OWNER="${GITHUB_OWNER:?set GITHUB_OWNER, e.g. KateSant}"
GITHUB_REPO="${GITHUB_REPO:?set GITHUB_REPO, e.g. real-maths}"
BRANCH="${BRANCH:-main}"
# Jobs that declare an environment emit a different subject claim (see below).
ENVIRONMENT="${ENVIRONMENT:-production}"
STATE_BUCKET="${STATE_BUCKET:?set STATE_BUCKET, e.g. realmaths-terraform-state}"
ROLE_NAME="${ROLE_NAME:-realmaths-github-ci}"
EXPECTED_ACCOUNT_ID="${EXPECTED_ACCOUNT_ID:?set EXPECTED_ACCOUNT_ID to the 12-digit account this should run in}"
OIDC_URL="https://token.actions.githubusercontent.com"

say() { printf '\n==> %s\n' "$1"; }

# ---------------------------------------------------------------- preflight ---

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: the AWS CLI is not installed." >&2
  exit 1
fi

CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

# Checked before anything is created. With more than one account configured, the
# wrong AWS_PROFILE otherwise creates a role and a bucket in the wrong place, which
# is silent and annoying to unpick.
if [ "$ACCOUNT_ID" != "$EXPECTED_ACCOUNT_ID" ]; then
  cat >&2 <<ERR

  ERROR: authenticated to account $ACCOUNT_ID, but EXPECTED_ACCOUNT_ID is $EXPECTED_ACCOUNT_ID.

  Refusing to continue. Check which account your profile points at with:
      aws sts get-caller-identity --profile <profile>
  and pass the intended one explicitly, e.g. AWS_PROFILE=admin.

ERR
  exit 1
fi

say "Authenticated as $CALLER_ARN"
say "Account $ACCOUNT_ID"

case "$CALLER_ARN" in
  *:root)
    cat >&2 <<'WARN'

  ##############################################################################
  #  WARNING: you are authenticated as the ACCOUNT ROOT user.
  #
  #  Root cannot be restricted by IAM policy. It has unrestricted access to
  #  everything, including billing and account closure. Using it for routine
  #  work - and especially for a script that creates IAM roles - is the single
  #  riskiest thing you can do in an AWS account.
  #
  #  Recommended instead:
  #    1. IAM > Users > Create user, with "Provide user access to the console"
  #    2. Attach the AWS managed policy AdministratorAccess
  #    3. Enable MFA on it, then authenticate as that user and re-run this
  #    4. Enable MFA on root and delete any root access keys
  #
  #  This one-off bootstrap is the least bad moment to use root, and creating a
  #  role is exactly the operation an attacker would most want. Set
  #  ALLOW_ROOT=yes to proceed anyway.
  ##############################################################################

WARN
    if [ "${ALLOW_ROOT:-no}" != "yes" ]; then
      echo "  Refusing to continue. Re-run with ALLOW_ROOT=yes to override." >&2
      exit 1
    fi
    echo "  Continuing as root because ALLOW_ROOT=yes."
    ;;
esac

# ------------------------------------------------------------ state bucket ---

say "Terraform state bucket: $STATE_BUCKET"

if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  echo "    already exists"
else
  # us-east-1 must NOT be given a LocationConstraint; every other region MUST.
  # Getting this backwards fails with an unhelpful error.
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$STATE_BUCKET" --region us-east-1 >/dev/null
  else
    aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
  echo "    created in $AWS_REGION"
fi

# Versioning is what makes a corrupted or truncated state file recoverable.
aws s3api put-bucket-versioning \
  --bucket "$STATE_BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$STATE_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket "$STATE_BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'

aws s3api put-bucket-lifecycle-configuration \
  --bucket "$STATE_BUCKET" \
  --lifecycle-configuration \
  '{"Rules":[{"ID":"ExpireOldStateVersions","Status":"Enabled","Filter":{"Prefix":""},"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}'

echo "    versioning, encryption, public access block and lifecycle set"

# ------------------------------------------------------------ oidc provider ---

say "GitHub OIDC identity provider"

# An account may hold only one provider per URL, so reuse an existing one rather
# than failing. The ARN looks like
#   arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com
EXISTING_OIDC="$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?contains(Arn, '${OIDC_URL#https://}')].Arn | [0]" \
  --output text)"

if [ -n "$EXISTING_OIDC" ] && [ "$EXISTING_OIDC" != "None" ]; then
  OIDC_ARN="$EXISTING_OIDC"
  echo "    already exists: $OIDC_ARN"
else
  OIDC_ARN="$(aws iam create-open-id-connect-provider \
    --url "$OIDC_URL" \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 1c58a3a8518e8759bf075b76b750d4f2df264fcd \
    --query OpenIDConnectProviderArn --output text)"
  echo "    created: $OIDC_ARN"
  echo "    note: AWS can take ~10s to accept the first token from a new provider."
fi

# ----------------------------------------------------------------- ci role ---

say "GitHub Actions role: $ROLE_NAME"

# GitHub's subject claim embeds immutable numeric ids, e.g.
#   repo:KateSant@51126336/real-maths@1377364455:ref:refs/heads/main
# The ids were added so a deleted-and-recreated repository cannot inherit trust.
# Matching them with wildcards keeps the owner, repository and branch pinned
# exactly while surviving a rename; the ids themselves never change.
#
# Note the second subject. A job that declares an environment does not emit a ref
# claim at all - GitHub replaces it with the environment name. The infrastructure
# job matches the first pattern and the deploy job (environment: production) matches
# the second, which is why omitting the second silently breaks only the deploy.
TRUST_POLICY="$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$OIDC_ARN"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:$GITHUB_OWNER@*/$GITHUB_REPO@*:ref:refs/heads/$BRANCH",
            "repo:$GITHUB_OWNER@*/$GITHUB_REPO@*:environment:$ENVIRONMENT"
          ]
        }
      }
    }
  ]
}
JSON
)"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  # Keeps the trust policy in sync if the repo, branch or account changed.
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
  echo "    already exists; trust policy updated"
else
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --description "Assumed by GitHub Actions for Real Maths over OIDC. No stored access keys." \
    --assume-role-policy-document "$TRUST_POLICY" \
    --max-session-duration 3600 >/dev/null
  echo "    created"
fi

STATE_POLICY="$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListStateBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::$STATE_BUCKET"
    },
    {
      "Sid": "ReadWriteStateObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$STATE_BUCKET/*"
    }
  ]
}
JSON
)"

LIGHTSAIL_POLICY="$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageLightsail",
      "Effect": "Allow",
      "Action": "lightsail:*",
      "Resource": "*"
    }
  ]
}
JSON
)"

# put-role-policy creates or replaces, so this is naturally idempotent.
aws iam put-role-policy \
  --role-name "$ROLE_NAME" --policy-name terraform-state \
  --policy-document "$STATE_POLICY"
aws iam put-role-policy \
  --role-name "$ROLE_NAME" --policy-name lightsail \
  --policy-document "$LIGHTSAIL_POLICY"
echo "    inline policies: terraform-state, lightsail"

# ----------------------------------------------------------------- summary ---

ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"

cat <<EOF

==============================================================================
 Bootstrap complete.
==============================================================================

The role grants management of Lightsail and read/write on the state bucket, and
nothing else. It cannot touch EC2, IAM, billing, or any other bucket. It is
assumable only by a workflow running on branch '$BRANCH' of
$GITHUB_OWNER/$GITHUB_REPO.

Now add these in GitHub: Settings > Secrets and variables > Actions

  VARIABLES (the Variables tab)
    TF_STATE_BUCKET           $STATE_BUCKET
    AWS_REGION                $AWS_REGION
    AWS_AVAILABILITY_ZONE     <verify: aws lightsail get-regions --include-availability-zones --region $AWS_REGION>
    SITE_DOMAIN               <your hostname, no https:// prefix>
    SSH_PUBLIC_KEY            <contents of ~/.ssh/realmaths-deploy.pub>
    SSH_CIDR                  <your address, from: curl -4 ifconfig.me>

  SECRETS (the Secrets tab)
    AWS_ROLE_ARN              $ROLE_ARN
    DEPLOY_SSH_KEY            <private key matching the Lightsail key pair>
    DEPLOY_HOST_KEY           <ssh-keyscan -H <static-ip>   (after terraform apply)>

Still to do, outside this script:
  * Enable MFA on the root user and confirm it has no access keys.
  * Generate the deploy key pair locally, so Terraform can register the public half:
      ssh-keygen -t ed25519 -f ~/.ssh/realmaths-deploy -C realmaths-deploy -N ""

EOF
