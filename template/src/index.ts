export interface TemplateManifest {
  name: string;
  version: string;
  templates: TemplateName[];
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface CreateTemplateFilesOptions {
  projectName: string;
  templateName?: string;
}

export type TemplateName = "default" | "monorepo" | "vue3";

const templateNames: TemplateName[] = ["default", "monorepo", "vue3"];
export const templateProjectNameToken = "__tsu_project_name__";

export const templateManifest: TemplateManifest = {
  name: "quick-start-template",
  version: "0.0.0",
  templates: templateNames
};

export function listTemplates() {
  return [...templateNames];
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
      content: `@import "./base.css";\n\nbody {\n  min-height: 100vh;\n}\n`
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
      content: `<script setup lang="ts">\nimport { storeToRefs } from "pinia";\nimport { useCounterStore } from "@/stores/counter";\n\nconst projectName = "${packageName}";\nconst counterStore = useCounterStore();\nconst { count, doubleCount } = storeToRefs(counterStore);\n</script>\n\n<template>\n  <section class="home-view">\n    <p class="home-view__eyebrow">Vue 3 + Router + Pinia</p>\n    <h2>Welcome to {{ projectName }}</h2>\n    <p>Current count: {{ count }}</p>\n    <p>Double count: {{ doubleCount }}</p>\n    <div class="home-view__actions">\n      <button class="home-view__button" type="button" @click="counterStore.increment">Increment</button>\n      <button class="home-view__button home-view__button--secondary" type="button" @click="counterStore.reset">Reset</button>\n    </div>\n  </section>\n</template>\n\n<style scoped>\n.home-view {\n  display: grid;\n  gap: 0.75rem;\n  max-width: 32rem;\n}\n\n.home-view__eyebrow {\n  margin: 0;\n  color: #475569;\n  font-size: 0.875rem;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.home-view__actions {\n  display: flex;\n  gap: 0.75rem;\n}\n\n.home-view__button {\n  width: fit-content;\n  padding: 0.625rem 1rem;\n  border: 0;\n  border-radius: 0.5rem;\n  color: white;\n  background: #2563eb;\n  cursor: pointer;\n}\n\n.home-view__button--secondary {\n  background: #64748b;\n}\n</style>\n`
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
        ignore: ["@tsuz/template", "@tsuz/tests", "@tsuz/script"]
      })
    },
    ...createTopLevelPackageFiles("cli", "@tsuz/cli", "cli package is ready", {
      bin: {
        "tsu-cli": "./dist/index.js"
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
        private: true,
        type: "module",
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
          test: "node --test dist/index.test.js"
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
