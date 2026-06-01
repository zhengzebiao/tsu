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
          lint: "pnpm -r lint",
          test: "node -e \"console.log('No tests configured for mfe template')\"",
          "docker:build": `docker build -t ${packageName} .`,
          "docker:run": createDockerRunCommand(packageName)
        },
        devDependencies: {
          "@types/node": "^20.17.57",
          typescript: "^5.8.3"
        }
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
      content: `name: CI\n\non:\n  pull_request:\n    branches:\n      - master\n  push:\n    branches:\n      - master\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n        with:\n          version: 8.15.9\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm lint\n      - run: pnpm build\n`
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
      content: `import { createApp } from "vue";\nimport { registerMicroApps, start } from "qiankun";\nimport App from "./App.vue";\nimport { microApps } from "./micro-apps";\nimport "./styles.css";\n\ncreateApp(App).mount("#app");\nregisterMicroApps(microApps);\nstart();\n`
    },
    {
      path: "apps/host/src/App.vue",
      content: `<script setup lang="ts">\nimport { microAppMetas } from "@tsuz/shared";\nimport { uiBrandName } from "@tsuz/ui";\n</script>\n\n<template>\n  <main class="host-shell">\n    <header class="host-header">\n      <div>\n        <p class="host-eyebrow">{{ uiBrandName }}</p>\n        <h1>MFE Host</h1>\n      </div>\n      <nav class="host-nav">\n        <a href="/">Home</a>\n        <a v-for="app in microAppMetas" :key="app.name" :href="app.activeRule">{{ app.title }}</a>\n      </nav>\n    </header>\n\n    <section class="host-panel">\n      <h2>Registered apps</h2>\n      <ul>\n        <li v-for="app in microAppMetas" :key="app.name">{{ app.title }} ({{ app.name }})</li>\n      </ul>\n    </section>\n\n    <section class="host-containers">\n      <section\n        v-for="app in microAppMetas"\n        :id="app.name + '-container'"\n        :key="app.name"\n        class="host-container"\n        :aria-label="app.title + ' container'"\n      ></section>\n    </section>\n  </main>\n</template>\n\n<style scoped>\n.host-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 1.5rem;\n  font-family: system-ui, sans-serif;\n}\n\n.host-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1rem;\n}\n\n.host-eyebrow {\n  margin: 0 0 0.5rem;\n  color: #475569;\n  font-size: 0.875rem;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n}\n\n.host-nav,\n.host-containers {\n  display: grid;\n  gap: 1rem;\n}\n\n.host-nav {\n  grid-auto-flow: column;\n}\n\n.host-container {\n  min-height: 320px;\n  border: 1px dashed #94a3b8;\n  border-radius: 0.75rem;\n  padding: 1rem;\n}\n</style>\n`
    },
    {
      path: "apps/host/src/micro-apps.ts",
      content: `import { microAppMetas, type MicroAppConfig } from "@tsuz/shared";\n\nexport const microApps: MicroAppConfig[] = microAppMetas.map((app) => ({\n  ...app,\n  entry: "//localhost:" + app.port,\n  container: "#" + app.name + "-container"\n}));\n`
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
      content: `import { qiankunWindow, renderWithQiankun } from "vite-plugin-qiankun/dist/helper";\nimport { createApp } from "vue";\nimport App from "./App.vue";\nimport { bootstrap, mount, unmount } from "./lifecycle";\nimport "./styles.css";\n\nrenderWithQiankun({ bootstrap, mount, unmount, update: mount });\n\nif (!qiankunWindow.__POWERED_BY_QIANKUN__) {\n  createApp(App).mount("#app");\n}\n\nexport { bootstrap, mount, unmount };\n`
    },
    {
      path: `apps/${app.name}/src/App.vue`,
      content: `<script setup lang="ts">\nimport { uiBrandName } from "@tsuz/ui";\n</script>\n\n<template>\n  <section class="subapp-shell">\n    <p class="subapp-eyebrow">{{ uiBrandName }}</p>\n    <h2>${app.title} is ready</h2>\n    <p>This app can run standalone or be mounted by qiankun.</p>\n  </section>\n</template>\n\n<style scoped>\n.subapp-shell {\n  min-height: 240px;\n  display: grid;\n  place-content: center;\n  gap: 0.75rem;\n  font-family: system-ui, sans-serif;\n}\n\n.subapp-eyebrow {\n  margin: 0;\n  color: #475569;\n  font-size: 0.875rem;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n}\n</style>\n`
    },
    {
      path: `apps/${app.name}/src/lifecycle.ts`,
      content: `import { createApp } from "vue";\nimport App from "./App.vue";\n\nlet appInstance: ReturnType<typeof createApp> | null = null;\n\nexport function bootstrap() {\n  return Promise.resolve();\n}\n\nexport function mount(props: { container?: Element } = {}) {\n  const container = props.container?.querySelector("#app") ?? document.querySelector("#app");\n\n  if (!container) {\n    throw new Error("Missing mount container for ${app.name}");\n  }\n\n  appInstance = createApp(App);\n  appInstance.mount(container as Element);\n  return Promise.resolve();\n}\n\nexport function unmount() {\n  appInstance?.unmount();\n  appInstance = null;\n  return Promise.resolve();\n}\n`
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
        include: ["src"]
      })
    },
    {
      path: "packages/shared/src/index.ts",
      content: `export interface MicroAppMeta {\n  name: string;\n  title: string;\n  port: number;\n  activeRule: string;\n}\n\nexport interface MicroAppConfig extends MicroAppMeta {\n  entry: string;\n  container: string;\n}\n\nexport const microAppMetas = ${packageJson(microAppMetas).trim()} as const satisfies readonly MicroAppMeta[];\n\nexport const microAppNames = microAppMetas.map((app) => app.name);\n`
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
      content: `export const uiBrandName = "Tsu MFE UI";\n`
    }
  ];
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
