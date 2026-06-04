export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return keys.reduce<Pick<T, K>>((result, key) => {
    result[key] = source[key];
    return result;
  }, {} as Pick<T, K>);
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (isPlainObject(error) && typeof error.message === "string") {
    return error.message;
  }

  return "Unexpected error";
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
