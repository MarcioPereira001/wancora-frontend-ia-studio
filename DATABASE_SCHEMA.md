
# 🗄️ Wancora CRM - Database Schema & Architecture (Source of Truth)

**Versão da Documentação:** 3.10 (Sync Protocol & Polls)
**Status do Sistema:** Produção / Estável
**Engine:** PostgreSQL (via Supabase)
**Arquitetura:** Multi-tenant (Baseado em `company_id`)

Este documento é a FONTE DA VERDADE ABSOLUTA. Ele descreve a estrutura exata do banco de dados, regras de integridade, funções RPC e gatilhos.

---

## 🚨 1. Regras Críticas de Negócio (LEIA ANTES DE GERAR CÓDIGO)

Qualquer query ou lógica gerada deve respeitar estritamente estas 5 regras para evitar falhas catastróficas:

1.  **Suporte a LID (WhatsApp ID Oculto/Privado):**
    *   A tabela `messages` **NÃO POSSUI** Foreign Key restrita para `contacts`.
    *   *Motivo:* Permitir salvar mensagens de IDs ocultos (`user@lid`) ou Status (`status@broadcast`) antes que o contato seja formalmente criado.
    *   *Proibido:* Nunca sugira adicionar `CONSTRAINT fk_messages_contacts`.

2.  **Unicidade de Mensagens (Upsert Seguro):**
    *   A tabela `messages` possui a constraint `messages_unique_id UNIQUE (remote_jid, whatsapp_id)`.
    *   O Backend usa isso para fazer UPSERT. Qualquer insert manual deve tratar conflitos nesta chave.

3.  **Visualização de Chats (Sidebar):**
    *   O Frontend **NÃO** deve fazer `SELECT * FROM messages` para montar a lista de conversas. Isso é lento e não trata deduplicação.
    *   *Obrigatório:* Use sempre a função RPC `get_my_chat_list`. Ela retorna a lista ordenada, com contadores e última mensagem já formatada.

4.  **Multi-Tenancy (Segurança de Dados):**
    *   Todas as tabelas críticas (`leads`, `messages`, `contacts`, `campaigns`) possuem a coluna `company_id`.
    *   Todas as queries devem incluir `WHERE company_id = '...'` para evitar vazamento de dados entre clientes.

5.  **Hierarquia de Nomes (Smart Naming):**
    *   Ao exibir o nome de um chat, a prioridade visual é:
        1. `leads.name` (Nome no CRM)
        2. `contacts.name` (Nome na Agenda salva)
        3. `contacts.push_name` (Nome do Perfil WhatsApp)
        4. `contacts.jid` (Número de telefone formatado)

---

## 📜 2. RAW SQL: Estrutura das Tabelas (DDL)

### 2.1. Núcleo do Sistema & Auth

```sql
-- EMPRESAS (Tenants)
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  document text,
  status text DEFAULT 'active'::text,
  plan text DEFAULT 'starter'::text,
  trial_ends_at timestamp with time zone,
  stripe_customer_id text,
  subscription_status text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

-- PERFIS DE USUÁRIO (Vinculados ao Auth do Supabase)
CREATE TABLE public.profiles (
  id uuid NOT NULL, -- FK para auth.users
  email text,
  name text,
  role text DEFAULT 'owner'::text,
  company_id uuid,
  accepted_terms boolean DEFAULT false,
  accepted_terms_at timestamp with time zone,
  profile_pic_url text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- INSTÂNCIAS WHATSAPP (Sessões Baileys)
CREATE TABLE public.instances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  name text,
  session_id text NOT NULL UNIQUE,
  status text DEFAULT 'disconnected'::text, -- 'qrcode', 'connected', 'disconnected'
  qrcode_url text,
  battery_level integer,
  profile_pic_url text,
  sync_status text DEFAULT 'completed', -- 'importing_contacts', 'importing_messages', 'completed'
  sync_percent integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT instances_pkey PRIMARY KEY (id)
);

-- ESTADO DE AUTENTICAÇÃO (Chaves do Baileys)
CREATE TABLE public.baileys_auth_state (
  session_id text NOT NULL,
  data_type text NOT NULL, -- 'creds', 'keys'
  key_id text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT baileys_auth_state_pkey PRIMARY KEY (session_id, data_type, key_id)
);
```

### 2.2. Mensageria & Contatos

