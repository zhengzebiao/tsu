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
