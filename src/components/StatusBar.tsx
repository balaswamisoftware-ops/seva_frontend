import { useEffect, useState } from 'react';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useRef } from 'react';
import { useAutoSync } from '@/hooks/useOffline';
import { checkPrintAgent, configureAgent } from '@/utils/printBridge';
import { InputText } from 'primereact/inputtext';
import { toastSuccess } from '@/components/toast';

interface AgentStatus { ok: boolean; ready: boolean; printerType?: string; }

export default function StatusBar() {
  const { online, stats, syncNow } = useAutoSync(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ ok: false, ready: false });
  const [agentUrl, setAgentUrl] = useState(localStorage.getItem('printAgentUrl') ?? 'http://localhost:9100');
  const settingsRef = useRef<OverlayPanel>(null);

  useEffect(() => {
    const refresh = async () => setAgentStatus(await checkPrintAgent(true));
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex align-items-center gap-3">
      {/* Online / Offline */}
      <Tag
        icon={online ? 'ph ph-wifi-high' : 'ph ph-x-circle'}
        severity={online ? 'success' : 'danger'}
        value={online ? 'Online' : 'Offline'}
      />

      {/* Print Agent */}
      <Tag
        icon="ph ph-printer"
        severity={agentStatus.ok && agentStatus.ready ? 'success' : agentStatus.ok ? 'warning' : 'secondary'}
        value={
          agentStatus.ok && agentStatus.ready ? 'Direct Print' :
          agentStatus.ok                     ? 'Agent up, no printer' :
                                                'Browser Print'
        }
        style={{ cursor: 'pointer' }}
        onClick={(e) => settingsRef.current?.toggle(e)}
      />

      <OverlayPanel ref={settingsRef} style={{ width: 320 }}>
        <div className="flex flex-column gap-2">
          <div className="font-semibold">Print Agent</div>
          <small className="text-500">
            Run the local print agent on this PC for direct ESC/POS printing.
            URL defaults to <code>http://localhost:9100</code>.
          </small>
          <InputText value={agentUrl} onChange={(e) => setAgentUrl(e.target.value)} placeholder="http://localhost:9100" />
          <Button
            label="Save & Test"
            size="small"
            onClick={async () => {
              configureAgent(agentUrl);
              const st = await checkPrintAgent(true);
              setAgentStatus(st);
              toastSuccess(st.ok ? 'Agent reachable' : 'Agent not reachable');
            }}
          />
          <small>Status: {agentStatus.ok ? `OK · printer ${agentStatus.ready ? 'ready' : 'not detected'}` : 'Not running'}</small>
        </div>
      </OverlayPanel>

      {/* Queue */}
      {(stats.pending > 0 || stats.failed > 0) && (
        <>
          <Tag
            icon="ph ph-clock"
            severity={stats.failed > 0 ? 'danger' : 'warning'}
            value={`${stats.pending + stats.failed} queued`}
          />
          {online && <Button size="small" outlined label="Sync now" icon="ph ph-arrows-clockwise" onClick={syncNow} />}
        </>
      )}
    </div>
  );
}
