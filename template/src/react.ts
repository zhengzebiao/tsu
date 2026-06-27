export interface TemplateFile {
  path: string;
  content: string;
}

export function createReactTemplateFiles(packageName: string): TemplateFile[] {
  return [
    {
      path: "package.json",
      content: packageJson({
        name: packageName,
        version: "0.0.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc -p tsconfig.json --noEmit && vite build",
          preview: "vite preview",
          lint: "eslint . --max-warnings 0 && tsc -p tsconfig.json --noEmit",
          "docker:build": `docker build -t ${packageName} .`,
          "docker:run": `docker run --rm -p 8080:80 ${packageName}`
        },
        dependencies: {
          "@tsuz/components": "^0.2.0",
          "@tsuz/sdk": "^0.2.0",
          "@tsuz/utils": "^0.2.0",
          "@vitejs/plugin-react": "^4.3.4",
          react: "^19.1.0",
          "react-dom": "^19.1.0",
          "react-router-dom": "^7.6.2"
        },
        devDependencies: {
          "@eslint/js": "^9.21.0",
          "@types/node": "^20.17.57",
          "@types/react": "^19.0.10",
          "@types/react-dom": "^19.0.4",
          eslint: "^9.21.0",
          "eslint-plugin-react-hooks": "^5.2.0",
          "eslint-plugin-react-refresh": "^0.4.19",
          globals: "^16.0.0",
          "typescript-eslint": "^8.26.1",
          typescript: "^5.8.3",
          vite: "^6.2.0"
        }
      })
    },
    {
      path: "README.md",
      content: createTemplateReadme({
        projectName: packageName,
        templateName: "react",
        techStack: ["React", "Vite", "TypeScript", "React Router", "ESLint", "Docker", "GitHub Actions"],
        gettingStarted: ["pnpm install", "pnpm dev"],
        scripts: [
          ["dev", "Start the Vite development server"],
          ["lint", "Run ESLint and TypeScript checks"],
          ["build", "Type-check and build production assets"],
          ["preview", "Preview the production build"],
          ["docker:build", "Build the nginx production image"],
          ["docker:run", "Run the production image on port 8080"]
        ],
        projectStructure: [
          ["src/main.tsx", "React application bootstrap"],
          ["src/App.tsx", "Application routes and shell"],
          ["src/hooks/useDashboardSummary.ts", "Dashboard data, loading, and error state hook"],
          ["src/views/HomeView.tsx", "Dashboard starter view using Tsu packages"],
          ["src/views/AboutView.tsx", "About route view"],
          ["src/styles/", "Base and application styles"],
          [".github/workflows/ci.yml", "Install, lint, and build workflow"],
          ["Dockerfile", "Production container build"]
        ],
        deployment: ["Run pnpm build to create dist/.", "Use docker:build for an nginx-based production image.", "nginx.conf includes a React Router history fallback through try_files."],
        extraSections: [
          {
            title: "Sample Dashboard Flow",
            body: [
              "HomeView renders the starter dashboard and delegates data loading to the dashboard summary hook.",
              "src/hooks/useDashboardSummary.ts owns the summary data, loading state, and error message.",
              "The hook uses @tsuz/sdk with a mock adapter so the template works without a backend.",
              "@tsuz/components/react renders loading, error, empty, and content states.",
              "@tsuz/utils/js normalizes unknown errors into displayable messages."
            ]
          },
          {
            title: "Replacing the Mock API",
            body: [
              "Open src/hooks/useDashboardSummary.ts and replace the createClient mock adapter with your real API configuration.",
              "Keep the hook boundary so views stay focused on rendering and user interactions.",
              "Update the DashboardSummary interface when your API shape changes."
            ]
          },
          {
            title: "Adding Pages",
            body: [
              "Create a new view under src/views.",
              "Register the route in src/App.tsx.",
              "Add navigation in the app header when the route should be user-visible."
            ]
          }
        ],
        faq: [
          ["How does the sample business loop work?", "HomeView renders the page, the dashboard summary hook owns loading/error/content state, @tsuz/sdk simulates data loading, and Tsu components render loading/error/empty/content states."],
          ["How do I add pages?", "Add a view in src/views and register it in src/App.tsx."],
          ["How do I replace the sample data?", "Replace the mock adapter in src/hooks/useDashboardSummary.ts with your real API endpoint."],
          ["Can I remove Docker?", "Yes. Delete Dockerfile, nginx.conf, .dockerignore, and the docker scripts."]
        ]
      })
    },
    {
      path: "pnpm-workspace.yaml",
      content: `packages: []\n`
    },
    {
      path: ".dockerignore",
      content: `node_modules\ndist\n.git\n.github\n.turbo\n*.log\n*.local\n`
    },
    {
      path: ".gitignore",
      content: `node_modules/\ndist/\n*.local\n`
    },
    {
      path: "Dockerfile",
      content: `FROM node:20-alpine AS build\nWORKDIR /app\n\nRUN corepack enable\n\nCOPY package.json pnpm-lock.yaml* ./\nRUN pnpm install --frozen-lockfile\n\nCOPY . .\nRUN pnpm build\n\nFROM nginx:1.27-alpine\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\nCOPY --from=build /app/dist /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]\n`
    },
    {
      path: "nginx.conf",
      content: `server {\n  listen 80;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n\n  location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {\n    expires 1y;\n    add_header Cache-Control "public, immutable";\n  }\n}\n`
    },
    {
      path: ".github/workflows/ci.yml",
      content: `name: CI\n\non:\n  pull_request:\n    branches:\n      - master\n  push:\n    branches:\n      - master\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n        with:\n          version: 8.15.9\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm lint\n      - run: pnpm build\n`
    },
    {
      path: "index.html",
      content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
    },
    {
      path: "vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  }\n});\n`
    },
    {
      path: "eslint.config.js",
      content: `import js from "@eslint/js";\nimport globals from "globals";\nimport tseslint from "typescript-eslint";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport reactRefresh from "eslint-plugin-react-refresh";\n\nexport default tseslint.config(\n  {\n    ignores: ["dist", "coverage"]\n  },\n  js.configs.recommended,\n  ...tseslint.configs.recommended,\n  {\n    files: ["**/*.{ts,tsx}"],\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: globals.browser\n    },\n    plugins: {\n      "react-hooks": reactHooks,\n      "react-refresh": reactRefresh\n    },\n    rules: {\n      ...reactHooks.configs.recommended.rules,\n      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]\n    }\n  }\n);\n`
    },
    {
      path: "tsconfig.json",
      content: packageJson({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          module: "ESNext",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          skipLibCheck: true,
          moduleResolution: "Bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          jsx: "react-jsx",
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"]
          }
        },
        include: ["vite.config.ts", "src/**/*.ts", "src/**/*.tsx"]
      })
    },
    {
      path: "tsconfig.app.json",
      content: packageJson({
        extends: "./tsconfig.json",
        compilerOptions: {
          noEmit: true
        },
        include: ["src/**/*.ts", "src/**/*.tsx"]
      })
    },
    {
      path: "src/main.tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport { BrowserRouter } from "react-router-dom";\nimport App from "./App";\nimport "./styles/main.css";\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <BrowserRouter>\n      <App />\n    </BrowserRouter>\n  </StrictMode>\n);\n`
    },
    {
      path: "src/App.tsx",
      content: `import { NavLink, Route, Routes } from "react-router-dom";\nimport { AboutView } from "./views/AboutView";\nimport { HomeView } from "./views/HomeView";\n\nconst projectName = "${packageName}";\n\nexport default function App() {\n  return (\n    <div className="app-shell">\n      <header className="app-header">\n        <div>\n          <p className="app-intro">React + Router + Vite</p>\n          <h1>{projectName}</h1>\n        </div>\n        <nav className="app-nav">\n          <NavLink to="/">Home</NavLink>\n          <NavLink to="/about">About</NavLink>\n        </nav>\n      </header>\n\n      <Routes>\n        <Route path="/" element={<HomeView projectName={projectName} />} />\n        <Route path="/about" element={<AboutView />} />\n      </Routes>\n    </div>\n  );\n}\n`
    },
    {
      path: "src/styles/base.css",
      content: `:root {\n  color-scheme: light;\n  font-family: system-ui, sans-serif;\n  background: #f8fafc;\n  color: #0f172a;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nhtml,\nbody,\n#root {\n  min-height: 100%;\n}\n\nbody {\n  margin: 0;\n}\n\na {\n  color: inherit;\n}\n`
    },
    {
      path: "src/styles/main.css",
      content: `@import "./base.css";\n\nbody {\n  min-height: 100vh;\n}\n\n.app-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 2rem;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.app-intro {\n  margin: 0 0 0.5rem;\n  color: #475569;\n  font-size: 0.875rem;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.app-nav {\n  display: flex;\n  gap: 1rem;\n}\n\n.app-nav a {\n  color: #0f172a;\n  text-decoration: none;\n}\n\n.app-nav a.active {\n  color: #2563eb;\n}\n\n.about-view {\n  display: grid;\n  gap: 0.75rem;\n  max-width: 32rem;\n}\n\n.tsu-page-container {\n  display: grid;\n  gap: 1.5rem;\n}\n\n.tsu-page-container__header {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.tsu-page-container__title {\n  margin: 0;\n}\n\n.tsu-page-container__description,\n.tsu-state__description {\n  margin: 0.5rem 0 0;\n  color: #475569;\n}\n\n.tsu-page-container__actions,\n.tsu-state__actions {\n  display: flex;\n  gap: 0.75rem;\n}\n\n.tsu-state {\n  padding: 1rem;\n  border: 1px solid #e2e8f0;\n  border-radius: 0.5rem;\n  background: white;\n}\n\n.tsu-state__title {\n  color: #0f172a;\n}\n\n.tsu-state__button {\n  margin-top: 0.75rem;\n  padding: 0.5rem 0.875rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n\n.summary-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));\n  gap: 1rem;\n}\n\n.summary-card {\n  display: grid;\n  gap: 0.5rem;\n  padding: 1rem;\n  border: 1px solid #e2e8f0;\n  border-radius: 0.5rem;\n  background: white;\n}\n\n.summary-card span {\n  color: #475569;\n  font-size: 0.875rem;\n}\n\n.summary-card strong {\n  color: #0f172a;\n  font-size: 1.5rem;\n}\n\n.home-view__button {\n  width: fit-content;\n  padding: 0.625rem 1rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n\n.home-view__button--muted {\n  background: #475569;\n}\n\n.home-view__button--secondary {\n  background: #64748b;\n}\n`
    },
    {
      path: "src/hooks/useDashboardSummary.ts",
      content: `import { useCallback, useEffect, useMemo, useState } from "react";\nimport { createClient } from "@tsuz/sdk";\nimport { sleep, toErrorMessage } from "@tsuz/utils/js";\n\nexport interface DashboardSummary {\n  id: number;\n  label: string;\n  value: string;\n}\n\nexport type DashboardSummaryMode = "success" | "empty" | "error";\n\nexport function useDashboardSummary() {\n  const [summaries, setSummaries] = useState<DashboardSummary[]>([]);\n  const [isLoading, setIsLoading] = useState(true);\n  const [errorMessage, setErrorMessage] = useState("");\n  const api = useMemo(\n    () =>\n      createClient({\n        baseUrl: "https://example.tsu.local",\n        async adapter({ path }) {\n          await sleep(250);\n\n          if (path === "/dashboard/summary?fail=true") {\n            throw new Error("Mock request failed. Replace the adapter with your API when ready.");\n          }\n\n          if (path === "/dashboard/summary?empty=true") {\n            return [];\n          }\n\n          return [\n            { id: 1, label: "Open tasks", value: "12" },\n            { id: 2, label: "Deployments", value: "3" },\n            { id: 3, label: "Template", value: "React" }\n          ];\n        }\n      }),\n    []\n  );\n\n  const loadSummary = useCallback(\n    async (mode: DashboardSummaryMode = "success") => {\n      setIsLoading(true);\n      setErrorMessage("");\n\n      const pathByMode: Record<DashboardSummaryMode, string> = {\n        success: "/dashboard/summary",\n        empty: "/dashboard/summary?empty=true",\n        error: "/dashboard/summary?fail=true"\n      };\n\n      try {\n        setSummaries(await api.get<DashboardSummary[]>(pathByMode[mode]));\n      } catch (error: unknown) {\n        setSummaries([]);\n        setErrorMessage(toErrorMessage(error));\n      } finally {\n        setIsLoading(false);\n      }\n    },\n    [api]\n  );\n\n  useEffect(() => {\n    void loadSummary();\n  }, [loadSummary]);\n\n  return {\n    summaries,\n    isLoading,\n    errorMessage,\n    hasSummaries: summaries.length > 0,\n    loadSummary\n  };\n}\n`
    },
    {
      path: "src/views/HomeView.tsx",
      content: `import { EmptyState, ErrorState, LoadingState, PageContainer } from "@tsuz/components/react";\nimport { useDashboardSummary } from "@/hooks/useDashboardSummary";\n\ninterface HomeViewProps {\n  projectName: string;\n}\n\nexport function HomeView({ projectName }: HomeViewProps) {\n  const { summaries, isLoading, errorMessage, hasSummaries, loadSummary } = useDashboardSummary();\n\n  return (\n    <PageContainer\n      title="Dashboard starter"\n      description={projectName + " uses Tsu components, utils, SDK, and a hook in one replaceable example."}\n      actions={\n        <>\n          <button className="home-view__button" type="button" onClick={() => void loadSummary("success")}>\n            Reload\n          </button>\n          <button className="home-view__button home-view__button--muted" type="button" onClick={() => void loadSummary("empty")}>\n            Show empty\n          </button>\n          <button className="home-view__button home-view__button--secondary" type="button" onClick={() => void loadSummary("error")}>\n            Show error\n          </button>\n        </>\n      }\n    >\n      {isLoading ? <LoadingState label="Loading dashboard summary..." /> : null}\n      {!isLoading && errorMessage ? <ErrorState message={errorMessage} actions={["Retry"]} onAction={() => void loadSummary("success")} /> : null}\n      {!isLoading && !errorMessage && !hasSummaries ? (\n        <EmptyState title="No summary data" description="Connect your API client to show real metrics." />\n      ) : null}\n      {!isLoading && !errorMessage && hasSummaries ? (\n        <div className="summary-grid">\n          {summaries.map((item) => (\n            <article className="summary-card" key={item.id}>\n              <span>{item.label}</span>\n              <strong>{item.value}</strong>\n            </article>\n          ))}\n        </div>\n      ) : null}\n    </PageContainer>\n  );\n}\n`
    },
    {
      path: "src/views/AboutView.tsx",
      content: `export function AboutView() {\n  return (\n    <section className="about-view">\n      <h2>About</h2>\n      <p>This React starter includes routing, TypeScript, CI, and Docker out of the box.</p>\n    </section>\n  );\n}\n`
    },
    {
      path: "src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n`
    }
  ];
}

