export interface TemplateFile {
  path: string;
  content: string;
}

export function createVue3TemplateFiles(packageName: string): TemplateFile[] {
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
          build: "vue-tsc --noEmit && vite build",
          preview: "vite preview",
          lint: "eslint . --max-warnings 0 && vue-tsc --noEmit",
          test: "vitest run",
          "docker:build": `docker build -t ${packageName} .`,
          "docker:run": `docker run --rm -p 8080:80 ${packageName}`
        },
        dependencies: {
          "@tsuz/components": "^0.2.0",
          "@tsuz/sdk": "^0.2.0",
          "@tsuz/utils": "^0.2.0",
          pinia: "^3.0.1",
          "vue-router": "^4.5.1",
          vue: "^3.5.13"
        },
        devDependencies: {
          "@eslint/js": "^9.21.0",
          "@types/node": "^20.17.57",
          "@vitejs/plugin-vue": "^5.2.1",
          "@vue/test-utils": "^2.4.6",
          eslint: "^9.21.0",
          "eslint-plugin-vue": "^9.32.0",
          globals: "^16.0.0",
          jsdom: "^26.0.0",
          "typescript-eslint": "^8.26.1",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          vitest: "^3.0.5",
          "vue-tsc": "^2.2.8"
        }
      })
    },
    {
      path: "README.md",
      content: createTemplateReadme({
        projectName: packageName,
        templateName: "vue3",
        techStack: ["Vue 3", "Vite", "TypeScript", "Vue Router", "Pinia", "Vitest", "ESLint", "Docker", "GitHub Actions"],
        gettingStarted: ["pnpm install", "pnpm dev"],
        scripts: [
          ["dev", "Start the Vite development server"],
          ["lint", "Run ESLint and vue-tsc checks"],
          ["test", "Run the Vitest store and view tests"],
          ["build", "Type-check and build production assets"],
          ["preview", "Preview the production build"],
          ["docker:build", "Build the nginx production image"],
          ["docker:run", "Run the production image on port 8080"]
        ],
        projectStructure: [
          ["src/main.ts", "Vue application bootstrap"],
          ["src/router/index.ts", "Route definitions"],
          ["src/stores/dashboard.ts", "Pinia dashboard data, loading, and error state"],
          ["src/stores/dashboard.test.ts", "Store-level tests for the sample dashboard flow"],
          ["src/views/HomeView.vue", "Dashboard starter view using Tsu packages"],
          ["src/views/HomeView.test.ts", "View smoke test"],
          ["src/styles/", "Global app and Tsu component styles"],
          [".github/workflows/ci.yml", "Install, lint, test, and build workflow"],
          ["Dockerfile", "Production container build"]
        ],
        deployment: ["Run pnpm build to create dist/.", "Use docker:build for an nginx-based production image.", "nginx.conf includes a Vue Router history fallback through try_files."],
        extraSections: [
          {
            title: "Sample Dashboard Flow",
            body: [
              "HomeView renders the starter dashboard and delegates data loading to the Pinia dashboard store.",
              "src/stores/dashboard.ts owns the summary data, loading state, and error message.",
              "The store uses @tsuz/sdk with a mock adapter so the template works without a backend.",
              "@tsuz/components/vue renders loading, error, empty, and content states.",
              "@tsuz/utils/js normalizes unknown errors into displayable messages."
            ]
          },
          {
            title: "Replacing the Mock API",
            body: [
              "Open src/stores/dashboard.ts and replace the createClient mock adapter with your real API configuration.",
              "Keep the store action boundary so views stay focused on rendering and user interactions.",
              "Update src/stores/dashboard.test.ts with the expected success and failure cases for your API."
            ]
          },
          {
            title: "Adding Routes",
            body: [
              "Create a new view under src/views.",
              "Register the route in src/router/index.ts.",
              "Add navigation in src/App.vue when the route should be user-visible."
            ]
          },
          {
            title: "Testing",
            body: [
              "Run pnpm test to execute Vitest tests.",
              "Use store tests for business state and view tests for rendering contracts.",
              "Keep mock API behavior close to the store so tests stay deterministic."
            ]
          }
        ],
        faq: [
          ["How does the sample business loop work?", "HomeView renders the page, the Pinia store owns the dashboard state, @tsuz/sdk simulates data loading, and Tsu components render loading/error/empty/content states."],
          ["How do I add pages?", "Add a view in src/views and register it in src/router/index.ts."],
          ["How do I replace the sample data?", "Replace the mock adapter in src/stores/dashboard.ts with your real API endpoint."],
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
      content: `name: CI\n\non:\n  pull_request:\n    branches:\n      - master\n  push:\n    branches:\n      - master\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n        with:\n          version: 8.15.9\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm lint\n      - run: pnpm test\n      - run: pnpm build\n`
    },
    {
      path: "index.html",
      content: `<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>\n`
    },
    {
      path: "vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport vue from "@vitejs/plugin-vue";\nimport { defineConfig } from "vitest/config";\n\nexport default defineConfig({\n  plugins: [vue()],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  },\n  test: {\n    environment: "jsdom"\n  }\n});\n`
    },
    {
      path: "eslint.config.js",
      content: `import js from "@eslint/js";\nimport globals from "globals";\nimport tseslint from "typescript-eslint";\nimport pluginVue from "eslint-plugin-vue";\n\nexport default tseslint.config(\n  {\n    ignores: ["dist", "coverage"]\n  },\n  js.configs.recommended,\n  ...tseslint.configs.recommended,\n  ...pluginVue.configs["flat/recommended"],\n  {\n    files: ["**/*.{ts,vue}"],\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: {\n        ...globals.browser,\n        ...globals.node\n      },\n      parserOptions: {\n        parser: tseslint.parser\n      }\n    },\n    rules: {\n      "vue/max-attributes-per-line": "off",\n      "vue/multi-word-component-names": "off",\n      "vue/singleline-html-element-content-newline": "off"\n    }\n  }\n);\n`
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
          jsx: "preserve",
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"]
          },
          types: ["vitest/importMeta"]
        },
        include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
      })
    },
    {
      path: "tsconfig.app.json",
      content: packageJson({
        extends: "./tsconfig.json",
        compilerOptions: {
          noEmit: true
        },
        include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
      })
    },
    {
      path: "src/env.d.ts",
      content: `/// <reference types="vite/client" />\ndeclare module "*.vue" {\n  import type { DefineComponent } from "vue";\n\n  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;\n  export default component;\n}\n`
    },
    {
      path: "src/styles/base.css",
      content: `:root {\n  color-scheme: light;\n  font-family: system-ui, sans-serif;\n  background: #f8fafc;\n  color: #0f172a;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nhtml,\nbody,\n#app {\n  min-height: 100%;\n}\n\nbody {\n  margin: 0;\n}\n\na {\n  color: inherit;\n}\n`
    },
    {
      path: "src/styles/main.css",
      content: `@import "./base.css";\n\nbody {\n  min-height: 100vh;\n}\n\n.tsu-page-container {\n  display: grid;\n  gap: 1.5rem;\n}\n\n.tsu-page-container__header {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.tsu-page-container__title {\n  margin: 0;\n}\n\n.tsu-page-container__description,\n.tsu-state__description {\n  margin: 0.5rem 0 0;\n  color: #475569;\n}\n\n.tsu-page-container__actions,\n.tsu-state__actions {\n  display: flex;\n  gap: 0.75rem;\n}\n\n.tsu-state {\n  padding: 1rem;\n  border: 1px solid #e2e8f0;\n  border-radius: 0.5rem;\n  background: white;\n}\n\n.tsu-state__title {\n  color: #0f172a;\n}\n\n.tsu-state__button {\n  margin-top: 0.75rem;\n  padding: 0.5rem 0.875rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n`
    },
    {
      path: "src/main.ts",
      content: `import { createApp } from "vue";\nimport { createPinia } from "pinia";\nimport App from "./App.vue";\nimport { router } from "./router";\nimport "./styles/main.css";\n\nconst app = createApp(App);\n\napp.use(createPinia());\napp.use(router);\napp.mount("#app");\n`
    },
    {
      path: "src/App.vue",
      content: `<script setup lang="ts">\nconst projectName = "${packageName}";\n</script>\n\n<template>\n  <div class="app-shell">\n    <header class="app-header">\n      <div>\n        <p class="app-intro">Vue 3 + Router + Pinia</p>\n        <h1>{{ projectName }}</h1>\n      </div>\n      <nav class="app-nav">\n        <router-link to="/">Home</router-link>\n        <router-link to="/about">About</router-link>\n      </nav>\n    </header>\n\n    <router-view />\n  </div>\n</template>\n\n<style scoped>\n.app-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 2rem;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.app-intro {\n  margin: 0 0 0.5rem;\n  color: #475569;\n  font-size: 0.875rem;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.app-nav {\n  display: flex;\n  gap: 1rem;\n}\n\n.app-nav a {\n  color: #0f172a;\n  text-decoration: none;\n}\n\n.app-nav a.router-link-active {\n  color: #2563eb;\n  font-weight: 700;\n}\n</style>\n`
    },
    {
      path: "src/router/index.ts",
      content: `import { createRouter, createWebHistory } from "vue-router";\n\nexport const router = createRouter({\n  history: createWebHistory(import.meta.env.BASE_URL),\n  routes: [\n    {\n      path: "/",\n      name: "home",\n      component: () => import("@/views/HomeView.vue")\n    },\n    {\n      path: "/about",\n      name: "about",\n      component: () => import("@/views/AboutView.vue")\n    }\n  ]\n});\n`
    },
    {
      path: "src/stores/dashboard.ts",
      content: `import { defineStore } from "pinia";\nimport { createClient } from "@tsuz/sdk";\nimport { toErrorMessage } from "@tsuz/utils/js";\n\nexport interface DashboardSummary {\n  id: number;\n  label: string;\n  value: string;\n}\n\nconst dashboardClient = createClient({\n  baseUrl: "https://example.tsu.local",\n  async adapter({ path }) {\n    if (path === "/dashboard/summary?fail=true") {\n      throw new Error("Mock request failed. Replace the adapter with your API when ready.");\n    }\n\n    return [\n      { id: 1, label: "Open tasks", value: "12" },\n      { id: 2, label: "Deployments", value: "3" },\n      { id: 3, label: "Template", value: "Vue 3" }\n    ];\n  }\n});\n\nexport const useDashboardStore = defineStore("dashboard", {\n  state: () => ({\n    summaries: [] as DashboardSummary[],\n    isLoading: false,\n    errorMessage: ""\n  }),\n  getters: {\n    hasSummaries: (state) => state.summaries.length > 0\n  },\n  actions: {\n    async loadSummary(shouldFail = false) {\n      this.isLoading = true;\n      this.errorMessage = "";\n\n      try {\n        this.summaries = await dashboardClient.get<DashboardSummary[]>(shouldFail ? "/dashboard/summary?fail=true" : "/dashboard/summary");\n      } catch (error: unknown) {\n        this.summaries = [];\n        this.errorMessage = toErrorMessage(error);\n      } finally {\n        this.isLoading = false;\n      }\n    }\n  }\n});\n`
    },
    {
      path: "src/stores/dashboard.test.ts",
      content: `import { beforeEach, describe, expect, it } from "vitest";\nimport { createPinia, setActivePinia } from "pinia";\nimport { useDashboardStore } from "./dashboard";\n\ndescribe("dashboard store", () => {\n  beforeEach(() => {\n    setActivePinia(createPinia());\n  });\n\n  it("loads dashboard summaries", async () => {\n    const dashboard = useDashboardStore();\n\n    await dashboard.loadSummary();\n\n    expect(dashboard.isLoading).toBe(false);\n    expect(dashboard.errorMessage).toBe("");\n    expect(dashboard.hasSummaries).toBe(true);\n    expect(dashboard.summaries).toHaveLength(3);\n    expect(dashboard.summaries[2]).toMatchObject({ label: "Template", value: "Vue 3" });\n  });\n\n  it("stores a displayable error when loading fails", async () => {\n    const dashboard = useDashboardStore();\n\n    await dashboard.loadSummary(true);\n\n    expect(dashboard.isLoading).toBe(false);\n    expect(dashboard.summaries).toEqual([]);\n    expect(dashboard.errorMessage).toContain("Mock request failed");\n  });\n});\n`
    },
    {
      path: "src/views/HomeView.vue",
      content: `<script setup lang="ts">\nimport { onMounted } from "vue";\nimport { storeToRefs } from "pinia";\nimport { EmptyState, ErrorState, LoadingState, PageContainer } from "@tsuz/components/vue";\nimport { useDashboardStore } from "@/stores/dashboard";\n\nconst projectName = "${packageName}";\nconst dashboard = useDashboardStore();\nconst { summaries, isLoading, errorMessage, hasSummaries } = storeToRefs(dashboard);\n\nfunction loadSummary(shouldFail = false) {\n  void dashboard.loadSummary(shouldFail);\n}\n\nonMounted(() => {\n  loadSummary();\n});\n</script>\n\n<template>\n  <PageContainer\n    title="Dashboard starter"\n    :description="projectName + ' uses Tsu components, utils, SDK, and Pinia in one replaceable example.'"\n  >\n    <template #actions>\n      <button class="home-view__button" type="button" @click="loadSummary(false)">Reload</button>\n      <button class="home-view__button home-view__button--secondary" type="button" @click="loadSummary(true)">Show error</button>\n    </template>\n\n    <LoadingState v-if="isLoading" label="Loading dashboard summary..." />\n    <ErrorState v-else-if="errorMessage" :message="errorMessage" :actions="['Retry']" @action="loadSummary(false)" />\n    <EmptyState v-else-if="!hasSummaries" title="No summary data" description="Connect your API client to show real metrics." />\n    <div v-else class="summary-grid">\n      <article v-for="item in summaries" :key="item.id" class="summary-card">\n        <span>{{ item.label }}</span>\n        <strong>{{ item.value }}</strong>\n      </article>\n    </div>\n  </PageContainer>\n</template>\n\n<style scoped>\n.summary-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));\n  gap: 1rem;\n}\n\n.summary-card {\n  display: grid;\n  gap: 0.5rem;\n  padding: 1rem;\n  border: 1px solid #e2e8f0;\n  border-radius: 0.5rem;\n  background: white;\n}\n\n.summary-card span {\n  color: #475569;\n  font-size: 0.875rem;\n}\n\n.summary-card strong {\n  color: #0f172a;\n  font-size: 1.5rem;\n}\n\n.home-view__button {\n  width: fit-content;\n  padding: 0.625rem 1rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n\n.home-view__button--secondary {\n  background: #64748b;\n}\n</style>\n`
    },
    {
      path: "src/views/HomeView.test.ts",
      content: `import { mount } from "@vue/test-utils";\nimport { createPinia } from "pinia";\nimport { describe, expect, it } from "vitest";\nimport HomeView from "./HomeView.vue";\n\ndescribe("HomeView", () => {\n  it("renders the dashboard starter actions", () => {\n    const wrapper = mount(HomeView, {\n      global: {\n        plugins: [createPinia()]\n      }\n    });\n\n    expect(wrapper.text()).toContain("Dashboard starter");\n    expect(wrapper.text()).toContain("Reload");\n    expect(wrapper.text()).toContain("Show error");\n  });\n});\n`
    },
    {
      path: "src/views/AboutView.vue",
      content: `<template>\n  <section class="about-view">\n    <h2>About</h2>\n    <p>This Vue 3 starter includes routing, Pinia state, Vitest tests, CI, and Docker out of the box.</p>\n  </section>\n</template>\n\n<style scoped>\n.about-view {\n  display: grid;\n  gap: 0.75rem;\n}\n</style>\n`
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
