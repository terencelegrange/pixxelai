#!/usr/bin/env bash
#
# scripts/update-dockerhub-readme.sh
#
# Updates the Docker Hub landing page (README / full_description and short description)
# for tlgrange/pixxelai using Docker Hub REST API v2.
#
# Usage:
#   ./scripts/update-dockerhub-readme.sh
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
README_FILE="${REPO_ROOT}/DOCKERHUB.md"
REPO_NAME="tlgrange/pixxelai"
SHORT_DESC="AI-Powered Architecture & Compliance Assessment Platform (Dual SQLite / MySQL support)"

if [ ! -f "$README_FILE" ]; then
  echo "Error: $README_FILE not found." >&2
  exit 1
fi

echo "==> Updating Docker Hub overview for ${REPO_NAME} from ${README_FILE}"

python3 - <<PYEOF
import os, sys, subprocess, json, urllib.request

repo_name = "${REPO_NAME}"
short_description = "${SHORT_DESC}"
readme_path = "${README_FILE}"

username = os.environ.get("DOCKERHUB_USERNAME")
secret = os.environ.get("DOCKERHUB_PASSWORD") or os.environ.get("DOCKERHUB_TOKEN")

if not (username and secret):
    try:
        proc = subprocess.run(["docker-credential-desktop", "get"], input=b"https://index.docker.io/v1/", capture_output=True, check=True)
        creds = json.loads(proc.stdout)
        username = creds.get("Username")
        secret = creds.get("Secret")
    except Exception:
        pass

if not (username and secret):
    sys.exit("Error: Could not retrieve Docker Hub credentials. Set DOCKERHUB_USERNAME and DOCKERHUB_TOKEN/DOCKERHUB_PASSWORD env vars.")

login_payload = json.dumps({"username": username, "password": secret}).encode("utf-8")
req = urllib.request.Request(
    "https://hub.docker.com/v2/users/login/",
    data=login_payload,
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        token_data = json.loads(resp.read().decode("utf-8"))
        jwt = token_data.get("token")
except Exception as e:
    sys.exit(f"Failed to authenticate with Docker Hub API: {e}")

with open(readme_path, "r", encoding="utf-8") as f:
    full_description = f.read()

patch_payload = json.dumps({
    "description": short_description,
    "full_description": full_description
}).encode("utf-8")

patch_req = urllib.request.Request(
    f"https://hub.docker.com/v2/repositories/{repo_name}/",
    data=patch_payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"JWT {jwt}"
    },
    method="PATCH"
)

try:
    with urllib.request.urlopen(patch_req) as patch_resp:
        res = json.loads(patch_resp.read().decode("utf-8"))
        print(f"==> Successfully updated {repo_name} on Docker Hub!")
        print(f"    Short Description: {res.get('description')}")
        print(f"    Full Description Length: {len(res.get('full_description', ''))} characters")
except Exception as e:
    sys.exit(f"Failed to update Docker Hub repository description: {e}")
PYEOF
