export interface PythonDeployOptions {
  templateName: "python-main" | "python-app";
  serviceName: string;
  envDatabaseName: string;
  includePrivateKey: boolean;
  defaultImageName: string;
  defaultContainerName: string;
  defaultAppPort: number;
  defaultNginxPort: number;
}

export function createPythonDockerComposeDeploy(options: PythonDeployOptions) {
  return `services:
  api:
    image: \${DOCKER_IMAGE_NAME}:\${APP_VERSION}
    container_name: \${CONTAINER_NAME:-${options.defaultContainerName}}
    env_file:
      - .env
    ports:
      - "\${APP_PORT:-${options.defaultAppPort}}:8000"
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
        ]
      interval: 30s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:1.27-alpine
    container_name: \${NGINX_CONTAINER_NAME:-${options.defaultContainerName}-nginx}
    ports:
      - "\${NGINX_PORT:-${options.defaultNginxPort}}:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
    networks:
      - backend
    restart: unless-stopped

networks:
  backend:
    external: true
    name: \${DOCKER_NETWORK_NAME:-product-backend}
`;
}

export function createPythonDockerComposeInfra(options: PythonDeployOptions) {
  return `services:
  postgres:
    image: postgres:16-alpine
    container_name: \${POSTGRES_CONTAINER_NAME:-product-postgres}
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${options.envDatabaseName}}
      POSTGRES_USER: \${POSTGRES_USER:-${options.envDatabaseName}_user}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
    networks:
      - backend
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: \${REDIS_CONTAINER_NAME:-product-redis}
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    networks:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  backend:
    name: \${DOCKER_NETWORK_NAME:-product-backend}
`;
}

export function createPythonDeployEnvExample(options: PythonDeployOptions) {
  const authOnlyEnv = options.includePrivateKey
    ? `
# python-main signs tokens. Keep this secret in GitHub Environment Secrets for real deploys.
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_TOKEN_REUSE_GRACE_SECONDS=10
REFRESH_TOKEN_ROTATE=true
REFRESH_TOKEN_PREFIX=auth:product:refresh:
`
    : "";

  return `# Docker image name used by docker-compose.deploy.yml.
DOCKER_IMAGE_NAME=${options.defaultImageName}

# Immutable image/application version tag.
APP_VERSION=local

# Container names and host ports.
CONTAINER_NAME=${options.defaultContainerName}
NGINX_CONTAINER_NAME=${options.defaultContainerName}-nginx
APP_PORT=${options.defaultAppPort}
NGINX_PORT=${options.defaultNginxPort}

# Deployment environment and shared Docker network.
APP_ENV=product
DOCKER_NETWORK_NAME=product-backend

# Runtime service settings.
DEBUG=false
LOG_LEVEL=info
LOG_FORMAT=json
REQUEST_ID_HEADER=X-Request-ID
WEB_CONCURRENCY=4
GUNICORN_TIMEOUT=60
GUNICORN_GRACEFUL_TIMEOUT=30
SERVICE_NAME=${options.serviceName}
API_PREFIX=/api

# Infrastructure connection. Use GitHub Secrets for real values.
DATABASE_URL=postgresql+psycopg://${options.envDatabaseName}_user:change-me@product-postgres:5432/${options.envDatabaseName}
DB_SSLMODE=disable
REDIS_URL=redis://product-redis:6379/0
REDIS_KEY_PREFIX=auth:product:

# JWT common config.
JWT_ALGORITHM=RS256
JWT_ISSUER=auth-service
JWT_AUDIENCE=backend-api
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"
${authOnlyEnv}TOKEN_BLACKLIST_PREFIX=auth:product:blacklist:jti:
SESSION_PREFIX=auth:product:session:

CORS_ALLOW_ORIGINS=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=true

OPENAPI_ENABLED=false
DOCS_ENABLED=false
REDOC_ENABLED=false
`;
}

