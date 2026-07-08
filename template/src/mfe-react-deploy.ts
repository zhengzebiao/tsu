export interface MfeReactDeployOptions {
  appDirectory: "apps/main" | "apps/app";
  defaultContainerName: string;
  defaultImageName: string;
  defaultMfeAppEntry?: string;
  defaultPort: number;
  enableCors?: boolean;
}

export function createMfeDockerignore() {
  return `node_modules
dist
apps/*/dist
packages/*/dist
.git
.github
.turbo
coverage
*.log
*.local
.env
.env.*
!.env.deploy.example
`;
}

export function createMfeDockerfile(options: MfeReactDeployOptions) {
  return `FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=/api
ARG VITE_MFE_APP_ENTRY=${options.defaultMfeAppEntry ?? "//localhost:7201"}
ARG VITE_APP_ENV=production

ENV VITE_API_BASE_URL=\${VITE_API_BASE_URL}
ENV VITE_MFE_APP_ENTRY=\${VITE_MFE_APP_ENTRY}
ENV VITE_APP_ENV=\${VITE_APP_ENV}

RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY ${options.appDirectory}/package.json ${options.appDirectory}/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api/package.json packages/api/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/${options.appDirectory}/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

export function createMfeNginxConfig(options: MfeReactDeployOptions) {
  const serverCorsHeaders = options.enableCors
    ? `
  add_header Access-Control-Allow-Origin "*" always;
  add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
  add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization" always;`
    : "";
  const locationCorsHeaders = options.enableCors
    ? `
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization" always;`
    : "";
  const corsOptions = options.enableCors
    ? `

  if ($request_method = OPTIONS) {
    return 204;
  }`
    : "";

  return `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;${serverCorsHeaders}${corsOptions}

  location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;${locationCorsHeaders}
    try_files /index.html =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable" always;${locationCorsHeaders}
    try_files $uri =404;
  }
}
`;
}


export function createMfeDockerCompose(options: MfeReactDeployOptions) {
  return `services:
  app:
    image: \${DOCKER_IMAGE_NAME:-${options.defaultImageName}}:\${APP_VERSION:-local}
    container_name: \${CONTAINER_NAME:-${options.defaultContainerName}}
    build:
      context: .
      args:
        VITE_API_BASE_URL: \${VITE_API_BASE_URL:-/api}
        VITE_MFE_APP_ENTRY: \${VITE_MFE_APP_ENTRY:-${options.defaultMfeAppEntry ?? "//localhost:7201"}}
        VITE_APP_ENV: \${APP_ENV:-local}
    environment:
      APP_ENV: \${APP_ENV:-local}
    ports:
      - "\${APP_PORT:-${options.defaultPort}}:80"
    restart: unless-stopped
`;
}

export function createMfeDeployEnvExample(options: MfeReactDeployOptions) {
  return `# Docker image name used by docker-compose.yml.
DOCKER_IMAGE_NAME=${options.defaultImageName}

# Immutable image/application version tag.
APP_VERSION=local

# Container name used by docker-compose.yml.
CONTAINER_NAME=${options.defaultContainerName}

# Host port mapped to nginx port 80 inside the container.
APP_PORT=${options.defaultPort}

# Deployment environment. This is passed to the Docker build as VITE_APP_ENV.
APP_ENV=local

# Vite build-time variables.
VITE_API_BASE_URL=/api
VITE_MFE_APP_ENTRY=${options.defaultMfeAppEntry ?? "//localhost:7201"}
`;
}

export function createMfeDeployWorkflow(options: MfeReactDeployOptions) {
  const defaultMfeAppEntry = options.defaultMfeAppEntry ?? "//localhost:7201";

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
      DEPLOY_ENV: \${{ needs.resolve-deploy.outputs.environment }}
      DOCKER_REGISTRY: \${{ vars.DOCKER_REGISTRY }}
      DOCKER_IMAGE_NAME: \${{ vars.DOCKER_IMAGE_NAME }}
      DOCKER_REGISTRY_USERNAME: \${{ vars.DOCKER_REGISTRY_USERNAME }}
      DOCKER_REGISTRY_TOKEN: \${{ secrets.DOCKER_REGISTRY_TOKEN }}
      APP_ENV: \${{ vars.APP_ENV }}
      VITE_API_BASE_URL: \${{ vars.VITE_API_BASE_URL }}
      VITE_MFE_APP_ENTRY: \${{ vars.VITE_MFE_APP_ENTRY }}
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
        run: |
          set -euo pipefail
          docker build \
            --build-arg VITE_API_BASE_URL="\${VITE_API_BASE_URL:-/api}" \
            --build-arg VITE_MFE_APP_ENTRY="\${VITE_MFE_APP_ENTRY:-${defaultMfeAppEntry}}" \
            --build-arg VITE_APP_ENV="\${APP_ENV:-$DEPLOY_ENV}" \
            -t "$IMAGE_NAME:$IMAGE_TAG" .
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
      APP_PORT: \${{ vars.APP_PORT }}
      APP_ENV: \${{ vars.APP_ENV }}
      VITE_API_BASE_URL: \${{ vars.VITE_API_BASE_URL }}
      VITE_MFE_APP_ENTRY: \${{ vars.VITE_MFE_APP_ENTRY }}
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
      - name: Upload docker-compose.yml and environment file
        env:
          IMAGE_NAME: \${{ steps.image.outputs.image_name }}
        shell: bash
        run: |
          set -euo pipefail
          cat > .env.deploy.generated <<ENV
          DOCKER_IMAGE_NAME=$IMAGE_NAME
          APP_VERSION=$IMAGE_TAG
          CONTAINER_NAME=\${CONTAINER_NAME:-${options.defaultContainerName}}
          APP_PORT=\${APP_PORT:-${options.defaultPort}}
          APP_ENV=\${APP_ENV:-$DEPLOY_ENV}
          VITE_API_BASE_URL=\${VITE_API_BASE_URL:-/api}
          VITE_MFE_APP_ENTRY=\${VITE_MFE_APP_ENTRY:-${defaultMfeAppEntry}}
          ENV
          ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"
          scp -i ~/.ssh/deploy_key -P "\${DEPLOY_PORT:-22}" docker-compose.yml "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.yml"
          scp -i ~/.ssh/deploy_key -P "\${DEPLOY_PORT:-22}" .env.deploy.generated "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/.env"
      - name: Deploy with docker compose
        shell: bash
        run: |
          set -euo pipefail
          username="\${DOCKER_REGISTRY_USERNAME:-$GITHUB_ACTOR}"
          if [ -n "\${DOCKER_REGISTRY_TOKEN:-}" ]; then
            printf '%s' "$DOCKER_REGISTRY_TOKEN" | ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "docker login '\${{ steps.image.outputs.registry }}' -u '$username' --password-stdin"
          fi
          ssh -i ~/.ssh/deploy_key -p "\${DEPLOY_PORT:-22}" "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && docker compose --env-file .env -f docker-compose.yml pull app && docker compose --env-file .env -f docker-compose.yml up -d --no-build app"
`;
}
