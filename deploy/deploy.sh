#!/usr/bin/env bash
# Deploys MeaningBridge to Google Cloud Run.
# Run from the project root in Google Cloud Shell:  bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f deploy/env.deploy ]; then
  echo "ERROR: deploy/env.deploy not found. Copy deploy/env.deploy.example and fill it in."
  exit 1
fi

set -a; source deploy/env.deploy; set +a

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${DATABASE_URL:?Set DATABASE_URL}"

SERVICE_NAME=meaningbridge
BUCKET_NAME="${GCP_PROJECT_ID}-meaningbridge"

echo "==> Using project: $GCP_PROJECT_ID (region $GCP_REGION)"
gcloud config set project "$GCP_PROJECT_ID" --quiet

echo "==> Ensuring photo bucket exists..."
if ! gcloud storage buckets describe "gs://$BUCKET_NAME" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET_NAME" --location="$GCP_REGION" --quiet
fi

ENV_FILE=$(mktemp /tmp/envvars.XXXXXX.yaml)
trap 'rm -f "$ENV_FILE"' EXIT
python3 - "$ENV_FILE" <<'PYEOF'
import os, sys, json
keys = [
    "APP_ORIGIN", "DATABASE_URL",
    "AI_INTEGRATIONS_ANTHROPIC_API_KEY", "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
    "AI_INTEGRATIONS_OPENROUTER_API_KEY", "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
    "AI_INTEGRATIONS_OPENAI_API_KEY", "AI_INTEGRATIONS_OPENAI_BASE_URL",
    "GEMINI_CHAT_MODEL", "AI_IMAGE_MODEL",
    "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY",
    "PHI_ENCRYPTION_KEY", "HEALTHIE_API_KEY", "HEALTHIE_API_URL",
    "PUBLIC_OBJECT_SEARCH_PATHS", "PRIVATE_OBJECT_DIR",
]
out = {"NODE_ENV": "production"}
for k in keys:
    v = os.environ.get(k, "").strip()
    if v:
        out[k] = v
with open(sys.argv[1], "w") as f:
    for k, v in out.items():
        f.write(f"{k}: {json.dumps(v)}\n")
PYEOF

echo "==> Building and deploying to Cloud Run (5-10 minutes)..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$GCP_REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --env-vars-file "$ENV_FILE" \
  --quiet

URL=$(gcloud run services describe "$SERVICE_NAME" --region "$GCP_REGION" --format='value(status.url)')
echo ""
echo "============================================================"
echo "  Deployed! MeaningBridge is live at:"
echo "  $URL"
echo "============================================================"
