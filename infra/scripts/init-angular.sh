#!/usr/bin/env sh
set -eu

if [ -f "frontend/package.json" ]; then
  echo "frontend/package.json already exists. Skipping scaffold."
  exit 0
fi

if [ -f "frontend/README.md" ]; then
  mv frontend/README.md frontend/README.pre-scaffold.md
fi

cd frontend
npx -y @angular/cli@latest new ai-discord-ops-web \
  --directory . \
  --standalone \
  --style=css \
  --routing \
  --package-manager=npm \
  --skip-git \
  --force

npm install -D tailwindcss postcss autoprefixer @tailwindcss/postcss

cat > .postcssrc.json <<'EOF'
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
EOF

echo "@import \"tailwindcss\";" > src/styles.css

echo "Angular scaffold with Tailwind v4 dependencies initialized."
