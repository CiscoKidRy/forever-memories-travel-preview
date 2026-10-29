export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1 {
  prepare(query: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<unknown>;
}

export interface Env {
  DB: D1;
  GITHUB_TOKEN?: string;
  PASSWORD_PEPPER?: string;
  SETUP_TOKEN?: string;
  INQUIRY_STAFF_TOKEN?: string;
  GA_SERVICE_ACCOUNT_JSON?: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  INQUIRY_API_ORIGIN?: string;
}

export interface StaffUser {
  id: string;
  username: string;
  mustChangePassword: boolean;
}
