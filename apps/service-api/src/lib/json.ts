export function parseJsonSafe<T>(value: string): T {
  return JSON.parse(value) as T;
}
