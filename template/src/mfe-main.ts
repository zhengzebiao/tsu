export interface TemplateFile {
  path: string;
  content: string;
}

export function createMfeMainTemplateFiles(packageName: string): TemplateFile[] {
  const appPackageName = `${packageName}-main`;

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
      content: createMfeMainReadme(packageName)
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
          preview: "vite preview --port 7200"
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
      path: "apps/main/index.html",
      content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
    },
    {
      path: "apps/main/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 7200,\n    strictPort: true\n  },\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  }\n});\n`
    },
    {
      path: "apps/main/tsconfig.json",
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
      path: "apps/main/src/main.tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { BrowserRouter } from "react-router-dom";\nimport App from "./App";\nimport "./styles/main.css";\n\nconst queryClient = new QueryClient();\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <QueryClientProvider client={queryClient}>\n      <BrowserRouter>\n        <App />\n      </BrowserRouter>\n    </QueryClientProvider>\n  </StrictMode>\n);\n`
    },
    {
      path: "apps/main/src/App.tsx",
      content: `import { Card, Layout, List, Typography } from "antd";\nimport { Link, Route, Routes } from "react-router-dom";\nimport { create } from "zustand";\n\nconst { Header, Content } = Layout;\nconst projectName = "${packageName}";\n\ninterface ShellState {\n  selectedApp: string;\n  selectApp: (name: string) => void;\n}\n\nconst useShellStore = create<ShellState>((set) => ({\n  selectedApp: "mfe-app",\n  selectApp: (name) => set({ selectedApp: name })\n}));\n\nconst roadmapItems = [\n  "Phase 2: expand the React host skeleton",\n  "Phase 3: register qiankun apps and pass auth props",\n  "Phase 4: introduce shared, ui, and api packages"\n];\n\nexport default function App() {\n  const selectedApp = useShellStore((state) => state.selectedApp);\n\n  return (\n    <Layout className="app-shell">\n      <Header className="app-header">\n        <Typography.Title className="app-title" level={3}>\n          {projectName}\n        </Typography.Title>\n        <nav className="app-nav">\n          <Link to="/">Host shell</Link>\n          <Link to="/apps">Micro apps</Link>\n        </nav>\n      </Header>\n      <Content className="app-content">\n        <Routes>\n          <Route\n            path="/"\n            element={\n              <Card title="React qiankun host shell starter">\n                <Typography.Paragraph>\n                  Generated by Tsu from the <code>mfe-main</code> template. This Phase 1 skeleton reserves\n                  the host shell boundary without implementing auth or qiankun registration yet.\n                </Typography.Paragraph>\n                <List bordered dataSource={roadmapItems} renderItem={(item) => <List.Item>{item}</List.Item>} />\n              </Card>\n            }\n          />\n          <Route\n            path="/apps"\n            element={\n              <Card title="Sub application outlet">\n                <Typography.Paragraph>Selected app: {selectedApp}</Typography.Paragraph>\n                <div id="subapp-container" className="subapp-container">\n                  qiankun will mount sub applications here in Phase 3.\n                </div>\n              </Card>\n            }\n          />\n        </Routes>\n      </Content>\n    </Layout>\n  );\n}\n`
    },
    {
      path: "apps/main/src/styles/main.css",
      content: `@import "antd/dist/reset.css";\n\n:root {\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: #172033;\n  background: #f5f7fb;\n}\n\nbody {\n  margin: 0;\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}\n\n.app-title {\n  margin: 0 !important;\n  color: #fff !important;\n}\n\n.app-nav {\n  display: flex;\n  gap: 16px;\n}\n\n.app-nav a {\n  color: #dbeafe;\n  text-decoration: none;\n}\n\n.app-content {\n  padding: 32px;\n}\n\n.subapp-container {\n  min-height: 240px;\n  display: grid;\n  place-items: center;\n  border: 1px dashed #91caff;\n  border-radius: 12px;\n  background: #f0f7ff;\n  color: #31506f;\n}\n`
    },
    {
      path: "apps/main/src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n`
    }
  ];
}

function createMfeMainReadme(packageName: string) {
  return `# ${packageName}

Generated by Tsu from the \`mfe-main\` template.

This is the Phase 1 React qiankun host shell skeleton. It registers the template shape and reserves the main application boundary. Later phases add auth state, real qiankun registration, shared packages, tests, Docker, and CI/CD.

## Tech Stack

- React
- TypeScript
- Vite
- qiankun
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

The host application runs on http://localhost:7200.

## Scripts

| Script | Description |
| --- | --- |
| \`pnpm dev\` | Start the React host shell |
| \`pnpm lint\` | Run TypeScript no-emit checks |
| \`pnpm build\` | Build the workspace through Turbo |

## Project Structure

| Path | Purpose |
| --- | --- |
| \`apps/main/src/main.tsx\` | React host bootstrap |
| \`apps/main/src/App.tsx\` | Host shell and qiankun outlet placeholder |
| \`apps/main/src/styles/main.css\` | Phase 1 host shell styles |
| \`turbo.json\` | Workspace build and lint pipeline |

## Phase Roadmap

- Phase 2 expands the main application skeleton.
- Phase 3 adds auth state and qiankun registration.
- Phase 4 adds shared, ui, and api workspace packages.
- Later phases add tests, Docker, CI, deploy, and documentation.
`;
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
