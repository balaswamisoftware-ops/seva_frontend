import { api, unwrap } from '@/api/client';
import type { Donation, DonationReceiptPayload } from '@/types/donation';
import type { Paginated, PaymentMode } from '@/types';

export interface CreateDonationInput {
  eventId?: string;
  purpose: string;
  devoteeName: string;
  mobileNumber?: string;
  email?: string;
  address?: string;
  panNumber?: string;
  isAnonymous?: boolean;
  amount: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
  is80GEligible?: boolean;
  notes?: string;
}

export const donationsApi = {
  create: (data: CreateDonationInput) =>
    api.post('/donations', data).then((r) => r.data.data as { donation: Donation; receipt: DonationReceiptPayload }),
  list: (params?: any) =>
    api.get<{ data: Paginated<Donation> & { totalAmount: number } }>('/donations', { params }).then((r) => r.data.data),
  get: (id: string) => api.get(`/donations/${id}`).then(unwrap<Donation>),
  getReceipt: (id: string) => api.get(`/donations/${id}/receipt`).then(unwrap<DonationReceiptPayload>),
  issue80G:   (id: string) => api.post(`/donations/${id}/issue-80g`).then(unwrap<Donation>),
  get80GCert: (id: string) => api.get(`/donations/${id}/cert80g`).then(unwrap<any>),
  markPrinted:(id: string) => api.patch(`/donations/${id}/printed`).then(unwrap<Donation>),
  stats:      (range?: { from?: string; to?: string }) =>
    api.get('/donations/stats', { params: range }).then(unwrap<any>),
};
