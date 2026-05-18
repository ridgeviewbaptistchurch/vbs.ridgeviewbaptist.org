export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket | undefined;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  SENTRY_DSN: string;
  SEND_EMAIL: SendEmail;
}

export type Role = 'super_admin' | 'staff_admin' | 'kiosk';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  name: string;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: { user: JwtPayload };
};

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
  last_login: string | null;
}

export interface VbsSettings {
  id: number;
  year: number;
  theme_name: string;
  logo_url: string | null;
  accent_color: string;
  active: number;
  created_at: string;
}

export interface Family {
  id: number;
  parent_name: string;
  phone: string;
  email: string;
  home_church: string;
  vbs_year: number;
  registered_at: string;
}

export interface Child {
  id: number;
  family_id: number;
  first_name: string;
  last_name: string;
  grade: string;
  notes: string | null;
  created_at: string;
}

export interface Session {
  id: number;
  vbs_year: number;
  label: string;
  date: string;
  created_at: string;
}

export interface Attendance {
  id: number;
  child_id: number;
  session_id: number;
  checked_in_at: string;
}
