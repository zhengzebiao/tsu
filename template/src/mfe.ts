export interface TemplateFile {
  path: string;
  content: string;
}

interface MfeAppDefinition {
  name: string;
  title: string;
  port: number;
}

const hostPort = 7100;
const mfeApps: MfeAppDefinition[] = [
  {
    name: "subapp",
    title: "Sub App",
    port: 7101
  },
  {
    name: "subapp-two",
    title: "Sub App Two",
    port: 7102
  }
];

export function createMfeTemplateFiles(packageName: string): TemplateFile[] {
  return [
    {
      path: "package.json",
      content: packageJson({
        name: packageName,
        private: true,
        type: "module",
        packageManager: "pnpm@8.15.9",
        scripts: {
          dev: "pnpm --parallel --filter \"./apps/*\" dev",
          build: "pnpm -r build",
          lint: "eslint . && pnpm -r lint",
          test: "vitest run",
          "docker:build": `docker build -t ${packageName} .`,
          "docker:run": createDockerRunCommand(packageName)
        },
        devDependencies: {
          "@eslint/js": "^9.21.0",
          "@types/node": "^20.17.57",
          eslint: "^9.21.0",
          "eslint-plugin-vue": "^9.32.0",
          globals: "^16.0.0",
          "typescript-eslint": "^8.26.1",
          typescript: "^5.8.3",
          vitest: "^3.0.5"
        }
      })
    },
    {
      path: "README.md",
      content: createTemplateReadme({
        projectName: packageName,
        templateName: "mfe",
        techStack: ["pnpm workspace", "Vue 3", "Vite", "qiankun", "TypeScript", "ESLint", "Vitest", "Docker", "GitHub Actions"],
        gettingStarted: ["pnpm install", "pnpm dev"],
        scripts: [
          ["dev", "Start the host and sub apps in parallel"],
          ["lint", "Run ESLint and per-package TypeScript checks"],
          ["build", "Build host, sub apps, and shared packages"],
          ["test", "Run Vitest unit tests"],
          ["docker:build", "Build the nginx production image"],
          ["docker:run", "Run host and sub app nginx servers"]
        ],
        projectStructure: [
          ["apps/host/", `Host shell and qiankun registry on port ${hostPort}`],
          ["apps/subapp/", "First qiankun sub application on port 7101"],
          ["apps/subapp-two/", "Second qiankun sub application on port 7102"],
          ["packages/shared/", "Micro app metadata and the cross-app event bus"],
          ["packages/ui/", "Shared UI component (BrandBadge) and tokens"],
          ["eslint.config.js", "Workspace ESLint flat config"],
          [".env.example", "Override sub app entry URLs per environment"],
          ["nginx.conf", "Production routing for host and sub apps"]
        ],
        deployment: ["Run pnpm build to build all apps and packages.", "Use docker:build for an nginx image that serves the host and sub apps."],
        faq: [
          ["Where does local development start?", `Open the host app at http://localhost:${hostPort} after pnpm dev.`],
          ["How do the host and sub apps communicate?", "Import hostEventBus from @tsuz/shared. The host emits events (for example theme:change) and each sub app subscribes in onMounted and unsubscribes in onUnmounted."],
          ["How do I point the host at deployed sub apps?", "Sub app entries default to the current hostname plus each app port. Override them with VITE_ENTRY_<NAME> variables (see .env.example) when serving sub apps from other domains or paths."],
          ["How do I add another sub app?", "Add a new app under apps/, update the micro app metadata, and add its nginx server mapping."],
          ["Can I use only one sub app?", "Yes. Remove the unused app folder and update packages/shared plus nginx.conf."]
        ]
      })
    },
    {
      path: "pnpm-workspace.yaml",
      content: `packages:\n  - "apps/*"\n  - "packages/*"\n`
    },
    {
      path: "tsconfig.base.json",
      content: packageJson({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          declaration: true,
          types: ["node"],
          strict: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          skipLibCheck: true,
          baseUrl: "."
        }
      })
    },
    {
      path: ".dockerignore",
      content: `node_modules\napps/*/dist\npackages/*/dist\n.git\n.github\n.turbo\n*.log\n*.local\n`
    },
    {
      path: ".gitignore",
      content: `node_modules/\ndist/\n.turbo/\n*.log\n`
    },
    {
      path: "Dockerfile",
      content: createDockerfile()
    },
    {
      path: "nginx.conf",
      content: createNginxConfig()
    },
    {
      path: ".github/workflows/ci.yml",
      content: `name: CI\n\non:\n  pull_request:\n    branches:\n      - master\n  push:\n    branches:\n      - master\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n        with:\n          version: 8.15.9\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: pnpm\n      - run: pnpm install\n      - run: pnpm lint\n      - run: pnpm test\n      - run: pnpm build\n`
    },
    {
      path: "eslint.config.js",
      content: `import js from "@eslint/js";\nimport globals from "globals";\nimport tseslint from "typescript-eslint";\nimport pluginVue from "eslint-plugin-vue";\n\nexport default tseslint.config(\n  {\n    ignores: ["**/dist", "**/node_modules", "**/*.d.ts"]\n  },\n  js.configs.recommended,\n  ...tseslint.configs.recommended,\n  ...pluginVue.configs["flat/recommended"],\n  {\n    files: ["**/*.{ts,vue}"],\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: globals.browser,\n      parserOptions: {\n        parser: tseslint.parser\n      }\n    },\n    rules: {\n      "vue/max-attributes-per-line": "off",\n      "vue/multi-word-component-names": "off",\n      "vue/singleline-html-element-content-newline": "off"\n    }\n  }\n);\n`
    },
    {
      path: ".env.example",
      content: `# Override sub app entry URLs used by the host qiankun registry.\n# Defaults to the current hostname plus each app port when unset.\n# Use these when sub apps are served from another domain or path in production.\n${mfeApps.map((app) => `# VITE_ENTRY_${app.name.toUpperCase().replace(/-/g, "_")}=//localhost:${app.port}`).join("\n")}\n`
    },
    ...createHostFiles(packageName),
    ...mfeApps.flatMap((app) => createSubAppFiles(packageName, app)),
    ...createSharedFiles(),
    ...createUiFiles()
  ];
}

