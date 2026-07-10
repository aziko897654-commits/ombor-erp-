import { api } from './client';

export type Role = 'admin' | 'accountant' | 'warehouse' | 'sales' | 'hr';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export async function loginRequest(email: string, password: string) {
  const res = await api.post<{ data: LoginResponse }>('/auth/login', {
    email,
    password,
  });
  return res.data.data;
}

export async function meRequest() {
  const res = await api.get<{ data: User }>('/auth/me');
  return res.data.data;
}

export async function logoutRequest() {
  await api.post('/auth/logout');
}
