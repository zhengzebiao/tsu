export interface TemplateFile {
  path: string;
  content: string;
}

export function createReactSharedPackageFiles(): TemplateFile[] {
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
        types: "./dist/index.d.ts",
        files: ["dist"],
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "vitest run"
        },
        devDependencies: {
          vitest: "^3.0.5"
        }
      })
    },
    {
      path: "packages/shared/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          rootDir: "src",
          outDir: "dist",
          noEmit: false,
          declaration: true,
          declarationMap: true,
          allowImportingTsExtensions: false
        },
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.test.ts"]
      })
    },
    {
      path: "packages/shared/src/index.ts",
      content: `export type AuthStatus = "anonymous" | "authenticating" | "authenticated";

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
}

export interface AuthBridge {
  getAccessToken: () => string | undefined;
  getCurrentUser: () => CurrentUser | undefined;
  logout: () => void;
}

export interface MicroAppMeta {
  name: string;
  title: string;
  activeRule: string;
  basename: string;
  port: number;
}

export interface MicroAppProps extends AuthBridge {
  appName: string;
  basename: string;
  apiBaseUrl: string;
  container?: HTMLElement;
}

export const MFE_APP_ROUTE = "/apps/mfe-app";
export const MFE_APP_BASENAME = MFE_APP_ROUTE;
export const DEFAULT_API_BASE_URL = "/api";
export const DEFAULT_MFE_APP_ENTRY = "//localhost:7201";

export const mfeAppMeta = {
  name: "mfe-app",
  title: "Business App",
  activeRule: MFE_APP_ROUTE,
  basename: MFE_APP_BASENAME,
  port: 7201
} as const satisfies MicroAppMeta;

export const microAppMetas = [mfeAppMeta] as const satisfies readonly MicroAppMeta[];

export type ClassValue = string | number | false | null | undefined | Record<string, boolean>;

export function classNames(...values: ClassValue[]) {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      continue;
    }

    for (const [className, enabled] of Object.entries(value)) {
      if (enabled) {
        classes.push(className);
      }
    }
  }

  return classes.join(" ");
}

export const cx = classNames;

export function matchesActiveRoute(activeRule: string, pathname: string) {
  const normalizedRule = stripTrailingSlashes(activeRule || "/");
  const normalizedPath = stripTrailingSlashes(pathname || "/");

  if (normalizedRule === "/") {
    return normalizedPath === "/";
  }

  return normalizedPath === normalizedRule || normalizedPath.startsWith(normalizedRule + "/");
}

function stripTrailingSlashes(value: string) {
  let normalized = value;

  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}
`
    },
    {
      path: "packages/shared/src/index.test.ts",
      content: `import { describe, expect, test } from "vitest";
import { classNames, DEFAULT_API_BASE_URL, matchesActiveRoute, microAppMetas } from "./index";

describe("shared micro frontend contracts", () => {
  test("exposes default route and API constants", () => {
    expect(DEFAULT_API_BASE_URL).toBe("/api");
    expect(microAppMetas[0].name).toBe("mfe-app");
    expect(microAppMetas[0].activeRule).toBe("/apps/mfe-app");
  });

  test("matches active routes without prefix collisions", () => {
    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app")).toBe(true);
    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app/settings")).toBe(true);
    expect(matchesActiveRoute("/apps/mfe-app", "/apps/mfe-app-legacy")).toBe(false);
  });

  test("joins class names from strings and dictionaries", () => {
    expect(classNames("base", { active: true, hidden: false }, undefined, "rounded")).toBe("base active rounded");
  });
});
`
    }
  ];
}

