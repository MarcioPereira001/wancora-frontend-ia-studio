// --- AUTH & COMPANY ---
export interface Company {
  id: string;
  name: string;
  plan: 'starter' | 'pro' | 'scale';
  status: 'active' | 'inactive' | 'trialing';
  created_at: string;
  stripe_customer_id?: string;
  trial_ends_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'agent';
  company_id: string;
  avatar_url?: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  profile_pic_url?: string;
}

// --- CRM (KANBAN & LEADS) ---
export interface Lead {
  id: string;
  company_id: string;
  stage_id: string;
  name: string;
  phone: string;
  email?: string;
  profile_pic_url?: string;
  value_potential?: number;
  lead_score?: number;
  temperature: 'cold' | 'warm' | 'hot';
  tags: string[];
  notes?: string;
  created_at: string;
  updated_at?: string;
  next_appointment_at?: string;
  owner_id?: string;
  type?: 'b2b' | 'b2c';
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  items?: Lead[];
}

export interface Pipeline {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  stages?: PipelineStage[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
  items?: Lead[];
}

export interface ChecklistItem {
  id: string;
  lead_id: string;
  text: string;
  is_completed: boolean;
  created_at: string;
}

// --- WHATSAPP & CHAT ---
export interface WhatsAppInstance {
  id: string;
  company_id: string;
  session_id: string;
  name: string;
  // 'qr_ready' é o status exato que o backend envia quando tem QR
  status: 'connected' | 'disconnected' | 'qr_ready' | 'qrcode' | 'connecting';
  qrcode_url?: string;
  battery_level?: number;
  profile_pic_url?: string;
  created_at?: string;
}

export type Instance = WhatsAppInstance;

export interface Message {
  id: string;
  session_id: string;
  company_id: string;
  remote_jid: string;
  from_me: boolean;
  content: string; // Conteúdo principal (texto ou JSON de enquete)
  body?: string; // Fallback legacy
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'poll' | 'contact';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'sending';
  created_at: string;
  has_media?: boolean;
  media_url?: string; // URL pública do arquivo
  fileName?: string;
  caption?: string;
}

export interface ChatContact {
  id?: string;
  company_id: string;
  jid: string;
  remote_jid: string;
  name: string;
  push_name?: string;
  profile_pic_url?: string;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
  phone_number?: string;
  updated_at?: string;
}

// --- AI AGENTS ---
export interface Agent {
  id: string;
  company_id: string;
  name: string;
  prompt_instruction: string;
  knowledge_base?: string;
  is_active: boolean;
  model: string;
}
