import { createMfeCiWorkflow } from "./mfe-react-ci.js";
import {
  createMfeDeployEnvExample,
  createMfeDeployWorkflow,
  createMfeDockerCompose,
  createMfeDockerfile,
  createMfeDockerignore,
  createMfeNginxConfig
} from "./mfe-react-deploy.js";
import { createReactApiPackageFiles, createReactSharedPackageFiles, createReactUiPackageFiles } from "./mfe-react-common.js";

export interface TemplateFile {
  path: string;
  content: string;
}

export function createMfeMainTemplateFiles(packageName: string): TemplateFile[] {
  const appPackageName = `${packageName}-main`;
  const deployOptions = {
    appDirectory: "apps/main" as const,
    defaultContainerName: packageName,
    defaultImageName: packageName,
    defaultMfeAppEntry: "//localhost:7201",
    defaultPort: 7200
  };

  return [
    {
      path: "package.json",
      content: packageJson({
        name: packageName,
        version: "0.0.0",
        private: true,
        type: "module",
        packageManager: "pnpm@8.15.9",
        scripts: {
          dev: `pnpm --filter ${appPackageName} dev`,
          build: "turbo run build",
          lint: "eslint . --max-warnings 0 && turbo run lint",
          test: "turbo run test",
          "test:e2e": "playwright test",
          format: "prettier --ignore-unknown --write package.json pnpm-workspace.yaml .github/workflows/ci.yml .github/workflows/deploy.yml prettier.config.js",
          "format:check": "prettier --ignore-unknown --check package.json pnpm-workspace.yaml .github/workflows/ci.yml .github/workflows/deploy.yml prettier.config.js",
          "docker:build": `docker build -t ${packageName}:\${APP_VERSION:-local} .`,
          "docker:run": `docker run --rm -p 7200:80 ${packageName}:\${APP_VERSION:-local}`,
          "compose:up": "docker compose up --build",
          "compose:down": "docker compose down"
        },
        devDependencies: {
          "@eslint/js": "^9.21.0",
          "@playwright/test": "^1.51.1",
          "@types/node": "^20.17.57",
          eslint: "^9.21.0",
          "eslint-plugin-react-hooks": "^5.2.0",
          "eslint-plugin-react-refresh": "^0.4.19",
          globals: "^16.0.0",
          prettier: "^3.5.3",
          turbo: "^2.5.3",
          "typescript-eslint": "^8.26.1",
          typescript: "^5.8.3"
        }
      })
    },
    {
      path: "README.md",
      content: createMfeMainReadme(packageName)
    },
    {
      path: "pnpm-workspace.yaml",
      content: `packages:\n  - "apps/*"\n  - "packages/*"\n`
    },
    {
      path: "turbo.json",
      content: packageJson({
        $schema: "https://turbo.build/schema.json",
        tasks: {
          build: {
            dependsOn: ["^build"],
            outputs: ["dist/**"]
          },
          lint: {
            dependsOn: ["^lint"],
            outputs: []
          },
          test: {
            dependsOn: ["^test"],
            outputs: []
          }
        }
      })
    },
    {
      path: "tsconfig.base.json",
      content: packageJson({
        compilerOptions: {
          target: "ES2022",
          useDefineForClassFields: true,
          module: "ESNext",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          skipLibCheck: true,
          moduleResolution: "Bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          jsx: "react-jsx",
          forceConsistentCasingInFileNames: true
        }
      })
    },
    {
      path: ".dockerignore",
      content: createMfeDockerignore()
    },
    {
      path: ".gitignore",
      content: `node_modules/\ndist/\napps/*/dist/\npackages/*/dist/\n.turbo/\ncoverage/\n*.local\n*.log\n`
    },
    {
      path: ".github/workflows/ci.yml",
      content: createMfeCiWorkflow()
    },
    {
      path: ".github/workflows/deploy.yml",
      content: createMfeDeployWorkflow(deployOptions)
    },
    {
      path: "eslint.config.js",
      content: `import js from "@eslint/js";\nimport globals from "globals";\nimport tseslint from "typescript-eslint";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport reactRefresh from "eslint-plugin-react-refresh";\n\nexport default tseslint.config(\n  {\n    ignores: ["**/dist", "**/node_modules", ".turbo", "coverage"]\n  },\n  js.configs.recommended,\n  ...tseslint.configs.recommended,\n  {\n    files: ["**/*.{ts,tsx}"],\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: {
        ...globals.browser,
        ...globals.node
      }\n    },\n    plugins: {\n      "react-hooks": reactHooks,\n      "react-refresh": reactRefresh\n    },\n    rules: {\n      ...reactHooks.configs.recommended.rules\n    }\n  },\n  {\n    files: ["apps/**/*.tsx", "packages/ui/**/*.tsx"],\n    rules: {\n      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]\n    }\n  }\n);\n`
    },
    {
      path: "prettier.config.js",
      content: `export default {\n  printWidth: 120,\n  tabWidth: 2,\n  semi: true,\n  singleQuote: false,\n  trailingComma: "none"\n};\n`
    },
    {
      path: ".prettierignore",
      content: `node_modules\ndist\napps/*/dist\npackages/*/dist\n.turbo\ncoverage\npnpm-lock.yaml\n`
    },
    {
      path: ".env.deploy.example",
      content: createMfeDeployEnvExample(deployOptions)
    },
    {
      path: "Dockerfile",
      content: createMfeDockerfile(deployOptions)
    },
    {
      path: "nginx/nginx.conf",
      content: createMfeNginxConfig(deployOptions)
    },
    {
      path: "docker-compose.yml",
      content: createMfeDockerCompose(deployOptions)
    },
    {
      path: "playwright.config.ts",
      content: `import { defineConfig, devices } from "@playwright/test";\n\nconst isIntegrationE2e = process.env.MFE_INTEGRATION_E2E === "true";\n\nexport default defineConfig({\n  testDir: "./e2e",\n  fullyParallel: false,\n  forbidOnly: Boolean(process.env.CI),\n  retries: process.env.CI ? 2 : 0,\n  workers: 1,\n  reporter: process.env.CI ? "github" : "list",\n  use: {\n    baseURL: "http://127.0.0.1:7200",\n    trace: "on-first-retry"\n  },\n  webServer: isIntegrationE2e\n    ? undefined\n    : {\n        command: "pnpm dev",\n        url: "http://127.0.0.1:7200/login",\n        reuseExistingServer: !process.env.CI,\n        timeout: 60_000\n      },\n  projects: [\n    {\n      name: "chromium",\n      use: { ...devices["Desktop Chrome"] }\n    }\n  ]\n});\n`
    },
    {
      path: "e2e/host-login.spec.ts",
      content: `import { expect, test } from "@playwright/test";\n\ntest("logs in and shows the host micro-app outlet fallback", async ({ page }) => {\n  await page.goto("/login");\n\n  await expect(page.getByText("Demo credentials")).toBeVisible();\n  await expect(page.locator("#username")).toHaveValue("admin");\n  await expect(page.locator("#password")).toHaveValue("password123");\n\n  await page.getByRole("button", { name: "Sign in" }).click();\n\n  await expect(page).toHaveURL(/\\/apps\\/mfe-app$/);\n  await expect(page.getByRole("link", { name: "Host shell", exact: true })).toBeVisible();\n  await expect(page.getByText("Waiting for mfe-app")).toBeVisible();\n  await expect(page.getByText("Integration fallback")).toBeVisible();\n});\n`
    },
    {
      path: "e2e/host-load-subapp.spec.ts",
      content: `import { expect, test } from "@playwright/test";\n\ntest.skip(\n  process.env.MFE_INTEGRATION_E2E !== "true",\n  "Run this spec through validate-generated-apps after starting both generated MFE dev servers."\n);\n\ntest("loads the generated sub application through qiankun", async ({ page }) => {\n  await page.goto("/login");\n  await page.getByRole("button", { name: "Sign in" }).click();\n\n  await expect(page).toHaveURL(/\\/apps\\/mfe-app$/);\n  await expect(page.getByRole("heading", { name: "Business home" })).toBeVisible({ timeout: 15_000 });\n  await expect(page.getByText("Mounted by host")).toBeVisible();\n  await expect(page.getByText("qiankun mount")).toBeVisible();\n  await expect(page.getByText("Auth bridge: provided")).toBeVisible();\n  await expect(page.getByText("Current user: Demo Admin")).toBeVisible();\n\n  await page.getByRole("link", { name: "About" }).click();\n\n  await expect(page).toHaveURL(/\\/apps\\/mfe-app\\/about$/);\n  await expect(page.getByText("Integration notes")).toBeVisible();\n  await expect(page.getByText("Router basename: /apps/mfe-app")).toBeVisible();\n\n  await page.goto("/apps/mfe-app-legacy");\n\n  await expect(page.getByText("qiankun mount")).toHaveCount(0);\n  await expect(page.getByText("Business home")).toHaveCount(0);\n});\n`
    },
    {
      path: "apps/main/package.json",
      content: packageJson({
        name: appPackageName,
        version: "0.0.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite --host 0.0.0.0 --port 7200",
          build: "tsc -p tsconfig.json --noEmit && vite build",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "vitest run",
          preview: "vite preview --port 7200"
        },
        dependencies: {
          "@tanstack/react-query": "^5.66.9",
          "@tsuz/api": "workspace:*",
          "@tsuz/shared": "workspace:*",
          "@tsuz/ui": "workspace:*",
          antd: "^5.24.4",
          qiankun: "^2.10.16",
          react: "^19.1.0",
          "react-dom": "^19.1.0",
          "react-router-dom": "^7.6.2",
          zustand: "^5.0.3"
        },
        devDependencies: {
          "@testing-library/jest-dom": "^6.6.3",
          "@testing-library/react": "^16.2.0",
          "@testing-library/user-event": "^14.6.1",
          "@types/react": "^19.0.10",
          "@types/react-dom": "^19.0.4",
          "@vitejs/plugin-react": "^4.3.4",
          autoprefixer: "^10.4.20",
          postcss: "^8.5.3",
          jsdom: "^26.0.0",
          tailwindcss: "^3.4.17",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          vitest: "^3.0.5"
        }
      })
    },
    {
      path: "apps/main/.env.example",
      content: `VITE_API_BASE_URL=/api\nVITE_MFE_APP_ENTRY=//localhost:7201\nVITE_APP_ENV=local\n`
    },
    {
      path: "apps/main/index.html",
      content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
    },
    {
      path: "apps/main/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vitest/config";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  test: {\n    environment: "jsdom",\n    setupFiles: "./src/test/setup.ts"\n  },\n  server: {\n    port: 7200,\n    strictPort: true\n  },\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/api": fileURLToPath(new URL("../../packages/api/src/index.ts", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url))\n    },\n    dedupe: ["react", "react-dom"]\n  }\n});\n`
    },
    {
      path: "apps/main/tailwind.config.js",
      content: `export default {\n  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],\n  theme: {\n    extend: {\n      colors: {\n        shell: {\n          bg: "#f5f7fb",\n          text: "#172033"\n        }\n      }\n    }\n  },\n  plugins: []\n};\n`
    },
    {
      path: "apps/main/postcss.config.js",
      content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {}\n  }\n};\n`
    },
    {
      path: "apps/main/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
            "@tsuz/api": ["../../packages/api/src/index.ts"],
            "@tsuz/shared": ["../../packages/shared/src/index.ts"],
            "@tsuz/ui": ["../../packages/ui/src/index.tsx"]
          }
        },
        include: ["vite.config.ts", "src/**/*.ts", "src/**/*.tsx"]
      })
    },
    {
      path: "apps/main/src/test/setup.ts",
      content: `import "@testing-library/jest-dom/vitest";\nimport { vi } from "vitest";\n\nObject.defineProperty(window, "matchMedia", {\n  writable: true,\n  value: vi.fn().mockImplementation((query: string) => ({\n    matches: false,\n    media: query,\n    onchange: null,\n    addListener: vi.fn(),\n    removeListener: vi.fn(),\n    addEventListener: vi.fn(),\n    removeEventListener: vi.fn(),\n    dispatchEvent: vi.fn()\n  }))\n});\n\nglobalThis.ResizeObserver = class ResizeObserver {\n  observe() {\n    return undefined;\n  }\n\n  unobserve() {\n    return undefined;\n  }\n\n  disconnect() {\n    return undefined;\n  }\n};\n`
    },
    {
      path: "apps/main/src/main.tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport { AppProviders } from "./providers/AppProviders";\nimport { registerMicroFrontendApps } from "./micro-apps/registry";\nimport "./styles/main.css";\n\nregisterMicroFrontendApps();\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <AppProviders>\n      <App />\n    </AppProviders>\n  </StrictMode>\n);\n`
    },
    {
      path: "apps/main/src/App.tsx",
      content: `import { useEffect, type ReactNode } from "react";\nimport { Avatar, Button, Card, Layout, List, Space, Tag, Typography } from "antd";\nimport { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";\nimport { EmptyState, ErrorState, Logo, PageContainer } from "@tsuz/ui";\nimport { MFE_APP_ROUTE } from "@tsuz/shared";\nimport RequireAuth from "./components/RequireAuth";\nimport LoginPage from "./pages/LoginPage";\nimport { useAuthStore } from "./stores/auth.store";\n\nconst { Header, Content } = Layout;\nconst projectName = "${packageName}";\n\nconst roadmapItems = [\n  "Phase 4: shared, ui, and api workspace packages",\n  "Phase 5: richer sub application lifecycle and business routes",\n  "Phase 6: Testing Library and Playwright coverage",\n  "Phase 7: Docker, nginx, and compose deployment",\n  "Phase 8: GitHub Actions CI quality gate",\n  "Phase 9: tag deploy and rollback workflow",\n  "Later phases: release verification and documentation"\n];\n\nexport default function App() {\n  return (\n    <Routes>\n      <Route path="/login" element={<LoginPage />} />\n      <Route\n        path="/"\n        element={\n          <RequireAuth>\n            <AuthenticatedShell>\n              <HostHome />\n            </AuthenticatedShell>\n          </RequireAuth>\n        }\n      />\n      <Route\n        path="/apps/mfe-app/*"\n        element={\n          <RequireAuth>\n            <AuthenticatedShell>\n              <MicroAppOutlet />\n            </AuthenticatedShell>\n          </RequireAuth>\n        }\n      />\n      <Route path="*" element={<Navigate to="/" replace />} />\n    </Routes>\n  );\n}\n\ninterface AuthenticatedShellProps {\n  children: ReactNode;\n}\n\nfunction AuthenticatedShell({ children }: AuthenticatedShellProps) {\n  const navigate = useNavigate();\n  const user = useAuthStore((state) => state.user);\n  const logout = useAuthStore((state) => state.logout);\n\n  async function handleLogout() {\n    await logout();\n    navigate("/login", { replace: true });\n  }\n\n  return (\n    <Layout className="app-shell bg-slate-50 text-slate-800">\n      <Header className="app-header">\n        <Link className="brand-link" to="/" aria-label="Go to host shell home">\n          <Logo label={projectName} subtitle="qiankun host" />\n        </Link>\n        <nav className="app-nav">\n          <Link to="/">Host shell</Link>\n          <Link to={MFE_APP_ROUTE}>Business app</Link>\n        </nav>\n        <Space className="user-menu" size="middle">\n          <Avatar>{user?.name.slice(0, 1).toUpperCase() ?? "U"}</Avatar>\n          <Typography.Text className="user-name">{user?.name}</Typography.Text>\n          <Button ghost onClick={handleLogout}>\n            Logout\n          </Button>\n        </Space>\n      </Header>\n      <Content className="app-content">{children}</Content>\n    </Layout>\n  );\n}\n\nfunction HostHome() {\n  const user = useAuthStore((state) => state.user);\n\n  return (\n    <PageContainer\n      title="React qiankun host shell"\n      description="The host owns login state, workspace-level contracts, reusable UI primitives, and qiankun registration."\n    >\n      <Card>\n        <Space direction="vertical" size="large" className="full-width">\n          <Typography.Paragraph>\n            Generated by Tsu from the <code>mfe-main</code> template. This Phase 9 host shell includes\n            login state, demo auth service, React Query providers, shared workspace packages, tests, Docker/nginx assets, GitHub Actions CI,\n            tag deploy and rollback automation, and a qiankun registry that can pass auth props to sub applications.\n          </Typography.Paragraph>\n          <Space wrap>\n            <Tag color="blue">React</Tag>\n            <Tag color="purple">qiankun</Tag>\n            <Tag color="green">Shared packages</Tag>\n          </Space>\n          <Card size="small" title="Current user">\n            <Typography.Text>{user?.name} ({user?.username})</Typography.Text>\n            <br />\n            <Typography.Text type="secondary">Roles: {user?.roles.join(", ")}</Typography.Text>\n          </Card>\n          <List bordered dataSource={roadmapItems} renderItem={(item) => <List.Item>{item}</List.Item>} />\n        </Space>\n      </Card>\n    </PageContainer>\n  );\n}\n\nfunction MicroAppOutlet() {\n  useEffect(() => {\n    window.dispatchEvent(new PopStateEvent("popstate"));\n  }, []);\n\n  return (\n    <PageContainer\n      title="Business sub application outlet"\n      description="qiankun registers the generated mfe-app here and receives shared auth/API props from the host."\n    >\n      <Card>\n        <Typography.Paragraph>\n          The host passes <code>apiBaseUrl</code>, <code>getAccessToken</code>, <code>getCurrentUser</code>, and\n          <code>logout</code> through the shared <code>MicroAppProps</code> contract.\n        </Typography.Paragraph>\n        <div id="subapp-container" className="subapp-container rounded-xl">\n          <EmptyState\n            title="Waiting for mfe-app"\n            description="Start an mfe-app project on port 7201 to mount it in this container."\n          />\n        </div>\n        <ErrorState\n          className="integration-note"\n          title="Integration fallback"\n          description="If the remote entry fails to load, check VITE_MFE_APP_ENTRY and the sub app dev server."\n        />\n      </Card>\n    </PageContainer>\n  );\n}\n`
    },
    {
      path: "apps/main/src/components/RequireAuth.tsx",
      content: `import type { ReactNode } from "react";\nimport { Navigate, useLocation } from "react-router-dom";\nimport { useAuthStore } from "../stores/auth.store";\n\ninterface RequireAuthProps {\n  children: ReactNode;\n}\n\nexport default function RequireAuth({ children }: RequireAuthProps) {\n  const status = useAuthStore((state) => state.status);\n  const user = useAuthStore((state) => state.user);\n  const location = useLocation();\n\n  if (status !== "authenticated" || !user) {\n    return <Navigate to="/login" replace state={{ from: location }} />;\n  }\n\n  return children;\n}\n`
    },
    {
      path: "apps/main/src/micro-apps/config.ts",
      content: `import {\n  DEFAULT_API_BASE_URL,\n  DEFAULT_MFE_APP_ENTRY,\n  matchesActiveRoute,\n  microAppMetas,\n  type AuthBridge,\n  type MicroAppMeta,\n  type MicroAppProps\n} from "@tsuz/shared";\n\nexport type { AuthBridge, MicroAppMeta, MicroAppProps } from "@tsuz/shared";\n\nexport interface MicroAppRegistration {\n  name: string;\n  entry: string;\n  container: string;\n  activeRule: (location: Location) => boolean;\n  props: MicroAppProps;\n}\n\nexport type MicroAppEnvironment = Partial<Record<"VITE_API_BASE_URL" | "VITE_MFE_APP_ENTRY", string | undefined>>;\n\nexport interface CreateMicroAppsOptions {\n  env?: MicroAppEnvironment;\n  hostname?: string;\n  containerSelector?: string;\n  isAuthenticated?: () => boolean;\n  isContainerReady?: () => boolean;\n}\n\nexport function resolveApiBaseUrl(env: MicroAppEnvironment = readViteEnvironment()) {\n  return env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;\n}\n\nexport function resolveMicroAppEntry(\n  meta: MicroAppMeta = microAppMetas[0],\n  env: MicroAppEnvironment = readViteEnvironment(),\n  hostname = getDefaultHostname()\n) {\n  return env.VITE_MFE_APP_ENTRY?.trim() || (hostname ? "//" + hostname + ":" + meta.port : DEFAULT_MFE_APP_ENTRY);\n}\n\nexport { matchesActiveRoute };\n\nexport function createMicroApps(authBridge: AuthBridge, options: CreateMicroAppsOptions = {}): MicroAppRegistration[] {\n  const env = options.env ?? readViteEnvironment();\n  const hostname = options.hostname ?? getDefaultHostname();\n  const containerSelector = options.containerSelector ?? "#subapp-container";\n  const apiBaseUrl = resolveApiBaseUrl(env);\n\n  return microAppMetas.map((meta) => ({\n    name: meta.name,\n    entry: resolveMicroAppEntry(meta, env, hostname),\n    container: containerSelector,\n    activeRule: (location) =>\n      isAuthenticated(authBridge, options) &&\n      isContainerReady(containerSelector, options) &&\n      matchesActiveRoute(meta.activeRule, location.pathname),\n    props: {\n      appName: meta.name,\n      basename: meta.basename,\n      apiBaseUrl,\n      getAccessToken: authBridge.getAccessToken,\n      getCurrentUser: authBridge.getCurrentUser,\n      logout: authBridge.logout\n    }\n  }));\n}\n\nfunction isAuthenticated(authBridge: AuthBridge, options: CreateMicroAppsOptions) {\n  return options.isAuthenticated?.() ?? Boolean(authBridge.getAccessToken());\n}\n\nfunction isContainerReady(containerSelector: string, options: CreateMicroAppsOptions) {\n  return options.isContainerReady?.() ?? hasMicroAppContainer(containerSelector);\n}\n\nfunction hasMicroAppContainer(containerSelector: string) {\n  return typeof document !== "undefined" && document.querySelector(containerSelector) !== null;\n}\n\nfunction readViteEnvironment(): MicroAppEnvironment {\n  return import.meta.env;\n}\n\nfunction getDefaultHostname() {\n  return globalThis.location?.hostname || "localhost";\n}\n`
    },
    {
      path: "apps/main/src/micro-apps/config.test.ts",
      content: `import { describe, expect, test } from "vitest";\nimport { createMicroApps, matchesActiveRoute, resolveApiBaseUrl, resolveMicroAppEntry } from "./config";\n\nconst authBridge = {\n  getAccessToken: () => "demo-token",\n  getCurrentUser: () => ({\n    id: "user-1",\n    name: "Demo Admin",\n    username: "admin",\n    roles: ["admin"],\n    permissions: ["mfe:read"]\n  }),\n  logout: () => {\n    window.dispatchEvent(new Event("test-logout"));\n  }\n};\n\ndescribe("micro app config", () => {\n  test("matches active rules without prefix collisions", () => {\n    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app")).toBe(true);\n    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app/settings")).toBe(true);\n    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app-legacy")).toBe(false);\n  });\n\n  test("resolves entries and api base urls from environment overrides", () => {\n    expect(resolveApiBaseUrl({})).toBe("/api");\n    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "https://api.example.test" })).toBe("https://api.example.test");\n    expect(resolveMicroAppEntry(undefined, {}, "localhost")).toBe("//localhost:7201");\n    expect(resolveMicroAppEntry(undefined, { VITE_MFE_APP_ENTRY: "https://cdn.example.test/mfe-app/" }, "localhost")).toBe(\n      "https://cdn.example.test/mfe-app/"\n    );\n  });\n\n  test("creates qiankun registrations with auth props", () => {\n    const [app] = createMicroApps(authBridge, {\n      env: { VITE_API_BASE_URL: "https://api.example.test" },\n      hostname: "localhost",\n      isAuthenticated: () => true,\n      isContainerReady: () => true\n    });\n\n    expect(app.name).toBe("mfe-app");\n    expect(app.entry).toBe("//localhost:7201");\n    expect(app.container).toBe("#subapp-container");\n    expect(app.activeRule({ pathname: "/apps/mfe-app" } as Location)).toBe(true);\n    expect(app.activeRule({ pathname: "/apps/mfe-app-legacy" } as Location)).toBe(false);\n    expect(app.props.apiBaseUrl).toBe("https://api.example.test");\n    expect(app.props.getAccessToken()).toBe("demo-token");\n    expect(app.props.getCurrentUser()?.username).toBe("admin");\n    expect(typeof app.props.logout).toBe("function");\n  });\n});\n`
    },
    {
      path: "apps/main/src/micro-apps/registry.ts",
      content: `import { registerMicroApps, start } from "qiankun";\nimport { authBridge, useAuthStore } from "../stores/auth.store";\nimport { createMicroApps } from "./config";\n\nlet registered = false;\n\nexport function registerMicroFrontendApps() {\n  if (registered) {\n    return;\n  }\n\n  registerMicroApps(\n    createMicroApps(authBridge, {\n      isAuthenticated: () => useAuthStore.getState().status === "authenticated",\n      isContainerReady: () => document.querySelector("#subapp-container") !== null\n    })\n  );\n  start({ prefetch: false });\n  registered = true;\n}\n`
    },
    {
      path: "apps/main/src/pages/LoginPage.tsx",
      content: `import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";\nimport { useLocation, useNavigate } from "react-router-dom";\nimport type { LoginCredentials } from "@tsuz/shared";\nimport { Logo } from "@tsuz/ui";\nimport { useAuthStore } from "../stores/auth.store";\n\ninterface RedirectState {\n  from?: {\n    pathname?: string;\n  };\n}\n\nexport default function LoginPage() {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const login = useAuthStore((state) => state.login);\n  const status = useAuthStore((state) => state.status);\n  const error = useAuthStore((state) => state.error);\n  const redirectTo = getRedirectPath(location.state);\n\n  async function handleFinish(values: LoginCredentials) {\n    await login(values);\n    navigate(redirectTo, { replace: true });\n  }\n\n  return (\n    <main className="login-page">\n      <Card className="login-card" title={<Logo label="Sign in" subtitle="MFE host" />}>\n        <Space direction="vertical" size="large" className="full-width">\n          <Typography.Paragraph type="secondary">\n            Use the demo account to exercise auth state and qiankun props without a backend.\n          </Typography.Paragraph>\n          <Alert message="Demo credentials" description="Username: admin / Password: password123" type="info" showIcon />\n          {error ? <Alert message={error} type="error" showIcon /> : null}\n          <Form<LoginCredentials>\n            layout="vertical"\n            initialValues={{ username: "admin", password: "password123" }}\n            onFinish={handleFinish}\n          >\n            <Form.Item name="username" label="Username" rules={[{ required: true, message: "Username is required" }]}>\n              <Input autoComplete="username" />\n            </Form.Item>\n            <Form.Item name="password" label="Password" rules={[{ required: true, message: "Password is required" }]}>\n              <Input.Password autoComplete="current-password" />\n            </Form.Item>\n            <Button type="primary" htmlType="submit" loading={status === "authenticating"} block>\n              Sign in\n            </Button>\n          </Form>\n        </Space>\n      </Card>\n    </main>\n  );\n}\n\nfunction getRedirectPath(state: unknown) {\n  if (isRedirectState(state) && state.from?.pathname) {\n    return state.from.pathname;\n  }\n\n  return "/apps/mfe-app";\n}\n\nfunction isRedirectState(value: unknown): value is RedirectState {\n  return typeof value === "object" && value !== null && "from" in value;\n}\n`
    },
    {
      path: "apps/main/src/pages/LoginPage.test.tsx",
      content: `import { cleanup, render, screen } from "@testing-library/react";\nimport userEvent from "@testing-library/user-event";\nimport { MemoryRouter } from "react-router-dom";\nimport { afterEach, beforeEach, describe, expect, test } from "vitest";\nimport LoginPage from "./LoginPage";\nimport { useAuthStore } from "../stores/auth.store";\n\nbeforeEach(() => {\n  useAuthStore.setState({ status: "anonymous", user: undefined, accessToken: undefined, error: undefined });\n});\n\nafterEach(() => {\n  cleanup();\n});\n\ndescribe("LoginPage", () => {\n  test("renders demo credentials and prefilled fields", async () => {\n    const user = userEvent.setup();\n\n    render(\n      <MemoryRouter>\n        <LoginPage />\n      </MemoryRouter>\n    );\n\n    expect(screen.getByText("Demo credentials")).toBeInTheDocument();\n    expect(screen.getByText("Username: admin / Password: password123")).toBeInTheDocument();\n    expect(screen.getByLabelText("Username")).toHaveValue("admin");\n    expect(screen.getByLabelText("Password")).toHaveValue("password123");\n    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();\n\n    await user.clear(screen.getByLabelText("Username"));\n    await user.type(screen.getByLabelText("Username"), "operator");\n\n    expect(screen.getByLabelText("Username")).toHaveValue("operator");\n  });\n});\n`
    },
    {
      path: "apps/main/src/providers/AppProviders.tsx",
      content: `import type { PropsWithChildren } from "react";\nimport { QueryClientProvider } from "@tanstack/react-query";\nimport { BrowserRouter } from "react-router-dom";\nimport { queryClient } from "./query-client";\n\nexport function AppProviders({ children }: PropsWithChildren) {\n  return (\n    <QueryClientProvider client={queryClient}>\n      <BrowserRouter>{children}</BrowserRouter>\n    </QueryClientProvider>\n  );\n}\n`
    },
    {
      path: "apps/main/src/providers/query-client.ts",
      content: `import { QueryClient } from "@tanstack/react-query";\n\nexport const queryClient = new QueryClient({\n  defaultOptions: {\n    queries: {\n      retry: 1,\n      staleTime: 30_000\n    }\n  }\n});\n`
    },
    {
      path: "apps/main/src/services/api-client.ts",
      content: `import { createApiClient } from "@tsuz/api";\nimport { DEFAULT_API_BASE_URL } from "@tsuz/shared";\nimport { authBridge } from "../stores/auth.store";\n\nexport function createMainApiClient(baseUrl = DEFAULT_API_BASE_URL) {\n  return createApiClient({\n    baseUrl,\n    getAccessToken: authBridge.getAccessToken,\n    onUnauthorized: () => authBridge.logout()\n  });\n}\n`
    },
    {
      path: "apps/main/src/services/auth.service.ts",
      content: `import type { AuthSession, LoginCredentials } from "@tsuz/shared";\n\nconst demoUser = {\n  id: "user-1",\n  name: "Demo Admin",\n  username: "admin",\n  roles: ["admin"],\n  permissions: ["mfe:read", "mfe:write"]\n};\n\nexport async function loginWithPassword(credentials: LoginCredentials): Promise<AuthSession> {\n  const username = credentials.username.trim();\n\n  if (!username || !credentials.password) {\n    throw new Error("Username and password are required.");\n  }\n\n  if (username !== demoUser.username || credentials.password !== "password123") {\n    throw new Error("Invalid demo credentials. Use admin / password123.");\n  }\n\n  return {\n    accessToken: "demo-token-" + username,\n    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),\n    user: demoUser\n  };\n}\n\nexport async function logoutSession(): Promise<void> {\n  return Promise.resolve();\n}\n`
    },
    {
      path: "apps/main/src/services/auth.service.test.ts",
      content: `import { describe, expect, test } from "vitest";\nimport { loginWithPassword } from "./auth.service";\n\ndescribe("auth service", () => {\n  test("returns a demo session for valid credentials", async () => {\n    const session = await loginWithPassword({ username: "admin", password: "password123" });\n\n    expect(session.accessToken).toBe("demo-token-admin");\n    expect(session.user.username).toBe("admin");\n    expect(session.user.roles).toContain("admin");\n  });\n\n  test("rejects empty credentials", async () => {\n    await expect(loginWithPassword({ username: "", password: "password123" })).rejects.toThrow(\n      "Username and password are required."\n    );\n  });\n\n  test("rejects invalid demo credentials", async () => {\n    await expect(loginWithPassword({ username: "admin", password: "wrong" })).rejects.toThrow(\n      "Invalid demo credentials."\n    );\n  });\n});\n`
    },
    {
      path: "apps/main/src/stores/auth.store.ts",
      content: `import { create } from "zustand";\nimport type { AuthBridge, AuthSession, AuthStatus, CurrentUser, LoginCredentials } from "@tsuz/shared";\nimport { loginWithPassword, logoutSession } from "../services/auth.service";\n\ninterface AuthState {\n  status: AuthStatus;\n  user?: CurrentUser;\n  accessToken?: string;\n  error?: string;\n  login: (credentials: LoginCredentials) => Promise<AuthSession>;\n  logout: () => Promise<void>;\n  getAccessToken: () => string | undefined;\n  getCurrentUser: () => CurrentUser | undefined;\n}\n\nexport const useAuthStore = create<AuthState>((set, get) => ({\n  status: "anonymous",\n  user: undefined,\n  accessToken: undefined,\n  error: undefined,\n  async login(credentials) {\n    set({ status: "authenticating", error: undefined });\n\n    try {\n      const session = await loginWithPassword(credentials);\n\n      set({\n        status: "authenticated",\n        user: session.user,\n        accessToken: session.accessToken,\n        error: undefined\n      });\n\n      return session;\n    } catch (error) {\n      const message = error instanceof Error ? error.message : "Login failed.";\n\n      set({\n        status: "anonymous",\n        user: undefined,\n        accessToken: undefined,\n        error: message\n      });\n\n      throw error;\n    }\n  },\n  async logout() {\n    await logoutSession();\n    set({ status: "anonymous", user: undefined, accessToken: undefined, error: undefined });\n  },\n  getAccessToken: () => get().accessToken,\n  getCurrentUser: () => get().user\n}));\n\nexport const authBridge: AuthBridge = {\n  getAccessToken: () => useAuthStore.getState().getAccessToken(),\n  getCurrentUser: () => useAuthStore.getState().getCurrentUser(),\n  logout: () => {\n    void useAuthStore.getState().logout();\n  }\n};\n`
    },
    {
      path: "apps/main/src/styles/main.css",
      content: `@import "antd/dist/reset.css";\n\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: #172033;\n  background: #f5f7fb;\n}\n\nbody {\n  margin: 0;\n}\n\n.full-width {\n  width: 100%;\n}\n\n.login-page {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 32px;\n  background:\n    radial-gradient(circle at top left, rgba(22, 119, 255, 0.14), transparent 28rem),\n    linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%);\n}\n\n.login-card {\n  width: min(440px, 100%);\n  box-shadow: 0 24px 80px rgba(49, 80, 111, 0.16);\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}\n\n.brand-link {\n  color: #fff;\n  text-decoration: none;\n}\n\n.brand-link small {\n  color: #dbeafe !important;\n}\n\n.app-nav {\n  display: flex;\n  flex: 1;\n  gap: 16px;\n}\n\n.app-nav a {\n  color: #dbeafe;\n  text-decoration: none;\n}\n\n.user-menu {\n  color: #fff;\n}\n\n.user-name {\n  color: #fff;\n}\n\n.app-content {\n  padding: 32px;\n}\n\n.subapp-container {\n  min-height: 320px;\n  display: grid;\n  place-items: stretch;\n  border: 1px dashed #91caff;\n  background: #f0f7ff;\n  color: #31506f;\n}\n\n.integration-note {\n  margin-top: 16px;\n}\n`
    },
    {
      path: "apps/main/src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n\ninterface ImportMetaEnv {\n  readonly VITE_API_BASE_URL?: string;\n  readonly VITE_MFE_APP_ENTRY?: string;\n  readonly VITE_APP_ENV?: string;\n}\n\ninterface ImportMeta {\n  readonly env: ImportMetaEnv;\n}\n`
    },
    ...createReactSharedPackageFiles(),
    ...createReactUiPackageFiles(),
    ...createReactApiPackageFiles()
  ];
}

