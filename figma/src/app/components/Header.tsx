import React from 'react';
import { SyncDropdown } from './SyncDropdown';
import { Layout, Bell, Search, User } from 'lucide-react';
import { avatars } from '../mockData';

export function Header() {
  return (
    <header className="flex-shrink-0 flex items-center justify-between h-14 border-b border-gray-200 bg-white px-4">
      {/* App Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm">
          <Layout className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">SyncGantt</h1>
      </div>

      {/* Center - Search (optional for Teams feel) */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search epics, stories, tasks..."
            className="w-full bg-gray-100/75 text-gray-900 text-sm rounded-full pl-9 pr-4 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/50 transition-all border border-transparent focus:border-indigo-300"
          />
        </div>
      </div>

      {/* Right side - Integrations and User */}
      <div className="flex items-center gap-4">
        <SyncDropdown />
        
        <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>

        <button className="text-gray-400 hover:text-gray-600 transition-colors hidden sm:block">
          <Bell className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-100 group-hover:ring-indigo-300 transition-all">
            <img src={avatars.sarah} alt="Current User" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </header>
  );
}