function createDockerRunCommand(packageName: string) {
  const appPortFlags = mfeApps.map((app) => `-p ${app.port}:${app.port}`).join(" ");
  return `docker run --rm -p ${hostPort}:${hostPort} ${appPortFlags} ${packageName}`;
}

function createDockerfile() {
  const appPackageCopies = mfeApps.map((app) => `COPY apps/${app.name}/package.json apps/${app.name}/package.json`).join("\n");
  const appDistCopies = mfeApps.map((app) => `COPY --from=build /app/apps/${app.name}/dist /usr/share/nginx/html/${app.name}`).join("\n");
  const exposedPorts = [hostPort, ...mfeApps.map((app) => app.port)].join(" ");

  return `FROM node:20-alpine AS build\nWORKDIR /app\n\nRUN corepack enable\n\nCOPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./\nCOPY apps/host/package.json apps/host/package.json\n${appPackageCopies}\nCOPY packages/shared/package.json packages/shared/package.json\nCOPY packages/ui/package.json packages/ui/package.json\nRUN pnpm install --frozen-lockfile\n\nCOPY . .\nRUN pnpm build\n\nFROM nginx:1.27-alpine\nCOPY nginx.conf /etc/nginx/nginx.conf\nCOPY --from=build /app/apps/host/dist /usr/share/nginx/html/host\n${appDistCopies}\nEXPOSE ${exposedPorts}\nCMD ["nginx", "-g", "daemon off;"]\n`;
}

function createNginxConfig() {
  const subAppServers = mfeApps.map(createNginxSubAppServer).join("\n\n");

  return `events {}\n\nhttp {\n  include /etc/nginx/mime.types;\n\n  server {\n    listen ${hostPort};\n    server_name _;\n    root /usr/share/nginx/html/host;\n    index index.html;\n\n    location / {\n      try_files $uri $uri/ /index.html;\n    }\n\n    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {\n      expires 1y;\n      add_header Cache-Control "public, immutable";\n    }\n  }\n\n${subAppServers}\n}\n`;
}

