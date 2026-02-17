
// --- AUTH & SYSTEM ---

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'agent' | 'user';
    company_id: string;
    avatar_url?: string;
    super_admin?: boolean;
}

export interface Company {
    id: string;
    name: string;
    plan: 'starter' | 'pro' | 'scale';
    status: 'active' | 'blocked' | 'trial';
    storage_retention_days?: number;
    // Configuração de IA nativa (Gemini)
    ai_config?: {
        apiKey?: string;
        model?: string;
        provider?: string;
    };
    // [NOVO] Configuração Centralizada de Integrações (BYOK)
    integrations_config?: {
        openai?: { apiKey: string };
        elevenlabs?: { apiKey: string; voiceId?: string };
        stripe?: { publishableKey: string; secretKey: string };
        n8n?: { url: string };
        typebot?: { url: string };
        [key: string]: any; // Permite expansão futura
    };
}

export interface SystemLog {
// ... (restante do arquivo mantido inalterado)
    id: string;
    level: 'info' | 'warn' | 'error' | 'fatal';
    source: string;
    message: string;
    metadata?: any;
    company_id?: string | null;
    user_id?: string | null;
    created_at: string;
}

// --- WHATSAPP & CHAT ---

export interface Instance {
    id: string;
    company_id: string;
    session_id: string;
    name: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'qrcode' | 'qr_ready';
    qrcode_url?: string | null;
    profile_pic_url?: string | null;
    battery_level?: number;
    sync_status?: string;
    sync_percent?: number;
    is_business_account?: boolean;
    updated_at?: string;
    webhook_url?: string;
    webhook_enabled?: boolean;
}

export interface ChatContact {
    id: string;
    jid: string;
    remote_jid: string;
    company_id: string;
    name: string | null;
    push_name?: string | null;
    phone_number: string;
    profile_pic_url?: string | null;
    unread_count: number;
    last_message_at?: string;
    last_message_time?: string; // Compatibilidade com hook antigo
    last_message_content?: string;
    last_message_type?: string;
    is_group?: boolean;
    is_community?: boolean;
    is_online?: boolean;
    is_business?: boolean;
    is_newsletter?: boolean;
    lead_tags?: string[];
    stage_name?: string;
    stage_color?: string;
    lead_id?: string;
    last_seen_at?: string;
    is_ignored?: boolean;
}

export interface Message {
    id: string;
    session_id: string;
    company_id: string;
    remote_jid: string;
    from_me: boolean;
    content: string;
    body?: string; // Alias para content
    message_type: string;
    media_url?: string | null;
    fileName?: string;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'played' | 'failed';
    created_at: string;
    read_at?: string;
    delivered_at?: string;
    contact?: ChatContact;
    transcription?: string;
    poll_votes?: any[];
    reactions?: any[];
    lead_id?: string | null;
}

// Sub-types for Message Content Parsing
export interface LocationContent { latitude: number; longitude: number; degreesLatitude?: number; degreesLongitude?: number; }
export interface ContactContent { displayName: string; vcard?: string; phone?: string; }
export interface CardContent { title: string; description?: string; link: string; thumbnailUrl?: string; }

// --- CRM & KANBAN ---

export interface Pipeline {
    id: string;
    company_id: string;
    name: string;
    is_default: boolean;
    created_at?: string;
}

export interface PipelineStage {
    id: string;
    pipeline_id: string;
    name: string;
    color: string;
    position: number;
    company_id?: string;
}

export interface Lead {
    id: string;
    company_id: string;
    name: string;
    phone: string;
    email?: string;
    value_potential?: number;
    pipeline_stage_id: string;
    position?: number;
    tags?: string[];
    notes?: string;
    temperature?: 'hot' | 'warm' | 'cold';
    status?: string;
    owner_id?: string;
    profile_pic_url?: string;
    created_at: string;
    updated_at?: string;
    bot_status?: 'active' | 'paused' | 'off';
    deadline?: string | null;
    lead_score?: number;
}

export interface KanbanColumn {
    id: string;
    title: string;
    color: string;
    items: Lead[];
    totalValue: number;
    order?: number;
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
    company_id: string;
    type: 'note' | 'log' | 'won_deal' | 'new_lead';
    content: string;
    created_by?: string;
    creator_name?: string; // Hydrated
    created_at: string;
}

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
    profile_pic_url?: string; // Alias
}

// --- DASHBOARD & STATS ---

export interface DashboardKPI {
    totalLeads: number;
    potentialRevenue: number;
    conversionRate: number;
    avgTicket: number;
}

export interface GamificationProfile {
    user_id: string;
    user_name: string;
    avatar_url?: string;
    xp: number;
    rank: number;
    total_sales: number;
    leads_won: number;
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
    color: string;
}

// --- CALENDAR & APPOINTMENTS ---

export interface Appointment {
    id: string;
    company_id: string;
    user_id: string;
    lead_id?: string | null;
    lead?: { id: string; name: string; phone?: string }; // Hydrated
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    is_task: boolean;
    category?: string;
    guests?: any[];
    completed_at?: string | null;
    send_notifications?: boolean;
    reminder_sent?: boolean;
    confirmation_sent?: boolean;
    origin?: string;
    meet_link?: string;
    event_location_details?: string;
    companies?: { name: string };
    availability_rules?: any;
    custom_notification_config?: any;
}

// --- CLOUD & DRIVE ---

export interface DriveFile {
    id: string;
    google_id: string;
    name: string;
    mime_type: string;
    web_view_link: string;
    thumbnail_link?: string | null;
    size?: number;
    is_folder: boolean;
    parent_id?: string | null;
    updated_at?: string;
}

// --- AI & AGENTS ---

export type AgentLevel = 'junior' | 'pleno' | 'senior';
export type AgentTriggerType = 'all_messages' | 'first_message_day' | 'first_message_ever' | 'keyword_exact' | 'keyword_contains' | 'pipeline_stage';

export interface AgentTriggerConfig {
    type: AgentTriggerType;
    keywords?: string[];
    stage_id?: string;
}

export interface AgentFile {
    id: string;
    name: string;
    type: 'text' | 'image' | 'audio';
    url: string;
}

export interface AgentPersonalityConfig {
    role: string;
    tone: string;
    context?: string;
    negative_prompts?: string[];
    escape_rules?: string[];
}

export interface AgentToolsConfig {
    drive_integration?: boolean;
    drive_folder_id?: string | null;
    calendar_integration?: boolean;
    crm_integration?: boolean;
    reporting_phones?: string[];
}

export interface AgentLink {
    title: string;
    url: string;
    description?: string;
}

export interface Agent {
    id: string;
    company_id: string;
    name: string;
    level: AgentLevel;
    prompt_instruction: string;
    personality_config: AgentPersonalityConfig;
    knowledge_config: {
        text_files: AgentFile[];
        media_files: AgentFile[];
    };
    flow_config?: any; // Dados do React Flow (Nodes/Edges)
    tools_config?: AgentToolsConfig;
    links_config?: AgentLink[];
    trigger_config?: AgentTriggerConfig;
    is_default?: boolean;
    is_active: boolean;
    transcription_enabled: boolean;
    model: string;
    knowledge_base?: string; // Legacy
}
