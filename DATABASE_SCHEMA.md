# 🗄️ WANCORA CRM - Database Schema Definitions v4.3

Este documento define a estrutura oficial do Banco de Dados Supabase (PostgreSQL).
**Regra:** Qualquer SQL gerado deve ser validado contra este arquivo.

## 1. Tabelas Core

### `companies` (Tenants)
Tabela mestre das organizações.
* `id`: uuid (PK)
* `name`: text
* `plan`: text
* `status`: text
* `ai_config`: jsonb (Default: '{}') - Armazena configurações de IA por empresa.
 * Estrutura: `{ "provider": "gemini", "apiKey": "...", "model": "gemini-3-flash-preview" }`

### `instances` (Conexões)
Gerencia o estado físico da conexão com o WhatsApp.
* `id`: uuid (PK)
* `company_id`: uuid (FK -> companies)
* `session_id`: text (Unique)
* `status`: text ('qrcode', 'connected', 'disconnected', 'connecting')
* `qrcode_url`: text
* `sync_status`: text ('waiting', 'importing_contacts', 'importing_messages', 'completed') - Controla a barra de progresso.
* `sync_percent`: integer (0-100) - Feedback visual para o usuário.
* `updated_at`: timestamptz
* `webhook_url`: text
* `webhook_enabled`: boolean (Default: false)
* `webhook_events`: text[] (Default: ['message.upsert'])

### `identity_map` (NOVO: LID Resolver)
Tabela técnica para resolver conflitos entre IDs de telefone e IDs ocultos (LID).
* `lid_jid`: text (PK)
* `phone_jid`: text
* `company_id`: uuid

### `contacts` (Agenda)
Contatos brutos sincronizados do celular.
* `jid`: text (PK) - Ex: `551199999999@s.whatsapp.net`
* `company_id`: uuid (PK)
* `name`: text (Nome da agenda do celular e grupos - **Autoridade Máxima**)
* `verified_name`: text (Nome verificado do WhatsApp Business - **Autoridade Média**)
* `push_name`: text (Nome do perfil público - **Autoridade Baixa**)
* `is_business`: boolean (Default: false) - Identificado via API ou Sync.
* `profile_pic_url`: text (Sincronizado via Lazy Load e Realtime Refresh)
* `profile_pic_updated_at`: timestamptz (Controle de Cache de 24h)
* `is_ignored`: boolean (Default: false) - Se true, não vira Lead.
* `is_muted`: boolean (Default: false)
* `last_message_at`: timestamptz
* `last_seen_at`: timestamptz
* `is_online`: boolean
* `phone`: text (Telefone limpo para vínculo com Leads e Buscas)
* `unread_count`: integer (Default: 0) - **[NOVO]** Contador atômico atualizado via Trigger.
* `is_newsletter`: boolean (Virtual/Derivado) - Identifica Canais de Transmissão.

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
* `reactions`: jsonb (Default: '[]')
* `poll_votes`: jsonb (Default: '[]')

### `lead_activities` (Logs & Timeline) [NOVO]
Registro de interações e auditoria.
* `id`: uuid (PK)
* `lead_id`: uuid (FK)
* `company_id`: uuid (FK)
* `type`: text ('note', 'log', 'call', 'meeting', 'email')
* `content`: text
* `created_by`: uuid (FK -> profiles)
* `created_at`: timestamptz

### `lead_links` (Recursos) [NOVO]
Links úteis atrelados ao lead.
* `id`: uuid (PK)
* `lead_id`: uuid (FK)
* `company_id`: uuid (FK)
* `title`: text
* `url`: text
* `created_at`: timestamptz