export function createReactUiPackageFiles(): TemplateFile[] {
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
        types: "./dist/index.d.ts",
        files: ["dist"],
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "node -e \"console.log('No tests configured for @tsuz/ui')\""
        },
        peerDependencies: {
          react: "^19.1.0"
        },
        devDependencies: {
          "@types/react": "^19.0.10",
          react: "^19.1.0"
        }
      })
    },
    {
      path: "packages/ui/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          rootDir: "src",
          outDir: "dist",
          noEmit: false,
          declaration: true,
          declarationMap: true,
          allowImportingTsExtensions: false
        },
        include: ["src/**/*.ts", "src/**/*.tsx"],
        exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"]
      })
    },
    {
      path: "packages/ui/src/index.tsx",
      content: `import type { CSSProperties, ReactNode } from "react";

export interface LogoProps {
  label?: string;
  subtitle?: string;
  className?: string;
}

export function Logo({ label = "Tsu MFE", subtitle = "Micro frontend workspace", className }: LogoProps) {
  return (
    <div className={joinClassNames("tsu-logo", className)} style={logoStyle}>
      <span aria-hidden="true" style={logoMarkStyle}>
        T
      </span>
      <span>
        <strong style={logoLabelStyle}>{label}</strong>
        <small style={logoSubtitleStyle}>{subtitle}</small>
      </span>
    </div>
  );
}

export interface PageContainerProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageContainer({ title, description, actions, children, className }: PageContainerProps) {
  return (
    <section className={joinClassNames("tsu-page-container", className)} style={pageContainerStyle}>
      {title || description || actions ? (
        <header style={pageHeaderStyle}>
          <div>
            {title ? <h1 style={pageTitleStyle}>{title}</h1> : null}
            {description ? <p style={pageDescriptionStyle}>{description}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title = "Nothing here yet", description, action, className }: EmptyStateProps) {
  return (
    <div className={joinClassNames("tsu-empty-state", className)} style={stateStyle}>
      <strong>{title}</strong>
      {description ? <p style={stateDescriptionStyle}>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = "Something went wrong", description, action, className }: ErrorStateProps) {
  return (
    <div className={joinClassNames("tsu-error-state", className)} style={{ ...stateStyle, borderColor: "#fecaca", background: "#fff7f7" }}>
      <strong>{title}</strong>
      {description ? <p style={stateDescriptionStyle}>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const logoStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  lineHeight: 1.1
};

const logoMarkStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "linear-gradient(135deg, #1677ff, #7c3aed)",
  color: "#fff",
  fontWeight: 800
};

const logoLabelStyle: CSSProperties = {
  display: "block",
  color: "inherit"
};

const logoSubtitleStyle: CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: 12
};

const pageContainerStyle: CSSProperties = {
  display: "grid",
  gap: 24
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-start"
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.2
};

const pageDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b"
};

const stateStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: 8,
  minHeight: 180,
  padding: 24,
  border: "1px dashed #bfdbfe",
  borderRadius: 16,
  background: "#f8fbff",
  color: "#31506f",
  textAlign: "center"
};

const stateDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b"
};
`
    }
  ];
}

