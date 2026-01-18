# 🗄️ WANCORA CRM - Database Schema Definitions v4.2

Este documento define a estrutura oficial do Banco de Dados Supabase (PostgreSQL).
**Regra:** Qualquer SQL gerado deve ser validado contra este arquivo.

## 1. Tabelas Core

### `instances` (Conexões)
Gerencia o estado físico da conexão com o WhatsApp.
* `id`: uuid (PK)
* `company_id`: uuid (FK -> companies)
* `session_id`: text (Unique)
* `status`: text ('qrcode', 'connected', 'disconnected', 'connecting')
* `qrcode_url`: text
* `sync_status`: text ('waiting', 'importing_contacts', 'importing_messages', 'processing_history', 'completed')
* `sync_percent`: integer (0-100)
* `updated_at`: timestamptz

### `contacts` (Agenda)
Contatos brutos sincronizados do celular.
* `jid`: text (PK) - Ex: `551199999999@s.whatsapp.net`
* `company_id`: uuid (PK)
* `name`: text (Nome da agenda/grupo)
* `push_name`: text (Nome público do perfil)
* `profile_pic_url`: text
* `is_ignored`: boolean (Default: false) - Se true, não vira Lead.
* `is_muted`: boolean (Default: false)
* `last_message_at`: timestamptz

### `leads` (CRM)
A entidade de negócio principal.
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `phone`: text (Vinculado ao contato)
* `name`: text
* `status`: text ('new', 'open', 'won', 'lost', 'archived')
* `pipeline_stage_id`: uuid (FK)
* `owner_id`: uuid (FK)
* `position`: double precision
* `value_potential`: numeric
* `tags`: text[]
* `deadline`: timestamptz
* `lead_score`: integer (Default: 0)
* `temperature`: text ('cold', 'warm', 'hot')
* `custom_data`: jsonb (Campos personalizados)
* `next_appointment_at`: timestamptz
* `appointment_status`: text
* `type`: text ('b2c', 'b2b')
* `bot_status`: text ('active', 'paused', 'off')

### `messages` (Chat)
Histórico de mensagens.
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `session_id`: text
* `remote_jid`: text
* `whatsapp_id`: text (Unique Index composto com remote_jid)
* `from_me`: boolean
* `content`: text
* `message_type`: text ('text', 'image', 'audio', 'video', 'document', 'poll', 'location', 'sticker', 'contact', 'pix')
* `media_url`: text
* `poll_votes`: jsonb (Default: '[]') - Armazena votos [{ "voterJid": "...", "optionId": 0 }]
* `created_at`: timestamptz

### `pipelines` & `pipeline_stages`
Estrutura do Kanban.
* **`pipelines`**: `id`, `company_id`, `name`, `is_default`
* **`pipeline_stages`**: `id`, `pipeline_id`, `name`, `position` (int), `color`

### `lead_activities` (Logs)
Auditabilidade.
* `id`: uuid (PK)
* `lead_id`: uuid (FK -> leads ON DELETE CASCADE)
* `type`: text ('note', 'log', 'call')
* `content`: text
* `created_by`: uuid (FK -> profiles)

### `agents` (IA)
Configuração dos Agentes Inteligentes.
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `name`: text
* `prompt_instruction`: text
* `knowledge_base`: text
* `is_active`: boolean
* `model`: text (Default: 'gemini-3-flash-preview')

### `campaigns` (Motor de Disparos)
Gestão avançada de disparos em massa.
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `name`: text
* `message_template`: text
* `target_tags`: text[]
* `status`: text ('draft', 'pending', 'processing', 'completed', 'failed')
* `execution_mode`: text ('standard', 'warmup')
* `warmup_config`: jsonb (Configuração de aquecimento de chip)
* `stats`: jsonb (Contadores de leitura/envio em tempo real)
* `scheduled_at`: timestamptz

### `campaign_leads` (Fila de Disparo)
Relacionamento N:N rastreando o status de cada lead dentro de uma campanha.
* `id`: uuid (PK)
* `campaign_id`: uuid (FK)
* `lead_id`: uuid (FK)
* `status`: text ('pending', 'processing', 'sent', 'failed', 'replied')
* `sent_at`: timestamptz
* `error_log`: text

### `campaign_logs` (Histórico Técnico)
Logs detalhados de execução para auditoria.
* `id`: uuid (PK)
* `error_message`: text
* `status`: text

