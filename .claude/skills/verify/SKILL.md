# Verify generated MFE templates

Use this recipe when changes affect `template/src/mfe-main.ts`, `template/src/mfe-app.ts`, MFE generated-app behavior, MFE Docker/nginx/compose deployment assets, generated MFE CI workflow assets, generated MFE deploy workflow assets, or generated MFE README documentation markers.

1. Build and test the local generators:
   ```sh
   pnpm --filter @tsuz/template build
   pnpm --filter @tsuz/template test
   pnpm --filter @tsuz/cli build
   pnpm --filter @tsuz/cli test
   ```
2. Run the generated-app validation gate:
   ```sh
   pnpm validate:generated-apps
   ```
   This command generates fresh local-template `mfe-main` and `mfe-app` projects, installs dependencies, runs `lint`, `format:check`, `test`, `build`, and `test:e2e` in each generated project, verifies generated Docker/nginx/compose deployment files plus `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`, checks Phase 11 README documentation markers, then starts both dev servers and executes the host integration Playwright spec.
3. Validate the template release bundle when release assets are affected:
   ```sh
   pnpm template:release:build --version=0.0.0
   TEMPLATE_VERSION=0.0.0 pnpm validate:template-release
   ```
   This command validates the release archive manifest and bundle contents, initializes `mfe-main` and `mfe-app` from the release archive path, then runs the same generated-project install / lint / format / test / build / E2E / deploy-asset / README-marker checks against those release-sourced projects.
4. Optionally run real Docker runtime validation when Docker daemon is available:
   ```sh
   MFE_VALIDATE_DOCKER=true pnpm validate:generated-apps
   ```
   This adds `docker build`, `docker run`, `docker compose config`, `docker compose up --build`, HTTP smoke checks, and cleanup for generated `mfe-main` and `mfe-app` projects.

Generated project coverage expected from Phase 11:

- `mfe-main`: Vitest unit coverage, Testing Library login-page coverage, Playwright host login E2E, `e2e/host-load-subapp.spec.ts` for host + sub-app integration, Dockerfile build args, nginx SPA fallback/cache rules, single-service `docker-compose.yml` deployment variables, `.github/workflows/ci.yml` for lint / format check / test / build / E2E, and `.github/workflows/deploy.yml` for `test-v*.*.*` / `product-v*.*.*` tag deploys, Docker image build/push, compose upload, SSH deployment, and `workflow_dispatch` rollback by `image_tag`.
- `mfe-app`: Vitest lifecycle/API/store/query coverage, Testing Library business-home coverage, Playwright standalone startup/rendering E2E, Dockerfile build args, nginx SPA fallback/cache rules with qiankun-safe CORS headers, single-service `docker-compose.yml` deployment variables, Prettier format check, `.github/workflows/ci.yml` for lint / format check / test / build / E2E, and `.github/workflows/deploy.yml` for `test-v*.*.*` / `product-v*.*.*` tag deploys, Docker image build/push, compose upload, SSH deployment, and `workflow_dispatch` rollback by `image_tag`.

Manual browser fallback for debugging:

1. Generate and install fresh projects:
   ```sh
   rm -rf tmp/verify-phase9-mfe && mkdir -p tmp/verify-phase9-mfe
   node cli/dist/index.js init mfe-main-platform --template mfe-main --local --cwd tmp/verify-phase9-mfe --force
   node cli/dist/index.js init mfe-business-app --template mfe-app --local --cwd tmp/verify-phase9-mfe --force
   pnpm --dir tmp/verify-phase9-mfe/mfe-business-app install
   pnpm --dir tmp/verify-phase9-mfe/mfe-main-platform install
   ```
2. Start both dev servers:
   ```sh
   pnpm --dir tmp/verify-phase9-mfe/mfe-business-app dev
   VITE_MFE_APP_ENTRY=//127.0.0.1:7201 pnpm --dir tmp/verify-phase9-mfe/mfe-main-platform dev
   ```
3. Browser-drive the runtime surface:
   - Open `http://127.0.0.1:7201/`; confirm standalone `Business home`, `Standalone mode`, `/api`, and demo metrics render.
   - Open `http://127.0.0.1:7200/login`; click `Sign in` with the prefilled `admin / password123` credentials.
   - Confirm `/apps/mfe-app` renders the sub app inside the host with `Mounted by host`, `qiankun mount`, `Auth bridge: provided`, and `Current user: Demo Admin`.
   - Probe the sub-app router by clicking `About`; confirm URL `/apps/mfe-app/about` and `Integration notes` with router basename `/apps/mfe-app`.
   - Probe a non-matching route such as `/apps/mfe-app-legacy`; it should not mount the sub app.
4. Optional container smoke checks:
   - In each generated project, run `pnpm docker:build`, `pnpm docker:run`, `pnpm compose:up`, and `pnpm compose:down`.
   - For `mfe-main`, smoke `http://127.0.0.1:7200/login` and `/apps/mfe-app`.
   - For `mfe-app`, smoke `http://127.0.0.1:7201/` and `/about`; verify cross-origin asset responses include CORS headers.

Notes:

- `mfe-app` dev mode uses `vite-plugin-qiankun`; without it qiankun may fail with `Cannot use import statement outside a module`.
- `VITE_*` Docker build args are Vite build-time variables; changing them requires rebuilding the image.
- Phase 10 release validation uses the built template archive as the source for generated MFE projects; it still avoids real SSH deployment, registry pushes, and GitHub Release publishing.
- Phase 11 README markers cover local development, GitHub Environments, `test-v*.*.*` / `product-v*.*.*` tag releases, `workflow_dispatch` rollback, `VITE_API_BASE_URL` as a build-time variable, and automatic `docker-compose.yml` upload by `deploy.yml`.
- Stop background dev servers and containers after manual verification.
