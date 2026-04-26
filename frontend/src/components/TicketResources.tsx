import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useResourceStore } from '../store/resourceStore';
import { useResources } from '../hooks/useResources';
import { ResourceCard } from './ResourceCard';

interface TicketResourcesProps {
  ticketId: string;
}

export function TicketResources({ ticketId }: TicketResourcesProps) {
  const { fetchTicketResources } = useResources();
  const resources = useResourceStore((s) => s.ticketResources[ticketId] || []);
  const loadingTicket = useResourceStore((s) => s.loadingTicket);
  const isLoading = loadingTicket === ticketId;

  useEffect(() => {
    fetchTicketResources(ticketId);
  }, [ticketId, fetchTicketResources]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-[#8C8278] uppercase tracking-widest animate-pulse">
          Loading resources...
        </span>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-8 h-8 text-[#8C8278] mb-3" />
        <p className="text-sm text-[#8C8278] font-medium">
          No resources linked to this ticket
        </p>
        <p className="text-[10px] text-[#8C8278] mt-1 font-mono uppercase">
          Resources are pulled from ticket metadata
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
}
