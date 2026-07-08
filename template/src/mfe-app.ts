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

export function createMfeAppTemplateFiles(packageName: string): TemplateFile[] {
  const appPackageName = `${packageName}-app`;
  const deployOptions = {
    appDirectory: "apps/app" as const,
    defaultContainerName: packageName,
    defaultImageName: packageName,
    defaultMfeAppEntry: "//localhost:7201",
    defaultPort: 7201,
    enableCors: true
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
          lint: "turbo run lint",
          test: "turbo run test",
          "test:e2e": "playwright test",
          format: "prettier --ignore-unknown --write package.json pnpm-workspace.yaml .github/workflows/ci.yml .github/workflows/deploy.yml prettier.config.js",
          "format:check": "prettier --ignore-unknown --check package.json pnpm-workspace.yaml .github/workflows/ci.yml .github/workflows/deploy.yml prettier.config.js",
          "docker:build": `docker build -t ${packageName}:\${APP_VERSION:-local} .`,
          "docker:run": `docker run --rm -p 7201:80 ${packageName}:\${APP_VERSION:-local}`,
          "compose:up": "docker compose up --build",
          "compose:down": "docker compose down"
        },
        devDependencies: {
          "@playwright/test": "^1.51.1",
          "@types/node": "^20.17.57",
          prettier: "^3.5.3",
          turbo: "^2.5.3",
          typescript: "^5.8.3"
        }
      })
    },
    {
      path: "README.md",
      content: createMfeAppReadme(packageName)
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
      content: `node_modules/\ndist/\napps/*/dist/\npackages/*/dist/\n.turbo/\n*.local\n*.log\n`
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
      content: `import { defineConfig, devices } from "@playwright/test";\n\nexport default defineConfig({\n  testDir: "./e2e",\n  fullyParallel: false,\n  forbidOnly: Boolean(process.env.CI),\n  retries: process.env.CI ? 2 : 0,\n  workers: 1,\n  reporter: process.env.CI ? "github" : "list",\n  use: {\n    baseURL: "http://127.0.0.1:7201",\n    trace: "on-first-retry"\n  },\n  webServer: {\n    command: "pnpm dev",\n    url: "http://127.0.0.1:7201",\n    reuseExistingServer: !process.env.CI,\n    timeout: 60_000\n  },\n  projects: [\n    {\n      name: "chromium",\n      use: { ...devices["Desktop Chrome"] }\n    }\n  ]\n});\n`
    },
    {
      path: "e2e/standalone.spec.ts",
      content: `import { expect, test } from "@playwright/test";\n\ntest("renders the standalone business application", async ({ page }) => {\n  await page.goto("/");\n\n  await expect(page.getByRole("heading", { name: "Business home" })).toBeVisible();\n  await expect(page.getByText("Standalone mode")).toBeVisible();\n  await expect(page.getByText("Auth bridge: standalone")).toBeVisible();\n  await expect(page.getByText("API base URL: /api")).toBeVisible();\n  await expect(page.getByText("Open orders")).toBeVisible();\n\n  await page.getByRole("link", { name: "About" }).click();\n\n  await expect(page).toHaveURL(/\\/about$/);\n  await expect(page.getByText("Integration notes")).toBeVisible();\n});\n`
    },
    {
      path: "apps/app/package.json",
      content: packageJson({
        name: appPackageName,
        version: "0.0.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite --host 0.0.0.0 --port 7201",
          build: "tsc -p tsconfig.json --noEmit && vite build",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "vitest run",
          preview: "vite preview --port 7201"
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
          jsdom: "^26.0.0",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          "vite-plugin-qiankun": "^1.0.15",
          vitest: "^3.0.5"
        }
      })
    },
    {
      path: "apps/app/.env.example",
      content: `VITE_API_BASE_URL=/api\nVITE_MFE_APP_ENTRY=//localhost:7201\nVITE_APP_ENV=local\n`
    },
    {
      path: "apps/app/index.html",
      content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
    },
    {
      path: "apps/app/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vitest/config";\nimport react from "@vitejs/plugin-react";\nimport qiankun from "vite-plugin-qiankun";\n\nexport default defineConfig({\n  plugins: [react(), qiankun("mfe-app", { useDevMode: true })],\n  test: {\n    environment: "jsdom",\n    setupFiles: "./src/test/setup.ts"\n  },\n  server: {\n    port: 7201,\n    strictPort: true,\n    headers: {\n      "Access-Control-Allow-Origin": "*"\n    }\n  },\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/api": fileURLToPath(new URL("../../packages/api/src/index.ts", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url))\n    },\n    dedupe: ["react", "react-dom"]\n  }\n});\n`
    },
    {
      path: "apps/app/tsconfig.json",
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
      path: "apps/app/src/test/setup.ts",
      content: `import "@testing-library/jest-dom/vitest";\nimport { vi } from "vitest";\n\nObject.defineProperty(window, "matchMedia", {\n  writable: true,\n  value: vi.fn().mockImplementation((query: string) => ({\n    matches: false,\n    media: query,\n    onchange: null,\n    addListener: vi.fn(),\n    removeListener: vi.fn(),\n    addEventListener: vi.fn(),\n    removeEventListener: vi.fn(),\n    dispatchEvent: vi.fn()\n  }))\n});\n\nglobalThis.ResizeObserver = class ResizeObserver {\n  observe() {\n    return undefined;\n  }\n\n  unobserve() {\n    return undefined;\n  }\n\n  disconnect() {\n    return undefined;\n  }\n};\n`
    },
    {
      path: "apps/app/src/main.tsx",
      content: `import { qiankunWindow, renderWithQiankun } from "vite-plugin-qiankun/dist/helper";\nimport { render } from "./bootstrap";\nimport { bootstrap, mount, unmount, update } from "./qiankun";\nimport "./styles/main.css";\n\nrenderWithQiankun({ bootstrap, mount, unmount, update });\n\nif (!qiankunWindow.__POWERED_BY_QIANKUN__) {\n  render();\n}\n\nexport { bootstrap, mount, unmount, update };\n`
    },
    {
      path: "apps/app/src/bootstrap.tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot, type Root } from "react-dom/client";\nimport App from "./App";\nimport { AppProviders } from "./providers/AppProviders";\nimport { createMfeApiClient } from "./services/api-client";\nimport { useAppStore } from "./stores/app.store";\nimport type { MfeAppProps } from "./qiankun";\n\nlet root: Root | undefined;\n\nexport function render(props: MfeAppProps = {}) {\n  const container = props.container?.querySelector("#root") ?? document.getElementById("root");\n\n  if (!container) {\n    throw new Error("Missing #root container for mfe-app.");\n  }\n\n  destroy();\n  useAppStore.getState().setHostProps(props);\n\n  const { basename } = useAppStore.getState();\n  root = createRoot(container);\n  root.render(\n    <StrictMode>\n      <AppProviders basename={basename}>\n        <App />\n      </AppProviders>\n    </StrictMode>\n  );\n\n  void createMfeApiClient(props);\n}\n\nexport function destroy() {\n  root?.unmount();\n  root = undefined;\n  useAppStore.getState().resetHostProps();\n}\n`
    },
    {
      path: "apps/app/src/qiankun.ts",
      content: `import type { MicroAppProps } from "@tsuz/shared";\nimport { destroy, render } from "./bootstrap";\n\nexport type MfeAppProps = Partial<MicroAppProps>;\n\nexport async function bootstrap() {\n  return Promise.resolve();\n}\n\nexport async function mount(props: MfeAppProps = {}) {\n  render(props);\n}\n\nexport async function unmount() {\n  destroy();\n}\n\nexport async function update(props: MfeAppProps = {}) {\n  render(props);\n}\n`
    },
    {
      path: "apps/app/src/App.tsx",
      content: `import { Layout, Space, Typography } from "antd";\nimport { Link, Route, Routes } from "react-router-dom";\nimport { ErrorState, Logo, PageContainer } from "@tsuz/ui";\nimport BusinessHomePage from "./pages/BusinessHomePage";\nimport { useAppStore } from "./stores/app.store";\n\nconst { Header, Content } = Layout;\n\nexport default function App() {\n  const appName = useAppStore((state) => state.appName);\n  const mode = useAppStore((state) => state.mode);\n\n  return (\n    <Layout className="app-shell">\n      <Header className="app-header">\n        <Logo label={appName} subtitle="qiankun sub app" />\n        <nav className="app-nav">\n          <Link to="/">Business home</Link>\n          <Link to="/about">About</Link>\n        </nav>\n        <Typography.Text className="runtime-mode">{mode === "qiankun" ? "Mounted by host" : "Standalone mode"}</Typography.Text>\n      </Header>\n      <Content className="app-content">\n        <Routes>\n          <Route path="/" element={<BusinessHomePage />} />\n          <Route path="/about" element={<IntegrationNotesPage />} />\n        </Routes>\n      </Content>\n    </Layout>\n  );\n}\n\nfunction IntegrationNotesPage() {\n  const apiBaseUrl = useAppStore((state) => state.apiBaseUrl);\n  const basename = useAppStore((state) => state.basename);\n\n  return (\n    <PageContainer title="Integration notes" description="Use the shared contracts when connecting this sub application to the host shell.">\n      <Space direction="vertical" size="large" className="full-width">\n        <Typography.Paragraph>\n          The generated mfe-app reads qiankun props through a Zustand store, wraps routes with React Query and React Router,\n          and creates API clients through the shared workspace packages.\n        </Typography.Paragraph>\n        <ErrorState\n          title="Backend integration extension point"\n          description={"Wire real requests through createMfeApiClient when replacing the demo business query. Current base URL: " + apiBaseUrl}\n        />\n        <Typography.Text type="secondary">Router basename: {basename}</Typography.Text>\n      </Space>\n    </PageContainer>\n  );\n}\n`
    },
    {
      path: "apps/app/src/pages/BusinessHomePage.tsx",
      content: `import { useQuery } from "@tanstack/react-query";\nimport { Alert, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";\nimport { EmptyState, ErrorState, PageContainer } from "@tsuz/ui";\nimport { businessHomeQueryKey, loadBusinessHomeSummary } from "../queries/business-home.query";\nimport { useAppStore } from "../stores/app.store";\n\nexport default function BusinessHomePage() {\n  const mode = useAppStore((state) => state.mode);\n  const appName = useAppStore((state) => state.appName);\n  const apiBaseUrl = useAppStore((state) => state.apiBaseUrl);\n  const hasAuthBridge = useAppStore((state) => state.hasAuthBridge);\n  const currentUser = useAppStore((state) => state.currentUser);\n  const query = useQuery({\n    queryKey: businessHomeQueryKey(apiBaseUrl, currentUser?.id ?? "guest"),\n    queryFn: () => loadBusinessHomeSummary({ apiBaseUrl, currentUser })\n  });\n  const summary = query.data;\n\n  return (\n    <PageContainer\n      title="Business home"\n      description="Phase 9 starter page with host props, app state, React Query data, browser coverage, CI, and deploy workflow wired together."\n      actions={<Tag color={mode === "qiankun" ? "purple" : "blue"}>{mode === "qiankun" ? "qiankun mount" : "standalone"}</Tag>}\n    >\n      <Space direction="vertical" size="large" className="full-width">\n        <Card>\n          <Space direction="vertical" size="middle" className="full-width">\n            <Typography.Paragraph>\n              Generated by Tsu from the <code>mfe-app</code> template. This sub application can run independently on port\n              7201 or receive auth and API props from the generated mfe-main host.\n            </Typography.Paragraph>\n            <Space wrap>\n              <Tag color="blue">React</Tag>\n              <Tag color="purple">qiankun</Tag>\n              <Tag color="green">Phase 9 deploy ready</Tag>\n              <Tag color={hasAuthBridge ? "success" : "default"}>Auth bridge: {hasAuthBridge ? "provided" : "standalone"}</Tag>\n            </Space>\n            <Typography.Text>Application: {appName}</Typography.Text>\n            <Typography.Text type="secondary">API base URL: {apiBaseUrl}</Typography.Text>\n            <Typography.Text type="secondary">Current user: {currentUser?.name ?? "Standalone visitor"}</Typography.Text>\n          </Space>\n        </Card>\n\n        {query.isError ? (\n          <ErrorState title="Unable to load business summary" description="Replace the demo query with a real backend request when ready." />\n        ) : null}\n\n        <Row gutter={[16, 16]}>\n          {(summary?.metrics ?? []).map((metric) => (\n            <Col xs={24} md={8} key={metric.label}>\n              <Card className="metric-card">\n                <Statistic title={metric.label} value={metric.value} suffix={metric.suffix} />\n                <Tag color={metric.color}>{metric.trend}</Tag>\n              </Card>\n            </Col>\n          ))}\n        </Row>\n\n        <Card title="Next business actions" loading={query.isLoading || query.isFetching}>\n          {summary ? (\n            <List bordered dataSource={summary.nextActions} renderItem={(item) => <List.Item>{item}</List.Item>} />\n          ) : (\n            <EmptyState title="Loading business summary" description="React Query is preparing deterministic starter data." />\n          )}\n        </Card>\n\n        <Alert\n          type="info"\n          showIcon\n          message="Template extension point"\n          description="Keep backend calls inside query modules and inject host auth through createMfeApiClient for production business features."\n        />\n      </Space>\n    </PageContainer>\n  );\n}\n`
    },
    {
      path: "apps/app/src/pages/BusinessHomePage.test.tsx",
      content: `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { render, screen } from "@testing-library/react";\nimport { beforeEach, describe, expect, test } from "vitest";\nimport BusinessHomePage from "./BusinessHomePage";\nimport { useAppStore } from "../stores/app.store";\n\nbeforeEach(() => {\n  useAppStore.getState().resetHostProps();\n});\n\ndescribe("BusinessHomePage", () => {\n  test("renders standalone state and deterministic business data", async () => {\n    renderBusinessHomePage();\n\n    expect(screen.getByRole("heading", { name: "Business home" })).toBeInTheDocument();\n    expect(screen.getByText("standalone")).toBeInTheDocument();\n    expect(screen.getByText("Auth bridge: standalone")).toBeInTheDocument();\n    expect(screen.getByText("API base URL: /api")).toBeInTheDocument();\n    expect(await screen.findByText("Open orders")).toBeInTheDocument();\n    expect(await screen.findByText("Replace deterministic demo data with a domain API query.")).toBeInTheDocument();\n  });\n});\n\nfunction renderBusinessHomePage() {\n  const queryClient = new QueryClient({\n    defaultOptions: {\n      queries: { retry: false }\n    }\n  });\n\n  return render(\n    <QueryClientProvider client={queryClient}>\n      <BusinessHomePage />\n    </QueryClientProvider>\n  );\n}\n`
    },
    {
      path: "apps/app/src/providers/AppProviders.tsx",
      content: `import type { PropsWithChildren } from "react";\nimport { QueryClientProvider } from "@tanstack/react-query";\nimport { BrowserRouter } from "react-router-dom";\nimport { queryClient } from "./query-client";\n\ninterface AppProvidersProps extends PropsWithChildren {\n  basename?: string;\n}\n\nexport function AppProviders({ basename = "/", children }: AppProvidersProps) {\n  return (\n    <QueryClientProvider client={queryClient}>\n      <BrowserRouter basename={basename}>{children}</BrowserRouter>\n    </QueryClientProvider>\n  );\n}\n`
    },
    {
      path: "apps/app/src/providers/query-client.ts",
      content: `import { QueryClient } from "@tanstack/react-query";\n\nexport const queryClient = new QueryClient({\n  defaultOptions: {\n    queries: {\n      retry: 1,\n      staleTime: 30_000\n    }\n  }\n});\n`
    },
    {
      path: "apps/app/src/queries/business-home.query.ts",
      content: `import { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";\n\nexport interface BusinessMetric {\n  label: string;\n  value: number;\n  suffix?: string;\n  trend: string;\n  color: "blue" | "green" | "gold";\n}\n\nexport interface BusinessHomeSummary {\n  apiBaseUrl: string;\n  currentUserName: string;\n  metrics: BusinessMetric[];\n  nextActions: string[];\n}\n\nexport interface LoadBusinessHomeSummaryOptions {\n  apiBaseUrl?: string;\n  currentUser?: CurrentUser;\n}\n\nexport function businessHomeQueryKey(apiBaseUrl = DEFAULT_API_BASE_URL, userId = "guest") {\n  return ["business-home", apiBaseUrl, userId] as const;\n}\n\nexport async function loadBusinessHomeSummary(options: LoadBusinessHomeSummaryOptions = {}): Promise<BusinessHomeSummary> {\n  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;\n  const currentUserName = options.currentUser?.name ?? "Standalone visitor";\n\n  return {\n    apiBaseUrl,\n    currentUserName,\n    metrics: [\n      { label: "Open orders", value: 128, trend: "+12% demo", color: "blue" },\n      { label: "SLA", value: 99.9, suffix: "%", trend: "healthy", color: "green" },\n      { label: "Pending reviews", value: 7, trend: "needs attention", color: "gold" }\n    ],\n    nextActions: [\n      "Replace deterministic demo data with a domain API query.",\n      "Keep auth token access behind the shared MicroAppProps bridge.",\n      "Use Docker/nginx smoke checks before promoting container images."\n    ]\n  };\n}\n`
    },
    {
      path: "apps/app/src/stores/app.store.ts",
      content: `import { create } from "zustand";\nimport { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";\nimport type { MfeAppProps } from "../qiankun";\n\nexport type AppRuntimeMode = "standalone" | "qiankun";\n\nexport interface AppRuntimeState {\n  mode: AppRuntimeMode;\n  appName: string;\n  basename: string;\n  apiBaseUrl: string;\n  hasAuthBridge: boolean;\n  currentUser?: CurrentUser;\n  hostProps?: MfeAppProps;\n  lastMountedBy: string;\n}\n\ninterface AppStore extends AppRuntimeState {\n  setHostProps: (props?: MfeAppProps) => void;\n  resetHostProps: () => void;\n}\n\nexport const useAppStore = create<AppStore>((set) => ({\n  ...createInitialAppState(),\n  setHostProps: (props = {}) => {\n    const mode = resolveRuntimeMode(props);\n\n    set({\n      mode,\n      appName: props.appName ?? "mfe-app",\n      basename: props.basename ?? "/",\n      apiBaseUrl: props.apiBaseUrl ?? resolveDefaultApiBaseUrl(),\n      hasAuthBridge: Boolean(props.getAccessToken),\n      currentUser: readCurrentUser(props),\n      hostProps: props,\n      lastMountedBy: mode === "qiankun" ? "qiankun host" : "standalone mode"\n    });\n  },\n  resetHostProps: () => set(createInitialAppState())\n}));\n\nfunction createInitialAppState(): AppRuntimeState {\n  const mode = resolveRuntimeMode();\n\n  return {\n    mode,\n    appName: "mfe-app",\n    basename: "/",\n    apiBaseUrl: resolveDefaultApiBaseUrl(),\n    hasAuthBridge: false,\n    currentUser: undefined,\n    hostProps: undefined,\n    lastMountedBy: mode === "qiankun" ? "qiankun host" : "standalone mode"\n  };\n}\n\nfunction resolveDefaultApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

function resolveRuntimeMode(props: MfeAppProps = {}): AppRuntimeMode {\n  if (props.container || isPoweredByQiankun()) {\n    return "qiankun";\n  }\n\n  return "standalone";\n}\n\nfunction isPoweredByQiankun() {\n  return typeof window !== "undefined" && Boolean(window.__POWERED_BY_QIANKUN__);\n}\n\nfunction readCurrentUser(props: MfeAppProps) {\n  try {\n    return props.getCurrentUser?.();\n  } catch {\n    return undefined;\n  }\n}\n`
    },
    {
      path: "apps/app/src/services/api-client.ts",
      content: `import { createApiClient } from "@tsuz/api";\nimport { DEFAULT_API_BASE_URL, type MicroAppProps } from "@tsuz/shared";\n\nexport function createMfeApiClient(props: Partial<MicroAppProps> = {}) {\n  return createApiClient({\n    baseUrl: props.apiBaseUrl ?? resolveDefaultApiBaseUrl(),\n    getAccessToken: props.getAccessToken,\n    onUnauthorized: props.logout\n  });\n}\n\nfunction resolveDefaultApiBaseUrl() {\n  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;\n}\n`
    },
    {
      path: "apps/app/src/qiankun.test.ts",
      content: `import { beforeEach, describe, expect, test, vi } from "vitest";\nimport type { MfeAppProps } from "./qiankun";\n\nconst bootstrapModule = vi.hoisted(() => ({\n  render: vi.fn(),\n  destroy: vi.fn()\n}));\n\nvi.mock("./bootstrap", () => bootstrapModule);\n\nimport { bootstrap, mount, unmount, update } from "./qiankun";\n\nbeforeEach(() => {\n  bootstrapModule.render.mockClear();\n  bootstrapModule.destroy.mockClear();\n});\n\ndescribe("qiankun lifecycle", () => {\n  test("bootstrap resolves without side effects", async () => {\n    await expect(bootstrap()).resolves.toBeUndefined();\n    expect(bootstrapModule.render).not.toHaveBeenCalled();\n  });\n\n  test("mount delegates to render with host props", async () => {\n    const props: MfeAppProps = {\n      appName: "mfe-app",\n      basename: "/apps/mfe-app",\n      apiBaseUrl: "https://api.example.test",\n      getAccessToken: () => "host-token",\n      getCurrentUser: () => undefined,\n      logout: () => undefined\n    };\n\n    await mount(props);\n\n    expect(bootstrapModule.render).toHaveBeenCalledWith(props);\n  });\n\n  test("unmount delegates to destroy", async () => {\n    await unmount();\n\n    expect(bootstrapModule.destroy).toHaveBeenCalledTimes(1);\n  });\n\n  test("update remounts with new host props", async () => {\n    const props: MfeAppProps = { appName: "mfe-app", apiBaseUrl: "https://api.next.example.test" };\n\n    await update(props);\n\n    expect(bootstrapModule.render).toHaveBeenCalledWith(props);\n  });\n});\n`
    },
    {
      path: "apps/app/src/services/api-client.test.ts",
      content: `import { afterEach, describe, expect, test } from "vitest";\nimport { createMfeApiClient } from "./api-client";\n\nconst originalFetch = globalThis.fetch;\n\nafterEach(() => {\n  globalThis.fetch = originalFetch;\n});\n\ndescribe("createMfeApiClient", () => {\n  test("uses the default API base URL when no host prop is provided", async () => {\n    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];\n\n    globalThis.fetch = (async (input, init) => {\n      requests.push({ input, init });\n      return new Response(JSON.stringify({ ok: true }), {\n        status: 200,\n        headers: { "Content-Type": "application/json" }\n      });\n    }) as typeof fetch;\n\n    const client = createMfeApiClient();\n\n    await expect(client.get("/health")).resolves.toEqual({ ok: true });\n    expect(String(requests[0].input)).toBe("/api/health");\n  });\n\n  test("uses host API base URL and bearer token props", async () => {\n    let capturedInput: RequestInfo | URL | undefined;\n    let capturedHeaders: Headers | undefined;\n    let loggedOut = false;\n\n    globalThis.fetch = (async (input, init) => {\n      capturedInput = input;\n      capturedHeaders = init?.headers as Headers;\n      return new Response(JSON.stringify({ message: "Unauthorized" }), {\n        status: 401,\n        headers: { "Content-Type": "application/json" }\n      });\n    }) as typeof fetch;\n\n    const client = createMfeApiClient({\n      apiBaseUrl: "https://api.example.test/v1",\n      getAccessToken: () => "host-token",\n      logout: () => {\n        loggedOut = true;\n      }\n    });\n\n    await expect(client.get("/private")).rejects.toThrow("API request failed");\n    expect(String(capturedInput)).toBe("https://api.example.test/v1/private");\n    expect(capturedHeaders?.get("Authorization")).toBe("Bearer host-token");\n    expect(loggedOut).toBe(true);\n  });\n});\n`
    },
    {
      path: "apps/app/src/stores/app.store.test.ts",
      content: `import { beforeEach, describe, expect, test } from "vitest";\nimport { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";\nimport { useAppStore } from "./app.store";\n\nbeforeEach(() => {\n  useAppStore.getState().resetHostProps();\n});\n\ndescribe("app store", () => {\n  test("uses standalone defaults", () => {\n    const state = useAppStore.getState();\n\n    expect(state.mode).toBe("standalone");\n    expect(state.appName).toBe("mfe-app");\n    expect(state.basename).toBe("/");\n    expect(state.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);\n    expect(state.hasAuthBridge).toBe(false);\n  });\n\n  test("stores qiankun host props and current user", () => {\n    const currentUser: CurrentUser = {\n      id: "user-1",\n      name: "Demo Admin",\n      username: "admin",\n      roles: ["admin"],\n      permissions: ["mfe:read"]\n    };\n\n    useAppStore.getState().setHostProps({\n      appName: "mfe-app",\n      basename: "/apps/mfe-app",\n      apiBaseUrl: "https://api.example.test",\n      getAccessToken: () => "host-token",\n      getCurrentUser: () => currentUser,\n      logout: () => undefined,\n      container: {} as HTMLElement\n    });\n\n    const state = useAppStore.getState();\n\n    expect(state.mode).toBe("qiankun");\n    expect(state.basename).toBe("/apps/mfe-app");\n    expect(state.apiBaseUrl).toBe("https://api.example.test");\n    expect(state.hasAuthBridge).toBe(true);\n    expect(state.currentUser?.username).toBe("admin");\n    expect(state.lastMountedBy).toBe("qiankun host");\n  });\n\n  test("reset clears host-derived state", () => {\n    useAppStore.getState().setHostProps({\n      apiBaseUrl: "https://api.example.test",\n      getAccessToken: () => "host-token"\n    });\n\n    useAppStore.getState().resetHostProps();\n\n    const state = useAppStore.getState();\n    expect(state.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);\n    expect(state.hasAuthBridge).toBe(false);\n    expect(state.hostProps).toBeUndefined();\n  });\n});\n`
    },
    {
      path: "apps/app/src/queries/business-home.query.test.ts",
      content: `import { describe, expect, test } from "vitest";\nimport { DEFAULT_API_BASE_URL, type CurrentUser } from "@tsuz/shared";\nimport { businessHomeQueryKey, loadBusinessHomeSummary } from "./business-home.query";\n\ndescribe("business home query", () => {\n  test("creates stable query keys", () => {\n    expect(businessHomeQueryKey()).toEqual(["business-home", DEFAULT_API_BASE_URL, "guest"]);\n    expect(businessHomeQueryKey("https://api.example.test", "user-1")).toEqual([\n      "business-home",\n      "https://api.example.test",\n      "user-1"\n    ]);\n  });\n\n  test("returns deterministic starter metrics", async () => {\n    const currentUser: CurrentUser = {\n      id: "user-1",\n      name: "Demo Admin",\n      username: "admin",\n      roles: ["admin"],\n      permissions: ["mfe:read"]\n    };\n\n    await expect(loadBusinessHomeSummary({ apiBaseUrl: "https://api.example.test", currentUser })).resolves.toMatchObject({\n      apiBaseUrl: "https://api.example.test",\n      currentUserName: "Demo Admin",\n      metrics: expect.arrayContaining([expect.objectContaining({ label: "Open orders" })])\n    });\n  });\n});\n`
    },
    {
      path: "apps/app/src/styles/main.css",
      content: `@import "antd/dist/reset.css";\n\n:root {\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: #172033;\n  background: #f6f8fb;\n}\n\nbody {\n  margin: 0;\n}\n\n.full-width {\n  width: 100%;\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}\n\n.app-header .tsu-logo {\n  color: #fff;\n}\n\n.app-header .tsu-logo small {\n  color: #dbeafe !important;\n}\n\n.app-nav {\n  display: flex;\n  flex: 1;\n  gap: 16px;\n}\n\n.app-nav a {\n  color: #dbeafe;\n  text-decoration: none;\n}\n\n.runtime-mode {\n  color: #fff;\n}\n\n.app-content {\n  padding: 32px;\n}\n\n.metric-card {\n  height: 100%;\n}\n`
    },
    {
      path: "apps/app/src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n\ninterface ImportMetaEnv {\n  readonly VITE_API_BASE_URL?: string;\n  readonly VITE_MFE_APP_ENTRY?: string;\n  readonly VITE_APP_ENV?: string;\n}\n\ninterface ImportMeta {\n  readonly env: ImportMetaEnv;\n}\n\ninterface Window {\n  __POWERED_BY_QIANKUN__?: boolean;\n}\n`
    },
    ...createReactSharedPackageFiles(),
    ...createReactUiPackageFiles(),
    ...createReactApiPackageFiles()
  ];
}

