import React from 'react';
import { GanttItem } from '../data';
import { X, ExternalLink, PenTool, LayoutTemplate, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface ItemDrawerProps {
  item: GanttItem | null;
  onClose: () => void;
}

export function ItemDrawer({ item, onClose }: ItemDrawerProps) {
  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-[450px] bg-[#F7F3ED] border-l-4 border-[#2C2824] z-50 shadow-[-8px_0_0_0_rgba(44,40,36,0.8)] flex flex-col font-sans"
          >
            {/* Header */}
            <header className="h-16 border-b-2 border-[#2C2824] flex items-center justify-between px-6 bg-[#E8E2D9] flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-[#2C2824] text-[#F0EBE3] text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1">
                  {item.source} {item.sourceId}
                </span>
                <span className={`border-2 border-[#2C2824] text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 ${
                  item.type === 'epic' ? 'bg-[#2C2824] text-[#F0EBE3]' :
                  item.type === 'story' ? 'bg-[#DDD7CE] text-[#2C2824]' :
                  'bg-[#F7F3ED] text-[#2C2824]'
                }`}>
                  {item.type}
                </span>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center border border-transparent hover:border-[#2C2824] hover:bg-[#2C2824] hover:text-[#F0EBE3] transition-colors group"
              >
                <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              
              {/* Title Section */}
              <section>
                <h2 className="text-3xl font-black leading-tight tracking-tight mb-4">
                  {item.title}
                </h2>
                
                <p className="text-sm text-[#5C564E] leading-relaxed font-medium">
                  {item.description}
                </p>
              </section>

              {/* Meta Info Grid */}
              <section className="grid grid-cols-2 gap-px bg-[#2C2824] border-2 border-[#2C2824]">
                <div className="bg-[#F7F3ED] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">Status</span>
                  <span className="font-bold uppercase tracking-wider text-sm">{item.status.replace('-', ' ')}</span>
                </div>
                <div className="bg-[#F7F3ED] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">Department</span>
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm">
                    {item.department === 'frontend' && <LayoutTemplate className="w-4 h-4" />}
                    {item.department === 'backend' && <Database className="w-4 h-4" />}
                    {item.department === 'design' && <PenTool className="w-4 h-4" />}
                    {item.department}
                  </div>
                </div>
                <div className="bg-[#F7F3ED] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">Timeline</span>
                  <span className="font-bold text-sm">
                    {format(item.startDate, 'MMM dd')} - {format(item.endDate, 'MMM dd')}
                  </span>
                </div>
                <div className="bg-[#F7F3ED] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">Assignees</span>
                  <div className="flex -space-x-2 mt-1">
                    {item.assignees.map((a, i) => (
                      <img 
                        key={a.id} 
                        src={a.avatarUrl} 
                        alt={a.name}
                        className="w-8 h-8 rounded-none border-2 border-[#2C2824] object-cover bg-[#F7F3ED] relative hover:z-10 transition-transform hover:scale-110"
                        style={{ zIndex: item.assignees.length - i }}
                        title={a.name}
                      />
                    ))}
                  </div>
                </div>
              </section>

              {/* Links / Resources Section */}
              <section className="flex flex-col gap-4 mt-auto">
                <h3 className="text-xs font-mono uppercase font-bold tracking-widest border-b-2 border-[#2C2824] pb-2">
                  Resources
                </h3>
                
                {item.resourceLink && (
                  <a 
                    href={item.resourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 border-2 border-[#2C2824] bg-[#EDE8E1] hover:bg-[#2C2824] hover:text-[#F0EBE3] transition-colors group shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">
                        {item.type === 'epic' ? 'Project Brief (Article)' : `${item.source} Ticket`}
                      </span>
                      <span className="text-[10px] font-mono text-[#8C8278] group-hover:text-[#C8C1B7] transition-colors">
                        {item.resourceLink}
                      </span>
                    </div>
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}

                {item.figmaLink && (
                  <div className="flex flex-col gap-2">
                    <a 
                      href={item.figmaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 border-2 border-[#F24E1E] bg-[#FFF2F0] hover:bg-[#F24E1E] hover:text-white transition-colors group shadow-[4px_4px_0_0_rgba(242,78,30,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Figma Design File</span>
                        <span className="text-[10px] font-mono text-[#F24E1E]/70 group-hover:text-white/70 transition-colors">
                          {item.figmaLink}
                        </span>
                      </div>
                      <ExternalLink className="w-5 h-5" />
                    </a>
                    
                    {/* Placeholder for Figma Embed/Preview */}
                    <div className="w-full h-48 border-2 border-[#2C2824] bg-[#E8E2D9] flex items-center justify-center mt-2 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-[#2C2824]/5 flex flex-col items-center justify-center text-center p-4 gap-2">
                        <div className="w-10 h-10 bg-[#F7F3ED] border-2 border-[#2C2824] rounded-full flex items-center justify-center font-bold">F</div>
                        <span className="text-xs font-mono uppercase font-bold">Figma Preview Available in Full Version</span>
                      </div>
                      <div className="absolute inset-0 border-[8px] border-[#F7F3ED] z-10 pointer-events-none" />
                    </div>
                  </div>
                )}
                
                {/* Fallback empty state */}
                {!item.resourceLink && !item.figmaLink && (
                  <div className="p-8 border-2 border-dashed border-gray-300 text-center text-gray-500 font-mono text-xs uppercase">
                    No resources linked.
                  </div>
                )}
              </section>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}