export function createPythonDeployWorkflow(options: PythonDeployOptions) {
  const privateKeyEnv = options.includePrivateKey ? "      JWT_PRIVATE_KEY: ${{ secrets.JWT_PRIVATE_KEY }}\n" : "";
  const privateKeyGeneratedEnv = options.includePrivateKey ? "          JWT_PRIVATE_KEY=$JWT_PRIVATE_KEY\n          REFRESH_TOKEN_EXPIRE_DAYS=${REFRESH_TOKEN_EXPIRE_DAYS:-30}\n          REFRESH_TOKEN_REUSE_GRACE_SECONDS=${REFRESH_TOKEN_REUSE_GRACE_SECONDS:-10}\n          REFRESH_TOKEN_ROTATE=${REFRESH_TOKEN_ROTATE:-true}\n          REFRESH_TOKEN_PREFIX=${REFRESH_TOKEN_PREFIX:-auth:$DEPLOY_ENV:refresh:}\n" : "";
  const privateKeyRequiredCheck = options.includePrivateKey ? "          : \"${JWT_PRIVATE_KEY:?Missing JWT_PRIVATE_KEY secret}\"\n" : "";

  return `name: Deploy

on:
  push:
    tags:
      - "test-v*.*.*"
      - "product-v*.*.*"
  workflow_dispatch:
    inputs:
      environment:
        description: Deployment environment for rollback
        required: true
        type: choice
        options:
          - test
          - product
      image_tag:
        description: Historical immutable image tag to deploy, for example product-v1.0.1
        required: true
        type: string

permissions:
  contents: read
  packages: write

jobs:
  resolve-deploy:
    runs-on: ubuntu-latest
    outputs:
      environment: \${{ steps.resolve.outputs.environment }}
      image_tag: \${{ steps.resolve.outputs.image_tag }}
      version: \${{ steps.resolve.outputs.version }}
      should_build: \${{ steps.resolve.outputs.should_build }}
    steps:
      - id: resolve
        shell: bash
        run: |
          set -euo pipefail

          if [ "\${{ github.event_name }}" = "workflow_dispatch" ]; then
            environment="\${{ inputs.environment }}"
            image_tag="\${{ inputs.image_tag }}"
            should_build="false"
          else
            tag="$GITHUB_REF_NAME"
            should_build="true"
            case "$tag" in
              test-v*.*.*)
                environment="test"
                image_tag="$tag"
                ;;
              product-v*.*.*)
                environment="product"
                image_tag="$tag"
                ;;
              *)
                echo "Unsupported deploy tag: $tag" >&2
                exit 1
                ;;
            esac
          fi

          if [ "$image_tag" = "latest" ] || [ "\${image_tag##*:}" = "latest" ]; then
            echo "Refusing to deploy a latest tag. Use an immutable test-v*.*.* or product-v*.*.* image tag." >&2
            exit 1
          fi

          if [ "$environment" = "test" ] && [[ "$image_tag" == product-v* ]]; then
            echo "Refusing to deploy a product image tag to the test environment." >&2
            exit 1
          fi

          if [ "$environment" = "product" ] && [[ "$image_tag" == test-v* ]]; then
            echo "Refusing to deploy a test image tag to the product environment." >&2
            exit 1
          fi

          version="$image_tag"
          version="\${version#test-v}"
          version="\${version#product-v}"

          echo "environment=$environment" >> "$GITHUB_OUTPUT"
          echo "image_tag=$image_tag" >> "$GITHUB_OUTPUT"
          echo "version=$version" >> "$GITHUB_OUTPUT"
          echo "should_build=$should_build" >> "$GITHUB_OUTPUT"

  prepare-image:
    needs: resolve-deploy
    if: \${{ needs.resolve-deploy.outputs.should_build == 'true' }}
    runs-on: ubuntu-latest
    environment: \${{ needs.resolve-deploy.outputs.environment }}
    env:
      IMAGE_TAG: \${{ needs.resolve-deploy.outputs.image_tag }}
      DOCKER_REGISTRY: \${{ vars.DOCKER_REGISTRY }}
      DOCKER_IMAGE_NAME: \${{ vars.DOCKER_IMAGE_NAME }}
      DOCKER_REGISTRY_USERNAME: \${{ vars.DOCKER_REGISTRY_USERNAME }}
      DOCKER_REGISTRY_TOKEN: \${{ secrets.DOCKER_REGISTRY_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - name: Resolve image name
        id: image
        shell: bash
        run: |
          set -euo pipefail
          registry="\${DOCKER_REGISTRY:-ghcr.io}"
          image_name="$DOCKER_IMAGE_NAME"
          if [ -z "$image_name" ]; then
            image_name="$registry/$GITHUB_REPOSITORY"
          fi
          image_name="$(printf '%s' "$image_name" | tr '[:upper:]' '[:lower:]')"
          echo "registry=$registry" >> "$GITHUB_OUTPUT"
          echo "image_name=$image_name" >> "$GITHUB_OUTPUT"
      - name: Log in to container registry
        shell: bash
        run: |
          set -euo pipefail
          username="\${DOCKER_REGISTRY_USERNAME:-$GITHUB_ACTOR}"
          if [ -z "$DOCKER_REGISTRY_TOKEN" ]; then
            echo "Missing DOCKER_REGISTRY_TOKEN secret." >&2
            exit 1
          fi
          printf '%s' "$DOCKER_REGISTRY_TOKEN" | docker login "\${{ steps.image.outputs.registry }}" -u "$username" --password-stdin
      - name: Build Docker image
        env:
          IMAGE_NAME: \${{ steps.image.outputs.image_name }}
        shell: bash
        run: docker build -t "$IMAGE_NAME:$IMAGE_TAG" .
      - name: Push Docker image
        env:
          IMAGE_NAME: \${{ steps.image.outputs.image_name }}
        shell: bash
        run: docker push "$IMAGE_NAME:$IMAGE_TAG"

  deploy:
    needs:
      - resolve-deploy
      - prepare-image
    if: \${{ always() && needs.resolve-deploy.result == 'success' && (needs.prepare-image.result == 'success' || needs.prepare-image.result == 'skipped') }}
    runs-on: ubuntu-latest
    environment: \${{ needs.resolve-deploy.outputs.environment }}
    env:
      IMAGE_TAG: \${{ needs.resolve-deploy.outputs.image_tag }}
      DEPLOY_ENV: \${{ needs.resolve-deploy.outputs.environment }}
      DOCKER_REGISTRY: \${{ vars.DOCKER_REGISTRY }}
      DOCKER_IMAGE_NAME: \${{ vars.DOCKER_IMAGE_NAME }}
      DOCKER_REGISTRY_USERNAME: \${{ vars.DOCKER_REGISTRY_USERNAME }}
      DOCKER_REGISTRY_TOKEN: \${{ secrets.DOCKER_REGISTRY_TOKEN }}
      SSH_PRIVATE_KEY: \${{ secrets.SSH_PRIVATE_KEY }}
      SSH_KNOWN_HOSTS: \${{ secrets.SSH_KNOWN_HOSTS }}
      DEPLOY_HOST: \${{ vars.DEPLOY_HOST }}
      DEPLOY_PORT: \${{ vars.DEPLOY_PORT }}
      DEPLOY_USER: \${{ vars.DEPLOY_USER }}
      DEPLOY_PATH: \${{ vars.DEPLOY_PATH }}
      CONTAINER_NAME: \${{ vars.CONTAINER_NAME }}
      NGINX_CONTAINER_NAME: \${{ vars.NGINX_CONTAINER_NAME }}
      APP_PORT: \${{ vars.APP_PORT }}
      NGINX_PORT: \${{ vars.NGINX_PORT }}
      APP_ENV: \${{ vars.APP_ENV }}
      DOCKER_NETWORK_NAME: \${{ vars.DOCKER_NETWORK_NAME }}
      JWT_ISSUER: \${{ vars.JWT_ISSUER }}
      JWT_AUDIENCE: \${{ vars.JWT_AUDIENCE }}
      CORS_ALLOW_ORIGINS: \${{ vars.CORS_ALLOW_ORIGINS }}
      DATABASE_URL: \${{ secrets.DATABASE_URL }}
      REDIS_URL: \${{ secrets.REDIS_URL }}
${privateKeyEnv}      JWT_PUBLIC_KEY: \${{ secrets.JWT_PUBLIC_KEY }}
    steps:
      - uses: actions/checkout@v4
      - name: Resolve image name
        id: image
        shell: bash
        run: |
          set -euo pipefail
          registry="\${DOCKER_REGISTRY:-ghcr.io}"
          image_name="$DOCKER_IMAGE_NAME"
          if [ -z "$image_name" ]; then
            image_name="$registry/$GITHUB_REPOSITORY"
          fi
          image_name="$(printf '%s' "$image_name" | tr '[:upper:]' '[:lower:]')"
          echo "registry=$registry" >> "$GITHUB_OUTPUT"
          echo "image_name=$image_name" >> "$GITHUB_OUTPUT"
      - name: Configure SSH
        shell: bash
        run: |
          set -euo pipefail
          : "\${DEPLOY_HOST:?Missing DEPLOY_HOST environment variable}"
          : "\${DEPLOY_USER:?Missing DEPLOY_USER environment variable}"
          : "\${DEPLOY_PATH:?Missing DEPLOY_PATH environment variable}"
          : "\${SSH_PRIVATE_KEY:?Missing SSH_PRIVATE_KEY secret}"
          mkdir -p ~/.ssh
          printf '%s\\n' "$SSH_PRIVATE_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          if [ -n "\${SSH_KNOWN_HOSTS:-}" ]; then
            printf '%s\\n' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
          else
            ssh-keyscan -p "\${DEPLOY_PORT:-22}" "$DEPLOY_HOST" >> ~/.ssh/known_hosts
          fi
      - name: Upload docker-compose.deploy.yml, nginx config, and environment file
        env:
          IMAGE_NAME: \${{ steps.image.outputs.image_name }}
        shell: bash
        run: |
          set -euo pipefail
          : "\${DATABASE_URL:?Missing DATABASE_URL secret}"
          : "\${REDIS_URL:?Missing REDIS_URL secret}"
          : "\${JWT_PUBLIC_KEY:?Missing JWT_PUBLIC_KEY secret}"
${privateKeyRequiredCheck}          cat > .env.deploy.generated <<ENV
          DOCKER_IMAGE_NAME=$IMAGE_NAME
          APP_VERSION=$IMAGE_TAG
          CONTAINER_NAME=\${CONTAINER_NAME:-${options.defaultContainerName}}
          NGINX_CONTAINER_NAME=\${NGINX_CONTAINER_NAME:-${options.defaultContainerName}-nginx}
          APP_PORT=\${APP_PORT:-${options.defaultAppPort}}
          NGINX_PORT=\${NGINX_PORT:-${options.defaultNginxPort}}
          APP_ENV=\${APP_ENV:-$DEPLOY_ENV}
          DOCKER_NETWORK_NAME=\${DOCKER_NETWORK_NAME:-product-backend}
          DEBUG=false
          LOG_LEVEL=info
          LOG_FORMAT=json
          REQUEST_ID_HEADER=X-Request-ID
          WEB_CONCURRENCY=4
          GUNICORN_TIMEOUT=60
          GUNICORN_GRACEFUL_TIMEOUT=30
          SERVICE_NAME=${options.serviceName}
          API_PREFIX=/api
          DATABASE_URL=$DATABASE_URL
          DB_SSLMODE=disable
          REDIS_URL=$REDIS_URL
          REDIS_KEY_PREFIX=auth:$DEPLOY_ENV:
          JWT_ALGORITHM=RS256
          JWT_ISSUER=\${JWT_ISSUER:-auth-service}
          JWT_AUDIENCE=\${JWT_AUDIENCE:-backend-api}
          JWT_PUBLIC_KEY=$JWT_PUBLIC_KEY
${privateKeyGeneratedEnv}          TOKEN_BLACKLIST_PREFIX=auth:$DEPLOY_ENV:blacklist:jti:
          SESSION_PREFIX=auth:$DEPLOY_ENV:session:
          CORS_ALLOW_ORIGINS=\${CORS_ALLOW_ORIGINS:-https://app.example.com}
          CORS_ALLOW_CREDENTIALS=true
          OPENAPI_ENABLED=false
          DOCS_ENABLED=false
          REDOC_ENABLED=false
          ENV
          ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH/nginx'"
          scp -i ~/.ssh/deploy_key -P "\${DEPLOY_PORT:-22}" docker-compose.deploy.yml "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.deploy.yml"
          scp -i ~/.ssh/deploy_key -P "\${DEPLOY_PORT:-22}" nginx/default.conf "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/nginx/default.conf"
          scp -i ~/.ssh/deploy_key -P "\${DEPLOY_PORT:-22}" .env.deploy.generated "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/.env"
      - name: Deploy with docker compose
        shell: bash
        run: |
          set -euo pipefail
          username="\${DOCKER_REGISTRY_USERNAME:-$GITHUB_ACTOR}"
          if [ -n "\${DOCKER_REGISTRY_TOKEN:-}" ]; then
            printf '%s' "$DOCKER_REGISTRY_TOKEN" | ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "docker login '\${{ steps.image.outputs.registry }}' -u '$username' --password-stdin"
          fi
          ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && docker compose --env-file .env -f docker-compose.deploy.yml pull api && docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-build api nginx"
`;
}