function createNginxSubAppServer(app: MfeAppDefinition) {
  return `  server {\n    listen ${app.port};\n    server_name _;\n    root /usr/share/nginx/html/${app.name};\n    index index.html;\n\n    add_header Access-Control-Allow-Origin "*" always;\n\n    location / {\n      try_files $uri $uri/ /index.html;\n    }\n\n    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {\n      expires 1y;\n      add_header Cache-Control "public, immutable";\n      add_header Access-Control-Allow-Origin "*" always;\n    }\n  }`;
}

function createHostFiles(packageName: string): TemplateFile[] {
  return [
    {
      path: "apps/host/package.json",
      content: packageJson({
        name: `${packageName}-host`,
        private: true,
        type: "module",
        scripts: {
          dev: `vite --port ${hostPort} --strictPort`,
          build: "vue-tsc --noEmit && vite build",
          lint: "vue-tsc --noEmit"
        },
        dependencies: {
          qiankun: "^2.10.16",
          vue: "^3.5.13",
          "@tsuz/shared": "workspace:*",
          "@tsuz/ui": "workspace:*"
        },
        devDependencies: {
          "@types/node": "^20.17.57",
          "@vitejs/plugin-vue": "^5.2.1",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          "vue-tsc": "^2.2.8"
        }
      })
    },
    {
      path: "apps/host/index.html",
      content: `<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>\n`
    },
    {
      path: "apps/host/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\n\nexport default defineConfig({\n  plugins: [vue()],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url))\n    }\n  },\n  server: {\n    port: ${hostPort}\n  }\n});\n`
    },
    {
      path: "apps/host/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          noEmit: true,
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
            "@tsuz/shared": ["../../packages/shared/src/index.ts"],
            "@tsuz/ui": ["../../packages/ui/src/index.ts"]
          }
        },
        include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
      })
    },
    {
      path: "apps/host/src/main.ts",
      content: `import { createApp } from "vue";\nimport { registerMicroApps, setDefaultMountApp, start } from "qiankun";\nimport App from "./App.vue";\nimport { microApps } from "./micro-apps";\nimport "./styles.css";\n\ncreateApp(App).mount("#app");\n\nregisterMicroApps(microApps);\n\nif (microApps.length > 0) {\n  setDefaultMountApp(microApps[0].activeRule);\n}\n\nstart();\n`
    },
    {
      path: "apps/host/src/env.d.ts",
      content: `/// <reference types="vite/client" />\ndeclare module "*.vue" {\n  import type { DefineComponent } from "vue";\n\n  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;\n  export default component;\n}\n`
    },
    {
      path: "apps/host/src/App.vue",
      content: `<script setup lang="ts">\nimport { computed, onMounted, onUnmounted, ref } from "vue";\nimport { hostEventBus, microAppMetas } from "@tsuz/shared";\nimport { BrandBadge } from "@tsuz/ui";\n\nconst currentPath = ref(window.location.pathname);\nconst theme = ref<"light" | "dark">("light");\n\nconst activeApp = computed(() => microAppMetas.find((app) => currentPath.value.startsWith(app.activeRule)));\n\nfunction navigate(rule: string) {\n  if (window.location.pathname === rule) {\n    return;\n  }\n\n  // qiankun patches history, so pushState triggers the matching sub app to mount.\n  window.history.pushState(null, "", rule);\n  syncPath();\n}\n\nfunction syncPath() {\n  currentPath.value = window.location.pathname;\n}\n\nfunction toggleTheme() {\n  theme.value = theme.value === "light" ? "dark" : "light";\n  // Broadcast to every mounted sub app through the shared event bus.\n  hostEventBus.emit("theme:change", { theme: theme.value });\n}\n\nonMounted(() => window.addEventListener("popstate", syncPath));\nonUnmounted(() => window.removeEventListener("popstate", syncPath));\n</script>\n\n<template>\n  <main class="host-shell">\n    <header class="host-header">\n      <div>\n        <BrandBadge />\n        <h1>MFE Host</h1>\n      </div>\n      <nav class="host-nav">\n        <button\n          v-for="app in microAppMetas"\n          :key="app.name"\n          type="button"\n          class="host-nav__link"\n          :class="{ 'host-nav__link--active': app.name === activeApp?.name }"\n          @click="navigate(app.activeRule)"\n        >\n          {{ app.title }}\n        </button>\n        <button type="button" class="host-nav__link" @click="toggleTheme">Theme: {{ theme }}</button>\n      </nav>\n    </header>\n\n    <p class="host-hint">Active app: {{ activeApp?.title ?? "none" }}. Use the nav to switch sub apps.</p>\n\n    <section id="subapp-container" class="host-container" aria-label="Active sub app container" />\n  </main>\n</template>\n\n<style scoped>\n.host-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 1.5rem;\n  font-family: system-ui, sans-serif;\n}\n\n.host-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1rem;\n}\n\n.host-nav {\n  display: flex;\n  gap: 0.75rem;\n}\n\n.host-nav__link {\n  padding: 0.5rem 0.875rem;\n  border: 1px solid #cbd5f5;\n  border-radius: 0.5rem;\n  background: white;\n  color: #0f172a;\n  cursor: pointer;\n}\n\n.host-nav__link--active {\n  border-color: #2563eb;\n  color: #2563eb;\n}\n\n.host-hint {\n  margin: 0;\n  color: #475569;\n}\n\n.host-container {\n  min-height: 320px;\n  border: 1px dashed #94a3b8;\n  border-radius: 0.75rem;\n  padding: 1rem;\n}\n</style>\n`
    },
    {
      path: "apps/host/src/micro-apps.ts",
      content: `import { microAppMetas, type MicroAppConfig, type MicroAppMeta } from "@tsuz/shared";\n\nconst env = import.meta.env as unknown as Record<string, string | undefined>;\n\nexport const microApps: MicroAppConfig[] = microAppMetas.map((app) => ({\n  ...app,\n  entry: resolveEntry(app),\n  container: "#subapp-container"\n}));\n\n// Sub apps are loaded by URL at runtime. Default to the current hostname plus\n// each app port so Docker and remote hosts work without code changes, and allow\n// VITE_ENTRY_<NAME> overrides for custom domains or path based routing.\nfunction resolveEntry(app: MicroAppMeta): string {\n  const override = env["VITE_ENTRY_" + app.name.toUpperCase().replace(/-/g, "_")];\n\n  if (override) {\n    return override;\n  }\n\n  const hostname = typeof window === "undefined" ? "localhost" : window.location.hostname;\n  return "//" + hostname + ":" + app.port;\n}\n`
    },
    {
      path: "apps/host/src/styles.css",
      content: `body {\n  margin: 0;\n  background: #f8fafc;\n  color: #0f172a;\n}\n\na {\n  color: inherit;\n  text-decoration: none;\n}\n`
    }
  ];
}

