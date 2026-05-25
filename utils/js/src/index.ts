export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return keys.reduce<Pick<T, K>>((result, key) => {
    result[key] = source[key];
    return result;
  }, {} as Pick<T, K>);
}