```sql
-- CONTATOS (Agenda Sincronizada)
CREATE TABLE public.contacts (
  jid text NOT NULL UNIQUE, -- PK (Ex: 55119999@s.whatsapp.net)
  company_id uuid,
  name text, -- Nome salvo na agenda
  push_name text, -- Nome público do perfil
  profile_pic_url text,
  is_ignored boolean DEFAULT false, -- Se true, não vira lead (Anti-Ghost)
  is_muted boolean DEFAULT false,
  unread_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (jid)
);

-- MENSAGENS (Histórico)
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  remote_jid text NOT NULL,
  whatsapp_id text, -- ID único da msg no WhatsApp
  from_me boolean DEFAULT false,
  content text, -- Texto ou JSON (Polls)
  message_type text DEFAULT 'text'::text,
  media_url text,
  status text DEFAULT 'sent'::text,
  poll_votes jsonb DEFAULT '[]'::jsonb, -- Votos da Enquete
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  lead_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_unique_id UNIQUE (remote_jid, whatsapp_id), -- VITAL PARA UPSERT
  CONSTRAINT messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
  -- NOTA: Sem FK para contacts intencionalmente.
);
```

### 2.3. CRM & Pipeline (Funil de Vendas)

```sql
-- FUNIL DE VENDAS (Colunas do Kanban)
CREATE TABLE public.pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipelines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.pipeline_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_id uuid,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text DEFAULT '#3b82f6'::text,
  automation_config jsonb DEFAULT '{}'::jsonb,
  company_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id),
  CONSTRAINT pipeline_stages_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- LEADS (Oportunidades)
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  stage_id uuid, -- Legado (usar pipeline_stage_id)
  pipeline_stage_id uuid, -- Coluna atual do Kanban
  owner_id uuid, -- Usuário responsável
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  status text DEFAULT 'new'::text,
  lead_score integer DEFAULT 0,
  temperature text DEFAULT 'cold'::text,
  value_potential numeric,
  profile_pic_url text,
  tags ARRAY,
  notes text,
  custom_data jsonb DEFAULT '{}'::jsonb,
  bot_status text DEFAULT 'active'::text CHECK (bot_status = ANY (ARRAY['active'::text, 'paused'::text, 'off'::text])),
  deadline timestamp with time zone, -- Adicionado para controle de prazo
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_pipeline_stage_id_fkey FOREIGN KEY (pipeline_stage_id) REFERENCES public.pipeline_stages(id)
);

-- ATIVIDADES DO LEAD (Histórico de Ações)
CREATE TABLE public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['note'::text, 'log'::text, 'call'::text, 'meeting'::text])),
  content text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lead_activities_pkey PRIMARY KEY (id),
  CONSTRAINT lead_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);

-- TAREFAS / CHECKLIST (Atualizado v3.9)
CREATE TABLE public.lead_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL, -- [CRÍTICO] Adicionado para RLS
  lead_id uuid NOT NULL,
  text text NOT NULL,
  is_completed boolean DEFAULT false,
  deadline timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lead_checklists_pkey PRIMARY KEY (id),
  CONSTRAINT lead_checklists_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
  CONSTRAINT lead_checklists_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- LINKS DO LEAD (Novo v3.9)
CREATE TABLE public.lead_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL, -- [CRÍTICO] Adicionado para RLS
  lead_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lead_links_pkey PRIMARY KEY (id),
  CONSTRAINT lead_links_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
  CONSTRAINT lead_links_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
```

### 2.4. Marketing & Campanhas (Disparos em Massa)

```sql
-- CAMPANHAS
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'draft'::text, -- 'draft', 'scheduled', 'processing', 'completed', 'paused'
  message_template text,
  target_tags ARRAY,
  scheduled_at timestamp with time zone,
  stats jsonb DEFAULT '{"read": 0, "sent": 0, "failed": 0}'::jsonb,
  execution_mode text DEFAULT 'standard'::text,
  total_leads integer DEFAULT 0,
  processed_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

-- FILA DE ENVIOS DA CAMPANHA (Atualizado v3.9)
CREATE TABLE public.campaign_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid, -- [CRÍTICO] Adicionado para RLS e Performance
  campaign_id uuid,
  lead_id uuid,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'replied'::text])),
  sent_at timestamp with time zone,
  error_log text,
  CONSTRAINT campaign_leads_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT campaign_leads_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);

-- LOGS DE AUDITORIA DE DISPAROS (Atualizado v3.9)
CREATE TABLE public.campaign_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  campaign_id uuid,
  lead_id uuid,
  phone text,
  status text CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text])),
  error_message text,
  sent_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_logs_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

-- AGENDAMENTOS DE MENSAGENS (Novo v3.9)
CREATE TABLE public.scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid,
  contact_jid text NOT NULL,
  content text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_messages_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
```

### 2.5. Automação & IA