function createMfeAppReadme(packageName: string) {
  return `# ${packageName}

Generated by Tsu from the \`mfe-app\` template.

This is the Phase 9 React qiankun sub application starter. It runs independently, exposes concrete qiankun lifecycle functions, stores host props in a local Zustand wrapper, includes React Query-ready business page structure, ships Vitest, Testing Library, Playwright, and format-check coverage by default, includes Docker/nginx/compose deployment assets, GitHub Actions CI, and a GitHub Actions Deploy workflow for tag releases and rollback.

## Tech Stack

- React
- TypeScript
- Vite
- qiankun lifecycle functions through vite-plugin-qiankun
- React Router
- Zustand
- TanStack Query
- Ant Design
- Vitest
- Testing Library
- Playwright
- Docker
- nginx
- docker compose
- GitHub Actions
- ESLint-compatible TypeScript checks
- Prettier
- pnpm workspace
- Turbo

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

The sub application runs on http://localhost:7201 in standalone mode.

## Host Mode

Start a generated \`mfe-main\` project on port 7200 and this project on port 7201. Log in to the host with the demo account, then visit http://localhost:7200/apps/mfe-app to mount this application through qiankun.

## Environment Variables

Copy \`apps/app/.env.example\` to \`apps/app/.env.local\` when you need local Vite overrides.

| Variable | Default | Purpose |
| --- | --- | --- |
| \`VITE_API_BASE_URL\` | \`/api\` | Standalone API base URL when no host prop is provided |
| \`VITE_MFE_APP_ENTRY\` | \`//localhost:7201\` | Kept for parity with the host template and compose build args |
| \`VITE_APP_ENV\` | \`local\` | Build-time application environment label |

## Scripts

| Script | Description |
| --- | --- |
| \`pnpm dev\` | Start the React sub application |
| \`pnpm lint\` | Run TypeScript no-emit checks |
| \`pnpm test\` | Run generated Vitest and Testing Library tests |
| \`pnpm test:e2e\` | Run Playwright standalone E2E checks |
| \`pnpm build\` | Build the workspace through Turbo |
| \`pnpm docker:build\` | Build the nginx production image |
| \`pnpm docker:run\` | Run the production image on http://localhost:7201 |
| \`pnpm compose:up\` | Build and start the compose service |
| \`pnpm compose:down\` | Stop the compose service |
| \`pnpm format\` | Format generated source files |
| \`pnpm format:check\` | Check formatting without writing files |

## Project Structure

| Path | Purpose |
| --- | --- |
| \`apps/app/src/main.tsx\` | Standalone bootstrap and qiankun lifecycle exports |
| \`apps/app/src/bootstrap.tsx\` | Shared render and destroy boundary with idempotent unmount behavior |
| \`apps/app/src/qiankun.ts\` | bootstrap, mount, and unmount functions using shared props |
| \`apps/app/src/pages/BusinessHomePage.tsx\` | Phase 9 starter business page using host props, state, query data, CI, and deploy-ready checks |
| \`apps/app/src/pages/BusinessHomePage.test.tsx\` | Testing Library coverage for standalone business page rendering |
| \`apps/app/src/providers/AppProviders.tsx\` | React Query and Router providers with qiankun-aware basename support |
| \`apps/app/src/providers/query-client.ts\` | Shared TanStack Query client defaults |
| \`apps/app/src/stores/app.store.ts\` | Zustand runtime state for standalone and qiankun-mounted modes |
| \`apps/app/src/queries/business-home.query.ts\` | Deterministic starter query for business summary data |
| \`apps/app/src/services/api-client.ts\` | Sub-app API client factory using optional host props |
| \`e2e/standalone.spec.ts\` | Playwright standalone startup, rendering, and route smoke test |
| \`Dockerfile\` | Multi-stage production image build using nginx runtime |
| \`nginx/nginx.conf\` | SPA fallback, cache, and qiankun CORS rules |
| \`docker-compose.yml\` | Single-service compose orchestration for this sub app |
| \`.env.deploy.example\` | Deployment variables consumed by docker compose |
| \`.github/workflows/ci.yml\` | PR and main/master push quality gate for lint, format, test, build, and E2E |
| \`.github/workflows/deploy.yml\` | Tag release and rollback workflow for Docker image deployment |
| \`packages/shared/src/index.ts\` | Shared auth, micro-app, route, and utility contracts |
| \`packages/ui/src/index.tsx\` | Shared React UI primitives: Logo, PageContainer, EmptyState, ErrorState |
| \`packages/api/src/index.ts\` | Generic fetch-based API client |

## Shared Workspace Packages

- \`@tsuz/shared\` owns reusable types, constants, and utilities, including the shared \`MicroAppProps\` mount contract.
- \`@tsuz/ui\` exposes small React UI primitives used by generated host and sub app templates.
- \`@tsuz/api\` exposes \`createApiClient\`, a generic request wrapper that can read auth tokens from qiankun mount props.

The app consumes these packages via \`workspace:*\` dependencies plus source aliases in \`apps/app/tsconfig.json\` and \`apps/app/vite.config.ts\`, so local development does not require prebuilding packages.

## qiankun Integration

When mounted by a host, \`apps/app/src/qiankun.ts\` accepts \`Partial<MicroAppProps>\` from \`@tsuz/shared\`. The generated lifecycle calls write those props into \`apps/app/src/stores/app.store.ts\`, and \`createMfeApiClient\` uses the same props to configure API base URL, access-token injection, and unauthorized handling without hard-coding host behavior.

## Testing

\`pnpm test\` runs lifecycle, API client, store, query, and Testing Library page coverage. \`pnpm test:e2e\` starts the sub application on port 7201 and verifies standalone rendering plus the \`/about\` route through Playwright.

For host-mounted coverage, generate a matching \`mfe-main\` project and run the Tsu repository \`pnpm validate:generated-apps\` command, which starts both dev servers and executes the host integration Playwright spec.

## GitHub Actions CI

\`.github/workflows/ci.yml\` runs on pull requests and pushes to \`main\` or \`master\`. The workflow installs dependencies with pnpm, then runs \`pnpm lint\`, \`pnpm format:check\`, \`pnpm test\`, \`pnpm build\`, installs Playwright Chromium dependencies, and runs \`pnpm test:e2e\`.

The generated sub-app E2E job starts the standalone Vite dev server on port 7201 and verifies the business home plus \`/about\` route through Playwright. Host-mounted integration coverage is still orchestrated from a matching generated \`mfe-main\` project by the Tsu repository \`pnpm validate:generated-apps\` command.

## GitHub Actions Deploy

\`.github/workflows/deploy.yml\` is separate from CI. It deploys immutable Docker image tags when you push \`test-v*.*.*\` or \`product-v*.*.*\`, and it supports manual \`workflow_dispatch\` rollback by selecting an environment and entering a historical \`image_tag\`.

Create GitHub Environments named \`test\` and \`product\`. Configure these Environment variables: \`DOCKER_REGISTRY\`, \`DOCKER_IMAGE_NAME\`, \`DOCKER_REGISTRY_USERNAME\`, \`DEPLOY_HOST\`, \`DEPLOY_PORT\`, \`DEPLOY_USER\`, \`DEPLOY_PATH\`, \`CONTAINER_NAME\`, \`APP_PORT\`, \`APP_ENV\`, \`VITE_API_BASE_URL\`, and \`VITE_MFE_APP_ENTRY\`. Configure these Environment secrets: \`DOCKER_REGISTRY_TOKEN\`, \`SSH_PRIVATE_KEY\`, and optionally \`SSH_KNOWN_HOSTS\`.

Tag deployment parses \`environment\`, \`image_tag\`, and \`version\`, builds the Docker image with \`VITE_API_BASE_URL\`, \`VITE_MFE_APP_ENTRY\`, and \`VITE_APP_ENV\` build args, pushes \`DOCKER_IMAGE_NAME:image_tag\`, uploads \`docker-compose.yml\` plus a generated remote \`.env\`, then runs \`docker compose pull\` and \`docker compose up -d --no-build\` over SSH.

\`VITE_*\` values are build-time variables. A rollback deploys the old image exactly as it was built, so changing API or host entry values requires a new tag build.

\`\`\`bash
git tag test-v1.0.1
git push origin test-v1.0.1

git tag product-v1.0.1
git push origin product-v1.0.1
\`\`\`

To rollback, open Actions → Deploy → Run workflow, choose \`test\` or \`product\`, and enter a historical immutable \`image_tag\` such as \`product-v1.0.0\`.

## Docker and nginx

\`Dockerfile\` builds the workspace with Node 20 and serves \`apps/app/dist\` with nginx. The build supports these Vite build args:

- \`VITE_API_BASE_URL\`
- \`VITE_MFE_APP_ENTRY\`
- \`VITE_APP_ENV\`

\`nginx/nginx.conf\` serves the sub app as an SPA with fallback for \`/\`, \`/about\`, and future business routes. It also emits \`Access-Control-Allow-Origin: *\` headers so qiankun host shells can load sub-app assets from another origin.

## Docker Compose

Copy \`.env.deploy.example\` to \`.env\` before running compose in a deployment directory.

| Variable | Purpose |
| --- | --- |
| \`DOCKER_IMAGE_NAME\` | Image repository/name used by \`docker-compose.yml\` |
| \`APP_VERSION\` | Image tag/version |
| \`CONTAINER_NAME\` | Container name |
| \`APP_PORT\` | Host port mapped to nginx port 80 |
| \`APP_ENV\` | Deployment environment; passed to the build as \`VITE_APP_ENV\` |
| \`VITE_API_BASE_URL\` | Build-time standalone API base URL |
| \`VITE_MFE_APP_ENTRY\` | Build-time MFE entry value kept for compose parity |

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
- Later phases add release validation and extended documentation.
`;
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
