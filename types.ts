// Domain Types
export enum TicketStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  CLOSED = 'CLOSED',
}

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  QRCODE = 'QRCODE',
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  profilePicUrl?: string;
  email?: string;
  tags: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export interface Message {
  id: string;
  content: string;
  senderId: string; // 'me' or contactId
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'audio';
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  items: Contact[];
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  prompt: string;
  active: boolean;
  temperature: number;
}
