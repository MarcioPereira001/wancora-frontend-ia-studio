# 🗄️ WANCORA CRM - Database Schema Definitions v5.0

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
* `storage_retention_days`: integer (Default: 30) - [NOVO] Ciclo de vida da mídia. Arquivos no Supabase mais antigos que isso são movidos para o Google Drive e deletados do bucket.

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
* `unread_count`: integer (Default: 0) - Contador atômico atualizado via Trigger.
* `parent_jid`: text (Para vincular Grupos a Comunidades)
* `is_community`: boolean

### `baileys_auth_state`
Armazena chaves criptográficas e credenciais de sessão do WhatsApp (Multi-Device).
* `session_id`: text (PK)
* `data_type`: text (PK)
* `key_id`: text (PK)
* `payload`: jsonb
* `updated_at`: timestamptz

### `identity_map` (LID Resolver) [CRÍTICO v5.1]
Tabela técnica essencial para o ecossistema Multi-Device (iOS/Android). O WhatsApp envia atualizações de presença e reações usando IDs ocultos (`@lid`) que não correspondem ao número de telefone. Esta tabela faz a ponte.
* `lid_jid`: text (PK) - O ID opaco (Ex: `123456@lid`)
* `phone_jid`: text - O ID real do telefone (Ex: `55119999@s.whatsapp.net`)
* `company_id`: uuid (PK, FK -> companies)
* `created_at`: timestamptz

### `leads` (CRM)
A entidade de negócio principal.
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `phone`: text (Vinculado ao contato)
* `name`: text (Nullable) - Pode ser NULL se o contato não tiver identificação. O Frontend formata o telefone.
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
*   **Constraint de Integridade:** `UNIQUE (company_id, phone)` - Impede fisicamente a criação de dois leads com o mesmo número na mesma empresa, forçando o Backend a tratar a duplicidade antes da inserção.
*   **Regra de Exclusão (Lead Guard):** O Trigger de banco `auto_create_lead_on_message` agora bloqueia *fisicamente* a criação de leads para:
    * Grupos (`@g.us`)
    * Newsletters (`@newsletter`)
    * Broadcasts de Status (`status@broadcast`)
    * Mensagens enviadas por mim (`from_me = true`)

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
* `remote_jid`: text (O Chat ID - Grupo ou Pessoa)
* `participant`: text (Nullable) <- [NOVO] O ID real de quem enviou a mensagem (Vital para Grupos).
* `whatsapp_id`: text (Unique Index composto com remote_jid)
* `from_me`: boolean
* `content`: text (Para Cards, armazena o JSON com título/descrição/link)
* `transcription`: text (Nullable)
* `message_type`: text
* `media_url`: text
* `created_at`: timestamptz
* `delivered_at`: timestamptz
* `read_at`: timestamptz
* `reactions`: jsonb
* `poll_votes`: jsonb