```sql
CREATE TABLE public.agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  prompt_instruction text,
  knowledge_base text,
  is_active boolean DEFAULT false,
  trigger_keywords ARRAY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT agents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL,
  action_type text NOT NULL,
  conditions jsonb DEFAULT '{}'::jsonb,
  action_payload jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automations_pkey PRIMARY KEY (id)
);
```

---

## 📜 3. RAW SQL: Funções RPC (Lógica do Backend)

### `get_my_chat_list` (Vital para Sidebar)
Recupera a lista de conversas com suporte a LIDs e sincronização de identidade (usando LEFT JOIN).

```sql
CREATE OR REPLACE FUNCTION public.get_my_chat_list(p_company_id uuid, p_session_id text DEFAULT NULL::text)
 RETURNS TABLE(remote_jid text, contact_name text, contact_push_name text, contact_pic text, is_group boolean, is_muted boolean, unread_count integer, last_message_content text, last_message_type text, last_message_time timestamp with time zone, lead_id uuid, lead_name text, lead_pic text, contact_updated_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH LatestMessages AS (
        SELECT DISTINCT ON (m.remote_jid) 
            m.remote_jid, m.content, m.message_type, m.created_at
        FROM messages m
        WHERE m.company_id = p_company_id
        ORDER BY m.remote_jid, m.created_at DESC
    )
    SELECT 
        lm.remote_jid,
        COALESCE(l.name, c.name, c.push_name, split_part(lm.remote_jid, '@', 1)) as contact_name,
        c.push_name as contact_push_name,
        c.profile_pic_url as contact_pic,
        COALESCE(c.jid LIKE '%@g.us', false) as is_group,
        COALESCE(c.is_muted, false) as is_muted,
        COALESCE(c.unread_count, 0) as unread_count,
        lm.content as last_message_content,
        lm.message_type as last_message_type,
        lm.created_at as last_message_time,
        l.id as lead_id,
        l.name as lead_name,
        l.profile_pic_url as lead_pic,
        c.updated_at as contact_updated_at
    FROM LatestMessages lm
    LEFT JOIN contacts c ON c.jid = lm.remote_jid -- LEFT JOIN permite que mensagens LID sem contato apareçam
    LEFT JOIN leads l ON (l.company_id = p_company_id AND l.phone = split_part(lm.remote_jid, '@', 1))
    WHERE 
        (c.company_id = p_company_id OR c.company_id IS NULL)
        AND (c.is_ignored IS FALSE OR c.is_ignored IS NULL)
    ORDER BY lm.created_at DESC;
END;
$function$
```

### `get_gamification_ranking` (Ranking de Vendas)
```sql
CREATE OR REPLACE FUNCTION public.get_gamification_ranking(p_company_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(user_id uuid, user_name text, avatar_url text, total_sales numeric, leads_won bigint, xp numeric, rank bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.name as user_name,
        p.profile_pic_url as avatar_url,
        COALESCE(SUM(l.value_potential) FILTER (WHERE l.status = 'won'), 0) as total_sales,
        COUNT(l.id) FILTER (WHERE l.status = 'won') as leads_won,
        (COUNT(l.id) * 10) + (COALESCE(SUM(l.value_potential), 0) / 10) as xp,
        RANK() OVER (ORDER BY (COUNT(l.id) * 10 + COALESCE(SUM(l.value_potential), 0) / 10) DESC) as rank
    FROM profiles p
    LEFT JOIN leads l ON l.owner_id = p.id 
        AND l.company_id = p_company_id 
        AND l.created_at BETWEEN p_start_date AND p_end_date
    WHERE p.company_id = p_company_id
    GROUP BY p.id, p.name, p.profile_pic_url;
END;
$function$
```

### `get_recent_activity` (Feed Dashboard)
```sql
CREATE OR REPLACE FUNCTION public.get_recent_activity(p_company_id uuid, p_limit integer)
 RETURNS TABLE(id text, type text, title text, description text, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    (
        SELECT l.id::text, 'new_lead' as type, l.name as title, 'Novo lead cadastrado' as description, l.created_at 
        FROM leads l WHERE l.company_id = p_company_id
    )
    UNION ALL
    (
        SELECT l.id::text, 'won_deal' as type, l.name as title, CONCAT('Fechou venda de R$ ', l.value_potential) as description, l.updated_at as created_at 
        FROM leads l WHERE l.company_id = p_company_id AND l.status = 'won'
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$function$
```

### `increment_campaign_count` (Worker Atomic Update)
```sql
CREATE OR REPLACE FUNCTION increment_campaign_count(p_campaign_id uuid, p_field text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_field = 'processed_count' THEN
    UPDATE campaigns SET processed_count = COALESCE(processed_count, 0) + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'failed_count' THEN
    UPDATE campaigns SET failed_count = COALESCE(failed_count, 0) + 1 WHERE id = p_campaign_id;
  END IF;
END;
$$;
```

