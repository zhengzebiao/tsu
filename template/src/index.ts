import { createMfeTemplateFiles } from "./mfe.js";
import { createReactTemplateFiles } from "./react.js";

export interface TemplateManifest {
  name: string;
  version: string;
  templates: TemplateDefinition[];
}

export interface TemplateDefinition {
  name: TemplateName;
  description: string;
  tags: string[];
  recommendedFor: string[];
  node: string;
  packageManagers: string[];
  nextSteps: string[];
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface CreateTemplateFilesOptions {
  projectName: string;
  templateName?: string;
}

export type TemplateName = "default" | "monorepo" | "vue3" | "mfe" | "react";

export const templateDefinitions: TemplateDefinition[] = [
  {
    name: "default",
    description: "Minimal Node.js starter",
    tags: ["node", "minimal"],
    recommendedFor: ["node", "minimal"],
    node: ">=20",
    packageManagers: ["pnpm"],
    nextSteps: ["pnpm dev"]
  },
  {
    name: "monorepo",
    description: "Multi-package workspace with pnpm, Turbo, Changesets, and TypeScript",
    tags: ["monorepo", "pnpm", "turbo", "changesets"],
    recommendedFor: ["workspace", "packages", "team standard"],
    node: ">=20",
    packageManagers: ["pnpm"],
    nextSteps: ["pnpm install", "pnpm build"]
  },
  {
    name: "vue3",
    description: "Vue 3 app with Vite, Router, Pinia, ESLint, Docker, and CI",
    tags: ["vue", "vite", "spa", "docker"],
    recommendedFor: ["admin", "dashboard", "web app"],
    node: ">=20",
    packageManagers: ["pnpm"],
    nextSteps: ["pnpm install", "pnpm dev"]
  },
  {
    name: "mfe",
    description: "Micro frontend workspace with host and Vue sub apps",
    tags: ["mfe", "qiankun", "vue", "workspace"],
    recommendedFor: ["micro frontend", "multi app"],
    node: ">=20",
    packageManagers: ["pnpm"],
    nextSteps: ["pnpm install", "pnpm dev"]
  },
  {
    name: "react",
    description: "React app with Vite, TypeScript, Router, ESLint, Docker, and CI",
    tags: ["react", "vite", "spa", "docker"],
    recommendedFor: ["react app", "dashboard", "web app"],
    node: ">=20",
    packageManagers: ["pnpm"],
    nextSteps: ["pnpm install", "pnpm dev"]
  }
];
export const templateNames = templateDefinitions.map((template) => template.name);
export const templateProjectNameToken = "__tsu_project_name__";

export const templateManifest: TemplateManifest = {
  name: "tsuz-template",
  version: "0.0.0",
  templates: templateDefinitions
};

export function listTemplates() {
  return [...templateNames];
}

export function getTemplateDefinition(templateName: TemplateName) {
  return templateDefinitions.find((template) => template.name === templateName);
}

export function createTemplateFiles(options: CreateTemplateFilesOptions): TemplateFile[] {
  return renderTemplateFiles(createTemplateSourceFiles(options.templateName), options.projectName);
}

export function createTemplateSourceFiles(templateName?: string): TemplateFile[] {
  const resolvedTemplateName = resolveTemplateName(templateName);

  if (resolvedTemplateName === "monorepo") {
    return createMonorepoTemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "vue3") {
    return createVue3TemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "mfe") {
    return createMfeTemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "react") {
    return createReactTemplateFiles(templateProjectNameToken);
  }

  return createDefaultTemplateFiles(templateProjectNameToken);
}

export function renderTemplateFiles(files: TemplateFile[], projectName: string): TemplateFile[] {
  const packageName = normalizePackageName(projectName);

  return files.map((file) => ({
    path: file.path,
    content: file.content.replaceAll(templateProjectNameToken, packageName)
  }));
}

function createDefaultTemplateFiles(packageName: string): TemplateFile[] {
  return [
    {
      path: "package.json",
      content: packageJson({
        name: packageName,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "node src/index.js"
        }
      })
    },
    {
      path: "README.md",
      content: createTemplateReadme({
        projectName: packageName,
        templateName: "default",
        techStack: ["Node.js", "ES modules"],
        gettingStarted: ["pnpm dev"],
        scripts: [["dev", "Run the Node.js starter entry"]],
        projectStructure: [["src/index.js", "Application entry file"]],
        deployment: ["Add the runtime or deployment target your team uses."],
        faq: [["Can I add TypeScript?", "Yes. Add TypeScript and a build script when this project grows beyond the minimal starter."]]
      })
    },
    {
      path: "src/index.js",
      content: `console.log("${packageName} is ready");\n`
    }
  ];
}

