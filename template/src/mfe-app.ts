import { createReactApiPackageFiles, createReactSharedPackageFiles, createReactUiPackageFiles } from "./mfe-react-common.js";

export interface TemplateFile {
  path: string;
  content: string;
}

export function createMfeAppTemplateFiles(packageName: string): TemplateFile[] {
  const appPackageName = `${packageName}-app`;

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
          test: "turbo run test"
        },
        devDependencies: {
          "@types/node": "^20.17.57",
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
      path: ".gitignore",
      content: `node_modules/\ndist/\napps/*/dist/\npackages/*/dist/\n.turbo/\n*.local\n*.log\n`
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
          "@types/react": "^19.0.10",
          "@types/react-dom": "^19.0.4",
          "@vitejs/plugin-react": "^4.3.4",
          typescript: "^5.8.3",
          vite: "^6.2.0"
        }
      })
    },
    {
      path: "apps/app/index.html",
      content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
    },
    {
      path: "apps/app/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 7201,\n    strictPort: true,\n    headers: {\n      "Access-Control-Allow-Origin": "*"\n    }\n  },\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/api": fileURLToPath(new URL("../../packages/api/src/index.ts", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url))\n    },\n    dedupe: ["react", "react-dom"]\n  }\n});\n`
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
      path: "apps/app/src/main.tsx",
      content: `import { render } from "./bootstrap";\nimport "./styles/main.css";\n\nif (!window.__POWERED_BY_QIANKUN__) {\n  render();\n}\n\nexport { bootstrap, mount, unmount } from "./qiankun";\n`
    },
    {
      path: "apps/app/src/bootstrap.tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot, type Root } from "react-dom/client";\nimport { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { BrowserRouter } from "react-router-dom";\nimport App from "./App";\nimport { createMfeApiClient } from "./services/api-client";\nimport type { MfeAppProps } from "./qiankun";\n\nlet root: Root | undefined;\nconst queryClient = new QueryClient();\n\nexport function render(props: MfeAppProps = {}) {\n  const container = props.container?.querySelector("#root") ?? document.getElementById("root");\n  const apiClient = createMfeApiClient(props);\n\n  if (!container) {\n    throw new Error("Missing #root container for mfe-app.");\n  }\n\n  root = createRoot(container);\n  root.render(\n    <StrictMode>\n      <QueryClientProvider client={queryClient}>\n        <BrowserRouter basename={props.basename ?? "/"}>\n          <App appName={props.appName ?? "mfe-app"} apiBaseUrl={props.apiBaseUrl} hasAuthBridge={Boolean(props.getAccessToken)} />\n        </BrowserRouter>\n      </QueryClientProvider>\n    </StrictMode>\n  );\n\n  void apiClient;\n}\n\nexport function destroy() {\n  root?.unmount();\n  root = undefined;\n}\n`
    },
    {
      path: "apps/app/src/qiankun.ts",
      content: `import type { MicroAppProps } from "@tsuz/shared";\nimport { destroy, render } from "./bootstrap";\n\nexport type MfeAppProps = Partial<MicroAppProps>;\n\nexport async function bootstrap() {\n  // Phase 5 will initialize app-level resources here.\n}\n\nexport async function mount(props: MfeAppProps) {\n  render(props);\n}\n\nexport async function unmount() {\n  destroy();\n}\n`
    },
    {
      path: "apps/app/src/App.tsx",
      content: `import { Card, Layout, Space, Tag, Typography } from "antd";\nimport { Link, Route, Routes } from "react-router-dom";\nimport { create } from "zustand";\nimport { EmptyState, ErrorState, Logo, PageContainer } from "@tsuz/ui";\n\nconst { Header, Content } = Layout;\n\ninterface AppState {\n  lastMountedBy: string;\n  setLastMountedBy: (source: string) => void;\n}\n\nconst useAppStore = create<AppState>((set) => ({\n  lastMountedBy: window.__POWERED_BY_QIANKUN__ ? "qiankun host" : "standalone mode",\n  setLastMountedBy: (source) => set({ lastMountedBy: source })\n}));\n\ninterface AppProps {\n  appName: string;\n  apiBaseUrl?: string;\n  hasAuthBridge: boolean;\n}\n\nexport default function App({ appName, apiBaseUrl, hasAuthBridge }: AppProps) {\n  const lastMountedBy = useAppStore((state) => state.lastMountedBy);\n\n  return (\n    <Layout className="app-shell">\n      <Header className="app-header">\n        <Logo label={appName} subtitle="qiankun sub app" />\n        <nav className="app-nav">\n          <Link to="/">Business home</Link>\n          <Link to="/about">About</Link>\n        </nav>\n      </Header>\n      <Content className="app-content">\n        <Routes>\n          <Route\n            path="/"\n            element={\n              <PageContainer\n                title="React qiankun sub application starter"\n                description="This Phase 4 skeleton can run independently and can also consume shared host props when mounted by qiankun."\n              >\n                <Card>\n                  <Space direction="vertical" size="middle" className="full-width">\n                    <Typography.Paragraph>\n                      Generated by Tsu from the <code>mfe-app</code> template. Shared workspace packages provide\n                      mount prop types, UI primitives, and a generic API client without adding business logic yet.\n                    </Typography.Paragraph>\n                    <Space wrap>\n                      <Tag color="blue">React</Tag>\n                      <Tag color="purple">qiankun</Tag>\n                      <Tag color="green">Phase 4 packages</Tag>\n                    </Space>\n                    <Typography.Text>Mounted by: {lastMountedBy}</Typography.Text>\n                    <Typography.Text type="secondary">API base URL: {apiBaseUrl ?? "/api"}</Typography.Text>\n                    <Typography.Text type="secondary">Auth bridge: {hasAuthBridge ? "provided by host" : "not provided"}</Typography.Text>\n                    <EmptyState\n                      title="Ready for business routes"\n                      description="Add domain pages and queries in Phase 5 while reusing @tsuz/shared, @tsuz/ui, and @tsuz/api."\n                    />\n                  </Space>\n                </Card>\n              </PageContainer>\n            }\n          />\n          <Route\n            path="/about"\n            element={\n              <PageContainer title="Integration notes" description="The app can run standalone or under the generated mfe-main host.">\n                <ErrorState\n                  title="No backend calls yet"\n                  description="Use createMfeApiClient when adding real queries so auth tokens and unauthorized handling stay consistent."\n                />\n              </PageContainer>\n            }\n          />\n        </Routes>\n      </Content>\n    </Layout>\n  );\n}\n`
    },
    {
      path: "apps/app/src/services/api-client.ts",
      content: `import { createApiClient } from "@tsuz/api";\nimport { DEFAULT_API_BASE_URL, type MicroAppProps } from "@tsuz/shared";\n\nexport function createMfeApiClient(props: Partial<MicroAppProps> = {}) {\n  return createApiClient({\n    baseUrl: props.apiBaseUrl ?? DEFAULT_API_BASE_URL,\n    getAccessToken: props.getAccessToken,\n    onUnauthorized: props.logout\n  });\n}\n`
    },
    {
      path: "apps/app/src/styles/main.css",
      content: `@import "antd/dist/reset.css";\n\n:root {\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: #172033;\n  background: #f6f8fb;\n}\n\nbody {\n  margin: 0;\n}\n\n.full-width {\n  width: 100%;\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}\n\n.app-header .tsu-logo {\n  color: #fff;\n}\n\n.app-header .tsu-logo small {\n  color: #dbeafe !important;\n}\n\n.app-nav {\n  display: flex;\n  gap: 16px;\n}\n\n.app-nav a {\n  color: #dbeafe;\n  text-decoration: none;\n}\n\n.app-content {\n  padding: 32px;\n}\n`
    },
    {
      path: "apps/app/src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n\ninterface Window {\n  __POWERED_BY_QIANKUN__?: boolean;\n}\n`
    },
    ...createReactSharedPackageFiles(),
    ...createReactUiPackageFiles(),
    ...createReactApiPackageFiles()
  ];
}

