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
      content: `@import "./base.css";\n\nbody {\n  min-height: 100vh;\n}\n\n.app-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 2rem;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.app-intro,\n.home-view__eyebrow {\n  margin: 0 0 0.5rem;\n  color: #475569;\n  font-size: 0.875rem;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.app-nav,\n.home-view__actions {\n  display: flex;\n  gap: 1rem;\n}\n\n.app-nav a {\n  color: #0f172a;\n  text-decoration: none;\n}\n\n.app-nav a.active {\n  color: #2563eb;\n}\n\n.home-view,\n.about-view {\n  display: grid;\n  gap: 0.75rem;\n  max-width: 32rem;\n}\n\n.home-view__button {\n  width: fit-content;\n  padding: 0.625rem 1rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n\n.home-view__button--secondary {\n  background: #64748b;\n}\n`
    },
    {
      path: "src/views/HomeView.tsx",
      content: `import { useState } from "react";\n\ninterface HomeViewProps {\n  projectName: string;\n}\n\nexport function HomeView({ projectName }: HomeViewProps) {\n  const [count, setCount] = useState(0);\n\n  return (\n    <section className="home-view">\n      <p className="home-view__eyebrow">React + Router + Vite</p>\n      <h2>Welcome to {projectName}</h2>\n      <p>Current count: {count}</p>\n      <p>Double count: {count * 2}</p>\n      <div className="home-view__actions">\n        <button className="home-view__button" type="button" onClick={() => setCount((value) => value + 1)}>\n          Increment\n        </button>\n        <button className="home-view__button home-view__button--secondary" type="button" onClick={() => setCount(0)}>\n          Reset\n        </button>\n      </div>\n    </section>\n  );\n}\n`
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

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