export function createReactApiPackageFiles(): TemplateFile[] {
  return [
    {
      path: "packages/api/package.json",
      content: packageJson({
        name: "@tsuz/api",
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
        files: ["dist"],
        scripts: {
          build: "tsc -p tsconfig.json",
          lint: "tsc -p tsconfig.json --noEmit",
          test: "vitest run"
        },
        devDependencies: {
          vitest: "^3.0.5"
        }
      })
    },
    {
      path: "packages/api/tsconfig.json",
      content: packageJson({
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          rootDir: "src",
          outDir: "dist",
          noEmit: false,
          declaration: true,
          declarationMap: true,
          allowImportingTsExtensions: false
        },
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.test.ts"]
      })
    },
    {
      path: "packages/api/src/index.ts",
      content: `export interface CreateApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  onUnauthorized?: (response: Response) => void | Promise<void>;
  fetcher?: typeof fetch;
  defaultHeaders?: HeadersInit;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

export interface ApiClient {
  request<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
  get<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  delete<T = unknown>(path: string, options?: ApiRequestOptions): Promise<T>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly response: Response;
  readonly data: unknown;

  constructor(message: string, status: number, response: Response, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.response = response;
    this.data = data;
  }
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);

  if (!fetcher) {
    throw new Error("createApiClient requires a fetch implementation.");
  }

  async function request<T = unknown>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const { query, body, headers, ...init } = requestOptions;
    const requestHeaders = new Headers(options.defaultHeaders);

    if (headers) {
      new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
    }

    const accessToken = await options.getAccessToken?.();

    if (accessToken && !requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", "Bearer " + accessToken);
    }

    const requestInit: RequestInit = {
      ...init,
      headers: requestHeaders
    };

    if (body !== undefined) {
      requestInit.body = prepareBody(body, requestHeaders);
    }

    const response = await fetcher(resolveUrl(options.baseUrl, path, query), requestInit);
    const data = await parseResponse(response);

    if (response.status === 401) {
      await options.onUnauthorized?.(response);
    }

    if (!response.ok) {
      throw new ApiError("API request failed with status " + response.status, response.status, response, data);
    }

    return data as T;
  }

  return {
    request,
    get: (path, requestOptions) => request(path, { ...requestOptions, method: "GET" }),
    post: (path, body, requestOptions) => request(path, { ...requestOptions, method: "POST", body }),
    put: (path, body, requestOptions) => request(path, { ...requestOptions, method: "PUT", body }),
    patch: (path, body, requestOptions) => request(path, { ...requestOptions, method: "PATCH", body }),
    delete: (path, requestOptions) => request(path, { ...requestOptions, method: "DELETE" })
  };
}

function resolveUrl(baseUrl: string, path: string, query?: ApiRequestOptions["query"]) {
  const normalizedBaseUrl = stripTrailingSlashes(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  const url = new URL(normalizedBaseUrl + normalizedPath, "http://tsu.local");

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  if (normalizedBaseUrl.startsWith("http://") || normalizedBaseUrl.startsWith("https://")) {
    return url.toString();
  }

  return url.pathname + url.search;
}

function stripTrailingSlashes(value: string) {
  let normalized = value;

  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}

function prepareBody(body: unknown, headers: Headers): BodyInit {
  if (isBodyInit(body)) {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}
`
    },
    {
      path: "packages/api/src/index.test.ts",
      content: `import { describe, expect, test } from "vitest";
import { ApiError, createApiClient } from "./index";

describe("createApiClient", () => {
  test("builds URLs with query params and parses JSON", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createApiClient({
      baseUrl: "https://api.example.test/v1",
      fetcher: async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    });

    await expect(client.get("/users", { query: { page: 2, archived: false } })).resolves.toEqual({ ok: true });
    expect(String(requests[0].input)).toBe("https://api.example.test/v1/users?page=2&archived=false");
    expect(requests[0].init?.method).toBe("GET");
  });

  test("adds bearer tokens and JSON request bodies", async () => {
    let capturedHeaders: Headers | undefined;
    let capturedBody: BodyInit | null | undefined;
    const client = createApiClient({
      baseUrl: "/api",
      getAccessToken: () => "token-1",
      fetcher: async (_input, init) => {
        capturedHeaders = init?.headers as Headers;
        capturedBody = init?.body;
        return new Response(null, { status: 204 });
      }
    });

    await expect(client.post("/items", { name: "Demo" })).resolves.toBeUndefined();
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer token-1");
    expect(capturedHeaders?.get("Content-Type")).toBe("application/json");
    expect(capturedBody).toBe(JSON.stringify({ name: "Demo" }));
  });

  test("calls unauthorized handler and throws ApiError for failed responses", async () => {
    let unauthorized = false;
    const client = createApiClient({
      baseUrl: "/api",
      onUnauthorized: () => {
        unauthorized = true;
      },
      fetcher: async () =>
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
    });

    await expect(client.get("/private")).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toBe(true);
  });
});
`
    }
  ];
}

function packageJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
