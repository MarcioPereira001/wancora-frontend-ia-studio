# 📘 WANCORA CRM - System Architecture & Master Blueprint

**Versão:** 3.2 (Enterprise Gold Standard)
**Status:** Production-Ready
**Arquitetura:** Event-Driven, Multi-Tenant, Persistent Connection
**Stack Principal:** Next.js 14 (App Router), Node.js (Baileys Core), Supabase (PostgreSQL + Realtime).

---

## 1. Visão do Produto & Filosofia
O Wancora CRM é um Sistema Operacional de Vendas para WhatsApp. Diferente de ferramentas que apenas "disparam mensagens", o Wancora foca na **Retenção de Contexto** e na **Conversão de Leads**.

### A "Experiência Wancora" (UX Guidelines)
1.  **Zero Friction:** O usuário nunca deve sentir que "perdeu" uma mensagem porque a internet caiu ou a aba fechou. O sistema deve ser resiliente.
2.  **Optimistic UI:** Ao enviar uma mensagem, ela aparece instantaneamente na tela (cinza), e só depois confirma o envio (check). O usuário não espera o servidor responder para ver sua ação.
3.  **Contexto Infinito:** O histórico pertence ao Lead, não à conexão. Se o vendedor trocar de número/instância, a conversa com o cliente continua visível no CRM.
4.  **IA Invisível:** A IA ("Sentinela") não é um robô chato. Ela é um "copiloto" que sussurra sugestões no ouvido do vendedor e preenche dados do CRM automaticamente.

---

## 2. Arquitetura Técnica Detalhada

### A. O Core Backend (Node.js + @whiskeysockets/baileys)
Este é o coração pulsante. Ele não é apenas uma API REST; é um Gerenciador de Estado Persistente.

* **Gerenciamento de Sessão:** Usa um `Map<sessionId, socket>` em memória RAM.
    * *Nota de Infra:* Em ambientes Serverless (como Render Free), é necessário um "Keep-Alive" (Cron-job) batendo na rota `/health` a cada 14 min para evitar que o socket morra.
* **Protocolo de Dados:**
    * **Entrada:** Webhooks do Baileys (`messages.upsert`, `connection.update`, `messages.update`).
    * **Saída:** API REST para o Frontend (`POST /api/message/send`).
    * **Persistência:** Gravação direta no Supabase via `supabase-js` (Service Role).

* **Estratégia de Sincronização (Sync Strategy):**
    * **Gerenciamento de Mídia (Supabase Storage):**
        * Bucket: `chat-media` (Público).
        * Fluxo: O Backend intercepta msg com mídia -> Baixa o buffer -> Faz upload no Storage -> Salva a URL pública na coluna `messages.media_url`.
    * **Chunking:** Processamos mensagens em lotes seguros para evitar Out of Memory.
    * **Deduplicação:** Uso rigoroso de `whatsapp_id` + `remote_jid` como chave composta única.

### B. O Banco de Dados (Supabase / PostgreSQL)
A Fonte da Verdade. Se não está no banco, não existe.

#### Schema Crítico & Relacionamentos

**1. instances (As Conexões)**
* Gerencia a conexão física com o WhatsApp.
* `session_id` (Unique): Identificador da sessão do Baileys.
* `company_id` (FK): Isolamento Multi-Tenant.

**2. contacts (A Agenda Inteligente)**
* `jid` (PK): Identificador único (`551199999999@s.whatsapp.net` p/ pessoas, `123456@g.us` p/ grupos).
* `is_ignored` (Boolean): Base do "Anti-Ghost". Se TRUE, mensagens são processadas mas **não** criam Leads novos.
* `is_muted` (Boolean): **[Vital]** Se TRUE, a conversa não gera notificações, mas continua recebendo mensagens.
* `name`: Nome salvo manualmente ou Título do Grupo.
* `push_name`: Nome público do perfil do usuário.
* `profile_pic_url`: Foto do avatar (sincronizada via Backend).

**3. leads (O Negócio/CRM)**
* Vinculado a um contato via lógica de negócio (telefone).
* `pipeline_stage_id`: Define onde ele está no Kanban. (⚠️ NUNCA use `stage_id`).
* `bot_status`: Controle do robô ('active', 'paused', 'off').
* `owner_id`: Responsável pelo lead.
* `status`: Status macro ('new', 'open', 'won', 'lost').

**4. messages (O Histórico)**
* `whatsapp_id` (Unique Index): ID vindo do Baileys (ex: `3EB0...`).
* `message_type`: Tipo ('text', 'image', 'audio', 'video', 'document', 'poll', 'location', 'sticker').
* `media_url`: Link público da mídia no Supabase Storage (se houver).
* `remote_jid`: Chave estrangeira para `contacts`.

#### Camada de Performance (RPCs & Views)
O Frontend **NÃO** deve fazer queries complexas ("Joins") manualmente. Usamos funções SQL otimizadas:

* **`get_my_chat_list(p_company_id, p_session_id)`**
    * **Função:** Retorna a "Inbox" completa e paginada.
    * **Lógica:** Agrupa mensagens por `remote_jid`, pega a mais recente, junta com `contacts` (para foto/nome) e `leads` (para dados de negócio).
    * **Retorno Crítico:** Inclui `is_muted`, `is_group` (derivado de `@g.us`), `unread_count`.
    