interface TemplateReadmeOptions {
  projectName: string;
  templateName: string;
  techStack: string[];
  gettingStarted: string[];
  scripts: [string, string][];
  projectStructure: [string, string][];
  deployment: string[];
  faq: [string, string][];
  extraSections?: Array<{ title: string; body: string[] }>;
}

function createTemplateReadme(options: TemplateReadmeOptions) {
  return `# ${options.projectName}

Generated by Tsu from the \`${options.templateName}\` template.

## Tech Stack

${markdownList(options.techStack)}

## Getting Started

\`\`\`bash
${options.gettingStarted.join("\n")}
\`\`\`

## Scripts

${markdownTable(["Script", "Description"], options.scripts.map(([script, description]) => [`\`pnpm ${script}\``, description]))}

## Project Structure

${markdownTable(["Path", "Purpose"], options.projectStructure.map(([path, purpose]) => [`\`${path}\``, purpose]))}

## Deployment

${markdownList(options.deployment)}

${options.extraSections?.map((section) => `## ${section.title}\n\n${markdownList(section.body)}`).join("\n\n") ?? ""}

## FAQ

${options.faq.map(([question, answer]) => `### ${question}\n\n${answer}`).join("\n\n")}
`;
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function markdownTable(headers: [string, string], rows: [string, string][]) {
  return [`| ${headers[0]} | ${headers[1]} |`, "| --- | --- |", ...rows.map(([first, second]) => `| ${first} | ${second} |`)].join("\n");
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