### `appointments` (Agenda Integrada & Tarefas)
Unificação de calendário e gerenciador de tarefas.
* `id`: uuid (PK)
* `user_id`: uuid (FK - Responsável/Dono da agenda)
* `lead_id`: uuid (FK - Opcional) -> Nullable pois pode ser tarefa pessoal.
* `title`: text
* `description`: text
* `start_time`: timestamptz
* `end_time`: timestamptz
* `status`: text ('pending', 'confirmed', 'cancelled')
* `is_task`: boolean (Default: false) -> Define se é Tarefa (Check) ou Evento (Tempo).
* `completed_at`: timestamptz -> Se preenchido, a tarefa foi concluída.
* `category`: text -> Categoria visual (ex: 'Reunião', 'Pessoal').
* `color`: text -> Hex code para UI.
* `recurrence_rule`: jsonb -> Ex: `{ frequency: 'weekly', interval: 1, count: 5 }`.
* `meet_link`: text
* `origin`: text (Default: 'internal')
* `ai_summary`: text
* `reminder_sent`: boolean

### `availability_rules` (Agendamento Inteligente)
Define as regras de horários para o sistema de agendamento (tipo Calendly).
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `user_id`: uuid (FK - Nullable) - Se null, é uma agenda global/time.
* `name`: text - Nome descritivo (ex: "Mentoria 30min")
* `slug`: text (Unique) - URL amigável.
* `days_of_week`: integer[] - Array de dias ativos (0-6).
* `start_hour`: time
* `end_hour`: time
* `slot_duration`: integer
* `buffer_before`: integer
* `buffer_after`: integer
* `is_active`: boolean

### `automations` (Workflow)
Regras de automação (Gatilho -> Ação).
* `id`: uuid (PK)
* `trigger_type`: text (Ex: 'tag_added', 'pipeline_moved')
* `action_type`: text (Ex: 'send_message', 'create_task')
* `conditions`: jsonb
* `action_payload`: jsonb
* `is_active`: boolean

### `gamification_points` (Ranking)
Histórico de XP da equipe.
* `id`: uuid (PK)
* `user_id`: uuid (FK)
* `points`: integer
* `action_type`: text (Ex: 'closed_deal', 'added_lead')

### `identity_map` (LID Resolver)
Tabela técnica para resolver conflitos entre IDs de telefone e IDs ocultos (LID).
* `lid_jid`: text (PK)
* `phone_jid`: text
* `company_id`: uuid

### `baileys_auth_state` (Sessão WhatsApp)
Persistência de credenciais do Baileys no banco (substitui arquivos locais).
* `session_id`: text (PK)
* `data_type`: text (PK)
* `key_id`: text (PK)
* `payload`: jsonb

### `scheduled_messages` (Agendamento de Envio)
Mensagens avulsas agendadas no chat.
* `id`: uuid (PK)
* `contact_jid`: text
* `content`: text
* `scheduled_at`: timestamptz
* `status`: text ('pending', 'sent', 'failed')

### `plans` & `subscriptions` (SaaS)
Gestão de planos do sistema.
* `id`: uuid
* `name`: text
* `price_monthly`: numeric
* `max_users`: integer
* `max_connections`: integer
* `features`: jsonb

---

## 2. Funções RPC (Server-Side Logic)

Estas funções são vitais para a performance e lógica do sistema.

### `get_gamification_ranking`
Calcula o ranking de vendas e XP da equipe em um período.
* Retorna: `user_name`, `total_sales`, `leads_won`, `xp`, `rank`.

### `get_sales_funnel_stats`
Retorna métricas do funil (Contagem e Valor Total) agrupado por estágio.
* Retorna: `stage_name`, `lead_count`, `total_value`, `color`.

### `get_recent_activity`
Feed unificado de atividades recentes (Novos leads + Vendas ganhas) para o Dashboard.

### `link_identities`
Função crítica que vincula um `LID` (ID oculto) ao `Phone JID` real, unificando o histórico de conversas e impedindo leads duplicados.

### `get_public_availability_by_slug`
Busca dados de uma regra de agendamento (`availability_rules`) de forma segura para usuários não logados.
* Parâmetros: `p_slug` (text)
* Retorna: Detalhes da regra + nome e avatar do dono.
* Segurança: `SECURITY DEFINER` (Bypassa RLS de leitura).

