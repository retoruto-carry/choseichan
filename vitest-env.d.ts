import 'vitest';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
  }

  export const env: ProvidedEnv;
  export function applyD1Migrations(db: D1Database, migrations: D1Migration[]): Promise<void>;
}

interface D1Migration {
  name: string;
  query: string;
}
