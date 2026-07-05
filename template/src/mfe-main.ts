export interface TemplateFile {
  path: string;
  content: string;
}

export function createMfeMainTemplateFiles(packageName: string): TemplateFile[] {
  const appPackageName = `${packageName}-main`;

  return [
    {
      path: "package.json",
      content: packageJson({
        name: packageName,
        version: "0.0.0",
        private: true,
        type: "module",
        packageManager: "pnpm@8.15.9",
        scripts: {
          dev: `pnpm --filter ${appPackageName} dev`,
          build: "turbo run build",
          lint: "eslint . --max-warnings 0 && turbo run lint",
          test: "turbo run test",
          format: "prettier . --write",
          "format:check": "prettier . --check"
        },
        devDependencies: {
          "@eslint/js": "^9.21.0",
          "@types/node": "^20.17.57",
          eslint: "^9.21.0",
          "eslint-plugin-react-hooks": "^5.2.0",
          "eslint-plugin-react-refresh": "^0.4.19",
          globals: "^16.0.0",
          prettier: "^3.5.3",
          turbo: "^2.5.3",
          "typescript-eslint": "^8.26.1",
          typescript: "^5.8.3"
        }
      })
    },
    {
      path: "README.md",
      content: createMfeMainReadme(packageName)
    },
    {
      path: "pnpm-workspace.yaml",
      content: `packages:\n  - "apps/*"\n`
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
            dependsOn: ["^test"],
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
          useDefineForClassFields: true,
          module: "ESNext",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          skipLibCheck: true,
          moduleResolution: "Bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          jsx: "react-jsx",
          forceConsistentCasingInFileNames: true
        }
      })
    },
    {
      path: ".dockerignore",
      content: `node_modules\ndist\napps/main/dist\n.git\n.github\n.turbo\ncoverage\n*.log\n*.local\n`
    },
    {
      path: ".gitignore",
      content: `node_modules/\ndist/\napps/*/dist/\n.turbo/\ncoverage/\n*.local\n*.log\n`
    },
    {
      path: "eslint.config.js",
      content: `import js from "@eslint/js";\nimport globals from "globals";\nimport tseslint from "typescript-eslint";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport reactRefresh from "eslint-plugin-react-refresh";\n\nexport default tseslint.config(\n  {\n    ignores: ["**/dist", "**/node_modules", ".turbo", "coverage"]\n  },\n  js.configs.recommended,\n  ...tseslint.configs.recommended,\n  {\n    files: ["**/*.{ts,tsx}"],\n    languageOptions: {\n      ecmaVersion: "latest",\n      sourceType: "module",\n      globals: globals.browser\n    },\n    plugins: {\n      "react-hooks": reactHooks,\n      "react-refresh": reactRefresh\n    },\n    rules: {\n      ...reactHooks.configs.recommended.rules,\n      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]\n    }\n  }\n);\n`
    },
    {
      path: "prettier.config.js",
      content: `export default {\n  printWidth: 120,\n  tabWidth: 2,\n  semi: true,\n  singleQuote: false,\n  trailingComma: "none"\n};\n`
    },
    {
      path: ".prettierignore",
      content: `node_modules\ndist\napps/*/dist\n.turbo\ncoverage\npnpm-lock.yaml\n`
    },
    {
      path: "apps/main/package.json",
      content: packageJson({
        name: appPackageName,
        version: "0.0.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite --host 0.0.0.0 --port 7200",
          build: "tsc -p tsconfig.json --noEmit && vite build",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "vitest run",
          preview: "vite preview --port 7200"
        },
        dependencies: {
          "@tanstack/react-query": "^5.66.9",
          antd: "^5.24.4",
          qiankun: "^2.10.16",
          react: "^19.1.0",
          "react-dom": "^19.1.0",
          "react-router-dom": "^7.6.2",
          zustand: "^5.0.3"
        },
        devDependencies: {
          "@types/react": "^19.0.10",
          "@types/react-dom": "^19.0.4",
          "@vitejs/plugin-react": "^4.3.4",
          autoprefixer: "^10.4.20",
          postcss: "^8.5.3",
          tailwindcss: "^3.4.17",
          typescript: "^5.8.3",
          vite: "^6.2.0",
          vitest: "^3.0.5"
        }
      })
    },
    {
      path: "apps/main/.env.example",
      content: `VITE_API_BASE_URL=/api\nVITE_MFE_APP_ENTRY=//localhost:7201\n`
    },
    {
      path: "apps/main/index.html",
      content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
    },
    {
      path: "apps/main/vite.config.ts",
      content: `import { fileURLToPath, URL } from "node:url";\nimport { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 7200,\n    strictPort: true\n  },\n  resolve: {\n    alias: {\n      "@": fileURLToPath(new URL("./src", import.meta.url))\n    }\n  }\n});\n`
    },
    {
      path: "apps/main/tailwind.config.js",
      content: `export default {\n  content: ["./index.html", "./src/**/*.{ts,tsx}"],\n  theme: {\n    extend: {\n      colors: {\n        shell: {\n          bg: "#f5f7fb",\n          text: "#172033"\n        }\n      }\n    }\n  },\n  plugins: []\n};\n`
    },
    {
      path: "apps/main/postcss.config.js",
      content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {}\n  }\n};\n`
    },
    {
      path: "apps/main/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"]
          }
        },
        include: ["vite.config.ts", "src/**/*.ts", "src/**/*.tsx"]
      })
    },
    {
      path: "apps/main/src/main.tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport { AppProviders } from "./providers/AppProviders";\nimport { registerMicroFrontendApps } from "./micro-apps/registry";\nimport "./styles/main.css";\n\nregisterMicroFrontendApps();\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <AppProviders>\n      <App />\n    </AppProviders>\n  </StrictMode>\n);\n`
    },
    {
      path: "apps/main/src/App.tsx",
      content: `import type { ReactNode } from "react";\nimport { Avatar, Button, Card, Layout, List, Space, Tag, Typography } from "antd";\nimport { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";\nimport RequireAuth from "./components/RequireAuth";\nimport LoginPage from "./pages/LoginPage";\nimport { useAuthStore } from "./stores/auth.store";\n\nconst { Header, Content } = Layout;\nconst projectName = "${packageName}";\n\nconst roadmapItems = [\n  "Phase 3: login page, auth state, and qiankun registry",\n  "Phase 4: shared, ui, and api workspace packages",\n  "Phase 5: richer sub application lifecycle and business routes"\n];\n\nexport default function App() {\n  return (\n    <Routes>\n      <Route path="/login" element={<LoginPage />} />\n      <Route\n        path="/"\n        element={\n          <RequireAuth>\n            <AuthenticatedShell>\n              <HostHome />\n            </AuthenticatedShell>\n          </RequireAuth>\n        }\n      />\n      <Route\n        path="/apps/mfe-app/*"\n        element={\n          <RequireAuth>\n            <AuthenticatedShell>\n              <MicroAppOutlet />\n            </AuthenticatedShell>\n          </RequireAuth>\n        }\n      />\n      <Route path="*" element={<Navigate to="/" replace />} />\n    </Routes>\n  );\n}\n\ninterface AuthenticatedShellProps {\n  children: ReactNode;\n}\n\nfunction AuthenticatedShell({ children }: AuthenticatedShellProps) {\n  const navigate = useNavigate();\n  const user = useAuthStore((state) => state.user);\n  const logout = useAuthStore((state) => state.logout);\n\n  async function handleLogout() {\n    await logout();\n    navigate("/login", { replace: true });\n  }\n\n  return (\n    <Layout className="app-shell bg-slate-50 text-slate-800">\n      <Header className="app-header">\n        <Typography.Title className="app-title" level={3}>\n          {projectName}\n        </Typography.Title>\n        <nav className="app-nav">\n          <Link to="/">Host shell</Link>\n          <Link to="/apps/mfe-app">Business app</Link>\n        </nav>\n        <Space className="user-menu" size="middle">\n          <Avatar>{user?.name.slice(0, 1).toUpperCase() ?? "U"}</Avatar>\n          <Typography.Text className="user-name">{user?.name}</Typography.Text>\n          <Button ghost onClick={handleLogout}>\n            Logout\n          </Button>\n        </Space>\n      </Header>\n      <Content className="app-content">{children}</Content>\n    </Layout>\n  );\n}\n\nfunction HostHome() {\n  const user = useAuthStore((state) => state.user);\n\n  return (\n    <Card title="React qiankun host shell">\n      <Space direction="vertical" size="large" className="full-width">\n        <Typography.Paragraph>\n          Generated by Tsu from the <code>mfe-main</code> template. This Phase 3 host shell includes\n          login state, demo auth service, React Query providers, and a qiankun registry that can pass auth\n          props to sub applications.\n        </Typography.Paragraph>\n        <Space wrap>\n          <Tag color="blue">React</Tag>\n          <Tag color="purple">qiankun</Tag>\n          <Tag color="green">Authenticated host</Tag>\n        </Space>\n        <Card size="small" title="Current user">\n          <Typography.Text>{user?.name} ({user?.username})</Typography.Text>\n          <br />\n          <Typography.Text type="secondary">Roles: {user?.roles.join(", ")}</Typography.Text>\n        </Card>\n        <List bordered dataSource={roadmapItems} renderItem={(item) => <List.Item>{item}</List.Item>} />\n      </Space>\n    </Card>\n  );\n}\n\nfunction MicroAppOutlet() {\n  return (\n    <Card title="Business sub application outlet">\n      <Typography.Paragraph>\n        qiankun registers the generated <code>mfe-app</code> here and passes <code>apiBaseUrl</code>,\n        <code>getAccessToken</code>, <code>getCurrentUser</code>, and <code>logout</code> through props.\n      </Typography.Paragraph>\n      <div id="subapp-container" className="subapp-container rounded-xl">\n        Start an <code>mfe-app</code> project on port 7201 to mount it in this container.\n      </div>\n    </Card>\n  );\n}\n`
    },
    {
      path: "apps/main/src/components/RequireAuth.tsx",
      content: `import type { ReactNode } from "react";\nimport { Navigate, useLocation } from "react-router-dom";\nimport { useAuthStore } from "../stores/auth.store";\n\ninterface RequireAuthProps {\n  children: ReactNode;\n}\n\nexport default function RequireAuth({ children }: RequireAuthProps) {\n  const status = useAuthStore((state) => state.status);\n  const user = useAuthStore((state) => state.user);\n  const location = useLocation();\n\n  if (status !== "authenticated" || !user) {\n    return <Navigate to="/login" replace state={{ from: location }} />;\n  }\n\n  return children;\n}\n`
    },
    {
      path: "apps/main/src/micro-apps/config.ts",
      content: `import type { CurrentUser } from "../types/auth";\n\nexport interface AuthBridge {\n  getAccessToken: () => string | undefined;\n  getCurrentUser: () => CurrentUser | undefined;\n  logout: () => void;\n}\n\nexport interface MicroAppMeta {\n  name: string;\n  title: string;\n  activeRule: string;\n  basename: string;\n  port: number;\n}\n\nexport interface MicroAppProps extends AuthBridge {\n  appName: string;\n  basename: string;\n  apiBaseUrl: string;\n}\n\nexport interface MicroAppRegistration {\n  name: string;\n  entry: string;\n  container: string;\n  activeRule: (location: Location) => boolean;\n  props: MicroAppProps;\n}\n\nexport type MicroAppEnvironment = Partial<Record<"VITE_API_BASE_URL" | "VITE_MFE_APP_ENTRY", string | undefined>>;\n\nexport interface CreateMicroAppsOptions {\n  env?: MicroAppEnvironment;\n  hostname?: string;\n  containerSelector?: string;\n  isAuthenticated?: () => boolean;\n  isContainerReady?: () => boolean;\n}\n\nexport const microAppMetas: MicroAppMeta[] = [\n  {\n    name: "mfe-app",\n    title: "Business App",\n    activeRule: "/apps/mfe-app",\n    basename: "/apps/mfe-app",\n    port: 7201\n  }\n];\n\nexport function resolveApiBaseUrl(env: MicroAppEnvironment = readViteEnvironment()) {\n  return env.VITE_API_BASE_URL?.trim() || "/api";\n}\n\nexport function resolveMicroAppEntry(\n  meta: MicroAppMeta = microAppMetas[0],\n  env: MicroAppEnvironment = readViteEnvironment(),\n  hostname = getDefaultHostname()\n) {\n  return env.VITE_MFE_APP_ENTRY?.trim() || "//" + hostname + ":" + meta.port;\n}\n\nexport function matchesActiveRule(activeRule: string, pathname: string) {\n  return pathname === activeRule || pathname.startsWith(activeRule + "/");\n}\n\nexport function createMicroApps(authBridge: AuthBridge, options: CreateMicroAppsOptions = {}): MicroAppRegistration[] {\n  const env = options.env ?? readViteEnvironment();\n  const hostname = options.hostname ?? getDefaultHostname();\n  const containerSelector = options.containerSelector ?? "#subapp-container";\n  const apiBaseUrl = resolveApiBaseUrl(env);\n\n  return microAppMetas.map((meta) => ({\n    name: meta.name,\n    entry: resolveMicroAppEntry(meta, env, hostname),\n    container: containerSelector,\n    activeRule: (location) =>\n      isAuthenticated(authBridge, options) &&\n      isContainerReady(containerSelector, options) &&\n      matchesActiveRule(meta.activeRule, location.pathname),\n    props: {\n      appName: meta.name,\n      basename: meta.basename,\n      apiBaseUrl,\n      getAccessToken: authBridge.getAccessToken,\n      getCurrentUser: authBridge.getCurrentUser,\n      logout: authBridge.logout\n    }\n  }));\n}\n\nfunction isAuthenticated(authBridge: AuthBridge, options: CreateMicroAppsOptions) {\n  return options.isAuthenticated?.() ?? Boolean(authBridge.getAccessToken());\n}\n\nfunction isContainerReady(containerSelector: string, options: CreateMicroAppsOptions) {\n  return options.isContainerReady?.() ?? hasMicroAppContainer(containerSelector);\n}\n\nfunction hasMicroAppContainer(containerSelector: string) {\n  return typeof document !== "undefined" && document.querySelector(containerSelector) !== null;\n}\n\nfunction readViteEnvironment(): MicroAppEnvironment {\n  return import.meta.env;\n}\n\nfunction getDefaultHostname() {\n  return globalThis.location?.hostname || "localhost";\n}\n`
    },
    {
      path: "apps/main/src/micro-apps/config.test.ts",
      content: `import { describe, expect, test } from "vitest";\nimport { createMicroApps, matchesActiveRule, resolveApiBaseUrl, resolveMicroAppEntry } from "./config";\n\nconst authBridge = {\n  getAccessToken: () => "demo-token",\n  getCurrentUser: () => ({\n    id: "user-1",\n    name: "Demo Admin",\n    username: "admin",\n    roles: ["admin"],\n    permissions: ["mfe:read"]\n  }),\n  logout: () => {\n    window.dispatchEvent(new Event("test-logout"));\n  }\n};\n\ndescribe("micro app config", () => {\n  test("matches active rules without prefix collisions", () => {\n    expect(matchesActiveRule("/apps/mfe-app", "/apps/mfe-app")).toBe(true);\n    expect(matchesActiveRule("/apps/mfe-app", "/apps/mfe-app/settings")).toBe(true);\n    expect(matchesActiveRule("/apps/mfe-app", "/apps/mfe-app-legacy")).toBe(false);\n  });\n\n  test("resolves entries and api base urls from environment overrides", () => {\n    expect(resolveApiBaseUrl({})).toBe("/api");\n    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "https://api.example.test" })).toBe("https://api.example.test");\n    expect(resolveMicroAppEntry(undefined, {}, "localhost")).toBe("//localhost:7201");\n    expect(resolveMicroAppEntry(undefined, { VITE_MFE_APP_ENTRY: "https://cdn.example.test/mfe-app/" }, "localhost")).toBe(\n      "https://cdn.example.test/mfe-app/"\n    );\n  });\n\n  test("creates qiankun registrations with auth props", () => {\n    const [app] = createMicroApps(authBridge, {\n      env: { VITE_API_BASE_URL: "https://api.example.test" },\n      hostname: "localhost",\n      isAuthenticated: () => true,\n      isContainerReady: () => true\n    });\n\n    expect(app.name).toBe("mfe-app");\n    expect(app.entry).toBe("//localhost:7201");\n    expect(app.container).toBe("#subapp-container");\n    expect(app.activeRule({ pathname: "/apps/mfe-app" } as Location)).toBe(true);\n    expect(app.activeRule({ pathname: "/apps/mfe-app-legacy" } as Location)).toBe(false);\n    expect(app.props.apiBaseUrl).toBe("https://api.example.test");\n    expect(app.props.getAccessToken()).toBe("demo-token");\n    expect(app.props.getCurrentUser()?.username).toBe("admin");\n    expect(typeof app.props.logout).toBe("function");\n  });\n});\n`
    },
    {
      path: "apps/main/src/micro-apps/registry.ts",
      content: `import { registerMicroApps, start } from "qiankun";\nimport { authBridge, useAuthStore } from "../stores/auth.store";\nimport { createMicroApps } from "./config";\n\nlet registered = false;\n\nexport function registerMicroFrontendApps() {\n  if (registered) {\n    return;\n  }\n\n  registerMicroApps(\n    createMicroApps(authBridge, {\n      isAuthenticated: () => useAuthStore.getState().status === "authenticated",\n      isContainerReady: () => document.querySelector("#subapp-container") !== null\n    })\n  );\n  start({ prefetch: false });\n  registered = true;\n}\n`
    },
    {
      path: "apps/main/src/pages/LoginPage.tsx",
      content: `import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";\nimport { useLocation, useNavigate } from "react-router-dom";\nimport type { LoginCredentials } from "../types/auth";\nimport { useAuthStore } from "../stores/auth.store";\n\ninterface RedirectState {\n  from?: {\n    pathname?: string;\n  };\n}\n\nexport default function LoginPage() {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const login = useAuthStore((state) => state.login);\n  const status = useAuthStore((state) => state.status);\n  const error = useAuthStore((state) => state.error);\n  const redirectTo = getRedirectPath(location.state);\n\n  async function handleFinish(values: LoginCredentials) {\n    await login(values);\n    navigate(redirectTo, { replace: true });\n  }\n\n  return (\n    <main className="login-page">\n      <Card className="login-card" title="Sign in to the MFE host">\n        <Space direction="vertical" size="large" className="full-width">\n          <Typography.Paragraph type="secondary">\n            Use the demo account to exercise auth state and qiankun props without a backend.\n          </Typography.Paragraph>\n          <Alert message="Demo credentials" description="Username: admin / Password: password123" type="info" showIcon />\n          {error ? <Alert message={error} type="error" showIcon /> : null}\n          <Form<LoginCredentials>\n            layout="vertical"\n            initialValues={{ username: "admin", password: "password123" }}\n            onFinish={handleFinish}\n          >\n            <Form.Item name="username" label="Username" rules={[{ required: true, message: "Username is required" }]}>\n              <Input autoComplete="username" />\n            </Form.Item>\n            <Form.Item name="password" label="Password" rules={[{ required: true, message: "Password is required" }]}>\n              <Input.Password autoComplete="current-password" />\n            </Form.Item>\n            <Button type="primary" htmlType="submit" loading={status === "authenticating"} block>\n              Sign in\n            </Button>\n          </Form>\n        </Space>\n      </Card>\n    </main>\n  );\n}\n\nfunction getRedirectPath(state: unknown) {\n  if (isRedirectState(state) && state.from?.pathname) {\n    return state.from.pathname;\n  }\n\n  return "/apps/mfe-app";\n}\n\nfunction isRedirectState(value: unknown): value is RedirectState {\n  return typeof value === "object" && value !== null && "from" in value;\n}\n`
    },
    {
      path: "apps/main/src/providers/AppProviders.tsx",
      content: `import type { PropsWithChildren } from "react";\nimport { QueryClientProvider } from "@tanstack/react-query";\nimport { BrowserRouter } from "react-router-dom";\nimport { queryClient } from "./query-client";\n\nexport function AppProviders({ children }: PropsWithChildren) {\n  return (\n    <QueryClientProvider client={queryClient}>\n      <BrowserRouter>{children}</BrowserRouter>\n    </QueryClientProvider>\n  );\n}\n`
    },
    {
      path: "apps/main/src/providers/query-client.ts",
      content: `import { QueryClient } from "@tanstack/react-query";\n\nexport const queryClient = new QueryClient({\n  defaultOptions: {\n    queries: {\n      retry: 1,\n      staleTime: 30_000\n    }\n  }\n});\n`
    },
    {
      path: "apps/main/src/services/auth.service.ts",
      content: `import type { AuthSession, LoginCredentials } from "../types/auth";\n\nconst demoUser = {\n  id: "user-1",\n  name: "Demo Admin",\n  username: "admin",\n  roles: ["admin"],\n  permissions: ["mfe:read", "mfe:write"]\n};\n\nexport async function loginWithPassword(credentials: LoginCredentials): Promise<AuthSession> {\n  const username = credentials.username.trim();\n\n  if (!username || !credentials.password) {\n    throw new Error("Username and password are required.");\n  }\n\n  if (username !== demoUser.username || credentials.password !== "password123") {\n    throw new Error("Invalid demo credentials. Use admin / password123.");\n  }\n\n  return {\n    accessToken: "demo-token-" + username,\n    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),\n    user: demoUser\n  };\n}\n\nexport async function logoutSession(): Promise<void> {\n  return Promise.resolve();\n}\n`
    },
    {
      path: "apps/main/src/services/auth.service.test.ts",
      content: `import { describe, expect, test } from "vitest";\nimport { loginWithPassword } from "./auth.service";\n\ndescribe("auth service", () => {\n  test("returns a demo session for valid credentials", async () => {\n    const session = await loginWithPassword({ username: "admin", password: "password123" });\n\n    expect(session.accessToken).toBe("demo-token-admin");\n    expect(session.user.username).toBe("admin");\n    expect(session.user.roles).toContain("admin");\n  });\n\n  test("rejects empty credentials", async () => {\n    await expect(loginWithPassword({ username: "", password: "password123" })).rejects.toThrow(\n      "Username and password are required."\n    );\n  });\n\n  test("rejects invalid demo credentials", async () => {\n    await expect(loginWithPassword({ username: "admin", password: "wrong" })).rejects.toThrow(\n      "Invalid demo credentials."\n    );\n  });\n});\n`
    },
    {
      path: "apps/main/src/stores/auth.store.ts",
      content: `import { create } from "zustand";\nimport { loginWithPassword, logoutSession } from "../services/auth.service";\nimport type { AuthSession, AuthStatus, CurrentUser, LoginCredentials } from "../types/auth";\n\ninterface AuthState {\n  status: AuthStatus;\n  user?: CurrentUser;\n  accessToken?: string;\n  error?: string;\n  login: (credentials: LoginCredentials) => Promise<AuthSession>;\n  logout: () => Promise<void>;\n  getAccessToken: () => string | undefined;\n  getCurrentUser: () => CurrentUser | undefined;\n}\n\nexport const useAuthStore = create<AuthState>((set, get) => ({\n  status: "anonymous",\n  user: undefined,\n  accessToken: undefined,\n  error: undefined,\n  async login(credentials) {\n    set({ status: "authenticating", error: undefined });\n\n    try {\n      const session = await loginWithPassword(credentials);\n\n      set({\n        status: "authenticated",\n        user: session.user,\n        accessToken: session.accessToken,\n        error: undefined\n      });\n\n      return session;\n    } catch (error) {\n      const message = error instanceof Error ? error.message : "Login failed.";\n\n      set({\n        status: "anonymous",\n        user: undefined,\n        accessToken: undefined,\n        error: message\n      });\n\n      throw error;\n    }\n  },\n  async logout() {\n    await logoutSession();\n    set({ status: "anonymous", user: undefined, accessToken: undefined, error: undefined });\n  },\n  getAccessToken: () => get().accessToken,\n  getCurrentUser: () => get().user\n}));\n\nexport const authBridge = {\n  getAccessToken: () => useAuthStore.getState().getAccessToken(),\n  getCurrentUser: () => useAuthStore.getState().getCurrentUser(),\n  logout: () => {\n    void useAuthStore.getState().logout();\n  }\n};\n`
    },
    {
      path: "apps/main/src/styles/main.css",
      content: `@import "antd/dist/reset.css";\n\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  color: #172033;\n  background: #f5f7fb;\n}\n\nbody {\n  margin: 0;\n}\n\n.full-width {\n  width: 100%;\n}\n\n.login-page {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 32px;\n  background:\n    radial-gradient(circle at top left, rgba(22, 119, 255, 0.14), transparent 28rem),\n    linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%);\n}\n\n.login-card {\n  width: min(440px, 100%);\n  box-shadow: 0 24px 80px rgba(49, 80, 111, 0.16);\n}\n\n.app-shell {\n  min-height: 100vh;\n}\n\n.app-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}\n\n.app-title {\n  margin: 0 !important;\n  color: #fff !important;\n}\n\n.app-nav {\n  display: flex;\n  flex: 1;\n  gap: 16px;\n}\n\n.app-nav a {\n  color: #dbeafe;\n  text-decoration: none;\n}\n\n.user-menu {\n  color: #fff;\n}\n\n.user-name {\n  color: #fff;\n}\n\n.app-content {\n  padding: 32px;\n}\n\n.subapp-container {\n  min-height: 320px;\n  display: grid;\n  place-items: center;\n  border: 1px dashed #91caff;\n  background: #f0f7ff;\n  color: #31506f;\n}\n`
    },
    {
      path: "apps/main/src/types/auth.ts",
      content: `export type AuthStatus = "anonymous" | "authenticating" | "authenticated";\n\nexport interface CurrentUser {\n  id: string;\n  name: string;\n  username: string;\n  roles: string[];\n  permissions: string[];\n}\n\nexport interface LoginCredentials {\n  username: string;\n  password: string;\n}\n\nexport interface AuthSession {\n  accessToken: string;\n  expiresAt: string;\n  user: CurrentUser;\n}\n`
    },
    {
      path: "apps/main/src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />\n\ninterface ImportMetaEnv {\n  readonly VITE_API_BASE_URL?: string;\n  readonly VITE_MFE_APP_ENTRY?: string;\n}\n\ninterface ImportMeta {\n  readonly env: ImportMetaEnv;\n}\n`
    }
  ];
}