### `products` (Catálogo) [NOVO]
Cache dos produtos sincronizados do WhatsApp Business.
* `id`: uuid (PK)
* `company_id`: uuid (FK)
* `product_id`: text (ID original do WA)
* `name`: text
* `description`: text
* `price`: numeric
* `currency`: text
* `image_url`: text
* `is_hidden`: boolean

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
* `title`, `description`, `start_time`, `end_time`
* `start_time`: timestamptz
* `end_time`: timestamptz
* `status`: text ('pending', 'confirmed', 'cancelled')
* `is_task`: boolean (True = Checklist, False = Evento de Tempo)
* `completed_at`: timestamptz -> Se preenchido, a tarefa foi concluída.
* `category`: text -> Categoria visual (ex: 'Reunião', 'Pessoal').
* `color`: text -> Hex code para UI.
* `recurrence_rule`: jsonb (Ex: `{ "frequency": "weekly", "count": 10 }`)
* `meet_link`: text
* `origin`: text (Default: 'internal')
* `ai_summary`: text
* `reminder_sent`: boolean (Controle para o Worker não enviar duplicado)
* `confirmation_sent`: boolean (Controle de envio imediato `on_booking`)

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
* `notification_config`: jsonb (CRÍTICO) - Configurações de automação.
  * Schema:
    ```json
    { 
      "admin_phone": "5511999999999", 
      "admin_notifications": [
        { "id": "uuid", "type": "on_booking", "active": true, "template": "Novo agendamento de [lead_name]..." },
        { "id": "uuid", "type": "before_event", "time_amount": 1, "time_unit": "hours", "template": "Falta 1h..." }
      ], 
      "lead_notifications": [
        { "id": "uuid", "type": "before_event", "time_amount": 30, "time_unit": "minutes", "template": "Olá [lead_name], sua reunião começa em 30min." }
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

### `webhook_logs` (Integrações) [NOVO]
Logs de disparos de eventos para sistemas externos (n8n, Typebot).
* `id`: uuid (PK)
* `instance_id`: uuid (FK -> instances)
* `event_type`: text (Ex: 'message.upsert')
* `status`: integer (HTTP Status Code)
* `payload`: jsonb
* `response_body`: text
* `created_at`: timestamptz

### `integrations_google` (Cloud Auth)
Armazena tokens OAuth2 para acesso ao Google Drive (Multi-Tenant).
* `company_id`: uuid (PK, FK -> companies) - Relação 1:1 estrita.
* `email`: text (Email da conta Google conectada).
* `access_token`: text
* `refresh_token`: text (Crítico para acesso offline/renovação).
* `token_type`: text
* `expiry_date`: bigint
* `updated_at`: timestamptz

### `drive_cache` (Sistema de Arquivos / Espelho)
Espelho local dos metadados do Drive para navegação instantânea (0ms latency).
* `id`: uuid (PK)
* `company_id`: uuid (FK -> companies)
* `google_id`: text (ID real do arquivo no Google Drive)
* `name`: text
* `mime_type`: text
* `web_view_link`: text (Link para visualização no navegador)
* `thumbnail_link`: text
* `size`: bigint
* `parent_id`: text (Suporte a estrutura de pastas, null = root)
* `is_folder`: boolean
* `updated_at`: timestamptz
* **Constraint:** `UNIQUE(company_id, google_id)`

---

## 2. Funções RPC (Server-Side Logic)

Estas funções são vitais para a performance e lógica do sistema.

### `get_my_chat_list` (Inbox Core v5.0)
A query mais pesada do sistema. Retorna a lista de conversas com dados agregados de Leads, Mensagens, Contatos e Kanban.
*   **Parâmetro:** `p_company_id` (uuid)
*   **Retorno:** Tabela expandida contendo:
    *   Dados do Contato: `unread_count`, `profile_pic_url`, `name`, `push_name`, `is_muted`, `is_group`.
    *   **[NOVO]** Presença: `is_online`, `last_seen_at`.
    *   **[NOVO]** Dados do Lead: `lead_id`, `lead_status`, `lead_tags` (Array de etiquetas).
    *   **[NOVO]** Dados do Kanban: `pipeline_stage_id`, `stage_name` (Nome da Fase), `stage_color`.
    *   Mensagem: `last_message_content`, `last_message_type`, `last_message_at`.
*   **Regra de Ouro:** Apenas contatos **Com Mensagens** aparecem. Contatos ocultos (`is_ignored = true`) são filtrados.
*   **Hierarquia de Nome:** Agenda > Business > PushName > Telefone Formatado.

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

### `search_drive_files` (IA + Drive)
Busca arquivos no cache do drive usando `pg_trgm` (fuzzy search) para que o Agente de IA possa encontrar documentos pelo nome aproximado.
* **Parâmetros:** `p_company_id`, `p_query`, `p_limit`
* **Retorno:** Tabela contendo `id`, `google_id`, `name`, `mime_type`, `web_view_link`.

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

**Índices de Alta Performance (Aplicados v5.1):**
*   `idx_messages_remote_jid_company`: Otimiza a abertura de chat e scroll de histórico (Composite Index).
*   `idx_contacts_last_message`: Acelera a ordenação da Sidebar (Inbox) em 100x.
*   `idx_leads_company_phone`: Vital para o "Lead Guard" evitar duplicidade na criação de leads.
*   `idx_appointments_worker`: Índice parcial (Filtered Index) que permite ao Worker de Agenda encontrar lembretes pendentes em milissegundos, ignorando milhões de registros antigos.

**Estratégia de Limpeza (Storage Garbage Collection):**
*   A View `view_orphan_storage_files` lista arquivos no bucket `chat-media` que não possuem referência na tabela `messages`.
*   Deve ser monitorada mensalmente para reduzir custos de armazenamento.
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

## NOTAS DE IMPLEMENTAÇÃO:

### Comunidades
Comunidades são tratadas como Contatos especiais (`is_community = true`). Grupos pertencentes a uma comunidade terão o campo `parent_jid` preenchido com o JID da comunidade.

### Canais
Canais são identificados pelo sufixo `@newsletter` no JID. Metadados específicos como número de seguidores ou função do usuário (admin/subscriber) são armazenados no campo JSONB `metadata`.

### Catálogo
A tabela `products` serve como um cache de leitura. Não editamos produtos pelo CRM para evitar violações de política do WhatsApp. A sincronização deve ser feita periodicamente ou sob demanda via botão no frontend.

---