### `lead_checklists` (Tarefas) [NOVO]
To-do list interna do lead.
* `id`: uuid (PK)
* `lead_id`: uuid (FK)
* `company_id`: uuid (FK)
* `text`: text
* `is_completed`: boolean
* `deadline`: timestamptz
* `created_at`: timestamptz

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
* `created_at`: timestamptz
* `delivered_at`: timestamptz
* `read_at`: timestamptz
* ... (colunas existentes) ...
* `reactions`: jsonb (Default: '[]') - Array de reações `{ text: "👍", actor: "jid", ts: 123 }`.
* `poll_votes`: jsonb (Default: '[]') - Array de votos `{ voterJid: "...", selectedOptions: [...] }`.

### `pipelines` & `pipeline_stages`
Estrutura do Kanban.
* **`pipelines`**: `id`, `company_id`, `name`, `is_default`
* **`pipeline_stages`**: `id`, `pipeline_id`, `name`, `position` (int), `color`

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
* `reminder_sent`: boolean (Default: false) - Controle do worker de lembretes.
* `confirmation_sent`: boolean (Default: false) - Controle de envio imediato.

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
* `notification_config`: jsonb (NOVO) - Configurações de automação de avisos.
  * Estrutura JSON: 
    ```json
    { 
      "admin_phone": "5511999999999", 
      "admin_notifications": [
        { "type": "on_booking", "active": true, "template": "Novo agendamento..." }
      ], 
      "lead_notifications": [
        { "type": "before_event", "time_amount": 1, "time_unit": "hours", "template": "Lembrete..." }
      ] 
    }
    ```

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

### `baileys_auth_state`
Armazena chaves criptográficas e credenciais de sessão do WhatsApp (Multi-Device).
* `session_id`: text (PK)
* `data_type`: text (PK)
* `key_id`: text (PK)
* `payload`: jsonb
* `updated_at`: timestamptz

### `webhook_logs` (Integrações) [NOVO]
Logs de disparos de eventos para sistemas externos (n8n, Typebot).
* `id`: uuid (PK)
* `instance_id`: uuid (FK -> instances)
* `event_type`: text (Ex: 'message.upsert')
* `status`: integer (HTTP Status Code)
* `payload`: jsonb
* `response_body`: text
* `created_at`: timestamptz
---

## 2. Funções RPC (Server-Side Logic)

Estas funções são vitais para a performance e lógica do sistema.

### `get_my_chat_list` (Inbox Core)
A query mais pesada do sistema. Retorna a lista de conversas com dados agregados de Leads, Mensagens e Contatos.
*   **Parâmetro:** `p_company_id` (uuid)
*   **Retorno:** Tabela contendo `unread_count`, `last_message_content`, `last_message_type`, `lead_status`, `is_muted`, etc.
**Regra de Ouro:** Apenas contatos **Com Mensagens** devem aparecer (Inbox Limpa).
*   **Lógica:** Executa um `INNER JOIN` entre `contacts` e `messages`. Contatos sincronizados que nunca trocaram mensagem são excluídos da visualização.
*   **Hierarquia de Exibição de Nome:**
    1. `contacts.name` (Agenda)
    2. `contacts.verified_name` (Business)
    3. `contacts.push_name` (Perfil)
    4. `contacts.phone` (Formatado pelo Frontend se os anteriores forem NULL)

### `get_gamification_ranking`
Calcula o ranking de vendas e XP da equipe em um período.
*   **Parâmetros:** `p_company_id`, `p_start_date`, `p_end_date`
*   **Lógica:** XP = (Leads Ganhos * 1000) + (Valor Vendido / 10). Retorna `rank` calculado via window function.

### `get_sales_funnel_stats`
Retorna métricas do funil para gráficos.
*   **Parâmetros:** `p_company_id`, `p_owner_id` (Opcional)
*   **Retorno:** `stage_name`, `lead_count`, `total_value`, `color`.

### `get_recent_activity`
Feed unificado de atividades recentes (Novos leads + Vendas ganhas) para o Dashboard.
*   **Parâmetros:** `p_company_id`, `p_limit`