* **`get_gamification_ranking`**
    * **Função:** Calcula XP e Ranking.
    * **Lógica:** XP = (Vendas * 1000) + (Valor / 10).

---

## 3. Módulos do Sistema (Especificação Funcional)

### 💬 Módulo 1: Chat Avançado (Inbox 2.0)
O Chat é o centro de comando.

**Layout:** 1.  **Sidebar Esquerda (Inbox):** Lista de conversas com Foto, Nome, Última Msg, Hora e Badges (Mute/Grupo).
2.  **Janela Central (Thread):** Histórico infinito.
3.  **Sidebar Direita (CRM Context):** Dados do Lead.

**Funcionalidades de Inbox (Enterprise):**
* **Suporte a Grupos:** Identificação automática de JIDs `@g.us`. O sistema exibe o nome do grupo em vez do número.
* **Ações em Massa:** Ao segurar o clique ou selecionar, ativa modo de seleção múltipla (checkboxes).
    * *Ação Mute:* Silencia/Desmuta conversas selecionadas (`contacts.is_muted`).
    * *Ação Delete:* Apaga mensagens do banco.
* **Delete em Cascata:** Ao apagar uma conversa, um Modal pergunta: *"Apagar também o Lead no CRM?"*. Isso garante limpeza total.

**Funcionalidades de Mídia:**
* **Visualização:** Renderização nativa de Imagens (Lightbox), Áudio (Player customizado), Vídeo e Documentos.
* **Upload:** Envio de arquivos suportado, com upload direto para Supabase Storage -> Backend envia link.

### 👥 Módulo 2: Gestão de Leads (Sidebar Direita)
A inteligência do CRM dentro do Chat.

**Estado do Lead:**
* **Lead Fora do CRM:** Mostra botão **VERDE** "Adicionar ao CRM".
    * Campos de edição (Nome, Valor, Etiquetas) ficam **Bloqueados** (Cadeado).
* **Lead Dentro do CRM:** Mostra botão **VERMELHO** "Remover do CRM".
    * Campos desbloqueados para edição imediata.
    * Alterações salvam direto na tabela `leads` e refletem no Kanban.

### 📊 Módulo 3: Kanban & Pipeline
* **Smart Drop & Sort:** Ordenação persistente via coluna `position` (float).
* **Master View:** Admins veem todos os cards; Agentes veem apenas os seus.

---

## 4. Fluxos Críticos (Core Business Rules)

### A. O Fluxo "Anti-Ghost" (Gestão de Spam)
Como o sistema decide quem vira Lead e quem é ignorado?

1.  **Chegada da Mensagem:** Webhook `messages.upsert` dispara.
2.  **Verificação de Bloqueio:** O sistema checa `contacts.is_ignored`.
    * Se `TRUE`: A mensagem é salva, mas **nenhum** Lead é criado/atualizado. O chat não sobe para o topo se estiver arquivado (futuro).
    * Se `FALSE`: Segue para o passo 3.
3.  **Verificação de CRM:**
    * O número já existe na tabela `leads`?
    * **NÃO:** Cria um novo Lead na etapa inicial do funil padrão.
    * **SIM:** Atualiza `updated_at` e move o card para o topo da lista (se configurado).

### B. O Fluxo de Agendamento
1.  **Input:** Usuário clica no relógio, escolhe data/hora e escreve texto.
2.  **Persistência:** Salva em `scheduled_messages` com status `pending`.
3.  **Disparo:** Um Cron-job no Backend verifica a cada minuto mensagens onde `scheduled_at <= NOW()` e `status = 'pending'`.
4.  **Execução:** Envia via Baileys e atualiza status para `sent`.

---

## 5. Diretrizes para Desenvolvimento com IA (Google AI Studio)

Ao gerar código para este projeto, você **DEVE** seguir estas regras estritas:

1.  **Integridade do Schema:** NUNCA invente colunas. Consulte este README e o arquivo SQL.
    * Use `pipeline_stage_id` (correto) e NÃO `stage_id` (errado).
    * Use `remote_jid` para relacionamentos de mensagem.
2.  **Data Fetching:**
    * Para listar chats, **SEMPRE** use a RPC `get_my_chat_list`. Nunca tente fazer joins manuais complexos no Frontend, pois é lento e perde dados de Grupos/Mute.
3.  **Mutação de Dados:**
    * Ao criar Lead: Garanta que `contacts.is_ignored` seja setado para `false`.
    * Ao remover Lead: Pergunte se deve setar `contacts.is_ignored` para `true` (banir) ou apenas remover o card.
4.  **Componentes Chave:**
    * `ChatSidebar.tsx`: Controla a lista, busca e ações em massa.
    * `MessageContent.tsx`: Renderiza a bolha de mensagem (texto/mídia).
    * `useChatList.ts`: Hook vital que conecta com a RPC.

---

✅ **Instruções Finais para o Usuário**
Este arquivo `README.md` é a única fonte de verdade. Qualquer alteração no banco de dados (SQL) deve ser refletida aqui imediatamente para manter a consistência entre o "Manual" e a "Máquina".