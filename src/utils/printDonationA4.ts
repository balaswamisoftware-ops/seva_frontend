import type { DonationReceiptPayload } from '@/types/donation';
import type { A4ReceiptSettings } from '@/types';

const escapeHtml = (s: string | undefined | null) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtINR = (n: number) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Indian number-to-words for "Rupees ... Only".
function numberToIndianWords(num: number): string {
  if (!num || num <= 0) return 'Zero Rupees Only';
  const n = Math.floor(num);
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigit = (v: number): string => v < 20 ? a[v] : b[Math.floor(v / 10)] + (v % 10 ? ' ' + a[v % 10] : '');
  const threeDigit = (v: number): string => {
    const h = Math.floor(v / 100), r = v % 100;
    return (h ? a[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigit(r) : '');
  };
  const cr = Math.floor(n / 10000000);
  const lk = Math.floor((n % 10000000) / 100000);
  const th = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let str = '';
  if (cr)   str += threeDigit(cr)   + ' Crore ';
  if (lk)   str += threeDigit(lk)   + ' Lakh ';
  if (th)   str += threeDigit(th)   + ' Thousand ';
  if (rest) str += threeDigit(rest) + ' ';
  return (str.trim() || 'Zero') + ' Rupees Only';
}

const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// Resolve org-level A4 settings into a complete, defaulted style record.
function resolveStyle(s: A4ReceiptSettings | undefined) {
  const accent = (s?.a4AccentColor ?? '#b45309').replace(/^#?/, '#');
  const fontSizes = { small: 11, normal: 12, large: 13 } as const;
  const fz = fontSizes[s?.a4FontSize ?? 'normal'];
  return {
    title:              s?.a4Title              ?? 'DONATION RECEIPT',
    titleAlignment:     s?.a4TitleAlignment     ?? 'left',
    orgNameAlignment:   s?.a4OrgNameAlignment   ?? 'left',
    accentColor:        accent,
    fontSizeBase:       fz,
    boldHeaders:        s?.a4BoldHeaders        ?? true,
    boldAmount:         s?.a4BoldAmount         ?? true,
    showLogo:           s?.a4ShowLogo           ?? true,
    showAmountInWords:  s?.a4ShowAmountInWords  ?? true,
    showSignatureLine:  s?.a4ShowSignatureLine  ?? true,
    signatureLabel:     s?.a4SignatureLabel     ?? 'Authorised Signatory',
    show80GTagline:     s?.a4Show80GTagline     ?? true,
    customHeader:       s?.a4Header             ?? '',
    customFooter:       s?.a4Footer             ?? '',
  };
}

function buildHtml(receipt: DonationReceiptPayload, settings?: A4ReceiptSettings): string {
  const d = receipt.donation;
  const org = receipt.org;
  const amountWords = numberToIndianWords(d.amount);
  const s = resolveStyle(settings);

  const headerWeight = s.boldHeaders ? '800' : '600';
  const amountWeight = s.boldAmount  ? '800' : '600';
  const orgNameJustify = s.orgNameAlignment === 'center' ? 'center' : 'space-between';

  return `<!doctype html>
<html><head>
<title>Donation Receipt — ${escapeHtml(d.receiptNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif;
    color: #1f2937;
    font-size: ${s.fontSizeBase}px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { width: 100%; }

  .letterhead {
    display: flex;
    justify-content: ${orgNameJustify};
    align-items: ${s.orgNameAlignment === 'center' ? 'center' : 'flex-start'};
    flex-direction: ${s.orgNameAlignment === 'center' ? 'column' : 'row'};
    text-align: ${s.orgNameAlignment === 'center' ? 'center' : 'left'};
    padding-bottom: 12px;
    border-bottom: 3px solid ${s.accentColor};
    gap: 12px;
  }
  .org { max-width: 100%; }
  .org h1 {
    margin: 0;
    font-size: ${s.fontSizeBase + 10}px;
    color: ${s.accentColor};
    letter-spacing: 0.3px;
    font-weight: ${headerWeight};
  }
  .org .meta { font-size: ${s.fontSizeBase - 1}px; color: #4b5563; margin-top: 4px; white-space: pre-line; }
  .org-logo {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: ${s.accentColor}1a;
    display: flex; align-items: center; justify-content: center;
    color: ${s.accentColor}; font-size: 34px;
    border: 2px solid ${s.accentColor}55;
    flex: 0 0 auto;
  }
  .org-logo img { max-width: 64px; max-height: 64px; }

  .custom-header {
    margin-top: 8px;
    font-size: ${s.fontSizeBase}px;
    color: #4b5563;
    white-space: pre-line;
    text-align: ${s.orgNameAlignment === 'center' ? 'center' : 'left'};
  }

  .title-row {
    display: flex;
    justify-content: ${s.titleAlignment === 'center' ? 'center' : s.titleAlignment === 'right' ? 'flex-end' : 'space-between'};
    align-items: center;
    margin: 22px 0 8px 0;
  }
  .title-row h2 {
    margin: 0;
    font-size: ${s.fontSizeBase + 6}px;
    letter-spacing: 1.5px;
    color: ${s.accentColor};
    text-transform: uppercase;
    text-align: ${s.titleAlignment};
    font-weight: ${headerWeight};
  }
  .badges { display: flex; gap: 6px; }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    background: ${s.accentColor}1a;
    color: ${s.accentColor};
    border: 1px solid ${s.accentColor}55;
  }
  .badge.is80g { background: #dcfce7; color: #166534; border-color: #86efac; }

  .meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
    margin: 12px 0 18px 0;
    padding: 10px 14px;
    background: ${s.accentColor}0d;
    border: 1px solid ${s.accentColor}40;
    border-radius: 6px;
    font-size: ${s.fontSizeBase}px;
  }
  .meta-row .cell { display: flex; gap: 8px; }
  .meta-row .k { color: #6b7280; min-width: 80px; }
  .meta-row .v { font-weight: 600; color: #111827; }

  .section-h {
    font-size: ${s.fontSizeBase - 1}px;
    font-weight: ${headerWeight};
    letter-spacing: 0.6px;
    color: #6b7280;
    text-transform: uppercase;
    margin: 16px 0 6px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }

  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;
  }
  .field { display: flex; padding: 4px 0; }
  .field .k { color: #6b7280; min-width: 90px; }
  .field .v { color: #111827; font-weight: 500; }

  .amount-block {
    margin-top: 18px;
    padding: 16px 18px;
    background: linear-gradient(90deg, ${s.accentColor}22 0%, ${s.accentColor}08 100%);
    border: 1px solid ${s.accentColor}55;
    border-radius: 8px;
  }
  .amount-block .label {
    font-size: ${s.fontSizeBase - 1}px;
    color: #6b7280;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .amount-block .figure {
    font-size: ${s.fontSizeBase + 16}px;
    font-weight: ${amountWeight};
    color: ${s.accentColor};
    line-height: 1.1;
    margin-top: 2px;
  }
  .amount-block .words {
    margin-top: 6px;
    font-size: ${s.fontSizeBase}px;
    color: #374151;
    font-style: italic;
  }

  .footer {
    margin-top: 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .thanks { font-size: ${s.fontSizeBase}px; color: #374151; }
  .thanks .big { color: ${s.accentColor}; font-weight: 600; }
  .signature {
    text-align: center;
    min-width: 200px;
  }
  .signature .line { border-top: 1px solid #4b5563; padding-top: 4px; margin-top: 50px; font-size: ${s.fontSizeBase - 1}px; color: #4b5563; }

  .tagline {
    margin-top: 28px;
    text-align: center;
    color: ${s.accentColor};
    font-style: italic;
    font-size: ${s.fontSizeBase - 1}px;
  }
  .legal {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px dashed #d1d5db;
    text-align: center;
    color: #6b7280;
    font-size: 10px;
    white-space: pre-line;
  }

  .num { font-variant-numeric: tabular-nums; }
  .mono { font-family: 'Courier New', monospace; letter-spacing: 0.4px; }
</style>
</head>
<body>
<div class="sheet">

  <div class="letterhead">
    <div class="org">
      <h1>${escapeHtml(org.name)}</h1>
      <div class="meta">${escapeHtml(org.address)}${org.contact ? `\nPh: ${escapeHtml(org.contact)}` : ''}${org.gst ? `\nGST: ${escapeHtml(org.gst)}` : ''}</div>
    </div>
    ${s.showLogo ? `<div class="org-logo">${org.logoUrl ? `<img src="${escapeHtml(org.logoUrl)}" alt="logo"/>` : 'ॐ'}</div>` : ''}
  </div>
  ${s.customHeader ? `<div class="custom-header">${escapeHtml(s.customHeader)}</div>` : ''}

  <div class="title-row">
    <h2>${escapeHtml(s.title)}</h2>
    <div class="badges">
      ${d.is80GEligible ? '<span class="badge is80g">80G Eligible</span>' : ''}
      <span class="badge">Original</span>
    </div>
  </div>

  <div class="meta-row">
    <div class="cell"><span class="k">Receipt No</span><span class="v mono">${escapeHtml(d.receiptNumber)}</span></div>
    <div class="cell"><span class="k">Date</span><span class="v">${escapeHtml(fmtDate(d.soldAt))}</span></div>
    <div class="cell"><span class="k">Donation ID</span><span class="v mono">${escapeHtml(d.donationId)}</span></div>
    <div class="cell"><span class="k">Booking</span><span class="v mono">${escapeHtml(d.bookingNumber)}</span></div>
  </div>

  <div class="section-h">Donor Details</div>
  <div class="grid2">
    <div class="field"><span class="k">Name</span><span class="v">${escapeHtml(d.devoteeName)}</span></div>
    <div class="field"><span class="k">Mobile</span><span class="v">${escapeHtml(d.mobileNumber ?? '—')}</span></div>
    <div class="field"><span class="k">PAN</span><span class="v mono">${escapeHtml(d.panNumber ?? '—')}</span></div>
    <div class="field"><span class="k">Purpose</span><span class="v">${escapeHtml(d.purpose)}</span></div>
  </div>

  <div class="section-h">Donation Details</div>
  <div class="grid2">
    ${d.eventName ? `<div class="field"><span class="k">Event</span><span class="v">${escapeHtml(d.eventName)}</span></div>` : ''}
    <div class="field"><span class="k">Payment</span><span class="v">${escapeHtml(d.paymentMode)}</span></div>
    ${d.transactionRef ? `<div class="field"><span class="k">Ref</span><span class="v mono">${escapeHtml(d.transactionRef)}</span></div>` : ''}
    <div class="field"><span class="k">Received By</span><span class="v">${escapeHtml(d.soldByName)}</span></div>
  </div>

  <div class="amount-block">
    <div class="label">Amount received</div>
    <div class="figure num">${fmtINR(d.amount)}</div>
    ${s.showAmountInWords ? `<div class="words">${escapeHtml(amountWords)}</div>` : ''}
  </div>

  <div class="footer">
    <div class="thanks">
      ${receipt.footer.thankYou ? `<div class="big">${escapeHtml(receipt.footer.thankYou)}</div>` : ''}
      ${receipt.footer.quote ? `<div>${escapeHtml(receipt.footer.quote)}</div>` : ''}
    </div>
    ${s.showSignatureLine ? `<div class="signature">
      <div class="line">${escapeHtml(s.signatureLabel)} · ${escapeHtml(org.name)}</div>
    </div>` : ''}
  </div>

  ${d.is80GEligible && s.show80GTagline ? '<div class="tagline">This donation is eligible for tax deduction under Section 80G of the Income Tax Act, 1961.</div>' : ''}
  ${s.customFooter ? `<div class="legal">${escapeHtml(s.customFooter)}</div>` : (receipt.footer.custom ? `<div class="legal">${escapeHtml(receipt.footer.custom)}</div>` : '')}

</div>
<script>
  // Auto-open the print dialog. If the org doesn't want auto-print, they can
  // remove this — the page can still be printed manually with Ctrl+P.
  window.addEventListener('load', () => {
    setTimeout(() => { window.print(); }, 250);
  });
  // Close after printing or canceling. afterprint fires for both.
  window.addEventListener('afterprint', () => { setTimeout(() => window.close(), 300); });
</script>
</body></html>`;
}

/**
 * Open a new browser window with an A4-formatted donation receipt and trigger
 * the browser's print dialog. Operator picks whichever A4 printer they've got
 * installed (USB, WiFi, network — anything the OS knows about).
 *
 * Pass the org's A4 settings (a4Title, a4AccentColor, alignment flags, etc.)
 * to honor the operator's customizations from Org Settings → A4 Donation tab.
 */
export function printDonationA4(
  receipt: DonationReceiptPayload,
  settings?: A4ReceiptSettings,
): boolean {
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    return false; // popup blocked
  }
  win.document.open();
  win.document.write(buildHtml(receipt, settings));
  win.document.close();
  win.focus();
  return true;
}

// Re-export for the OrgSettings live-preview iframe.
export function buildDonationA4Html(
  receipt: DonationReceiptPayload,
  settings?: A4ReceiptSettings,
): string {
  return buildHtml(receipt, settings);
}
