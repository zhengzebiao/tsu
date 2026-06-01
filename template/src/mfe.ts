export interface TemplateFile {
  path: string;
  content: string;
}

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
          test: "node -e \"console.log('No tests configured for mfe template')\""
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
      path: ".gitignore",
      content: `node_modules/\ndist/\n.turbo/\n*.log\n`
    },
    ...createHostFiles(packageName),
    ...createSubAppFiles(packageName),
    ...createSharedFiles(),
    ...createUiFiles()
  ];
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
          dev: "vite --port 7100",
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
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\n\nexport default defineConfig({\n  plugins: [vue()],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url))\n    }\n  },\n  server: {\n    port: 7100\n  }\n});\n`
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
      content: `<script setup lang="ts">\nimport { microAppNames } from "@tsuz/shared";\nimport { uiBrandName } from "@tsuz/ui";\n</script>\n\n<template>\n  <main class="host-shell">\n    <header class="host-header">\n      <div>\n        <p class="host-eyebrow">{{ uiBrandName }}</p>\n        <h1>MFE Host</h1>\n      </div>\n      <nav class="host-nav">\n        <a href="/">Home</a>\n        <a href="/subapp">Sub App</a>\n      </nav>\n    </header>\n\n    <section class="host-panel">\n      <h2>Registered apps</h2>\n      <ul>\n        <li v-for="name in microAppNames" :key="name">{{ name }}</li>\n      </ul>\n    </section>\n\n    <section id="subapp-container" class="host-container"></section>\n  </main>\n</template>\n\n<style scoped>\n.host-shell {\n  min-height: 100vh;\n  padding: 2rem;\n  display: grid;\n  gap: 1.5rem;\n  font-family: system-ui, sans-serif;\n}\n\n.host-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1rem;\n}\n\n.host-eyebrow {\n  margin: 0 0 0.5rem;\n  color: #475569;\n  font-size: 0.875rem;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n}\n\n.host-nav {\n  display: flex;\n  gap: 1rem;\n}\n\n.host-container {\n  min-height: 320px;\n  border: 1px dashed #94a3b8;\n  border-radius: 0.75rem;\n  padding: 1rem;\n}\n</style>\n`
    },
    {
      path: "apps/host/src/micro-apps.ts",
      content: `import type { MicroAppConfig } from "@tsuz/shared";\n\nexport const microApps: MicroAppConfig[] = [\n  {\n    name: "subapp",\n    entry: "//localhost:7101",\n    container: "#subapp-container",\n    activeRule: "/subapp"\n  }\n];\n`
    },
    {
      path: "apps/host/src/styles.css",
      content: `body {\n  margin: 0;\n  background: #f8fafc;\n  color: #0f172a;\n}\n\na {\n  color: inherit;\n  text-decoration: none;\n}\n`
    }
  ];
}

function createSubAppFiles(packageName: string): TemplateFile[] {
  return [
    {
      path: "apps/subapp/package.json",
      content: packageJson({
        name: `${packageName}-subapp`,
        private: true,
        type: "module",
        scripts: {
          dev: "vite --port 7101",
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
      path: "apps/subapp/index.html",
      content: `<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>\n`
    },
    {
      path: "apps/subapp/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\nimport qiankun from "vite-plugin-qiankun";\n\nexport default defineConfig({\n  plugins: [vue(), qiankun("subapp", { useDevMode: true })],\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url)),\n      "@tsuz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),\n      "@tsuz/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url))\n    }\n  },\n  server: {\n    port: 7101,\n    headers: {\n      "Access-Control-Allow-Origin": "*"\n    }\n  }\n});\n`
    },
    {
      path: "apps/subapp/tsconfig.json",
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
      path: "apps/subapp/src/main.ts",
      content: `import { createApp } from "vue";\nimport App from "./App.vue";\nimport { bootstrap, mount, unmount } from "./lifecycle";\nimport "./styles.css";\n\nconst app = createApp(App);\nconst poweredByQiankun = (window as Window & { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__;\n\nif (!poweredByQiankun) {\n  app.mount("#app");\n}\n\nexport { bootstrap, mount, unmount };\n`
    },
    {
      path: "apps/subapp/src/App.vue",
      content: `<script setup lang="ts">\nimport { uiBrandName } from "@tsuz/ui";\n</script>\n\n<template>\n  <section class="subapp-shell">\n    <p class="subapp-eyebrow">{{ uiBrandName }}</p>\n    <h2>Sub App is ready</h2>\n    <p>This app can run standalone or be mounted by qiankun.</p>\n  </section>\n</template>\n\n<style scoped>\n.subapp-shell {\n  min-height: 240px;\n  display: grid;\n  place-content: center;\n  gap: 0.75rem;\n  font-family: system-ui, sans-serif;\n}\n\n.subapp-eyebrow {\n  margin: 0;\n  color: #475569;\n  font-size: 0.875rem;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n}\n</style>\n`
    },
    {
      path: "apps/subapp/src/lifecycle.ts",
      content: `import { createApp } from "vue";\nimport App from "./App.vue";\n\nlet appInstance: ReturnType<typeof createApp> | null = null;\n\nexport function bootstrap() {\n  return Promise.resolve();\n}\n\nexport function mount(props: { container?: Element } = {}) {\n  const container = props.container ?? document.querySelector("#app");\n\n  if (!container) {\n    throw new Error("Missing mount container for subapp");\n  }\n\n  appInstance = createApp(App);\n  appInstance.mount(container as Element);\n  return Promise.resolve();\n}\n\nexport function unmount() {\n  appInstance?.unmount();\n  appInstance = null;\n  return Promise.resolve();\n}\n`
    },
    {
      path: "apps/subapp/src/styles.css",
      content: `body {\n  margin: 0;\n  background: #ffffff;\n  color: #0f172a;\n}\n`
    }
  ];
}

function createSharedFiles(): TemplateFile[] {
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
      content: `export interface MicroAppConfig {\n  name: string;\n  entry: string;\n  container: string;\n  activeRule: string;\n}\n\nexport const microAppNames = ["subapp"] as const;\n`
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
