import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Bot, 
  Settings, 
  Bell, 
  Menu, 
  X, 
  Zap,
  Search
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarItem = ({ icon: Icon, label, to, isActive }: any) => (
  <Link
    to={to}
    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive 
        ? 'bg-primary/10 text-primary border-r-2 border-primary' 
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
    }`}
  >
    <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'group-hover:text-zinc-100'}`} />
    {label}
  </Link>
);

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'CRM / Kanban', path: '/kanban' },
    { icon: MessageSquare, label: 'Inbox', path: '/inbox' },
    { icon: Bot, label: 'AI Agents', path: '/agents' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden text-zinc-100">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-border transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border bg-zinc-900/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-800 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
              Wancora
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-8 overflow-y-auto h-[calc(100vh-4rem)]">
          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Platform</p>
            {navItems.map((item) => (
              <SidebarItem 
                key={item.path}
                icon={item.icon}
                label={item.label}
                to={item.path}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>

          <div className="mt-auto pt-6 border-t border-border">
            <div className="px-3 py-4 bg-zinc-900/50 rounded-xl border border-zinc-800 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs font-medium text-zinc-400 mb-1">Current Plan</p>
              <h4 className="text-sm font-bold text-white mb-2">Professional</h4>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[75%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              </div>
              <p className="text-[10px] text-zinc-500 mt-2">75% of monthly tokens used</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-border bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-zinc-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
              <Search className="w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search commands..." 
                className="bg-transparent border-none outline-none text-zinc-300 placeholder-zinc-600 w-48"
              />
              <span className="text-xs border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-500">⌘K</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative text-zinc-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-background transform translate-x-1/4 -translate-y-1/4" />
            </button>
            <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background/50 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};