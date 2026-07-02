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
          lint: "turbo run lint"
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
      content: `packages:\n  - "apps/*"\n`
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
      content: `node_modules/\ndist/\n.turbo/\n*.local\n*.log\n`
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
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 7201,\n    strictPort: true,\n    headers: {\n      "Access-Control-Allow-Origin": "*"\n    }\n  },\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  }\n});\n`
    },
    {
      path: "apps/app/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"]
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
      content: `import { StrictMode } from "react";\nimport { createRoot, type Root } from "react-dom/client";\nimport { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { BrowserRouter } from "react-router-dom";\nimport App from "./App";\nimport type { MfeAppProps } from "./qiankun";\n\nlet root: Root | undefined;\nconst queryClient = new QueryClient();\n\nexport function render(props: MfeAppProps = {}) {\n  const container = props.container?.querySelector("#root") ?? document.getElementById("root");\n\n  if (!container) {\n    throw new Error("Missing #root container for mfe-app.");\n  }\n\n  root = createRoot(container);\n  root.render(\n    <StrictMode>\n      <QueryClientProvider client={queryClient}>\n        <BrowserRouter basename={props.basename ?? "/"}>\n          <App appName={props.appName ?? "mfe-app"} />\n        </BrowserRouter>\n      </QueryClientProvider>\n    </StrictMode>\n  );\n}\n\nexport function destroy() {\n  root?.unmount();\n  root = undefined;\n}\n`
    },
    {
      path: "apps/app/src/qiankun.ts",
      content: `import { destroy, render } from "./bootstrap";\n\nexport interface MfeAppProps {\n  appName?: string;\n  basename?: string;\n  container?: HTMLElement;\n  apiBaseUrl?: string;\n  getAccessToken?: () => string | undefined;\n  getCurrentUser?: () => unknown;\n  logout?: () => void;\n}\n\nexport async function bootstrap() {\n  // Phase 5 will initialize app-level resources here.\n}\n\nexport async function mount(props: MfeAppProps) {\n  render(props);\n}\n\nexport async function unmount() {\n  destroy();\n}\n`
    },
    {
      path: "apps/app/src/App.tsx",
      content: `import { Card, Layout, Space, Tag, Typography } from "antd";\nimport { Link, Route, Routes } from "react-router-dom";\nimport { create } from "zustand";\n\nconst { Header, Content } = Layout;\n\ninterface AppState {\n  lastMountedBy: string;\n  setLastMountedBy: (source: string) => void;\n}\n\nconst useAppStore = create<AppState>((set) => ({\n  lastMountedBy: window.__POWERED_BY_QIANKUN__ ? "qiankun host" : "standalone mode",\n  setLastMountedBy: (source) => set({ lastMountedBy: source })\n}));\n\ninterface AppProps {\n  appName: string;\n}\n\nexport default function App({ appName }: AppProps) {\n  const lastMountedBy = useAppStore((state) => state.lastMountedBy);\n\n  return (\n    <Layout className="app-shell">\n      <Header className="app-header">\n        <Typography.Title className="app-title" level={3}>\n          {appName}\n        </Typography.Title>\n        <nav className="app-nav">\n          <Link to="/">Business home</Link>\n          <Link to="/about">About</Link>\n        </nav>\n      </Header>\n      <Content className="app-content">\n        <Routes>\n          <Route\n            path="/"\n            element={\n              <Card title="React qiankun sub application starter">\n                <Space direction="vertical" size="middle">\n                  <Typography.Paragraph>\n                    Generated by Tsu from the <code>mfe-app</code> template. This Phase 1 skeleton can run\n                    independently and exposes qiankun lifecycle placeholders for Phase 5.\n                  </Typography.Paragraph>\n                  <Space>\n                    <Tag color="blue">React</Tag>\n                    <Tag color="purple">qiankun</Tag>\n                    <Tag color="green">Phase 1 skeleton</Tag>\n                  </Space>\n                  <Typography.Text>Mounted by: {lastMountedBy}</Typography.Text>\n                </Space>\n              </Card>\n            }\n          />\n          <Route\n            path="/about"\n            element={\n              <Card title="Integration notes">\n                <Typography.Paragraph>\n                  Phase 5 will wire real mount props, auth context, API clients, and business routes.\n                </Typography.Paragraph>\n              </Card>\n            }\n          />\n        </Routes>\n      </Content>\n    </Layout>\n  );\n}\n`
    },
    {
      path: "apps/app/src/styles/main.css",
      content: `@import "antd/dist/reset.css";\n\n:root {\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: #172033;\n  background: #f6f8fb;\n}\n\nbody {\n  margin: 0;\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}\n\n.app-title {\n  margin: 0 !important;\n  color: #fff !important;\n}\n\n.app-nav {\n  display: flex;\n  gap: 16px;\n}\n\n.app-nav a {\n  color: #dbeafe;\n  text-decoration: none;\n}\n\n.app-content {\n  padding: 32px;\n}\n`
    },
    {
      path: "apps/app/src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n\ninterface Window {\n  __POWERED_BY_QIANKUN__?: boolean;\n}\n`
    }
  ];
}

function createMfeAppReadme(packageName: string) {
  return `# ${packageName}

Generated by Tsu from the \`mfe-app\` template.

This is the Phase 1 React qiankun sub application skeleton. It runs independently and exposes lifecycle placeholders for later qiankun integration. Later phases add business routes, auth props, shared packages, tests, Docker, and CI/CD.

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
| \`pnpm build\` | Build the workspace through Turbo |

## Project Structure

| Path | Purpose |
| --- | --- |
| \`apps/app/src/main.tsx\` | Standalone bootstrap and qiankun lifecycle exports |
| \`apps/app/src/bootstrap.tsx\` | Shared render and destroy boundary |
| \`apps/app/src/qiankun.ts\` | bootstrap, mount, and unmount placeholders |
| \`apps/app/src/App.tsx\` | Business application shell |

## Phase Roadmap

- Phase 5 wires full qiankun mount/unmount behavior.
- Phase 5 adds business home pages, state, queries, and tests.
- Later phases add Playwright, Docker, CI, deploy, and documentation.
`;
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
