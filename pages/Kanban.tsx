import React, { useState } from 'react';
import { KanbanColumn, Contact } from '../types';
import { MoreHorizontal, Plus, Search, Filter, Phone, Mail, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';

const initialColumns: KanbanColumn[] = [
  {
    id: 'col-1',
    title: 'New Leads',
    color: 'bg-zinc-500',
    items: [
      { id: '1', name: 'Alice Freeman', number: '+55 11 99999-9999', tags: ['Hot'], email: 'alice@corp.com' },
      { id: '2', name: 'Bob Smith', number: '+55 11 98888-8888', tags: ['Web'], email: 'bob@tech.io' },
    ]
  },
  {
    id: 'col-2',
    title: 'In Progress',
    color: 'bg-blue-500',
    items: [
      { id: '3', name: 'Charlie Davis', number: '+55 11 97777-7777', tags: ['Referral'], email: 'charlie@dev.com' },
    ]
  },
  {
    id: 'col-3',
    title: 'Negotiation',
    color: 'bg-orange-500',
    items: [
      { id: '4', name: 'Diana Prince', number: '+55 11 96666-6666', tags: ['Enterprise'], email: 'diana@amazon.com' },
    ]
  },
  {
    id: 'col-4',
    title: 'Closed Won',
    color: 'bg-primary',
    items: [
      { id: '5', name: 'Evan Wright', number: '+55 11 95555-5555', tags: ['Q1 Deal'], email: 'evan@write.com' },
    ]
  }
];

export const Kanban: React.FC = () => {
  const [columns, setColumns] = useState(initialColumns);

  // Simplified Drag and Drop simulation for demo purposes
  const handleDragStart = (e: React.DragEvent, contactId: string, fromColId: string) => {
    e.dataTransfer.setData('contactId', contactId);
    e.dataTransfer.setData('fromColId', fromColId);
  };

  const handleDrop = (e: React.DragEvent, toColId: string) => {
    const contactId = e.dataTransfer.getData('contactId');
    const fromColId = e.dataTransfer.getData('fromColId');

    if (fromColId === toColId) return;

    const newColumns = [...columns];
    const fromCol = newColumns.find(c => c.id === fromColId);
    const toCol = newColumns.find(c => c.id === toColId);

    if (fromCol && toCol) {
      const contactIndex = fromCol.items.findIndex(i => i.id === contactId);
      const [contact] = fromCol.items.splice(contactIndex, 1);
      toCol.items.push(contact);
      setColumns(newColumns);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
          <p className="text-zinc-400 text-sm">Manage your opportunities and track conversions.</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                    type="text" 
                    placeholder="Search deals..." 
                    className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-primary w-64"
                />
            </div>
            <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
            </Button>
            <Button variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                New Deal
            </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-[1000px] h-full">
          {columns.map((column) => (
            <div 
                key={column.id} 
                className="w-80 flex flex-col bg-zinc-900/30 rounded-xl border border-zinc-800/50"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-4 flex items-center justify-between border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color} shadow-[0_0_8px_rgba(var(--tw-shadow-color),0.5)]`} />
                  <h3 className="font-semibold text-zinc-200 text-sm">{column.title}</h3>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{column.items.length}</span>
                </div>
                <button className="text-zinc-500 hover:text-zinc-300">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {column.items.map((contact) => (
                  <div 
                    key={contact.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, contact.id, column.id)}
                    className="group bg-card p-4 rounded-lg border border-zinc-800 hover:border-primary/50 cursor-grab active:cursor-grabbing hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {contact.tags[0]}
                        </span>
                        <MoreHorizontal className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h4 className="font-medium text-zinc-200 mb-0.5">{contact.name}</h4>
                    <p className="text-xs text-zinc-500 mb-4">{contact.email}</p>
                    
                    <div className="flex items-center gap-2 pt-3 border-t border-zinc-800/50">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 border border-zinc-700">
                            {contact.name.charAt(0)}
                        </div>
                        <div className="ml-auto flex gap-1">
                            <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-green-500 transition-colors">
                                <Phone className="w-3 h-3" />
                            </button>
                            <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-blue-500 transition-colors">
                                <Mail className="w-3 h-3" />
                            </button>
                            <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-orange-500 transition-colors">
                                <Calendar className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                  </div>
                ))}
                
                <button className="w-full py-2 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-800 hover:border-zinc-600 transition-all">
                    <Plus className="w-4 h-4" />
                    Add Deal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};