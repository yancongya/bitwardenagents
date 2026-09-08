#!/usr/bin/env bash
set -euo pipefail

repo="yancongya/bitwardenagents"
cf_project="bitwardenagents-landing"
cf_branch="main"
out_dir="landing/dist"
dry_run=false

if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
fi

for command in git gh npm npx; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done

git rev-parse --show-toplevel >/dev/null
gh auth status >/dev/null

echo "[1/4] Build one static artifact"
npm run landing:build
test -s "$out_dir/index.html"
grep -q "Bitwardenagents" "$out_dir/index.html"

if $dry_run; then
  echo "[dry-run] GitHub Pages: $repo, branch gh-pages, path /"
  echo "[dry-run] Cloudflare Pages: $cf_project, branch $cf_branch"
  exit 0
fi

echo "[2/4] Publish GitHub Pages mirror"
publish_dir="$(mktemp -d)"
trap 'rm -rf "$publish_dir"' EXIT
cp -R "$out_dir"/. "$publish_dir"/
touch "$publish_dir/.nojekyll"
(
  cd "$publish_dir"
  git init -q
  git checkout -q -b gh-pages
  git config user.name "Bitwardenagents deploy"
  git config user.email "actions@users.noreply.github.com"
  git add -A
  git commit -q -m "deploy: landing page"
  git remote add origin "https://github.com/${repo}.git"
  git push --force origin gh-pages
)

if gh api "repos/$repo/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$repo/pages" \
    -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/' >/dev/null
else
  gh api --method POST "repos/$repo/pages" \
    -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/' >/dev/null
fi

echo "[3/4] Publish Cloudflare Pages primary"
if ! npx wrangler pages project list 2>/dev/null | grep -q "│ $cf_project │"; then
  npx wrangler pages project create "$cf_project" --production-branch "$cf_branch"
fi
npx wrangler pages deploy "$out_dir" --project-name "$cf_project" --branch "$cf_branch" --commit-dirty=true

echo "[4/4] Verify public endpoints"
github_page="$publish_dir/github-page.html"
cloudflare_page="$publish_dir/cloudflare-page.html"
curl --fail --silent --show-error --retry 8 --retry-delay 3 \
  --output "$github_page" "https://yancongya.github.io/bitwardenagents/"
curl --fail --silent --show-error --retry 8 --retry-delay 3 \
  --output "$cloudflare_page" "https://${cf_project}.pages.dev/"
grep -q "Agent" "$github_page"
grep -q "Agent" "$cloudflare_page"

echo "GitHub mirror: https://yancongya.github.io/bitwardenagents/"
echo "Cloudflare landing: https://${cf_project}.pages.dev/"
echo "Product/demo: https://bitwardenagents.itycon.cn/"
