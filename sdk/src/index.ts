export interface QuickStartSdkOptions {
  baseUrl: string;
}

export interface RequestAdapterOptions {
  method: "GET";
  url: string;
  path: string;
}

export type RequestAdapter = (options: RequestAdapterOptions) => Promise<unknown>;

export interface CreateClientOptions extends QuickStartSdkOptions {
  adapter?: RequestAdapter;
}

export class SdkError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "SdkError";
  }
}

export class QuickStartSdk {
  constructor(private readonly options: QuickStartSdkOptions) {}

  getBaseUrl() {
    return this.options.baseUrl;
  }
}

export function createClient(options: CreateClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  return {
    getBaseUrl() {
      return baseUrl;
    },
    async get<T>(path: string) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${baseUrl}${normalizedPath}`;

      if (options.adapter) {
        return (await options.adapter({ method: "GET", url, path: normalizedPath })) as T;
      }

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new SdkError(`Request failed with status ${response.status}`, response.status);
        }

        return (await response.json()) as T;
      } catch (error: unknown) {
        if (error instanceof SdkError) {
          throw error;
        }

        throw new SdkError("Request failed", undefined, error);
      }
    }
  };
}