export function createPythonMigrateWorkflow(options: PythonDeployOptions) {
  return `name: Migrate

on:
  workflow_dispatch:
    inputs:
      environment:
        description: Target environment for the migration
        required: true
        type: choice
        options:
          - test
          - product
      revision:
        description: Alembic target revision, for example head or a revision id
        required: true
        default: head
        type: string
      backup_confirmed:
        description: Confirm database backup and rollback plan before product migration
        required: true
        default: false
        type: boolean

permissions:
  contents: read

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}
    env:
      DEPLOY_ENV: \${{ inputs.environment }}
      REVISION: \${{ inputs.revision }}
      BACKUP_CONFIRMED: \${{ inputs.backup_confirmed }}
      SSH_PRIVATE_KEY: \${{ secrets.SSH_PRIVATE_KEY }}
      SSH_KNOWN_HOSTS: \${{ secrets.SSH_KNOWN_HOSTS }}
      DEPLOY_HOST: \${{ vars.DEPLOY_HOST }}
      DEPLOY_PORT: \${{ vars.DEPLOY_PORT }}
      DEPLOY_USER: \${{ vars.DEPLOY_USER }}
      DEPLOY_PATH: \${{ vars.DEPLOY_PATH }}
    steps:
      - uses: actions/checkout@v4
      - name: Validate migration inputs
        shell: bash
        run: |
          set -euo pipefail
          case "$DEPLOY_ENV" in
            test|product)
              ;;
            *)
              echo "Unsupported migration environment: $DEPLOY_ENV" >&2
              exit 1
              ;;
          esac

          if [ -z "$REVISION" ]; then
            echo "Refusing to run migration without an Alembic revision." >&2
            exit 1
          fi

          if ! [[ "$REVISION" =~ ^[A-Za-z0-9_.:-]+$ ]]; then
            echo "Refusing to run migration with unsupported revision characters." >&2
            exit 1
          fi

          if [ "$DEPLOY_ENV" = "product" ] && [ "$BACKUP_CONFIRMED" != "true" ]; then
            echo "Refusing to run product migration without backup confirmation." >&2
            exit 1
          fi
      - name: Configure SSH
        shell: bash
        run: |
          set -euo pipefail
          : "\${DEPLOY_HOST:?Missing DEPLOY_HOST environment variable}"
          : "\${DEPLOY_USER:?Missing DEPLOY_USER environment variable}"
          : "\${DEPLOY_PATH:?Missing DEPLOY_PATH environment variable}"
          : "\${SSH_PRIVATE_KEY:?Missing SSH_PRIVATE_KEY secret}"
          mkdir -p ~/.ssh
          printf '%s\\n' "$SSH_PRIVATE_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          if [ -n "\${SSH_KNOWN_HOSTS:-}" ]; then
            printf '%s\\n' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
          else
            ssh-keyscan -p "\${DEPLOY_PORT:-22}" "$DEPLOY_HOST" >> ~/.ssh/known_hosts
          fi
      - name: Run Alembic migration
        shell: bash
        run: |
          set -euo pipefail
          echo "Running ${options.serviceName} migration for $DEPLOY_ENV to revision $REVISION."
          ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic current && docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic upgrade '$REVISION' && docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic current"
`;
}

