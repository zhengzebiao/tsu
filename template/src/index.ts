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

export type TemplateName = "default" | "monorepo";

const templateNames: TemplateName[] = ["default", "monorepo"];
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
