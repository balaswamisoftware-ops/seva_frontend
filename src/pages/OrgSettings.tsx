import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { orgApi } from '@/api';
import type { OrgSettings, ReceiptPayload } from '@/types';
import type { DonationReceiptPayload } from '@/types/donation';
import { toastSuccess, toastError } from '@/components/toast';
import { apiErrorMessage } from '@/utils/format';
import { renderReceiptText, printReceipt } from '@/utils/printReceipt';
import { buildDonationA4Html, printDonationA4 } from '@/utils/printDonationA4';
import PageHeader from '@/components/PageHeader';

const FONT_OPTIONS = [{ label: 'Small', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Large', value: 'large' }];
const ALIGN_OPTIONS = [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }];
const ALIGN_OPTIONS_NO_RIGHT = [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }];
const WIDTH_OPTIONS = [{ label: '58 mm', value: 58 }, { label: '80 mm', value: 80 }];

// Sample donation receipt used to feed the live A4 preview iframe.
const sampleDonationReceipt = (org: OrgSettings): DonationReceiptPayload => ({
  type: 'DONATION',
  width: 58, columns: 32, alignment: 'left', fontSize: 'normal',
  org: {
    name: org.orgName,
    address: org.address ?? '',
    contact: org.contactNumber ?? '',
    gst: org.gstNumber ?? '',
    logoUrl: org.logoUrl,
  },
  receiptHeader: org.receiptHeader ?? '',
  printLogo: !!org.printLogo,
  printQrCode: false,
  donation: {
    receiptNumber: 'DON-2026-0001',
    bookingNumber: 'BK20260521-0001',
    donationId:    'DON00001',
    purpose:       'General Donation',
    eventName:     'Diwali Mahotsav',
    devoteeName:   'Devotee Name',
    mobileNumber:  '9999999999',
    panNumber:     'ABCDE1234F',
    amount:        2500,
    paymentMode:   'CASH',
    transactionRef: undefined,
    is80GEligible: true,
    soldByName:    'Counter Staff',
    soldAt:        new Date().toISOString(),
  },
  footer: {
    thankYou: org.thankYouMessage ?? '',
    quote:    org.spiritualQuote ?? '',
    custom:   org.receiptFooter ?? '',
  },
  lineSpacing: org.lineSpacing,
});

const samplePreview = (org: OrgSettings): ReceiptPayload => ({
  width: org.printerWidth, columns: org.printerWidth === 80 ? 48 : 32,
  alignment: org.textAlignment, fontSize: org.fontSize,
  org: { name: org.orgName, address: org.address ?? '', contact: org.contactNumber ?? '', gst: org.gstNumber ?? '', logoUrl: org.logoUrl },
  receiptHeader: org.receiptHeader ?? '',
  printLogo: org.printLogo, printQrCode: org.printQrCode,
  ticket: {
    receiptNumber: 'RCP-2026-0001', bookingNumber: 'BK20260521-0001', ticketId: 'TKT00001',
    eventName: 'Sample Event', sevaName: 'Sample Seva',
    devoteeName: 'Devotee Name', mobileNumber: '9999999999',
    quantity: 2, unitPrice: 251, totalAmount: 502,
    paymentMode: 'CASH', soldByName: 'Counter Staff',
    soldAt: new Date().toISOString(),
  },
  footer: { thankYou: org.thankYouMessage ?? '', quote: org.spiritualQuote ?? '', custom: org.receiptFooter ?? '' },
  lineSpacing: org.lineSpacing,
});

