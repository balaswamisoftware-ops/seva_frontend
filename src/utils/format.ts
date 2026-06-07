import dayjs from 'dayjs';

export const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const formatDate = (d?: string | Date) => (d ? dayjs(d).format('DD MMM YYYY') : '-');
export const formatDateTime = (d?: string | Date) => (d ? dayjs(d).format('DD MMM YYYY, hh:mm A') : '-');
export const formatTime = (d?: string | Date) => (d ? dayjs(d).format('hh:mm A') : '-');

export const apiErrorMessage = (e: any) =>
  e?.response?.data?.error?.message ?? e?.message ?? 'Something went wrong';

export const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;
