export interface User {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: 'admin' | 'user';
  created_at?: string;
  avatar_url?: string;
}

export interface AuthSession {
  user: User | null;
  accessToken: string | null;
}