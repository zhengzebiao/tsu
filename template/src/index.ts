import { createMfeAppTemplateFiles } from "./mfe-app.js";
import { createMfeMainTemplateFiles } from "./mfe-main.js";
import { createMfeTemplateFiles } from "./mfe.js";
import { createPythonAppTemplateFiles, createPythonMainTemplateFiles } from "./python.js";
import { createReactTemplateFiles } from "./react.js";
import { createVue3TemplateFiles } from "./vue3.js";

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

export type TemplateName = "default" | "monorepo" | "vue3" | "mfe" | "mfe-main" | "mfe-app" | "react" | "python-main" | "python-app";

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
    name: "mfe-main",
    description: "React qiankun host shell starter with Docker and nginx",
    tags: ["mfe", "qiankun", "react", "host", "vite", "docker", "nginx"],
    recommendedFor: ["micro frontend host", "auth shell", "app container"],
    node: ">=20",
    packageManagers: ["pnpm"],
    nextSteps: ["pnpm install", "pnpm dev"]
  },
  {
    name: "mfe-app",
    description: "React qiankun sub application starter with Docker and nginx",
    tags: ["mfe", "qiankun", "react", "sub app", "vite", "docker", "nginx"],
    recommendedFor: ["micro frontend sub app", "business app", "remote module"],
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
  },
  {
    name: "python-main",
    description: "FastAPI auth service with PostgreSQL, Redis, RS256 JWT, Alembic, Docker, nginx, and CI",
    tags: ["python", "fastapi", "auth", "postgresql", "redis"],
    recommendedFor: ["auth service", "jwt issuer", "backend api"],
    node: "not required",
    packageManagers: ["pdm"],
    nextSteps: ["pdm install", "pdm run dev"]
  },
  {
    name: "python-app",
    description: "FastAPI resource service with PostgreSQL, Redis blacklist checks, RS256 JWT verification, Docker, nginx, and CI",
    tags: ["python", "fastapi", "api", "postgresql", "redis"],
    recommendedFor: ["resource service", "business api", "jwt verifier"],
    node: "not required",
    packageManagers: ["pdm"],
    nextSteps: ["pdm install", "pdm run dev"]
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

  if (resolvedTemplateName === "mfe-main") {
    return createMfeMainTemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "mfe-app") {
    return createMfeAppTemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "react") {
    return createReactTemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "python-main") {
    return createPythonMainTemplateFiles(templateProjectNameToken);
  }

  if (resolvedTemplateName === "python-app") {
    return createPythonAppTemplateFiles(templateProjectNameToken);
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