function createSubAppFiles(packageName: string, app: MfeAppDefinition): TemplateFile[] {
  return [
    {
      path: `apps/${app.name}/package.json`,
      content: packageJson({
        name: `${packageName}-${app.name}`,
        private: true,
        type: "module",
        scripts: {
          dev: `vite --port ${app.port} --strictPort`,
          build: "vue-tsc --noEmit && vite build",
          lint: "vue-tsc --noEmit"
        },
        dependencies: {
          vue: "^3.5.13",
          "@tsuz/shared": "workspace:*",
          "@tsuz/ui": "workspace:*",
          "vite-plugin-qiankun": "^1.0.15"
        },
        devDependencies: {
          "@types/node": "^20.17.57",
          "@vitejs/plugin-vue": "^5.2.1",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          "vue-tsc": "^2.2.8"
        }
      })
    },
    {
      path: `apps/${app.name}/index.html`,
      content: `<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>\n`
    },
    {
      path: `apps/${app.name}/vite.config.ts`,
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\nimport qiankun from "vite-plugin-qiankun";\n\nexport default defineConfig({\n  plugins: [vue(), qiankun("${app.name}", { useDevMode: true })],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url))\n    }\n  },\n  server: {\n    port: ${app.port},\n    headers: {\n      "Access-Control-Allow-Origin": "*"\n    }\n  }\n});\n`
    },
    {
      path: `apps/${app.name}/tsconfig.json`,
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          noEmit: true,
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
            "@tsuz/shared": ["../../packages/shared/src/index.ts"],
            "@tsuz/ui": ["../../packages/ui/src/index.ts"]
          }
        },
        include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
      })
    },
    {
      path: `apps/${app.name}/src/main.ts`,
      content: `import { qiankunWindow, renderWithQiankun } from "vite-plugin-qiankun/dist/helper";\nimport { createApp } from "vue";\nimport App from "./App.vue";\nimport { bootstrap, mount, unmount, update } from "./lifecycle";\nimport "./styles.css";\n\nrenderWithQiankun({ bootstrap, mount, unmount, update });\n\nif (!qiankunWindow.__POWERED_BY_QIANKUN__) {\n  createApp(App).mount("#app");\n}\n\nexport { bootstrap, mount, unmount, update };\n`
    },
    {
      path: `apps/${app.name}/src/env.d.ts`,
      content: `/// <reference types="vite/client" />\ndeclare module "*.vue" {\n  import type { DefineComponent } from "vue";\n\n  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;\n  export default component;\n}\n`
    },
    {
      path: `apps/${app.name}/src/App.vue`,
      content: `<script setup lang="ts">\nimport { onMounted, onUnmounted, ref } from "vue";\nimport { hostEventBus } from "@tsuz/shared";\nimport { BrandBadge } from "@tsuz/ui";\n\n// Subscribe to host broadcasts to demonstrate cross-app communication.\nconst theme = ref<"light" | "dark">("light");\nlet unsubscribe: (() => void) | undefined;\n\nonMounted(() => {\n  unsubscribe = hostEventBus.on("theme:change", (payload) => {\n    theme.value = payload.theme;\n  });\n});\n\nonUnmounted(() => unsubscribe?.());\n</script>\n\n<template>\n  <section class="subapp-shell" :data-theme="theme">\n    <BrandBadge />\n    <h2>${app.title} is ready</h2>\n    <p>This app can run standalone or be mounted by qiankun.</p>\n    <p class="subapp-theme">Host theme: {{ theme }}</p>\n  </section>\n</template>\n\n<style scoped>\n.subapp-shell {\n  min-height: 240px;\n  display: grid;\n  place-content: center;\n  gap: 0.75rem;\n  font-family: system-ui, sans-serif;\n}\n\n.subapp-shell[data-theme="dark"] {\n  background: #0f172a;\n  color: #e2e8f0;\n}\n\n.subapp-theme {\n  margin: 0;\n  color: #475569;\n  font-size: 0.875rem;\n}\n</style>\n`
    },
    {
      path: `apps/${app.name}/src/lifecycle.ts`,
      content: `import { createApp } from "vue";\nimport App from "./App.vue";\n\ntype QiankunProps = { container?: Element };\n\nlet appInstance: ReturnType<typeof createApp> | null = null;\n\nexport function bootstrap() {\n  return Promise.resolve();\n}\n\nexport function mount(props: QiankunProps = {}) {\n  // Guard against a double mount leaking the previous Vue instance.\n  unmountInstance();\n\n  const container = props.container?.querySelector("#app") ?? document.querySelector("#app");\n\n  if (!container) {\n    throw new Error("Missing mount container for ${app.name}");\n  }\n\n  appInstance = createApp(App);\n  appInstance.mount(container);\n  return Promise.resolve();\n}\n\nexport function update(props: QiankunProps = {}) {\n  // qiankun calls update when the host passes new props; remount with them.\n  return mount(props);\n}\n\nexport function unmount() {\n  unmountInstance();\n  return Promise.resolve();\n}\n\nfunction unmountInstance() {\n  appInstance?.unmount();\n  appInstance = null;\n}\n`
    },
    {
      path: `apps/${app.name}/src/styles.css`,
      content: `body {\n  margin: 0;\n  background: #ffffff;\n  color: #0f172a;\n}\n`
    }
  ];
}