### `increment_campaign_count`
Incrementa contadores de campanha de forma atômica (sem concorrência de leitura/escrita).

### `link_identities`
Vincula um `LID` (ID oculto) ao `Phone JID` real na tabela `identity_map`.

---

## 3. Triggers & Automação

### `enforce_ignored_contact_rule` (Anti-Ghost)
Se um contato for marcado como ignorado (`is_ignored = true`), o Lead correspondente é deletado automaticamente.

### `sync_lid_to_phone_contact` (LID Sync)
Ao receber uma mensagem de um LID (`@lid`), verifica se já existe um Lead com o telefone correspondente e atualiza o contato principal, garantindo que a notificação apareça no chat correto.

### `auto_create_lead_on_message` (Smart Lead Guard)
Cria leads automaticamente ao receber mensagens, mas APENAS se o contato já tiver nome identificado (evita leads "fantasmas").

### `handle_updated_at`
Mantém a coluna `updated_at` sempre atualizada nas tabelas principais.

### `trigger_update_chat_stats` (Cérebro da Inbox)
*   **Alvo:** Tabela `messages` (AFTER INSERT).
*   **Função:** `handle_new_message_stats()`.
*   **Ação:** Sempre que uma nova mensagem entra:
    1. Atualiza `last_message_at` na tabela `contacts`.
    2. Se `from_me = false`, incrementa `unread_count` em +1.
    3. Garante que a conversa suba para o topo da lista instantaneamente.

---

## 4. ⚡ Infraestrutura Realtime (Gaming Mode Support)
Para suportar a arquitetura de "Snapshot + Subscription" sem recarregar a página, as seguintes tabelas possuem **REPLICA IDENTITY FULL**. Isso obriga o Postgres a enviar o objeto `old` completo nos eventos de UPDATE/DELETE, permitindo que o Frontend sincronize listas sem refetch.

```sql
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.instances REPLICA IDENTITY FULL; -- Necessário para o Sync Indicator
ALTER TABLE public.messages REPLICA IDENTITY FULL; -- Necessário para o Chat
ALTER TABLE public.appointments REPLICA IDENTITY FULL; -- Necessário para o Calendário
ALTER TABLE public.lead_checklists REPLICA IDENTITY FULL; -- Para Tarefas
ALTER TABLE public.lead_links REPLICA IDENTITY FULL; -- Para Links
ALTER TABLE public.lead_activities REPLICA IDENTITY FULL;
```

## 5. Políticas de Segurança (RLS) & Performance
**RLS (Row Level Security):** Todas as tabelas possuem RLS ativado. O acesso é restrito via `company_id`. O Backend utiliza a `service_role key` para ignorar RLS durante processamentos em background (Workers).

**Índices Recomendados:**
* `idx_leads_company_id` (Vital para Kanban)
* `idx_leads_pipeline_stage` (Vital para filtros de funil)
* `idx_contacts_company_id`
* `idx_messages_remote_jid_company` (Vital para carregar histórico de chat)
* `idx_agents_company`
* `idx_appointments_worker_lookup` (Vital para o Agenda Worker)

---

## 6. Storage (Arquivos & Mídia)
O sistema utiliza o Supabase Storage para armazenar arquivos pesados, mantendo o banco de dados leve.

### Bucket: `chat-media` (Público)
* **Função:** Armazenar imagens, áudios, vídeos e documentos recebidos ou enviados pelo WhatsApp.
* **Estrutura de Pastas:** `/{company_id}/{timestamp_nome_arquivo}.{ext}`
* **Política de Acesso:**
    * **Leitura (Select):** Pública (Qualquer pessoa com o link pode ver). Necessário para o Frontend renderizar imagens.
    * **Escrita (Insert/Update):** Restrita a usuários autenticados (`authenticated`) e backend (`service_role`).
* **Uso no Código:** O backend e frontend salvam o arquivo aqui e gravam apenas a URL pública na coluna `messages.media_url`.

---