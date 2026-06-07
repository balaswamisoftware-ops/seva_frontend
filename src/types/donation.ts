import type { PaymentMode, Event } from './index';

export interface Donation {
  _id: string;
  donationId: string;
  receiptNumber: string;
  bookingNumber: string;
  eventId?: string | { _id: string; eventName: string };
  eventName?: string;
  purpose: string;
  devoteeName: string;
  mobileNumber?: string;
  email?: string;
  address?: string;
  panNumber?: string;
  isAnonymous: boolean;
  amount: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
  is80GEligible: boolean;
  cert80GIssued: boolean;
  cert80GNumber?: string;
  soldByEmployeeId: string;
  soldByName: string;
  soldAt: string;
  printed: boolean;
  notes?: string;
}

export interface DonationReceiptPayload {
  type: 'DONATION';
  width: 58 | 80;
  columns: number;
  alignment: 'left' | 'center' | 'right';
  fontSize: 'small' | 'normal' | 'large';
  org: { name: string; address: string; contact: string; gst: string; logoUrl?: string };
  receiptHeader: string;
  printLogo: boolean;
  printQrCode: boolean;
  qrDataUrl?: string;
  donation: {
    receiptNumber: string;
    bookingNumber: string;
    donationId: string;
    purpose: string;
    eventName?: string;
    devoteeName: string;
    mobileNumber?: string;
    panNumber?: string;
    amount: number;
    paymentMode: string;
    transactionRef?: string;
    is80GEligible: boolean;
    soldByName: string;
    soldAt: string | Date;
  };
  footer: { thankYou: string; quote: string; custom: string };
  lineSpacing: number;
}
