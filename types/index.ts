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
  role: 'owner' | 'admin' | 'agent' | string;
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

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

// --- CRM (KANBAN & LEADS) ---
export interface Lead {
  id: string;
  company_id: string;
  pipeline_stage_id: string; // CORRIGIDO: Nome oficial do banco
  name: string;
  phone: string;
  email?: string;
  profile_pic_url?: string;
  value_potential?: number;
  lead_score?: number;
  temperature: 'cold' | 'warm' | 'hot';
  status?: string;
  tags: string[];
  notes?: string;
  created_at: string;
  updated_at?: string;
  next_appointment_at?: string;
  owner_id?: string;
  position?: number;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  company_id: string;
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
  assignments?: string[];
}

export interface KanbanColumn {
  id: string; // pipeline_stage_id
  title: string;
  color: string;
  order: number;
  totalValue: number;
  items: Lead[];
}

export interface ChecklistItem {
  id: string;
  lead_id: string;
  text: string;
  is_completed: boolean;
  created_at: string;
}

// --- DASHBOARD & GAMIFICATION ---
export interface GamificationProfile {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  total_sales: number;
  leads_won: number;
  xp: number;
  rank: number;
}

export interface ActivityItem {
  id: string;
  type: 'new_lead' | 'won_deal' | 'message';
  title: string;
  description: string;
  created_at: string;
  meta_id?: string;
}

export interface FunnelStat {
  stage_name: string;
  lead_count: number;
  total_value: number;
  color: string;
}

export interface DashboardKPI {
  totalLeads: number;
  potentialRevenue: number;
  conversionRate: number;
  avgTicket: number;
}

// --- WHATSAPP & CHAT ---
export interface Contact {
  jid: string;
  name?: string;
  push_name?: string;
  profile_pic_url?: string;
  company_id: string;
  email?: string;
  phone?: string;
}

export interface WhatsAppInstance {
  id: string;
  company_id: string;
  session_id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'qrcode' | 'connecting';
  qrcode_url?: string | null;
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
  content: string;
  body?: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'poll' | 'contact';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'sending';
  created_at: string;
  has_media?: boolean;
  media_url?: string;
  fileName?: string;
  caption?: string;
  lead_id?: string;
  lead?: Lead;
  contact?: Contact;
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

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  prompt_instruction: string;
  knowledge_base?: string;
  is_active: boolean;
  model: string;
}