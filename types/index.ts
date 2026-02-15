
export interface ChatContact {
  id: string;
  company_id: string;
  jid: string;
  remote_jid: string;
  name: string;
  push_name?: string;
  profile_pic_url?: string | null;
  unread_count: number;
  last_message_content?: string;
  last_message_type?: string;
  last_message_at?: string; // Alinhado com SQL
  phone_number: string;
  is_muted?: boolean;
  is_group?: boolean;
  // is_newsletter removido
  is_community?: boolean; 
  is_online?: boolean;
  last_seen_at?: string;
  is_business?: boolean;
  
  // Dados enriquecidos via Join/RPC (V5.0)
  lead_id?: string | null;
  lead_status?: string | null;
  lead_created_at?: string | null;
  lead_tags?: string[];
  pipeline_stage_id?: string;
  stage_name?: string;
  stage_color?: string;
  
  // Campos legados para compatibilidade de UI
  last_message?: string; 
  last_message_time?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'agent';
  profile_pic_url?: string;
  avatar_url?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id?: string;
  avatar_url?: string;
  super_admin?: boolean; // NOVO: Flag de Super Admin
}

export interface Company {
  id: string;
  name: string;
  plan: string;
  status: string;
  ai_config?: any;
}

export interface Instance {
  id: string;
  company_id: string;
  session_id: string;
  name: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'qrcode' | 'qr_ready';
  qrcode_url?: string | null;
  profile_pic_url?: string | null;
  battery_level?: number;
  sync_status?: string;
  sync_percent?: number;
  updated_at?: string;
  is_business_account?: boolean; // NOVO: Flag de tipo de conta
}

export interface DriveFile {
  id: string;
  google_id: string;
  name: string;
  mime_type: string;
  web_view_link: string;
  thumbnail_link?: string;
  size?: number;
  parent_id?: string | null;
  is_folder: boolean;
  created_at: string;
  updated_at: string;
}

export interface GamificationProfile {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  rank: number;
  total_sales: number;
  leads_won: number;
  xp: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
}

export interface FunnelStat {
  stage_name: string;
  lead_count: number;
  total_value: number;
  color?: string;
}

export interface DashboardKPI {
  totalLeads: number;
  potentialRevenue: number;
  conversionRate: number;
  avgTicket: number;
}

// --- MESSAGE CONTENT TYPES (STRONG TYPING) ---

export interface PollOption {
  optionName: string;
}

export interface PollContent {
  name: string;
  options: PollOption[] | string[];
  selectableOptionsCount?: number;
  values?: string[]; // Compatibilidade com versões antigas
}

export interface LocationContent {
  latitude: number;
  longitude: number;
  degreesLatitude?: number; // Compatibilidade Baileys
  degreesLongitude?: number;
}

export interface ContactContent {
  displayName: string;
  vcard: string;
  phone?: string;
}

export interface CardContent {
  title: string;
  description?: string;
  link: string;
  thumbnailUrl?: string;
}

export interface Message {
  id: string;
  remote_jid: string;
  from_me: boolean;
  content: string;
  body?: string;
  message_type: string;
  status: string;
  created_at: string;
  session_id: string;
  company_id: string;
  media_url?: string;
  fileName?: string;
  contact?: ChatContact;
  reactions?: any[];
  poll_votes?: any[];
  read_at?: string;
  delivered_at?: string;
  lead_id?: string;
  transcription?: string | null;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  position: number;
  company_id: string;
}

export interface Lead {
  id: string;
  company_id: string;
  pipeline_stage_id: string;
  name: string;
  phone: string;
  email?: string;
  value_potential?: number;
  temperature?: 'hot' | 'warm' | 'cold';
  notes?: string;
  tags?: string[];
  lead_score?: number;
  owner_id?: string;
  bot_status?: 'active' | 'paused' | 'off';
  deadline?: string | null;
  created_at: string;
  updated_at?: string;
  position?: number;
  profile_pic_url?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
  totalValue: number;
  items: Lead[];
}

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  company_id: string;
}

export interface ChecklistItem {
  id: string;
  lead_id: string;
  company_id: string;
  text: string;
  is_completed: boolean;
  deadline?: string | null;
  created_at: string;
}

export interface LeadLink {
  id: string;
  lead_id: string;
  company_id: string;
  title: string;
  url: string;
  created_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  type: 'note' | 'log';
  content: string;
  created_by?: string;
  creator_name?: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_task: boolean;
  status: string;
  completed_at?: string | null;
  lead_id?: string | null;
  lead?: { id: string; name: string; phone?: string };
  user_id: string;
  company_id: string;
  category?: string;
  reminder_sent?: boolean;
  confirmation_sent?: boolean;
  send_notifications?: boolean;
  custom_notification_config?: any;
}

// --- ADMIN & LOGS TYPES ---

export interface SystemLog {
    id: string;
    level: 'info' | 'warn' | 'error' | 'fatal';
    source: 'frontend' | 'backend' | 'worker' | 'database';
    message: string;
    metadata?: any;
    company_id?: string;
    user_id?: string;
    created_at: string;
}

export interface Feedback {
    id: string;
    type: 'bug' | 'suggestion';
    content: string;
    status: 'pending' | 'in_progress' | 'resolved';
    created_at: string;
    user?: { name: string; email: string };
}
