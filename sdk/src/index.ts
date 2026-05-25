export interface QuickStartSdkOptions {
  baseUrl: string;
}

export class QuickStartSdk {
  constructor(private readonly options: QuickStartSdkOptions) {}

  getBaseUrl() {
    return this.options.baseUrl;
  }
}
