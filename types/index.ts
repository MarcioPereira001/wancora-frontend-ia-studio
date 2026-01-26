
export interface Appointment {
  id: string;
  company_id: string;
  lead_id?: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  origin: 'internal' | 'public_link';
  category?: string;
  color?: string;
  is_task?: boolean;
  completed_at?: string | null;
  recurrence_rule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    days_of_week?: number[];
    end_date?: string;
    count?: number;
  };
  reminder_sent: boolean;
  confirmation_sent: boolean;
  cancel_reason?: string;
  meet_link?: string;
  ai_summary?: string;
  created_at?: string;
  lead?: {
      id: string;
      name: string;
      phone: string;
  };
}

export interface NotificationTrigger {
    id: string;
    type: 'on_booking' | 'before_event';
    time_amount?: number;
    time_unit?: 'minutes' | 'hours' | 'days';
    template: string;
    active: boolean;
}

export interface AvailabilityRule {
    id: string;
    company_id: string;
    user_id: string;
    name: string;
    slug: string;
    days_of_week: number[];
    start_hour: string;
    end_hour: string;
    slot_duration: number;
    is_active: boolean;
    notification_config?: {
        admin_phone: string | null;
        admin_notifications: NotificationTrigger[];
        lead_notifications: NotificationTrigger[];
    };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'agent' | 'user';
  company_id?: string;
  avatar_url?: string | null;
}

export interface Company {
  id: string;
  name: string;
  plan: 'starter' | 'pro' | 'scale';
  status: 'active' | 'inactive' | 'trial';
  ai_config?: {
      provider: string;
      apiKey: string;
      model: string;
      updatedAt?: string;
  };
  created_at?: string;
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
  created_at?: string;
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
  stage_id: string;
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

export interface Message {
  id: string;
  remote_jid: string;
  from_me: boolean;
  content: string;
  body?: string;
  message_type: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received' | 'played';
  created_at: string;
  delivered_at?: string;
  read_at?: string;
  session_id: string;
  company_id: string;
  media_url?: string;
  fileName?: string;
  contact?: {
    push_name?: string;
  };
  poll_votes?: any[];
  reactions?: any[];
  whatsapp_id?: string;
  lead_id?: string | null;
  is_deleted?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  company_id: string;
  created_at?: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  company_id: string;
}

export interface Lead {
  id: string;
  company_id: string;
  pipeline_stage_id: string;
  name: string;
  phone: string;
  email?: string;
  value_potential: number;
  temperature: 'hot' | 'warm' | 'cold';
  status?: string;
  notes?: string;
  tags?: string[];
  owner_id?: string;
  position?: number;
  created_at: string;
  updated_at?: string;
  profile_pic_url?: string;
  deadline?: string | null;
  bot_status?: 'active' | 'paused' | 'off';
  lead_score?: number;
  custom_data?: any;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
  totalValue: number;
  items: Lead[];
}

export interface ChatContact {
  id: string;
  company_id: string;
  jid: string;
  remote_jid: string;
  name: string;
  push_name?: string;
  profile_pic_url?: string | null;
  unread_count: number;
  last_message?: string;
  last_message_content?: string;
  last_message_type?: string;
  last_message_time?: string;
  phone_number: string;
  is_muted?: boolean;
  is_group?: boolean;
  updated_at?: string;
  is_online?: boolean;
  last_seen_at?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  profile_pic_url?: string | null;
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
  company_id: string;
  lead_id: string;
  type: 'note' | 'log' | 'call' | 'email' | 'meeting' | 'won_deal' | 'new_lead';
  content: string;
  created_by?: string;
  created_at: string;
  creator_name?: string;
  profiles?: { name: string };
}
