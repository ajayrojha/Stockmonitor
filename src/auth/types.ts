// Roles are ordered from most to least privileged. Permission checks and the
// admin module arrive in the next milestone; for now the role is only shown.
export type Role = 'admin' | 'analyst' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number; // seconds
  user: User;
}
