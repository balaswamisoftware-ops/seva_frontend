import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api';
import { toastError } from '@/components/toast';
import { apiErrorMessage } from '@/utils/format';
import { bootstrapOffline } from '@/db/offlineSync';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onKey = (k: string) => {
    if (k === 'C') return setPin('');
    if (k === '<') return setPin((p) => p.slice(0, -1));
    setPin((p) => (p.length < 6 ? p + k : p));
  };

  const submit = async () => {
    if (pin.length !== 6) return toastError('PIN must be 6 digits');
    setSubmitting(true);
    try {
      const data = await authApi.login(pin);
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        employee: data.employee,
      });
      bootstrapOffline().catch((e) => console.warn('Offline bootstrap failed:', e));
      navigate('/', { replace: true });
    } catch (e) {
      toastError('Login failed', apiErrorMessage(e));
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const onPinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 6) submit();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '<'];

  return (
    <div className="spiritual-bg flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Card className="shadow-3" style={{ width: 440 }}>
        <div className="text-center mb-4">
          <div style={{ fontSize: 56 }}>🕉️</div>
          <h2 className="m-0" style={{ color: '#92400e' }}>Seva ERP</h2>
          <div className="text-sm text-500 mt-1">Spiritual Organization Management</div>
        </div>

        <div className="flex flex-column gap-3" onKeyDown={onPinKeyDown}>
          <div>
            <div className="text-sm font-semibold mb-1 text-center">Enter your 6-digit PIN</div>
            <div className="flex justify-content-center gap-2 mb-3" style={{ height: 24 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 64px)',
                gap: 10,
                justifyContent: 'center',
              }}
            >
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="pin-key"
                  onClick={() => onKey(k)}
                  disabled={submitting}
                >
                  {k === '<' ? <i className="ph ph-arrow-left" /> : k}
                </button>
              ))}
            </div>
          </div>

          <Button
            label={submitting ? 'Signing in...' : 'Login'}
            icon="ph ph-sign-in"
            className="w-full mt-2"
            style={{ background: '#b45309', borderColor: '#b45309' }}
            loading={submitting}
            disabled={pin.length !== 6}
            onClick={submit}
          />

          <div className="text-center text-xs text-500 mt-2">
            Default PIN: <b>123456</b>
          </div>
        </div>
      </Card>
    </div>
  );
}
