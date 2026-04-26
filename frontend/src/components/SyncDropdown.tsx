import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

const integrations = [
  { name: 'Jira', status: 'connected' as const, lastSync: '2m ago' },
  { name: 'ServiceNow', status: 'disconnected' as const, lastSync: 'Never' },
];

export function SyncDropdown() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAll = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 h-9 px-4 border border-[#2C2824]/30 bg-[#F5EFE2] hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors uppercase font-bold text-xs font-mono tracking-widest group">
          <RefreshCw
            className={clsx(
              'w-3.5 h-3.5 transition-transform',
              isSyncing && 'animate-spin'
            )}
          />
          <span>Sync</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-[#F5EFE2] border border-[#2C2824]/30 shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] w-72 z-50 animate-in fade-in-0 zoom-in-95 p-0"
        >
          <div className="border-b border-[#2C2824]/20 p-4 flex justify-between items-center bg-[#E4DBCA]">
            <span className="font-bold uppercase text-xs tracking-wider">
              Integrations
            </span>
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="text-[10px] font-mono border border-[#2C2824]/30 px-2 py-1 bg-[#F5EFE2] hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors uppercase"
            >
              {isSyncing ? 'Syncing...' : 'Sync All'}
            </button>
          </div>

          <div className="flex flex-col">
            {integrations.map((integration, idx) => (
              <div
                key={integration.name}
                className={clsx(
                  'flex items-center justify-between p-4',
                  idx !== integrations.length - 1 &&
                    'border-b border-[#2C2824]/20'
                )}
              >
                <div className="flex items-center gap-3">
                  {integration.status === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <div>
                    <div className="font-bold text-sm">{integration.name}</div>
                    <div className="text-[10px] font-mono text-[#8C8278] uppercase mt-0.5">
                      {integration.status}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono">{integration.lastSync}</div>
                  <div className="text-[10px] text-[#8C8278] uppercase mt-0.5">
                    Last Sync
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