function createMfeAppReadme(packageName: string) {
  return `# ${packageName}

Generated by Tsu from the \`mfe-app\` template.

This is the Phase 4 React qiankun sub application skeleton. It runs independently, exposes qiankun lifecycle placeholders, and includes reusable workspace packages for shared contracts, UI primitives, and API requests. Later phases add richer business routes, lifecycle tests, Docker, and CI/CD.

## Tech Stack

- React
- TypeScript
- Vite
- qiankun lifecycle placeholders
- React Router
- Zustand
- TanStack Query
- Ant Design
- pnpm workspace
- Turbo

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

The sub application runs on http://localhost:7201 in standalone mode.

## Scripts

| Script | Description |
| --- | --- |
| \`pnpm dev\` | Start the React sub application |
| \`pnpm lint\` | Run TypeScript no-emit checks |
| \`pnpm test\` | Run generated package unit tests |
| \`pnpm build\` | Build the workspace through Turbo |

## Project Structure

| Path | Purpose |
| --- | --- |
| \`apps/app/src/main.tsx\` | Standalone bootstrap and qiankun lifecycle exports |
| \`apps/app/src/bootstrap.tsx\` | Shared render and destroy boundary |
| \`apps/app/src/qiankun.ts\` | bootstrap, mount, and unmount placeholders using shared props |
| \`apps/app/src/App.tsx\` | Business application shell |
| \`apps/app/src/services/api-client.ts\` | Sub-app API client factory using optional host props |
| \`packages/shared/src/index.ts\` | Shared auth, micro-app, route, and utility contracts |
| \`packages/ui/src/index.tsx\` | Shared React UI primitives: Logo, PageContainer, EmptyState, ErrorState |
| \`packages/api/src/index.ts\` | Generic fetch-based API client |

## Shared Workspace Packages

- \`@tsuz/shared\` owns reusable types, constants, and utilities, including the shared \`MicroAppProps\` mount contract.
- \`@tsuz/ui\` exposes small React UI primitives used by generated host and sub app templates.
- \`@tsuz/api\` exposes \`createApiClient\`, a generic request wrapper that can read auth tokens from qiankun mount props.

The app consumes these packages via \`workspace:*\` dependencies plus source aliases in \`apps/app/tsconfig.json\` and \`apps/app/vite.config.ts\`, so local development does not require prebuilding packages.

## qiankun Integration

When mounted by a host, \`apps/app/src/qiankun.ts\` accepts \`Partial<MicroAppProps>\` from \`@tsuz/shared\`. The generated \`createMfeApiClient\` helper uses those props to configure API base URL, access-token injection, and unauthorized handling without hard-coding host behavior.

## Phase Roadmap

- Phase 5 wires richer qiankun lifecycle behavior, business home pages, state, queries, and tests.
- Later phases add Playwright, Docker, CI, deploy, and documentation.
`;
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
