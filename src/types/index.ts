export type Role = 'SUPER_ADMIN' | 'ADMIN';
export type Status = 'ACTIVE' | 'INACTIVE';
export type EventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type SevaStatus = 'ACTIVE' | 'INACTIVE' | 'SOLD_OUT';
export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'OTHER';

export interface Employee {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email?: string;
  role: Role;
  status: Status;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  _id: string;
  eventId: string;
  eventName: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  bannerImage?: string;
  status: EventStatus;
  collectDevoteeDetails?: boolean;
  createdAt: string;
}

export interface Devotee {
  _id: string;
  devoteeId: string;
  fullName: string;
  phoneNumber: string;
  gothram?: string;
  nakshatram?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventParticipation {
  _id: string;
  participationId: string;
  eventId: string;
  eventName: string;
  devoteeId?: string;
  devoteeName?: string;
  phoneNumber?: string;
  sevaId?: string;
  sevaName?: string;
  quantity: number;
  unitPrice?: number;
  totalAmount?: number;
  paymentMode: PaymentMode;
  notes?: string;
  createdAt: string;
}

export type AuditEntityType = 'Devotee' | 'Event' | 'EventParticipation';
export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';

export interface AuditEntry {
  _id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityCode?: string;
  action: AuditActionType;
  before?: any;
  after?: any;
  performedBy?: { _id: string; employeeId: string; firstName: string; lastName: string; role: Role } | string;
  rolledBack?: boolean;
  rollbackOf?: string;
  createdAt: string;
}

export type SevaEventRef = string | { _id: string; eventId: string; eventName: string };

export interface Seva {
  _id: string;
  sevaId: string;
  // A seva can be attached to many events at once. When populated by the
  // backend the entries are { _id, eventId, eventName }; otherwise raw ids.
  eventIds: SevaEventRef[];
  sevaName: string;
  description?: string;
  price: number;
  maxTickets: number;
  availableTickets: number;
  sevaDate?: string;
  sevaTime?: string;
  status: SevaStatus;
}

export interface Ticket {
  _id: string;
  ticketId: string;
  bookingNumber: string;
  receiptNumber: string;
  eventId: string;
  sevaId: string;
  eventName: string;
  sevaName: string;
  devoteeName: string;
  mobileNumber?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMode: PaymentMode;
  soldByEmployeeId: string;
  soldByName: string;
  soldAt: string;
  printed: boolean;
}

export interface DonationPurpose {
  _id: string;
  purposeId: string;
  purposeName: string;
  status: Status;
  createdAt?: string;
  updatedAt?: string;
}

export interface A4ReceiptSettings {
  a4Title?: string;
  a4TitleAlignment?: 'left' | 'center' | 'right';
  a4OrgNameAlignment?: 'left' | 'center';
  a4AccentColor?: string;
  a4FontSize?: 'small' | 'normal' | 'large';
  a4BoldHeaders?: boolean;
  a4BoldAmount?: boolean;
  a4ShowLogo?: boolean;
  a4ShowAmountInWords?: boolean;
  a4ShowSignatureLine?: boolean;
  a4SignatureLabel?: string;
  a4Show80GTagline?: boolean;
  a4Header?: string;
  a4Footer?: string;
}

export interface OrgSettings extends A4ReceiptSettings {
  _id?: string;
  orgName: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  gstNumber?: string;
  logoUrl?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  spiritualQuote?: string;
  thankYouMessage?: string;
  printerWidth: 58 | 80;
  fontSize: 'small' | 'normal' | 'large';
  textAlignment: 'left' | 'center' | 'right';
  printLogo: boolean;
  printQrCode: boolean;
  lineSpacing: number;
}

export interface ReceiptPayload {
  width: 58 | 80;
  columns: number;
  alignment: 'left' | 'center' | 'right';
  fontSize: 'small' | 'normal' | 'large';
  org: { name: string; address: string; contact: string; gst: string; logoUrl?: string };
  receiptHeader: string;
  printLogo: boolean;
  printQrCode: boolean;
  qrDataUrl?: string;
  ticket: {
    receiptNumber: string; bookingNumber: string; ticketId: string;
    eventName: string; sevaName: string;
    devoteeName: string; mobileNumber?: string;
    quantity: number; unitPrice: number; totalAmount: number;
    paymentMode: string; soldByName: string; soldAt: string;
  };
  footer: { thankYou: string; quote: string; custom: string };
  lineSpacing: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message: string; code: string };
}