function createSharedFiles(): TemplateFile[] {
  const microAppMetas = mfeApps.map((app) => ({
    name: app.name,
    title: app.title,
    port: app.port,
    activeRule: `/${app.name}`
  }));

  return [
    {
      path: "packages/shared/package.json",
      content: packageJson({
        name: "@tsuz/shared",
        version: "0.0.0",
        private: true,
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js"
          }
        },
        files: ["dist/index.js", "dist/index.d.ts"],
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "node -e \"console.log('No tests configured for @tsuz/shared')\""
        }
      })
    },
    {
      path: "packages/shared/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          rootDir: "src",
          outDir: "dist"
        },
        include: ["src"],
        exclude: ["src/**/*.test.ts"]
      })
    },
    {
      path: "packages/shared/src/index.ts",
      content: `export interface MicroAppMeta {\n  name: string;\n  title: string;\n  port: number;\n  activeRule: string;\n}\n\nexport interface MicroAppConfig extends MicroAppMeta {\n  entry: string;\n  container: string;\n}\n\nexport const microAppMetas = ${packageJson(microAppMetas).trim()} as const satisfies readonly MicroAppMeta[];\n\nexport const microAppNames = microAppMetas.map((app) => app.name);\n\n// Strongly typed pub/sub bus shared by the host and every sub app. Extend\n// HostEvents with your own channels to coordinate auth, theme, routing, etc.\nexport interface HostEvents {\n  "theme:change": { theme: "light" | "dark" };\n  "user:change": { userId: string | null };\n}\n\ntype EventListener<Payload> = (payload: Payload) => void;\n\nexport function createEventBus<Events extends object>() {\n  const listeners = new Map<keyof Events, Set<EventListener<unknown>>>();\n\n  return {\n    on<Key extends keyof Events>(type: Key, listener: EventListener<Events[Key]>): () => void {\n      const set = listeners.get(type) ?? new Set<EventListener<unknown>>();\n      set.add(listener as EventListener<unknown>);\n      listeners.set(type, set);\n      return () => set.delete(listener as EventListener<unknown>);\n    },\n    emit<Key extends keyof Events>(type: Key, payload: Events[Key]): void {\n      listeners.get(type)?.forEach((listener) => (listener as EventListener<Events[Key]>)(payload));\n    },\n    clear(): void {\n      listeners.clear();\n    }\n  };\n}\n\nexport const hostEventBus = createEventBus<HostEvents>();\n`
    },
    {
      path: "packages/shared/src/index.test.ts",
      content: `import { describe, expect, it } from "vitest";\nimport { createEventBus, microAppMetas, microAppNames } from "./index";\n\ndescribe("micro app metadata", () => {\n  it("exposes a name for every registered app", () => {\n    expect(microAppNames).toHaveLength(microAppMetas.length);\n    expect(microAppNames).toContain("subapp");\n  });\n\n  it("uses unique ports", () => {\n    const ports = microAppMetas.map((app) => app.port);\n    expect(new Set(ports).size).toBe(ports.length);\n  });\n});\n\ndescribe("event bus", () => {\n  it("delivers events to subscribers and supports unsubscribe", () => {\n    const bus = createEventBus<{ ping: number }>();\n    const received: number[] = [];\n\n    const off = bus.on("ping", (value) => received.push(value));\n    bus.emit("ping", 1);\n    off();\n    bus.emit("ping", 2);\n\n    expect(received).toEqual([1]);\n  });\n});\n`
    }
  ];
}

function createUiFiles(): TemplateFile[] {
  return [
    {
      path: "packages/ui/package.json",
      content: packageJson({
        name: "@tsuz/ui",
        version: "0.0.0",
        private: true,
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js"
          }
        },
        files: ["dist/index.js", "dist/index.d.ts"],
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "node -e \"console.log('No tests configured for @tsuz/ui')\""
        },
        dependencies: {
          vue: "^3.5.13"
        }
      })
    },
    {
      path: "packages/ui/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          rootDir: "src",
          outDir: "dist"
        },
        include: ["src"]
      })
    },
    {
      path: "packages/ui/src/index.ts",
      content: `import { defineComponent, h } from "vue";\n\nexport const uiBrandName = "Tsu MFE UI";\n\n// A tiny shared component imported by the host and every sub app, so the\n// workspace demonstrates real shared UI rather than a single string constant.\nexport const BrandBadge = defineComponent({\n  name: "BrandBadge",\n  props: {\n    label: { type: String, default: uiBrandName }\n  },\n  setup(props) {\n    return () => h("span", { class: "tsu-brand-badge" }, props.label);\n  }\n});\n`
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

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
