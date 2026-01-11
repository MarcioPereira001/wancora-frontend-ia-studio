export interface User {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: 'admin' | 'user';
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: string;
  company_id: string;
  contact_id?: string;
  created_at: string;
  value_potential?: number;
  priority: 'low' | 'medium' | 'high';
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
  company_id: string;
  color?: string;
}

export interface WhatsAppInstance {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  company_id: string;
  phone_number?: string;
  qrcode?: string;
  session_id: string;
  updated_at: string;
  qrcode_url?: string;
  battery_level?: number;
}

export type Instance = WhatsAppInstance;

export interface ChatContact {
  id: string;
  name: string;
  profile_pic_url?: string;
  phone_number: string; // remote_jid limpo
  remote_jid: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  tags?: string[];
}

export interface Message {
  id: string;
  body: string;
  from_me: boolean;
  remote_jid: string;
  created_at: string;
  type: 'text' | 'image' | 'video' | 'audio';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  content?: string;
  message_type?: string;
}

export interface Campaign {
  id?: string;
  name: string;
  message: string;
  target_tags: string[];
  scheduled_at?: string;
  status: 'draft' | 'scheduled' | 'sent';
}