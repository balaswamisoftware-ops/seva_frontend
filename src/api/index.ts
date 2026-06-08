import { api, unwrap } from './client';
import type {
  Employee, Event, Seva, Ticket, OrgSettings, Paginated, ReceiptPayload, Role, Status, PaymentMode, EventStatus, SevaStatus, DonationPurpose,
  Devotee, EventParticipation, AuditEntry, AuditEntityType, AuditActionType,
} from '@/types';

// ---- Auth ----
export const authApi = {
  login: (pin: string) =>
    api.post('/auth/login', { pin }).then((r) => r.data.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data.data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me').then(unwrap),
};

// ---- Employees ----
export const employeesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; role?: Role; status?: Status }) =>
    api.get<{ data: Paginated<Employee> }>('/employees', { params }).then((r) => r.data.data),
  get: (id: string) => api.get(`/employees/${id}`).then(unwrap<Employee>),
  create: (data: any) => api.post('/employees', data).then(unwrap<Employee>),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data).then(unwrap<Employee>),
  resetPin: (id: string, newPin: string) => api.patch(`/employees/${id}/pin`, { newPin }).then((r) => r.data),
  toggleStatus: (id: string) => api.patch(`/employees/${id}/status`).then(unwrap<Employee>),
};

// ---- Events ----
export const eventsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: EventStatus }) =>
    api.get<{ data: Paginated<Event> }>('/events', { params }).then((r) => r.data.data),
  ongoing: () => api.get('/events/ongoing').then(unwrap<Event[]>),
  get: (id: string) => api.get(`/events/${id}`).then(unwrap<Event>),
  create: (data: any) => api.post('/events', data).then(unwrap<Event>),
  update: (id: string, data: any) => api.put(`/events/${id}`, data).then(unwrap<Event>),
  remove: (id: string) => api.delete(`/events/${id}`),
};

// ---- Sevas ----
export interface SevaTemplate { sevaName: string; price: number; maxTickets: number; sevaTime?: string }
export const sevasApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: SevaStatus; eventId?: string }) =>
    api.get<{ data: Paginated<Seva> }>('/sevas', { params }).then((r) => r.data.data),
  byEvent: (eventId: string) => api.get(`/sevas/by-event/${eventId}`).then(unwrap<Seva[]>),
  templates: (): Promise<SevaTemplate[]> => api.get('/sevas/templates').then(unwrap<SevaTemplate[]>),
  get: (id: string) => api.get(`/sevas/${id}`).then(unwrap<Seva>),
  create: (data: any) => api.post('/sevas', data).then(unwrap<Seva>),
  update: (id: string, data: any) => api.put(`/sevas/${id}`, data).then(unwrap<Seva>),
  remove: (id: string) => api.delete(`/sevas/${id}`),
};

// ---- Tickets ----
export const ticketsApi = {
  sell: (data: { eventId: string; sevaId: string; devoteeName: string; mobileNumber?: string; quantity: number; paymentMode: PaymentMode }) =>
    api.post('/tickets/sell', data).then((r) => r.data.data as { ticket: Ticket; receipt: ReceiptPayload }),
  list: (params?: any) =>
    api.get<{ data: Paginated<Ticket> }>('/tickets', { params }).then((r) => r.data.data),
  get: (id: string) => api.get(`/tickets/${id}`).then(unwrap<Ticket>),
  getReceipt: (id: string) => api.get(`/tickets/${id}/receipt`).then(unwrap<ReceiptPayload>),
  markPrinted: (id: string) => api.patch(`/tickets/${id}/printed`).then(unwrap<Ticket>),
};

// ---- Reports ----
export const reportsApi = {
  dashboard:   (): Promise<any>   => api.get('/reports/dashboard').then(unwrap<any>),
  byEvent:     (range?: { from?: string; to?: string }): Promise<any[]> =>
    api.get('/reports/by-event', { params: range }).then(unwrap<any[]>),
  bySeva:      (range?: { from?: string; to?: string }): Promise<any[]> =>
    api.get('/reports/by-seva', { params: range }).then(unwrap<any[]>),
  byEmployee:  (range?: { from?: string; to?: string }): Promise<any[]> =>
    api.get('/reports/by-employee', { params: range }).then(unwrap<any[]>),
  dailyChart:  (days = 14): Promise<any[]> =>
    api.get('/reports/daily-chart', { params: { days } }).then(unwrap<any[]>),
};

