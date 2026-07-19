import { api } from './client';
import type { Meta } from './warehouse';

export type EmployeeStatus = 'active' | 'fired';
export type AttendanceStatus = 'present' | 'absent' | 'vacation' | 'sick';

export interface CatalogItem {
  id: number;
  name: string;
  _count?: { employees: number };
}

export interface EmployeeLogin {
  id: number;
  email: string;
  role: 'admin' | 'accountant' | 'warehouse' | 'sales' | 'hr';
  isActive: boolean;
}

export interface Employee {
  id: number;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  departmentId: number;
  positionId: number;
  department?: { id: number; name: string };
  position?: { id: number; name: string };
  salary: string;
  hiredAt: string;
  firedAt?: string | null;
  status: EmployeeStatus;
  /** linked login account (null if the employee cannot sign in) */
  user?: EmployeeLogin | null;
}

export interface PayrollItemRow {
  id: number;
  employeeId: number;
  employee?: {
    id: number;
    fullName: string;
    position?: { name: string };
  };
  baseSalary: string;
  bonus: string;
  penalty: string;
  advance: string;
  amount: string;
  payroll?: { id: number; month: string };
}

export interface AdvanceRow {
  id: number;
  employeeId: number;
  employee?: { id: number; fullName: string };
  accountId: number;
  accountName?: string | null;
  date: string;
  amount: string;
  note?: string | null;
}

export interface EmployeeDetail extends Employee {
  attendanceSummary: { month: string; counts: Record<string, number> };
  payrollItems: PayrollItemRow[];
  advances: AdvanceRow[];
}

export interface AttendanceMonth {
  month: string;
  employees: Array<{ id: number; fullName: string; hiredAt: string }>;
  entries: Array<{ employeeId: number; date: string; status: AttendanceStatus }>;
}

export interface Payroll {
  id: number;
  month: string;
  total: string;
  createdAt: string;
  _count?: { items: number };
  items?: PayrollItemRow[];
}

export interface PayrollPreviewRow {
  employeeId: number;
  fullName: string;
  baseSalary: string;
  advance: string;
  /** TASK-032: month attendance counts, informational only */
  attendance: {
    present: number;
    absent: number;
    sick: number;
    vacation: number;
  };
}

// --- Catalogs ---
export const getDepartments = async () =>
  (await api.get<{ data: CatalogItem[] }>('/departments')).data.data;
export const createDepartment = async (name: string) =>
  (await api.post<{ data: CatalogItem }>('/departments', { name })).data.data;
export const getPositions = async () =>
  (await api.get<{ data: CatalogItem[] }>('/positions')).data.data;
export const createPosition = async (name: string) =>
  (await api.post<{ data: CatalogItem }>('/positions', { name })).data.data;

// --- Employees ---
export const getEmployees = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: EmployeeStatus;
  sort?: 'asc' | 'desc';
}) =>
  (
    await api.get<{ data: Employee[]; meta: Meta }>('/employees', { params })
  ).data;
export const getEmployee = async (id: number) =>
  (await api.get<{ data: EmployeeDetail }>(`/employees/${id}`)).data.data;
export const createEmployee = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Employee }>('/employees', body)).data.data;
export const updateEmployee = async (id: number, body: Record<string, unknown>) =>
  (await api.patch<{ data: Employee }>(`/employees/${id}`, body)).data.data;

// --- Attendance ---
export const getAttendanceMonth = async (month: string) =>
  (
    await api.get<{ data: AttendanceMonth }>('/attendance', {
      params: { month },
    })
  ).data.data;
export const setAttendance = async (body: {
  employeeId: number;
  date: string;
  status: AttendanceStatus | 'clear';
}) => (await api.post('/attendance', body)).data.data;

// --- Advances ---
export const getAdvances = async (params: { page?: number; sort?: 'asc' | 'desc' }) =>
  (
    await api.get<{ data: AdvanceRow[]; meta: Meta }>('/advances', { params })
  ).data;
export const createAdvance = async (body: Record<string, unknown>) =>
  (await api.post<{ data: AdvanceRow }>('/advances', body)).data.data;

// --- Payroll ---
export const getPayrolls = async (params: { page?: number; sort?: 'asc' | 'desc' }) =>
  (await api.get<{ data: Payroll[]; meta: Meta }>('/payroll', { params })).data;
export const getPayroll = async (id: number) =>
  (await api.get<{ data: Payroll }>(`/payroll/${id}`)).data.data;
export const getPayrollPreview = async (month: string) =>
  (
    await api.get<{ data: { month: string; rows: PayrollPreviewRow[] } }>(
      '/payroll/preview',
      { params: { month } },
    )
  ).data.data;
export const createPayroll = async (body: Record<string, unknown>) =>
  (await api.post<{ data: Payroll }>('/payroll', body)).data.data;
