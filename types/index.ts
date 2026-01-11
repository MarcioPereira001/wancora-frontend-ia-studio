// AUTH TYPES
export interface User {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: 'admin' | 'user';
  avatar_url?: string;
  created_at?: string;
}

export interface AuthSession {
  user: User | null;
  accessToken: string | null;
}

// CRM & PIPELINE TYPES
export interface Lead {
  id: string;
  company_id: string;
  stage_id: string;
  name: string;
  phone: string;
  email?: string;
  value_potential?: number;
  temperature?: 'cold' | 'warm' | 'hot';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  notes?: string;
  created_at?: string;
  owner_id?: string;
  lead_score?: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
  company_id: string;
  color?: string;
  items?: Lead[];
}

export interface PipelineStage {
  id: string;
  pipeline_id?: string;
  name: string;
  position: number;
  color: string;
  company_id?: string;
}

// WHATSAPP & CHAT TYPES
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
  phone_number: string;
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

// MARKETING TYPES
export interface Campaign {
  id?: string;
  name: string;
  message: string;
  target_tags: string[];
  scheduled_at?: string;
  status: 'draft' | 'scheduled' | 'sent';
  company_id?: string;
}