function createVue3TemplateFiles(packageName: string): TemplateFile[] {
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
          eslint: "^9.21.0",
          "eslint-plugin-vue": "^9.32.0",
          globals: "^16.0.0",
          "typescript-eslint": "^8.26.1",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          "vue-tsc": "^2.2.8"
        }
      })
    },
    {
      path: "README.md",
      content: createTemplateReadme({
        projectName: packageName,
        templateName: "vue3",
        techStack: ["Vue 3", "Vite", "TypeScript", "Vue Router", "Pinia", "ESLint", "Docker", "GitHub Actions"],
        gettingStarted: ["pnpm install", "pnpm dev"],
        scripts: [
          ["dev", "Start the Vite development server"],
          ["lint", "Run ESLint and vue-tsc checks"],
          ["build", "Type-check and build production assets"],
          ["preview", "Preview the production build"],
          ["docker:build", "Build the nginx production image"],
          ["docker:run", "Run the production image on port 8080"]
        ],
        projectStructure: [
          ["src/main.ts", "Vue application bootstrap"],
          ["src/router/", "Route definitions"],
          ["src/stores/", "Pinia stores"],
          ["src/views/", "Route-level views"],
          [".github/workflows/ci.yml", "Install, lint, and build workflow"],
          ["Dockerfile", "Production container build"]
        ],
        deployment: ["Run pnpm build to create dist/.", "Use docker:build for an nginx-based production image."],
        faq: [
          ["How does the sample business loop work?", "HomeView uses @tsuz/components/vue for page states, @tsuz/sdk with a mock adapter for data loading, and @tsuz/utils/js for error messages."],
          ["How do I add pages?", "Add a view in src/views and register it in src/router/index.ts."],
          ["How do I replace the sample data?", "Replace the mock adapter in src/views/HomeView.vue with your real API endpoint."],
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
      content: `<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>\n`
    },
    {
      path: "vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\n\nexport default defineConfig({\n  plugins: [vue()],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  }\n});\n`
    },
    {
      path: "eslint.config.js",
      content: `import js from "@eslint/js";\nimport globals from "globals";\nimport tseslint from "typescript-eslint";\nimport pluginVue from "eslint-plugin-vue";\n\nexport default tseslint.config(\n  {\n    ignores: ["dist", "coverage"]\n  },\n  js.configs.recommended,\n  ...tseslint.configs.recommended,\n  ...pluginVue.configs["flat/recommended"],\n  {\n    files: ["**/*.{ts,vue}"],\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: globals.browser,\n      parserOptions: {\n        parser: tseslint.parser\n      }\n    },\n    rules: {\n      "vue/max-attributes-per-line": "off",\n      "vue/multi-word-component-names": "off",\n      "vue/singleline-html-element-content-newline": "off"\n    }\n  }\n);\n`
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
          }
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
      content: `<script setup lang="ts">\nconst projectName = "${packageName}";\n</script>\n\n<template>\n  <div class="app-shell">\n    <header class="app-header">\n      <div>\n        <p class="app-intro">Vue 3 + Router + Pinia</p>\n        <h1>{{ projectName }}</h1>\n      </div>\n      <nav class="app-nav">\n        <router-link to="/">Home</router-link>\n        <router-link to="/about">About</router-link>\n      </nav>\n    </header>\n\n    <router-view />\n  </div>\n</template>\n\n<style scoped>\n.app-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 2rem;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.app-intro {\n  margin: 0 0 0.5rem;\n  color: #475569;\n  font-size: 0.875rem;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.app-nav {\n  display: flex;\n  gap: 1rem;\n}\n\n.app-nav a {\n  color: #0f172a;\n  text-decoration: none;\n}\n</style>\n`
    },
    {
      path: "src/router/index.ts",
      content: `import { createRouter, createWebHistory } from "vue-router";\n\nexport const router = createRouter({\n  history: createWebHistory(import.meta.env.BASE_URL),\n  routes: [\n    {\n      path: "/",\n      name: "home",\n      component: () => import("@/views/HomeView.vue")\n    },\n    {\n      path: "/about",\n      name: "about",\n      component: () => import("@/views/AboutView.vue")\n    }\n  ]\n});\n`
    },
    {
      path: "src/stores/counter.ts",
      content: `import { defineStore } from "pinia";\n\nexport const useCounterStore = defineStore("counter", {\n  state: () => ({\n    count: 0\n  }),\n  getters: {\n    doubleCount: (state) => state.count * 2\n  },\n  actions: {\n    increment() {\n      this.count += 1;\n    },\n    reset() {\n      this.count = 0;\n    }\n  }\n});\n`
    },
    {
      path: "src/views/HomeView.vue",
      content: `<script setup lang="ts">\nimport { onMounted, ref } from "vue";\nimport { EmptyState, ErrorState, LoadingState, PageContainer } from "@tsuz/components/vue";\nimport { createClient } from "@tsuz/sdk";\nimport { sleep, toErrorMessage } from "@tsuz/utils/js";\n\ninterface DashboardSummary {\n  id: number;\n  label: string;\n  value: string;\n}\n\nconst projectName = "${packageName}";\nconst summaries = ref<DashboardSummary[]>([]);\nconst isLoading = ref(true);\nconst errorMessage = ref("");\n\nconst api = createClient({\n  baseUrl: "https://example.tsu.local",\n  async adapter({ path }) {\n    await sleep(250);\n\n    if (path === "/dashboard/summary?fail=true") {\n      throw new Error("Mock request failed. Replace the adapter with your API when ready.");\n    }\n\n    return [\n      { id: 1, label: "Open tasks", value: "12" },\n      { id: 2, label: "Deployments", value: "3" },\n      { id: 3, label: "Template", value: "Vue 3" }\n    ];\n  }\n});\n\nasync function loadSummary(shouldFail = false) {\n  isLoading.value = true;\n  errorMessage.value = "";\n\n  try {\n    summaries.value = await api.get<DashboardSummary[]>(shouldFail ? "/dashboard/summary?fail=true" : "/dashboard/summary");\n  } catch (error: unknown) {\n    summaries.value = [];\n    errorMessage.value = toErrorMessage(error);\n  } finally {\n    isLoading.value = false;\n  }\n}\n\nonMounted(() => {\n  void loadSummary();\n});\n</script>\n\n<template>\n  <PageContainer\n    title="Dashboard starter"\n    :description="projectName + ' uses Tsu components, utils, and SDK in one replaceable example.'"\n  >\n    <template #actions>\n      <button class="home-view__button" type="button" @click="loadSummary(false)">Reload</button>\n      <button class="home-view__button home-view__button--secondary" type="button" @click="loadSummary(true)">Show error</button>\n    </template>\n\n    <LoadingState v-if="isLoading" label="Loading dashboard summary..." />\n    <ErrorState v-else-if="errorMessage" :message="errorMessage" :actions="['Retry']" @action="loadSummary(false)" />\n    <EmptyState v-else-if="summaries.length === 0" title="No summary data" description="Connect your API client to show real metrics." />\n    <div v-else class="summary-grid">\n      <article v-for="item in summaries" :key="item.id" class="summary-card">\n        <span>{{ item.label }}</span>\n        <strong>{{ item.value }}</strong>\n      </article>\n    </div>\n  </PageContainer>\n</template>\n\n<style scoped>\n.summary-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));\n  gap: 1rem;\n}\n\n.summary-card {\n  display: grid;\n  gap: 0.5rem;\n  padding: 1rem;\n  border: 1px solid #e2e8f0;\n  border-radius: 0.5rem;\n  background: white;\n}\n\n.summary-card span {\n  color: #475569;\n  font-size: 0.875rem;\n}\n\n.summary-card strong {\n  color: #0f172a;\n  font-size: 1.5rem;\n}\n\n.home-view__button {\n  width: fit-content;\n  padding: 0.625rem 1rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n\n.home-view__button--secondary {\n  background: #64748b;\n}\n</style>\n`
    },
    {
      path: "src/views/AboutView.vue",
      content: `<template>\n  <section class="about-view">\n    <h2>About</h2>\n    <p>This Vue 3 starter includes routing and Pinia out of the box.</p>\n  </section>\n</template>\n\n<style scoped>\n.about-view {\n  display: grid;\n  gap: 0.75rem;\n}\n</style>\n`
    },
    {
      path: "src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n`
    }
  ];
}

