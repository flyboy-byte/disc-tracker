// Minimal in-memory stand-in for expo-file-system, used only by catalog/*.test.ts via
// jest.mock('expo-file-system', () => require('./__testutils__/mockFileSystem')). The real
// module is a native binding with no node-environment implementation, so ts-jest (testEnvironment
// 'node', per jest.config.js) can't load it directly — this mimics just the surface catalogLoader
// / catalogSync actually use.
const store = new Map<string, string>();

function partUri(p: unknown): string {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && 'uri' in p) return (p as { uri: string }).uri;
  return String(p);
}

function joinUri(parts: unknown[]): string {
  return parts
    .map(partUri)
    .join('/')
    .replace(/\/+/g, '/');
}

export class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = joinUri(parts);
  }
  get exists() {
    return true; // directories are implicit in this flat mock — good enough for our usage
  }
  create(): void {
    /* no-op */
  }
}

export class File {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = joinUri(parts);
  }
  get exists(): boolean {
    return store.has(this.uri);
  }
  create(): void {
    if (!store.has(this.uri)) store.set(this.uri, '');
  }
  write(content: string): void {
    store.set(this.uri, content);
  }
  delete(): void {
    store.delete(this.uri);
  }
  async text(): Promise<string> {
    const v = store.get(this.uri);
    if (v === undefined) throw new Error(`ENOENT: ${this.uri}`);
    return v;
  }
  async move(destination: File): Promise<void> {
    const v = store.get(this.uri);
    store.delete(this.uri);
    if (v !== undefined) store.set(destination.uri, v);
  }
}

export const Paths = {
  document: '/mock/document',
  cache: '/mock/cache',
};

// Test-only helpers (not part of the real expo-file-system surface).
export function __reset(): void {
  store.clear();
}
export function __setFile(uri: string, content: string): void {
  store.set(uri, content);
}
export function __getFile(uri: string): string | undefined {
  return store.get(uri);
}
