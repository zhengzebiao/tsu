# Verify generated MFE templates

Use this recipe when changes affect `template/src/mfe-main.ts`, `template/src/mfe-app.ts`, or MFE generated-app behavior.

1. Build the local generators before creating projects:
   ```sh
   pnpm --filter @tsuz/template build
   pnpm --filter @tsuz/cli build
   ```
2. Generate fresh projects into an isolated temp directory:
   ```sh
   rm -rf tmp/verify-phase5-mfe && mkdir -p tmp/verify-phase5-mfe
   node cli/dist/index.js init mfe-main-platform --template mfe-main --local --cwd tmp/verify-phase5-mfe --force
   node cli/dist/index.js init mfe-business-app --template mfe-app --local --cwd tmp/verify-phase5-mfe --force
   pnpm --dir tmp/verify-phase5-mfe/mfe-business-app install
   pnpm --dir tmp/verify-phase5-mfe/mfe-main-platform install
   ```
3. Start both dev servers:
   ```sh
   pnpm --dir tmp/verify-phase5-mfe/mfe-business-app dev
   VITE_MFE_APP_ENTRY=//127.0.0.1:7201 pnpm --dir tmp/verify-phase5-mfe/mfe-main-platform dev
   ```
4. Browser-drive the runtime surface:
   - Open `http://127.0.0.1:7201/`; confirm standalone `Business home`, `Standalone mode`, `/api`, and demo metrics render.
   - Open `http://127.0.0.1:7200/login`; click `Sign in` with the prefilled `admin / password123` credentials.
   - Confirm `/apps/mfe-app` renders the sub app inside the host with `Mounted by host`, `qiankun mount`, `Auth bridge: provided`, and `Current user: Demo Admin`.
   - Probe the sub-app router by clicking `About`; confirm URL `/apps/mfe-app/about` and `Integration notes` with router basename `/apps/mfe-app`.
   - Probe a non-matching route such as `/apps/mfe-app-legacy`; it should redirect to the host home or login and must not mount the sub app.

Notes:
- `mfe-app` dev mode uses `vite-plugin-qiankun`; without it qiankun may fail with `Cannot use import statement outside a module`.
- Stop the background dev servers after verification.
