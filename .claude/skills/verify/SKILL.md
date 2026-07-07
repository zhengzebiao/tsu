# Verify generated MFE templates

Use this recipe when changes affect `template/src/mfe-main.ts`, `template/src/mfe-app.ts`, or MFE generated-app behavior.

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
   This command generates fresh `mfe-main` and `mfe-app` projects, installs dependencies, runs `lint`, `test`, `build`, and `test:e2e` in each generated project, then starts both dev servers and executes the host integration Playwright spec.
3. Validate the template release bundle when release assets are affected:
   ```sh
   pnpm template:release:build --version=0.0.0
   TEMPLATE_VERSION=0.0.0 pnpm validate:template-release
   ```

Generated project coverage expected from Phase 6:

- `mfe-main`: Vitest unit coverage, Testing Library login-page coverage, Playwright host login E2E, and `e2e/host-load-subapp.spec.ts` for host + sub-app integration.
- `mfe-app`: Vitest lifecycle/API/store/query coverage, Testing Library business-home coverage, and Playwright standalone startup/rendering E2E.

Manual browser fallback for debugging:

1. Generate and install fresh projects:
   ```sh
   rm -rf tmp/verify-phase6-mfe && mkdir -p tmp/verify-phase6-mfe
   node cli/dist/index.js init mfe-main-platform --template mfe-main --local --cwd tmp/verify-phase6-mfe --force
   node cli/dist/index.js init mfe-business-app --template mfe-app --local --cwd tmp/verify-phase6-mfe --force
   pnpm --dir tmp/verify-phase6-mfe/mfe-business-app install
   pnpm --dir tmp/verify-phase6-mfe/mfe-main-platform install
   ```
2. Start both dev servers:
   ```sh
   pnpm --dir tmp/verify-phase6-mfe/mfe-business-app dev
   VITE_MFE_APP_ENTRY=//127.0.0.1:7201 pnpm --dir tmp/verify-phase6-mfe/mfe-main-platform dev
   ```
3. Browser-drive the runtime surface:
   - Open `http://127.0.0.1:7201/`; confirm standalone `Business home`, `Standalone mode`, `/api`, and demo metrics render.
   - Open `http://127.0.0.1:7200/login`; click `Sign in` with the prefilled `admin / password123` credentials.
   - Confirm `/apps/mfe-app` renders the sub app inside the host with `Mounted by host`, `qiankun mount`, `Auth bridge: provided`, and `Current user: Demo Admin`.
   - Probe the sub-app router by clicking `About`; confirm URL `/apps/mfe-app/about` and `Integration notes` with router basename `/apps/mfe-app`.
   - Probe a non-matching route such as `/apps/mfe-app-legacy`; it should not mount the sub app.

Notes:

- `mfe-app` dev mode uses `vite-plugin-qiankun`; without it qiankun may fail with `Cannot use import statement outside a module`.
- Stop the background dev servers after manual verification.