// ---- Donation Purposes ----
export const donationPurposesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: Status }) =>
    api.get<{ data: Paginated<DonationPurpose> }>('/donation-purposes', { params }).then((r) => r.data.data),
  active: (): Promise<DonationPurpose[]> =>
    api.get('/donation-purposes/active').then(unwrap<DonationPurpose[]>),
  create: (data: { purposeName: string; status?: Status }) =>
    api.post('/donation-purposes', data).then(unwrap<DonationPurpose>),
  update: (id: string, data: { purposeName?: string; status?: Status }) =>
    api.put(`/donation-purposes/${id}`, data).then(unwrap<DonationPurpose>),
  toggleStatus: (id: string) =>
    api.patch(`/donation-purposes/${id}/status`).then(unwrap<DonationPurpose>),
};

// ---- Devotees ----
export const devoteesApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ data: Paginated<Devotee> }>('/devotees', { params }).then((r) => r.data.data),
  get: (id: string) => api.get(`/devotees/${id}`).then(unwrap<Devotee>),
  lookup: (phone: string) =>
    api.get('/devotees/lookup', { params: { phone } }).then(unwrap<Devotee | null>),
  create: (data: { fullName: string; phoneNumber: string; gothram?: string; nakshatram?: string }) =>
    api.post('/devotees', data).then(unwrap<Devotee>),
  update: (id: string, data: Partial<Devotee>) => api.put(`/devotees/${id}`, data).then(unwrap<Devotee>),
  remove: (id: string) => api.delete(`/devotees/${id}`),
};

// ---- Event Participations ----
export const participationsApi = {
  list: (params?: { page?: number; limit?: number; eventId?: string; devoteeId?: string; search?: string }) =>
    api.get<{ data: Paginated<EventParticipation> }>('/participations', { params }).then((r) => r.data.data),
  create: (data: {
    eventId: string; phoneNumber?: string; fullName?: string; gothram?: string; nakshatram?: string;
    sevaId?: string; quantity?: number; paymentMode?: PaymentMode; notes?: string;
  }) => api.post('/participations', data).then((r) => r.data as { success: boolean; message: string; data: EventParticipation; devoteeCreated: boolean }),
  remove: (id: string) => api.delete(`/participations/${id}`),
};

// ---- Audit Log (Super Admin only) ----
export const auditApi = {
  list: (params?: { page?: number; limit?: number; entityType?: AuditEntityType; action?: AuditActionType; entityId?: string }) =>
    api.get<{ data: Paginated<AuditEntry> }>('/audit', { params }).then((r) => r.data.data),
  rollback: (id: string) =>
    api.post(`/audit/${id}/rollback`).then((r) => r.data as { success: boolean; message: string }),
};

// ---- Org Settings ----
export const orgApi = {
  get: () => api.get('/org').then(unwrap<OrgSettings>),
  update: (data: Partial<OrgSettings>) => api.put('/org', data).then(unwrap<OrgSettings>),
};

// ---- Printers ----
import type { Printer, PrintResult } from '@/types/printer';
export const printersApi = {
  list:   ()                       => api.get('/printers').then(unwrap<Printer[]>),
  get:    (id: string)             => api.get(`/printers/${id}`).then(unwrap<Printer>),
  create: (data: Partial<Printer>) => api.post('/printers', data).then(unwrap<Printer>),
  update: (id: string, data: Partial<Printer>) => api.put(`/printers/${id}`, data).then(unwrap<Printer>),
  remove: (id: string)             => api.delete(`/printers/${id}`),
  test:   (id: string)             => api.post(`/printers/${id}/test`).then(unwrap<{ ok: boolean; method: string }>),
  print:  (ticketId: string, printerId?: string) =>
    api.post('/printers/print', { ticketId, printerId }).then(unwrap<PrintResult>),
};