function createMfeMainReadme(packageName: string) {
  return `# ${packageName}

Generated by Tsu from the \`mfe-main\` template.

This is the Phase 3 React qiankun host shell starter. It generates a main application with a demo login flow, auth state, React Query providers, and qiankun micro-app registration that passes auth props to sub applications.

## Tech Stack

- React
- TypeScript
- Vite
- qiankun
- React Router
- Zustand
- TanStack Query
- Ant Design
- Tailwind CSS
- Vitest
- ESLint
- Prettier
- pnpm workspace
- Turbo

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

The host application runs on http://localhost:7200.

Open http://localhost:7200/login and sign in with the demo account.

Demo credentials:

- Username: \`admin\`
- Password: \`password123\`

## Environment Variables

Copy \`apps/main/.env.example\` to \`apps/main/.env.local\` when you need local overrides.

| Variable | Default | Purpose |
| --- | --- | --- |
| \`VITE_API_BASE_URL\` | \`/api\` | API base URL passed to sub applications |
| \`VITE_MFE_APP_ENTRY\` | \`//localhost:7201\` | qiankun entry URL for the generated \`mfe-app\` template |

## Scripts

| Script | Description |
| --- | --- |
| \`pnpm dev\` | Start the React host shell |
| \`pnpm lint\` | Run ESLint and TypeScript checks |
| \`pnpm test\` | Run generated Vitest unit tests |
| \`pnpm build\` | Build the workspace through Turbo |
| \`pnpm format\` | Format generated source files |
| \`pnpm format:check\` | Check formatting without writing files |

## Project Structure

| Path | Purpose |
| --- | --- |
| \`apps/main/src/main.tsx\` | React host bootstrap and qiankun registration startup |
| \`apps/main/src/App.tsx\` | Authenticated host shell and micro-app outlet route |
| \`apps/main/src/pages/LoginPage.tsx\` | Demo login page |
| \`apps/main/src/stores/auth.store.ts\` | Zustand auth state and host-to-sub-app auth bridge |
| \`apps/main/src/services/auth.service.ts\` | Demo auth service; replace internals when connecting a real backend |
| \`apps/main/src/providers/AppProviders.tsx\` | React Query and Router providers |
| \`apps/main/src/micro-apps/config.ts\` | Pure qiankun app config helpers and env-driven entry resolution |
| \`apps/main/src/micro-apps/registry.ts\` | qiankun side-effect registration and start guard |
| \`apps/main/src/styles/main.css\` | Ant Design reset, Tailwind directives, and host shell styles |
| \`apps/main/.env.example\` | Local environment variable example |
| \`eslint.config.js\` | ESLint flat config for TypeScript and React hooks |
| \`prettier.config.js\` | Prettier formatting config |
| \`turbo.json\` | Workspace build, lint, and test pipeline |

## Auth and Micro-App Props

The host owns login state. The qiankun registry passes these props to sub applications:

- \`apiBaseUrl\`
- \`getAccessToken\`
- \`getCurrentUser\`
- \`logout\`

Start a generated \`mfe-app\` project on port 7201, then visit http://localhost:7200/apps/mfe-app after logging in to mount it in \`#subapp-container\`.

## Phase Roadmap

- Phase 4 adds shared, ui, and api workspace packages.
- Phase 5 enriches the sub application with business pages, state, queries, and lifecycle tests.
- Later phases add E2E, Docker, CI, deploy, and documentation.
`;
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
