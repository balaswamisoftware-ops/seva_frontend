import type { ReceiptPayload } from '@/types';

const center = (s: string, w: number) => {
  if (s.length >= w) return s.slice(0, w);
  const pad = Math.floor((w - s.length) / 2);
  return ' '.repeat(pad) + s + ' '.repeat(w - s.length - pad);
};
const line = (w: number, ch = '-') => ch.repeat(w);
const wrap = (s: string, w: number) => {
  const out: string[] = []; const words = (s || '').split(/\s+/); let cur = '';
  for (const word of words) {
    if ((cur + ' ' + word).trim().length > w) { if (cur) out.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) out.push(cur);
  return out;
};
const kv = (k: string, v: string, w: number) => {
  const space = w - k.length - v.length;
  return space > 0 ? `${k}${' '.repeat(space)}${v}` : `${k}: ${v}`;
};

// Render "Label : value" with the value wrapped to the receipt width.
// Continuation lines are indented under the value column so the label stays
// visually anchored.
const wrapLabeled = (label: string, value: string, w: number): string[] => {
  // Reserve at least 4 chars for the value on the first line; otherwise push
  // the value onto its own lines with a 2-space hanging indent.
  if (label.length + 4 > w) {
    return [label.trimEnd(), ...wrap(value, w - 2).map((l) => '  ' + l)];
  }
  const lines = wrap(value, w - label.length);
  if (lines.length === 0) return [label];
  const indent = ' '.repeat(label.length);
  return [label + lines[0], ...lines.slice(1).map((l) => indent + l)];
};

export function renderReceiptText(p: ReceiptPayload): string {
  const w = p.columns;
  const out: string[] = [];
  out.push(center(p.org.name, w));
  if (p.org.address) wrap(p.org.address, w).forEach((l) => out.push(center(l, w)));
  if (p.org.contact) out.push(center(`Ph: ${p.org.contact}`, w));
  if (p.org.gst)     out.push(center(`GST: ${p.org.gst}`, w));
  if (p.receiptHeader) wrap(p.receiptHeader, w).forEach((l) => out.push(center(l, w)));
  out.push(line(w));
  out.push(center('SEVA RECEIPT', w));
  out.push(line(w));
  out.push(kv('Receipt', p.ticket.receiptNumber, w));
  out.push(kv('Booking', p.ticket.bookingNumber, w));
  out.push(kv('Date', new Date(p.ticket.soldAt).toLocaleString('en-IN'), w));
  out.push(line(w));
  wrapLabeled('Event : ', p.ticket.eventName, w).forEach((l) => out.push(l));
  wrapLabeled('Seva  : ', p.ticket.sevaName, w).forEach((l) => out.push(l));
  wrapLabeled('Name  : ', p.ticket.devoteeName, w).forEach((l) => out.push(l));
  if (p.ticket.mobileNumber) wrapLabeled('Mob   : ', p.ticket.mobileNumber, w).forEach((l) => out.push(l));
  out.push(line(w));
  out.push(kv('Qty', String(p.ticket.quantity), w));
  out.push(kv('Unit Price', p.ticket.unitPrice.toFixed(2), w));
  out.push(kv('TOTAL', '₹' + p.ticket.totalAmount.toFixed(2), w));
  out.push(kv('Payment', p.ticket.paymentMode, w));
  out.push(line(w));
  wrapLabeled('Sold By: ', p.ticket.soldByName, w).forEach((l) => out.push(l));
  out.push(line(w));
  if (p.footer.thankYou) out.push(center(p.footer.thankYou, w));
  if (p.footer.quote)    out.push(center(p.footer.quote, w));
  if (p.footer.custom)   wrap(p.footer.custom, w).forEach((l) => out.push(center(l, w)));
  return out.join('\n');
}

/**
 * Print a receipt via the browser's print dialog.
 * Works with any printer (incl. 58mm/80mm thermal printers in monochrome mode).
 */
export function printReceipt(p: ReceiptPayload) {
  const text = renderReceiptText(p);
  const w = p.width;
  const fontSize = p.fontSize === 'large' ? '14px' : p.fontSize === 'small' ? '10px' : '12px';
  const html = `
<!doctype html><html><head><title>Receipt</title>
<style>
  @page { size: ${w}mm auto; margin: 2mm; }
  body { font-family: 'Courier New', monospace; white-space: pre; font-size: ${fontSize}; line-height: ${p.lineSpacing * 1.3}; margin: 0; padding: 0; }
  .qr { text-align: center; margin-top: 6px; }
  .qr img { width: ${w === 80 ? '120px' : '90px'}; }
</style></head>
<body>${escapeHtml(text)}${p.printQrCode && p.qrDataUrl ? `<div class="qr"><img src="${p.qrDataUrl}"/></div>` : ''}</body></html>`;
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the QR image a moment to load
  setTimeout(() => { win.print(); win.close(); }, 250);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