function createMonorepoTemplateFiles(packageName: string): TemplateFile[] {
  return [
    {
      path: "package.json",
      content: packageJson({
        name: packageName,
        private: true,
        type: "module",
        packageManager: "pnpm@8.15.9",
        scripts: {
          build: "turbo run build",
          test: "turbo run test",
          lint: "turbo run lint",
          "release:version": "changeset version",
          "release:publish": "changeset publish"
        },
        devDependencies: {
          "@changesets/cli": "^2.31.0",
          "@types/node": "^20.17.57",
          turbo: "^2.5.3",
          typescript: "^5.8.3"
        }
      })
    },
    {
      path: "README.md",
      content: createTemplateReadme({
        projectName: packageName,
        templateName: "monorepo",
        techStack: ["pnpm workspace", "Turborepo", "Changesets", "TypeScript", "Node.js packages"],
        gettingStarted: ["pnpm install", "pnpm build", "pnpm lint"],
        scripts: [
          ["build", "Build all workspace packages through Turbo"],
          ["lint", "Run TypeScript no-emit checks across packages"],
          ["test", "Run package tests after build"],
          ["release:version", "Apply Changesets version updates"],
          ["release:publish", "Publish changed packages with Changesets"]
        ],
        projectStructure: [
          ["cli/", "CLI package entry point"],
          ["template/", "Template source package"],
          ["components/", "Vue and React component package surfaces"],
          ["utils/", "Shared utility package surfaces"],
          ["sdk/", "SDK package surface"],
          ["script/", "Release and validation scripts"]
        ],
        deployment: ["Use Changesets for package versioning and publishing.", "Run pnpm build and pnpm lint before release."],
        faq: [
          ["How do I add a package?", "Add the package directory, include it in pnpm-workspace.yaml, and wire its scripts into Turbo."],
          ["Can I remove unused packages?", "Yes. Remove the package folder and update pnpm-workspace.yaml, turbo tasks, and Changesets ignore settings."],
          ["How do I publish packages?", "Use release:version to apply Changesets, then release:publish after validation."]
        ]
      })
    },
    {
      path: "pnpm-workspace.yaml",
      content: `packages:\n  - "cli"\n  - "template"\n  - "components"\n  - "utils"\n  - "sdk"\n  - "tests"\n  - "script"\n`
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
            dependsOn: ["build"],
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
          module: "NodeNext",
          moduleResolution: "NodeNext",
          declaration: true,
          types: ["node"],
          strict: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          skipLibCheck: true
        }
      })
    },
    {
      path: ".gitignore",
      content: `node_modules/\ndist/\n.turbo/\n*.log\n`
    },
    {
      path: ".changeset/config.json",
      content: packageJson({
        $schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
        changelog: "@changesets/cli/changelog",
        commit: false,
        fixed: [],
        linked: [],
        access: "public",
        baseBranch: "master",
        updateInternalDependencies: "patch",
        ignore: ["@tsuz/tests", "@tsuz/script"]
      })
    },
    ...createTopLevelPackageFiles("cli", "@tsuz/cli", "cli package is ready", {
      bin: {
        "tsu-cli": "./dist/index.js"
      },
      dependencies: {
        "@tsuz/template": "workspace:*"
      }
    }),
    ...createTopLevelPackageFiles("components", "@tsuz/components", undefined, {
      exports: {
        "./vue": {
          types: "./dist/vue/index.d.ts",
          import: "./dist/vue/index.js"
        },
        "./react": {
          types: "./dist/react/index.d.ts",
          import: "./dist/react/index.js"
        }
      },
      files: [
        "dist/vue/index.js",
        "dist/vue/index.d.ts",
        "dist/react/index.js",
        "dist/react/index.d.ts"
      ],
      scripts: {
        build: "tsc -p vue/tsconfig.json && tsc -p react/tsconfig.json",
        lint: "tsc -p vue/tsconfig.json --noEmit && tsc -p react/tsconfig.json --noEmit",
        test: "node -e \"console.log('No tests configured for @tsuz/components')\""
      }
    }),
    ...createTopLevelPackageFiles("utils", "@tsuz/utils", undefined, {
      exports: {
        "./js": {
          types: "./dist/js/index.d.ts",
          import: "./dist/js/index.js"
        }
      },
      files: ["dist/js/index.js", "dist/js/index.d.ts"],
      scripts: {
        build: "tsc -p js/tsconfig.json",
        lint: "tsc -p js/tsconfig.json --noEmit",
        test: "node -e \"console.log('No tests configured for @tsuz/utils')\""
      }
    }),
    ...createTopLevelPackageFiles("sdk", "@tsuz/sdk", "sdk package is ready"),
    {
      path: "template/package.json",
      content: packageJson({
        name: "@tsuz/template",
        version: "0.0.0",
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js"
          }
        },
        types: "./dist/index.d.ts",
        files: ["dist/*.js", "dist/*.d.ts"],
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "node --test dist/index.test.js"
        },
        repository: {
          type: "git",
          url: "https://github.com/zhengzebiao/tsu"
        }
      })
    },
    {
      path: "tests/package.json",
      content: packageJson({
        name: "@tsuz/tests",
        private: true,
        type: "module"
      })
    },
    {
      path: "script/package.json",
      content: packageJson({
        name: "@tsuz/script",
        private: true,
        type: "module"
      })
    }
  ];
}

