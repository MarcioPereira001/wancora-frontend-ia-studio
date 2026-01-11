// Tipos baseados no Schema SQL do Supabase

// Tabela: pipeline_stages
export interface PipelineStage {
  id: string;
  pipeline_id?: string;
  name: string;
  position: number;
  color: string;
  created_at?: string;
}

// Tabela: leads
export interface Lead {
  id: string;
  company_id: string;
  stage_id: string | null;
  name: string;
  phone: string;
  email?: string;
  profile_pic_url?: string;
  lead_score?: number;
  temperature?: 'cold' | 'warm' | 'hot';
  tags?: string[];
  notes?: string;
  value_potential?: number; // Numeric no banco
  created_at?: string;
  owner_id?: string;
}

// Tabela: contacts
export interface Contact {
  jid: string; // Primary Key no banco (ex: 551199999999@s.whatsapp.net)
  name?: string;
  push_name?: string;
  profile_pic_url?: string;
  company_id?: string;
  updated_at?: string;
  // Campos virtuais para o front (calculados)
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

// Tabela: messages
export interface Message {
  id: string;
  session_id?: string;
  remote_jid: string;
  from_me: boolean;
  content: string; // Used by pages/
  body?: string; // Used by app/
  message_type: string; // Used by pages/
  type?: 'text' | 'image' | 'video' | 'audio'; // Used by app/
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  company_id?: string;
}

// Tabela: agents
export interface Agent {
  id: string;
  company_id: string;
  name: string;
  prompt_instruction?: string; // No schema é prompt_instruction
  knowledge_base?: string;
  is_active: boolean; // No schema é is_active
  trigger_keywords?: string[];
  created_at?: string;
}

// Tabela: instances
export interface Instance {
    id: string;
    company_id: string;
    name: string;
    session_id: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'qrcode' | 'qr_ready';
    qrcode_url?: string; // Pode ser URL ou base64 string
    battery_level?: number;
    profile_pic_url?: string;
    updated_at?: string;
}

// Auxiliar para o Kanban do Front
export interface KanbanColumn {
  id: string; // stage_id
  title: string;
  color: string;
  items?: Lead[];
  order?: number;
  company_id?: string;
}

// --- Novos Tipos para Next.js App (Merge) ---

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

export interface WhatsAppInstance {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  company_id: string;
  phone_number?: string;
  qrcode?: string;
  session_id: string;
  updated_at: string;
}

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
