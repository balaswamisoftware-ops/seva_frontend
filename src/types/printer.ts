export type PrinterType = 'NETWORK' | 'AGENT_USB';
export type PrinterStatus = 'ACTIVE' | 'INACTIVE';

export interface Printer {
  _id: string;
  name: string;
  type: PrinterType;
  ipAddress?: string;
  port?: number;
  agentUrl?: string;
  agentKey?: string;
  paperWidth: 58 | 80;
  isDefault: boolean;
  status: PrinterStatus;
  location?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrintResult {
  method: 'network' | 'agent';
  via: string;
  printerId: string;
  printerName: string;
}