function createMfeMainReadme(packageName: string) {
  return `# ${packageName}

Generated by Tsu from the \`mfe-main\` template.

This is a production-ready React qiankun host shell starter. It generates a main application with demo login flow, auth state, React Query providers, reusable workspace packages, qiankun micro-app registration, Testing Library and Playwright coverage, Docker/nginx/compose deployment assets, GitHub Actions CI, and a GitHub Actions Deploy workflow for immutable test/product tag releases and rollback.

## Tech Stack

- React
- TypeScript
- Vite
- qiankun
- React Router
- Zustand
- TanStack Query
- Ant Design
- Tailwind CSS
- Vitest
- Testing Library
- Playwright
- Docker
- nginx
- docker compose
- GitHub Actions
- ESLint
- Prettier
- pnpm workspace
- Turbo

## Generate the Project

Create a host project with the Tsu CLI:

\`\`\`bash
tsu-cli init mfe-main-platform --template mfe-main
cd mfe-main-platform
\`\`\`

Generate a matching sub application separately when you want to run the full qiankun flow:

\`\`\`bash
tsu-cli init mfe-business-app --template mfe-app
\`\`\`

The host and sub application are independent deployable projects. The host owns login state and micro-app registration; the sub app owns business routes and can be released on its own cadence.

## Local development

Install dependencies and start the host:

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

The host application runs on http://localhost:7200. Open http://localhost:7200/login and sign in with the demo account.

Demo credentials:

- Username: \`admin\`
- Password: \`password123\`

For host + sub-app integration, start a generated \`mfe-app\` project first on port 7201, then start this host with the sub-app entry override:

\`\`\`bash
VITE_MFE_APP_ENTRY=//127.0.0.1:7201 pnpm dev
\`\`\`

After signing in, visit http://localhost:7200/apps/mfe-app to mount the sub app in \`#subapp-container\`.

## Local quality gates

Run these commands before opening a pull request or cutting a deployment tag:

\`\`\`bash
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
\`\`\`

\`pnpm test\` runs Vitest unit tests and Testing Library component tests. \`pnpm test:e2e\` starts the host on port 7200 and runs the Playwright host login smoke test.

The generated \`e2e/host-load-subapp.spec.ts\` covers the full host + sub-app qiankun flow. Run it after starting a generated \`mfe-app\` on port 7201 and the host with \`VITE_MFE_APP_ENTRY=//127.0.0.1:7201\`, or use the Tsu repository \`pnpm validate:generated-apps\` command to automate both servers and the integration spec.

## Environment variable model

There are three environment layers:

1. Copy \`apps/main/.env.example\` to \`apps/main/.env.local\` for local Vite overrides.
2. Copy \`.env.deploy.example\` to \`.env\` only when running docker compose manually in a deployment directory.
3. Configure GitHub Environment variables and secrets for automated \`.github/workflows/deploy.yml\` releases.

| Variable | Default | Purpose |
| --- | --- | --- |
| \`VITE_API_BASE_URL\` | \`/api\` | API base URL passed to sub applications |
| \`VITE_MFE_APP_ENTRY\` | \`//localhost:7201\` | qiankun entry URL for the generated \`mfe-app\` template |
| \`VITE_APP_ENV\` | \`local\` | Build-time application environment label |

\`VITE_API_BASE_URL is a build-time variable\`. The same build-time rule applies to \`VITE_MFE_APP_ENTRY\` and \`VITE_APP_ENV\`: changing any of them for a deployed image requires building and publishing a new immutable image tag. A rollback deploys the old image exactly as it was built.

## Scripts

| Script | Description |
| --- | --- |
| \`pnpm dev\` | Start the React host shell |
| \`pnpm lint\` | Run ESLint and TypeScript checks |
| \`pnpm test\` | Run generated Vitest and Testing Library tests |
| \`pnpm test:e2e\` | Run Playwright host E2E checks |
| \`pnpm build\` | Build the workspace through Turbo |
| \`pnpm docker:build\` | Build the nginx production image |
| \`pnpm docker:run\` | Run the production image on http://localhost:7200 |
| \`pnpm compose:up\` | Build and start the compose service |
| \`pnpm compose:down\` | Stop the compose service |
| \`pnpm format\` | Format generated source files |
| \`pnpm format:check\` | Check formatting without writing files |

## Project Structure

| Path | Purpose |
| --- | --- |
| \`apps/main/src/main.tsx\` | React host bootstrap and qiankun registration startup |
| \`apps/main/src/App.tsx\` | Authenticated host shell and micro-app outlet route |
| \`apps/main/src/pages/LoginPage.tsx\` | Demo login page |
| \`apps/main/src/pages/LoginPage.test.tsx\` | Testing Library coverage for the login surface |
| \`apps/main/src/stores/auth.store.ts\` | Zustand auth state and host-to-sub-app auth bridge |
| \`apps/main/src/services/auth.service.ts\` | Demo auth service; replace internals when connecting a real backend |
| \`apps/main/src/services/api-client.ts\` | Host API client factory using the shared auth bridge |
| \`apps/main/src/providers/AppProviders.tsx\` | React Query and Router providers |
| \`apps/main/src/micro-apps/config.ts\` | Pure qiankun app config helpers and env-driven entry resolution |
| \`apps/main/src/micro-apps/registry.ts\` | qiankun side-effect registration and start guard |
| \`e2e/host-login.spec.ts\` | Playwright host login and fallback outlet smoke test |
| \`e2e/host-load-subapp.spec.ts\` | Playwright integration spec for loading the generated \`mfe-app\` through qiankun |
| \`Dockerfile\` | Multi-stage production image build using nginx runtime |
| \`nginx/nginx.conf\` | SPA fallback, cache, and no-cache HTML rules |
| \`docker-compose.yml\` | Single-service compose orchestration for this host app |
| \`.env.deploy.example\` | Deployment variables consumed by docker compose |
| \`.github/workflows/ci.yml\` | PR and main/master push quality gate for lint, format, test, build, and E2E |
| \`.github/workflows/deploy.yml\` | Tag release and rollback workflow for Docker image deployment |
| \`packages/shared/src/index.ts\` | Shared auth, micro-app, route, and utility contracts |
| \`packages/ui/src/index.tsx\` | Shared React UI primitives: Logo, PageContainer, EmptyState, ErrorState |
| \`packages/api/src/index.ts\` | Generic fetch-based API client |
| \`turbo.json\` | Workspace build, lint, and test pipeline |

## Shared Workspace Packages

- \`@tsuz/shared\` owns reusable types, constants, and utilities. It intentionally avoids auth implementation and business logic.
- \`@tsuz/ui\` exposes small React UI primitives used by the host and sub app templates.
- \`@tsuz/api\` exposes \`createApiClient\`, a generic request wrapper that can read access tokens from host/sub-app auth props.

The app consumes these packages via \`workspace:*\` dependencies plus source aliases in \`apps/main/tsconfig.json\` and \`apps/main/vite.config.ts\`, so local development does not require prebuilding packages.

## Auth and Micro-App Props

The host owns login state. The qiankun registry passes these props to sub applications through the shared \`MicroAppProps\` contract:

- \`apiBaseUrl\`
- \`getAccessToken\`
- \`getCurrentUser\`
- \`logout\`

## GitHub Actions CI

\`.github/workflows/ci.yml\` runs on pull requests and pushes to \`main\` or \`master\`. The workflow installs dependencies with pnpm, then runs \`pnpm lint\`, \`pnpm format:check\`, \`pnpm test\`, \`pnpm build\`, installs Playwright Chromium dependencies, and runs \`pnpm test:e2e\`.

The default host E2E job covers login and the fallback micro-app outlet. The full host + sub-app integration spec remains available through \`MFE_INTEGRATION_E2E=true\` and is orchestrated by the Tsu repository \`pnpm validate:generated-apps\` command.

## GitHub Actions Deploy

\`.github/workflows/deploy.yml\` is separate from CI. It deploys immutable Docker image tags when you push \`test-v*.*.*\` or \`product-v*.*.*\`, and it supports manual \`workflow_dispatch\` rollback by selecting an environment and entering a historical \`image_tag\`.

### GitHub Environments

Create GitHub Environments named \`test\` and \`product\`. Configure Environment protection rules for \`product\` if production releases require manual approval.

Variables:

| Variable | Purpose |
| --- | --- |
| \`DOCKER_REGISTRY\` | Registry host, for example \`ghcr.io\` |
| \`DOCKER_IMAGE_NAME\` | Image repository/name pushed by the workflow |
| \`DOCKER_REGISTRY_USERNAME\` | Registry username used for docker login |
| \`DEPLOY_HOST\` | SSH host for the target server |
| \`DEPLOY_PORT\` | SSH port, usually \`22\` |
| \`DEPLOY_USER\` | SSH user for deployment |
| \`DEPLOY_PATH\` | Remote directory that will receive compose assets |
| \`CONTAINER_NAME\` | Runtime container name |
| \`APP_PORT\` | Server port mapped to nginx port 80 |
| \`APP_ENV\` | Environment label passed as \`VITE_APP_ENV\` at build time |
| \`VITE_API_BASE_URL\` | Build-time API base URL |
| \`VITE_MFE_APP_ENTRY\` | Build-time sub-app entry URL |

Secrets:

| Secret | Purpose |
| --- | --- |
| \`DOCKER_REGISTRY_TOKEN\` | Registry password/token for docker login |
| \`SSH_PRIVATE_KEY\` | Private key used for server deployment |
| \`SSH_KNOWN_HOSTS\` | Optional pinned known_hosts content |

### Tag release flow

\`test-v*.*.*\` tags deploy to the \`test\` environment. \`product-v*.*.*\` tags deploy to the \`product\` environment.

\`\`\`bash
git tag test-v1.0.1
git push origin test-v1.0.1

git tag product-v1.0.1
git push origin product-v1.0.1
\`\`\`

The workflow refuses \`latest\`. Use immutable tags such as \`test-v1.0.1\` and \`product-v1.0.1\` so each deployment can be audited and rolled back.

### Deploy mechanics

The deployment job builds the Docker image with \`VITE_API_BASE_URL\`, \`VITE_MFE_APP_ENTRY\`, and \`VITE_APP_ENV\` build args, pushes \`DOCKER_IMAGE_NAME:image_tag\`, then deploy.yml automatically uploads docker-compose.yml plus a generated remote \`.env\` file. The server does not need a hand-maintained compose file.

After upload, the workflow connects over SSH and runs \`docker compose pull\` followed by \`docker compose up -d --no-build\`:

\`\`\`bash
docker compose --env-file .env -f docker-compose.yml pull app
docker compose --env-file .env -f docker-compose.yml up -d --no-build app
\`\`\`

### Rollback flow

To rollback, open Actions → Deploy → Run workflow, choose \`test\` or \`product\`, and enter a historical immutable \`image_tag\` such as \`test-v1.0.0\` or \`product-v1.0.0\`.

Rollback skips rebuild and pulls an existing registry image. The workflow validates environment prefixes, so \`test\` only accepts \`test-v...\` tags and \`product\` only accepts \`product-v...\` tags. Because \`VITE_API_BASE_URL is a build-time variable\`, changing API hosts or sub-app entry URLs requires a new tag build rather than a rollback.

## Docker and nginx

\`Dockerfile\` builds the workspace with Node 20 and serves \`apps/main/dist\` with nginx. The build supports these Vite build args:

- \`VITE_API_BASE_URL\`
- \`VITE_MFE_APP_ENTRY\`
- \`VITE_APP_ENV\`

\`nginx/nginx.conf\` serves the host as an SPA. It falls back to \`index.html\` for \`/login\`, \`/apps/mfe-app\`, and nested routes, applies long cache headers to static assets, and keeps \`index.html\` uncached for safer releases.

## Docker Compose

Copy \`.env.deploy.example\` to \`.env\` before running compose in a deployment directory.

| Variable | Purpose |
| --- | --- |
| \`DOCKER_IMAGE_NAME\` | Image repository/name used by \`docker-compose.yml\` |
| \`APP_VERSION\` | Image tag/version |
| \`CONTAINER_NAME\` | Container name |
| \`APP_PORT\` | Host port mapped to nginx port 80 |
| \`APP_ENV\` | Deployment environment; passed to the build as \`VITE_APP_ENV\` |
| \`VITE_API_BASE_URL\` | Build-time API base URL |
| \`VITE_MFE_APP_ENTRY\` | Build-time sub-app entry URL |

\`\`\`bash
pnpm docker:build
pnpm docker:run
pnpm compose:up
pnpm compose:down
\`\`\`

## Phase Roadmap

- Phase 7 adds Docker, nginx, and compose deployment assets.
- Phase 8 adds GitHub Actions CI for install, lint, format check, test, build, and E2E.
- Phase 9 adds tag-driven GitHub Actions Deploy, image push, compose upload, SSH deployment, and rollback.
- Phase 10 adds release archive validation for generated MFE projects.
- Phase 11 completes README guidance for local development, GitHub Environments, tag releases, rollback, and build-time deployment variables.
`;
}
function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