function createTopLevelPackageFiles(
  directory: string,
  name: string,
  message?: string,
  packageJsonOverrides: Record<string, unknown> = {}
): TemplateFile[] {
  return [
    {
      path: `${directory}/package.json`,
      content: packageJson({
        name,
        version: "0.0.0",
        type: "module",
        repository: {
          type: "git",
          url: "https://github.com/zhengzebiao/tsu"
        },
        ...packageJsonOverrides,
        ...(message
          ? {
              exports: {
                ".": {
                  types: "./dist/index.d.ts",
                  import: "./dist/index.js"
                }
              },
              types: "./dist/index.d.ts",
              files: ["dist/index.js", "dist/index.d.ts"],
              scripts: {
                build: "tsc -p tsconfig.json",
                lint: "tsc -p tsconfig.json --noEmit",
                test: `node -e \"console.log('No tests configured for ${name}')\"`
              }
            }
          : {})
      })
    },
    ...(message
      ? [
          {
            path: `${directory}/tsconfig.json`,
            content: packageJson({
              extends: "../tsconfig.base.json",
              compilerOptions: {
                rootDir: "src",
                outDir: "dist"
              },
              include: ["src"]
            })
          },
          {
            path: `${directory}/src/index.ts`,
            content: `export const message = "${message}";\n`
          }
        ]
      : [])
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

function resolveTemplateName(templateName = "default"): TemplateName {
  if (templateNames.includes(templateName as TemplateName)) {
    return templateName as TemplateName;
  }

  throw new Error(`Template "${templateName}" is not available. Available templates: ${templateNames.join(", ")}.`);
}

function normalizePackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "quick-start-app";
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