---

## 🔒 4. Triggers de Automação

### `enforce_ignored_contact_rule` (Anti-Ghost)
```sql
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
```

---

## 🧩 5. Identity & Unification (LID vs Phone)

Sistema para corrigir a fragmentação de identidade do WhatsApp (iOS/Android Multi-Device).

### Estrutura e Funções de Unificação

```sql
-- 1. Tabela de Mapeamento de Identidade (A "Pedra de Roseta")
CREATE TABLE IF NOT EXISTS public.identity_map (
    lid_jid text NOT NULL,
    phone_jid text NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT identity_map_pkey PRIMARY KEY (lid_jid, company_id)
);

-- 2. Função para Criar o Vínculo (Chamada pelo Frontend)
CREATE OR REPLACE FUNCTION public.link_identities(p_lid text, p_phone text, p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Só insere se não existir, atualiza se necessário
    INSERT INTO public.identity_map (lid_jid, phone_jid, company_id)
    VALUES (p_lid, p_phone, p_company_id)
    ON CONFLICT (lid_jid, company_id) 
    DO UPDATE SET phone_jid = EXCLUDED.phone_jid;
    
    -- Efeito Reterorativo: Corrige mensagens passadas desse LID
    UPDATE messages 
    SET remote_jid = p_phone 
    WHERE remote_jid = p_lid 
    AND company_id = p_company_id;
    
    -- Limpa contato duplicado do LID se existir
    UPDATE contacts 
    SET is_ignored = true 
    WHERE jid = p_lid AND company_id = p_company_id;
END;
$function$;

-- 3. Trigger de Auto-Correção (O "Porteiro")
-- Intercepta mensagens novas. Se o LID já for conhecido, troca pelo Phone JID na hora.
CREATE OR REPLACE FUNCTION public.normalize_message_jid()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_real_jid text;
BEGIN
    -- Se for LID, procura no mapa
    IF NEW.remote_jid LIKE '%@lid' THEN
        SELECT phone_jid INTO v_real_jid
        FROM identity_map
        WHERE lid_jid = NEW.remote_jid
        AND company_id = NEW.company_id;
        
        -- Se achou mapeamento, corrige o ID antes de salvar
        IF v_real_jid IS NOT NULL THEN
            NEW.remote_jid := v_real_jid;
        END IF;
    END IF;
    return NEW;
END;
$function$;

-- Aplica o Trigger
DROP TRIGGER IF EXISTS on_message_normalize ON public.messages;
CREATE TRIGGER on_message_normalize
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.normalize_message_jid();
```

### `sync_lid_to_phone_contact` (Trigger de UX)
Atualiza a conversa principal (Phone) quando chega mensagem no canal secundário (LID), para garantir que ela suba no topo da lista.

```sql
CREATE OR REPLACE FUNCTION public.sync_lid_to_phone_contact()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.remote_jid LIKE '%@lid' AND NEW.lead_id IS NOT NULL THEN
        UPDATE contacts c
        SET updated_at = NOW(), 
            unread_count = unread_count + 1
        FROM leads l
        WHERE l.id = NEW.lead_id
        AND c.jid LIKE (l.phone || '%');
    END IF;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER on_message_lid_sync
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_lid_to_phone_contact();
```

---

## 🛡️ 6. Segurança & RLS (Row Level Security)

**Política Universal (Tenant Isolation):**
Implementado na v3.9 para garantir isolamento total entre empresas (Multi-tenancy). Todas as tabelas sensíveis possuem a seguinte política aplicada:

```sql
CREATE POLICY "Tenant Isolation Policy" ON public.nome_tabela
FOR ALL
TO authenticated
USING (company_id = getting_user_company_id())
WITH CHECK (company_id = getting_user_company_id())
```

**Função Auxiliar de Segurança:**
```sql
CREATE FUNCTION getting_user_company_id() RETURNS uuid AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
```

**Tabelas Protegidas:**
* `instances`, `contacts`, `messages`, `leads`
* `lead_activities`, `lead_checklists`, `lead_links`
* `pipelines`, `pipeline_stages`
* `campaigns`, `campaign_leads`, `campaign_logs`, `scheduled_messages`
* `agents`, `automations`, `identity_map`

---

### `fill_contact_name_fallback` (Auto-Name Fix)
Garante que, se um contato for salvo sem nome de agenda, o sistema use automaticamente o `push_name` (Nome do Perfil) como nome de exibição principal.

```sql
CREATE TRIGGER on_contact_name_fix
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.fill_contact_name_fallback();

Fim do Schema.