export function createPythonDeployReadmeSection(options: PythonDeployOptions) {
  const privateKeyNote = options.includePrivateKey
    ? "- `python-main` owns `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`; keep the private key only in the auth service environment."
    : "- `python-app` uses only `JWT_PUBLIC_KEY` for verification. Do not add `JWT_PRIVATE_KEY` to this service.";

  return `## Release Deploy and Rollback

This template includes a dedicated GitHub Actions Deploy workflow plus separate Docker Compose files for application deployment and long-running infrastructure:

| File | Purpose | Lifecycle |
| --- | --- | --- |
| \`docker-compose.yml\` | Local development with api, PostgreSQL, Redis, and nginx | can be rebuilt freely |
| \`docker-compose.infra.yml\` | Docker PostgreSQL and Redis for long-lived test/product infrastructure | start once and preserve volumes |
| \`docker-compose.deploy.yml\` | Application release and rollback for api + nginx | updated for each image tag |
| \`.github/workflows/deploy.yml\` | Tag release and workflow_dispatch rollback | runs on immutable image tags |
| \`.github/workflows/migrate.yml\` | Manual Alembic migration workflow | runs only by reviewed workflow_dispatch |
| \`.env.deploy.example\` | Example remote runtime environment | copy to real secrets/variables |

### GitHub Environments

Create GitHub Environments named \`test\` and \`product\`. Product should use GitHub Environment protection rules and required reviewers before deployment or migration.

Recommended Variables:

| Variable | Purpose |
| --- | --- |
| \`DOCKER_REGISTRY\` | Registry host, for example \`ghcr.io\` |
| \`DOCKER_IMAGE_NAME\` | Full image name, for example \`ghcr.io/owner/${options.serviceName}\` |
| \`DOCKER_REGISTRY_USERNAME\` | Registry username, defaults to the GitHub actor when empty |
| \`DEPLOY_HOST\` / \`DEPLOY_PORT\` / \`DEPLOY_USER\` / \`DEPLOY_PATH\` | SSH deployment target |
| \`CONTAINER_NAME\` / \`APP_PORT\` / \`NGINX_PORT\` | Runtime container and port settings |
| \`APP_ENV\` / \`DOCKER_NETWORK_NAME\` | Deployment environment and shared Docker network |
| \`JWT_ISSUER\` / \`JWT_AUDIENCE\` | Token issuer and audience expected by the service |
| \`CORS_ALLOW_ORIGINS\` | Comma-separated allowed origins |

Recommended Secrets:

| Secret | Purpose |
| --- | --- |
| \`DOCKER_REGISTRY_TOKEN\` | Push/pull token for Docker registry |
| \`SSH_PRIVATE_KEY\` | SSH deploy key |
| \`SSH_KNOWN_HOSTS\` | Optional pinned host keys |
| \`DATABASE_URL\` | PostgreSQL connection string |
| \`REDIS_URL\` | Redis connection string |
| \`JWT_PUBLIC_KEY\` | RS256 verification public key |
${options.includePrivateKey ? "| `JWT_PRIVATE_KEY` | RS256 signing private key, only for python-main |" : ""}

${privateKeyNote}

### Docker Infra

Start PostgreSQL and Redis separately from app releases:

\`\`\`bash
docker compose --env-file .env.infra -f docker-compose.infra.yml up -d
docker compose --env-file .env.infra -f docker-compose.infra.yml ps
\`\`\`

Do not run \`docker compose --env-file .env.infra -f docker-compose.infra.yml down -v\` in product unless you intentionally want to delete database and Redis volumes.

### Tag Release

Push immutable tags to deploy:

\`\`\`bash
git tag test-v1.0.1
git push origin test-v1.0.1
\`\`\`

\`\`\`bash
git tag product-v1.0.1
git push origin product-v1.0.1
\`\`\`

The workflow builds and pushes \`test-v*.*.*\` or \`product-v*.*.*\` Docker images. It refuses \`latest\` and refuses cross-environment deploys.

### Rollback

Use Actions -> Deploy -> Run workflow:

\`\`\`text
environment = product
image_tag = product-v1.0.0
\`\`\`

Rollback skips rebuild, pulls the historical image, uploads \`docker-compose.deploy.yml\` and \`nginx/default.conf\`, then runs:

\`\`\`bash
docker compose --env-file .env -f docker-compose.deploy.yml pull api
docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-build api nginx
\`\`\`

PostgreSQL and Redis are not rebuilt or rolled back by application deploys.

### Migration Policy

Application image rollback does not automatically rollback database schema. Product migration should be reviewed and approved separately. Prefer expand-contract migrations so older images can still run during rollback windows.

- local: run \`pdm run migrate\` manually.
- test: use Actions -> Migrate -> Run workflow, or run Alembic manually against test after review.
- product: use Actions -> Migrate -> Run workflow with product approval, backup confirmation, and a reviewed migration diff.

The generated Migrate workflow inputs are:

\`\`\`text
environment = product
revision = head
backup_confirmed = true
\`\`\`

It runs:

\`\`\`bash
docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic current
docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic upgrade "$REVISION"
docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic current
\`\`\`

Deploy and rollback do not run migrations automatically.

### Seed Policy

Product does not auto-run seed. The Migrate workflow also does not run seed. Use \`pdm run seed\` for local development, and execute product seed only as an explicit reviewed operation after confirming it is idempotent and safe for real data.
`;
}
