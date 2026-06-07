import { Toast } from 'primereact/toast';
import { createRef } from 'react';

export const toastRef = createRef<Toast>();

export const toastSuccess = (summary: string, detail?: string) =>
  toastRef.current?.show({ severity: 'success', summary, detail, life: 3000 });

export const toastError = (summary: string, detail?: string) =>
  toastRef.current?.show({ severity: 'error', summary, detail, life: 4000 });

export const toastInfo = (summary: string, detail?: string) =>
  toastRef.current?.show({ severity: 'info', summary, detail, life: 3000 });
