import React, { useState } from 'react';
import { SyncDropdown } from './components/SyncDropdown';
import { GanttChart } from './components/GanttChart';
import { ItemDrawer } from './components/ItemDrawer';
import { MOCK_DATA, GanttItem } from './data';
import { TooltipProvider } from '@radix-ui/react-tooltip';

export default function App() {
  const [selectedItem, setSelectedItem] = useState<GanttItem | null>(null);

  const handleSelectItem = (item: GanttItem) => {
    setSelectedItem(item);
  };

  const handleCloseDrawer = () => {
    setSelectedItem(null);
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-screen w-full bg-[#F0EBE3] text-[#2C2824] font-sans selection:bg-[#2C2824] selection:text-[#F0EBE3]">
        {/* Header */}
        <header className="flex-none border-b border-[#2C2824]/20 h-16 flex items-center justify-between px-6 bg-[#F7F3ED] z-10">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#2C2824] text-[#F0EBE3] flex items-center justify-center font-bold font-mono text-xl">
              G
            </div>
            <h1 className="font-bold tracking-tight uppercase text-lg hidden sm:block">
              Gantt / Global View
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <SyncDropdown />
            <div className="h-8 w-8 rounded-full border border-[#2C2824]/30 overflow-hidden bg-[#E8E2D9] flex-shrink-0">
              <img 
                src="https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHByb2ZpbGUlMjBwaWN0dXJlfGVufDF8fHx8MTc3NDg2OTQ5MXww&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="Current User" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden relative">
          <GanttChart 
            data={MOCK_DATA} 
            onSelectItem={handleSelectItem} 
          />
        </main>

        {/* Right Drawer */}
        <ItemDrawer 
          item={selectedItem} 
          onClose={handleCloseDrawer} 
        />
      </div>
    </TooltipProvider>
  );
}