export default function OrgSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['org'], queryFn: orgApi.get });
  const [form, setForm] = useState<OrgSettings | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const updateMutation = useMutation({
    mutationFn: orgApi.update,
    onSuccess: (d) => { toastSuccess('Settings saved'); setForm(d); queryClient.invalidateQueries({ queryKey: ['org'] }); },
    onError: (e) => toastError('Save failed', apiErrorMessage(e)),
  });

  if (isLoading || !form) return <div>Loading...</div>;

  const set = <K extends keyof OrgSettings>(k: K, v: OrgSettings[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="flex flex-column gap-3">
      <PageHeader
        icon="ph ph-gear"
        title="Organization Settings"
        subtitle="Branding, receipt formatting and printer defaults."
        actions={
          <Button
            label="Save Changes"
            icon="ph ph-floppy-disk"
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate(form)}
            className="p-button-rounded"
            style={{ background: '#fff', borderColor: '#fff', color: '#b45309' }}
          />
        }
      />

      <div className="grid">
        <div className="col-12 lg:col-7">
          <div className="soft-card">
            <TabView className="fancy-tabs" activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
            <TabPanel header="Organization" leftIcon="ph ph-buildings mr-2">
              <div className="flex flex-column gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Organization Name *</label>
                  <InputText className="w-full" value={form.orgName} onChange={(e) => set('orgName', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Address</label>
                  <InputTextarea className="w-full" rows={2} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
                </div>
                <div className="grid">
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Contact Number</label>
                    <InputText className="w-full" value={form.contactNumber ?? ''} onChange={(e) => set('contactNumber', e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <InputText className="w-full" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
                  </div>
                </div>
                <div className="grid">
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">GST Number</label>
                    <InputText className="w-full" value={form.gstNumber ?? ''} onChange={(e) => set('gstNumber', e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Logo URL</label>
                    <InputText className="w-full" value={form.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://..." />
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header="Receipt Layout" leftIcon="ph ph-printer mr-2">
              <div className="flex flex-column gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Receipt Header</label>
                  <InputText className="w-full" value={form.receiptHeader ?? ''} onChange={(e) => set('receiptHeader', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Thank You Message</label>
                  <InputText className="w-full" value={form.thankYouMessage ?? ''} onChange={(e) => set('thankYouMessage', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Spiritual Quote</label>
                  <InputText className="w-full" value={form.spiritualQuote ?? ''} onChange={(e) => set('spiritualQuote', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Footer (Custom Text)</label>
                  <InputTextarea className="w-full" rows={2} value={form.receiptFooter ?? ''} onChange={(e) => set('receiptFooter', e.target.value)} />
                </div>
                <div className="grid">
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Printer Width</label>
                    <Dropdown className="w-full" value={form.printerWidth} options={WIDTH_OPTIONS} onChange={(e) => set('printerWidth', e.value)} />
                  </div>
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Font Size</label>
                    <Dropdown className="w-full" value={form.fontSize} options={FONT_OPTIONS} onChange={(e) => set('fontSize', e.value)} />
                  </div>
                </div>
                <div className="grid">
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Text Alignment</label>
                    <Dropdown className="w-full" value={form.textAlignment} options={ALIGN_OPTIONS} onChange={(e) => set('textAlignment', e.value)} />
                  </div>
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Line Spacing</label>
                    <InputNumber className="w-full" value={form.lineSpacing} onValueChange={(e) => set('lineSpacing', e.value ?? 1)} min={1} max={3} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex align-items-center gap-2">
                    <InputSwitch checked={form.printLogo} onChange={(e) => set('printLogo', e.value)} />
                    <span>Print Logo</span>
                  </label>
                  <label className="flex align-items-center gap-2">
                    <InputSwitch checked={form.printQrCode} onChange={(e) => set('printQrCode', e.value)} />
                    <span>Print QR Code</span>
                  </label>
                </div>
              </div>
            </TabPanel>

            <TabPanel header="A4 Donation Receipt" leftIcon="ph ph-file-text mr-2">
              <div className="flex flex-column gap-3">
                <div className="grid">
                  <div className="col-8">
                    <label className="block text-sm font-semibold mb-1">Title</label>
                    <InputText className="w-full" value={form.a4Title ?? ''} onChange={(e) => set('a4Title', e.target.value)} placeholder="DONATION RECEIPT" />
                  </div>
                  <div className="col-4">
                    <label className="block text-sm font-semibold mb-1">Title Alignment</label>
                    <Dropdown className="w-full" value={form.a4TitleAlignment ?? 'left'} options={ALIGN_OPTIONS} onChange={(e) => set('a4TitleAlignment', e.value)} />
                  </div>
                </div>

                <div className="grid">
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Letterhead Alignment</label>
                    <Dropdown className="w-full" value={form.a4OrgNameAlignment ?? 'left'} options={ALIGN_OPTIONS_NO_RIGHT} onChange={(e) => set('a4OrgNameAlignment', e.value)} />
                  </div>
                  <div className="col-6">
                    <label className="block text-sm font-semibold mb-1">Font Size</label>
                    <Dropdown className="w-full" value={form.a4FontSize ?? 'normal'} options={FONT_OPTIONS} onChange={(e) => set('a4FontSize', e.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Accent Color</label>
                  <div className="flex align-items-center gap-2">
                    <input
                      type="color"
                      value={(form.a4AccentColor ?? '#b45309').replace(/^#?/, '#')}
                      onChange={(e) => set('a4AccentColor', e.target.value)}
                      style={{ width: 44, height: 36, border: '1px solid #d4d4d4', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                    />
                    <InputText
                      className="flex-1"
                      value={form.a4AccentColor ?? '#b45309'}
                      onChange={(e) => set('a4AccentColor', e.target.value)}
                      placeholder="#b45309"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Extra Header Text (optional)</label>
                  <InputTextarea className="w-full" rows={2} value={form.a4Header ?? ''} onChange={(e) => set('a4Header', e.target.value)} placeholder="e.g. Regd. Trust No. XXXX  |  80G Reg: ABC/123/2026" />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Signature Label</label>
                  <InputText className="w-full" value={form.a4SignatureLabel ?? ''} onChange={(e) => set('a4SignatureLabel', e.target.value)} placeholder="Authorised Signatory" />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Custom Footer (optional)</label>
                  <InputTextarea className="w-full" rows={3} value={form.a4Footer ?? ''} onChange={(e) => set('a4Footer', e.target.value)} placeholder="Replaces the thermal-receipt footer on A4 prints. Use for legal notices, registration numbers, etc." />
                </div>

                <div className="grid">
                  <div className="col-6">
                    <label className="flex align-items-center gap-2 mt-1">
                      <InputSwitch checked={form.a4BoldHeaders ?? true} onChange={(e) => set('a4BoldHeaders', e.value)} />
                      <span>Bold Headers</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label className="flex align-items-center gap-2 mt-1">
                      <InputSwitch checked={form.a4BoldAmount ?? true} onChange={(e) => set('a4BoldAmount', e.value)} />
                      <span>Bold Amount</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label className="flex align-items-center gap-2 mt-1">
                      <InputSwitch checked={form.a4ShowLogo ?? true} onChange={(e) => set('a4ShowLogo', e.value)} />
                      <span>Show Logo</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label className="flex align-items-center gap-2 mt-1">
                      <InputSwitch checked={form.a4ShowAmountInWords ?? true} onChange={(e) => set('a4ShowAmountInWords', e.value)} />
                      <span>Show Amount in Words</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label className="flex align-items-center gap-2 mt-1">
                      <InputSwitch checked={form.a4ShowSignatureLine ?? true} onChange={(e) => set('a4ShowSignatureLine', e.value)} />
                      <span>Signature Line</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label className="flex align-items-center gap-2 mt-1">
                      <InputSwitch checked={form.a4Show80GTagline ?? true} onChange={(e) => set('a4Show80GTagline', e.value)} />
                      <span>80G Tagline</span>
                    </label>
                  </div>
                </div>
              </div>
            </TabPanel>
            </TabView>
          </div>
        </div>

        <div className="col-12 lg:col-5">
          {activeTab === 2 ? (
            <div className="soft-card">
              <div className="block text-sm font-semibold mb-2">A4 Live Preview</div>
              <iframe
                title="A4 donation receipt preview"
                srcDoc={buildDonationA4Html(sampleDonationReceipt(form), form)}
                style={{
                  width: '100%',
                  height: 720,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: 'white',
                }}
                sandbox="allow-same-origin"
              />
              <Button
                label="Test Print A4"
                icon="ph ph-printer"
                className="mt-3"
                outlined
                onClick={() => printDonationA4(sampleDonationReceipt(form), form)}
              />
            </div>
          ) : (
            <div className="soft-card">
              <div className="block text-sm font-semibold mb-2">Live Receipt Preview</div>
              <div className="receipt-preview" style={{ maxWidth: form.printerWidth === 80 ? 360 : 260 }}>
                {renderReceiptText(samplePreview(form))}
              </div>
              <Button
                label="Test Print"
                icon="ph ph-printer"
                className="mt-3"
                outlined
                onClick={() => printReceipt(samplePreview(form))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