### `get_busy_slots`
Retorna horários ocupados (`start_time`, `end_time`) de um usuário em uma data específica para cálculo de disponibilidade.
* Parâmetros: `p_rule_id` (uuid), `p_date` (date)

### `get_my_chat_list`
Retorna a lista de conversas da Inbox com dados agregados (não lidas, última mensagem, dados do lead).
```sql
function get_my_chat_list(p_company_id uuid, p_session_id text)
returns table (...)
increment_campaign_count
Incrementa contadores de campanha de forma atômica (sem concorrência de leitura/escrita).

SQL

function increment_campaign_count(p_campaign_id uuid, p_field text)
returns void
reorder_pipeline_stages
Reordena estágios do funil em lote, garantindo atomicidade.

SQL

function reorder_pipeline_stages(p_updates jsonb) 
returns void
3. Triggers & Automação
enforce_ignored_contact_rule (Anti-Ghost)
Se um contato for marcado como ignorado (is_ignored = true), o Lead correspondente é deletado automaticamente.

### `sync_lid_to_phone_contact` (LID Sync)
Ao receber uma mensagem de um LID (`@lid`), verifica se já existe um Lead com o telefone correspondente e atualiza o contato principal, garantindo que a notificação apareça no chat correto.

SQL

CREATE OR REPLACE FUNCTION public.enforce_ignored_contact_rule()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.is_ignored = true THEN
    DELETE FROM public.leads 
    WHERE company_id = NEW.company_id 
    AND phone = split_part(NEW.jid, '@', 1);
  END IF;
  RETURN NEW;
END;
$function$
auto_create_lead_on_message (Smart Lead Guard)
Cria leads automaticamente ao receber mensagens, mas APENAS se o contato já tiver nome identificado (evita leads "fantasmas").

SQL

CREATE OR REPLACE FUNCTION public.auto_create_lead_on_message()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
DECLARE
    v_contact_name text;
    v_contact_push text;
BEGIN
    SELECT name, push_name INTO v_contact_name, v_contact_push
    FROM contacts WHERE jid = NEW.remote_jid AND company_id = NEW.company_id;

    IF (v_contact_name IS NOT NULL AND v_contact_name != '' AND v_contact_name != split_part(NEW.remote_jid, '@', 1)) OR 
       (v_contact_push IS NOT NULL AND v_contact_push != '') THEN
        
        INSERT INTO leads (company_id, name, phone, status, pipeline_stage_id)
        SELECT 
            NEW.company_id,
            COALESCE(v_contact_name, v_contact_push),
            split_part(NEW.remote_jid, '@', 1),
            'new',
            (SELECT id FROM pipeline_stages WHERE company_id = NEW.company_id AND position = 0 LIMIT 1)
        WHERE NOT EXISTS (
            SELECT 1 FROM leads WHERE company_id = NEW.company_id AND phone = split_part(NEW.remote_jid, '@', 1)
        );
    END IF;
    RETURN NEW;
END;
$function$;
4. ⚡ Infraestrutura Realtime (Gaming Mode Support)
Para suportar a arquitetura de "Snapshot + Subscription" sem recarregar a página, as seguintes tabelas possuem REPLICA IDENTITY FULL. Isso obriga o Postgres a enviar o objeto old completo nos eventos de UPDATE/DELETE, permitindo que o Frontend sincronize listas sem refetch.

SQL

ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.instances REPLICA IDENTITY FULL; -- Necessário para o Sync Indicator
ALTER TABLE public.messages REPLICA IDENTITY FULL; -- Necessário para o Chat
5. Políticas de Segurança (RLS) & Performance
RLS (Row Level Security): Todas as tabelas possuem RLS ativado. O acesso é restrito via company_id. O Backend utiliza a service_role key para ignorar RLS durante processamentos em background (Workers).

Índices Recomendados:

idx_leads_company_id (Vital para Kanban)

idx_leads_pipeline_stage (Vital para filtros de funil)

idx_contacts_company_id

idx_messages_remote_jid_company (Vital para carregar histórico de chat)

idx_agents_company


### Atualização v4.2 (Módulo Agenda Híbrida)
Alterações na tabela `appointments` para suportar tarefas e recorrência.
* `is_task`: boolean - Diferencia tarefas (checklist) de eventos de tempo.
* `recurrence_rule`: jsonb - Armazena regras de repetição (RFC 5545 simplificado).
* `category`: text - Categorização visual.
* `completed_at`: timestamptz - Data de conclusão para tarefas.