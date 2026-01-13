# 📘 WANCORA CRM - System Architecture & Master Blueprint

**Versão:** 3.4 (Enterprise Gold Standard - Unabridged)
**Status:** Production-Ready
**Arquitetura:** Event-Driven, Multi-Tenant, Persistent Connection
**Stack Principal:** Next.js 14 (App Router), Node.js (Baileys Core), Supabase (PostgreSQL + Realtime).

---

## 1. Visão do Produto & Filosofia
O Wancora CRM é um Sistema Operacional de Vendas para WhatsApp. Diferente de ferramentas que apenas "disparam mensagens", o Wancora foca na **Retenção de Contexto**, **Conversão de Leads** e **Auditabilidade Total**.

### A "Experiência Wancora" (UX Guidelines)
1.  **Zero Friction:** O usuário nunca deve sentir que "perdeu" uma mensagem porque a internet caiu ou a aba fechou. O sistema deve ser resiliente e salvar rascunhos/estados.
2.  **Optimistic UI:** Ao enviar uma mensagem, criar uma tarefa ou adicionar uma nota, a interface atualiza **instantaneamente** na tela, e só depois confirma o envio com o servidor. O usuário não vê "loading" para ações triviais.
3.  **Contexto Infinito:** O histórico pertence ao Lead, não à conexão. Se o vendedor trocar de número/instância, a conversa com o cliente continua visível e acessível no CRM.
4.  **IA Invisível:** A IA ("Sentinela") não é um robô chato. Ela é um "copiloto" que atua nos bastidores, sugerindo respostas e preenchendo dados.

---

## 2. Arquitetura Técnica Detalhada

### A. O Core Backend (Node.js + @whiskeysockets/baileys)
Este é o coração pulsante. Ele não é apenas uma API REST; é um Gerenciador de Estado Persistente.

* **Gerenciamento de Sessão:** Usa um `Map<sessionId, socket>` em memória RAM para manter a conexão WebSocket ativa.
    * *Nota de Infra:* Em ambientes Serverless, é necessário um "Keep-Alive" (Cron-job) batendo na rota `/health` a cada 14 min.
* **Protocolo de Dados:**
    * **Entrada:** Webhooks do Baileys (`messages.upsert`, `connection.update`, `messages.update`).
    * **Saída:** API REST para o Frontend (`POST /api/message/send`).
    * **Persistência:** Gravação direta no Supabase via `supabase-js` (Service Role) ignorando RLS.
* **Estratégia de Sincronização (Sync Strategy):**
    * **Gerenciamento de Mídia (Supabase Storage):**
        * Bucket: `chat-media` (Público).
        * Fluxo: O Backend intercepta msg com mídia -> Baixa o buffer -> Faz upload no Storage -> Salva a URL pública na coluna `messages.media_url`.
    * **Chunking:** Processamos mensagens históricas em lotes seguros (ex: 50 msgs) para evitar *Out of Memory*.
    * **Deduplicação:** Uso rigoroso de `whatsapp_id` + `remote_jid` como chave composta única para evitar mensagens repetidas.

### B. O Banco de Dados (Supabase / PostgreSQL)
A Fonte da Verdade. Se não está no banco, não existe.

#### Schema Crítico & Relacionamentos

**1. instances (As Conexões)**
* Gerencia a conexão física.
* `session_id` (Unique): Identificador da sessão do Baileys.
* `company_id` (FK): Isolamento Multi-Tenant.

**2. contacts (A Agenda Inteligente)**
* `jid` (PK): Identificador único (`551199999999@s.whatsapp.net` p/ pessoas, `123456@g.us` p/ grupos).
* `is_ignored` (Boolean): Base do "Anti-Ghost". Se TRUE, mensagens são processadas mas **não** criam Leads novos.
* `is_muted` (Boolean): **[Vital]** Se TRUE, a conversa não gera notificações, mas continua recebendo mensagens (Badge de "Silenciado").
* `name`: Nome salvo manualmente ou Título do Grupo.
* `push_name`: Nome público do perfil do usuário.
* `profile_pic_url`: Foto do avatar (sincronizada via Backend).

**3. leads (O Negócio/CRM)**
* Vinculado a um contato via lógica de negócio (telefone).
* `pipeline_stage_id`: Define onde ele está no Kanban. (⚠️ NUNCA use `stage_id`).
* `bot_status`: Controle do robô ('active', 'paused', 'off').
* `owner_id`: Responsável pelo lead (vendedor).
* `status`: Status macro ('new', 'open', 'won', 'lost').
* `deadline` (Timestamp): **[NOVO]** Prazo final para o "Cronômetro Principal" do lead.

**4. lead_activities (Auditabilidade & Notas) [NOVO]**
* Tabela centralizada para histórico de eventos.
* `type`: 'note' (manual), 'log' (sistema), 'call', 'meeting'.
* `content`: Conteúdo do log ou anotação (Ex: "Liguei e não atendeu").
* `created_by`: FK -> `public.profiles` (Quem gerou a atividade).
* *Integridade:* `ON DELETE CASCADE` (Se apagar o lead, todo o histórico some junto).

**5. lead_links (Recursos) [NOVO]**
* `title`, `url`: Links externos úteis vinculados ao lead.

**6. lead_checklists (Tarefas)**
* `text`: Descrição da tarefa.
* `is_completed`: Boolean.
* `deadline`: **[NOVO]** Prazo individual por tarefa (gera cronômetro na tarefa).

**7. messages (O Histórico)**
* `whatsapp_id` (Unique Index): ID vindo do Baileys.
* `message_type`: Tipo ('text', 'image', 'audio', 'video', 'document', 'poll', 'location', 'sticker').
* `media_url`: Link público da mídia no Supabase Storage.
* `remote_jid`: Chave estrangeira para `contacts`.

#### Camada de Performance (RPCs & Views)
O Frontend **NÃO** deve fazer queries complexas ("Joins") manualmente. Usamos funções SQL otimizadas:

* **`get_my_chat_list(p_company_id, p_session_id)`**
    * **Função:** Retorna a "Inbox" completa e paginada.
    * **Lógica:** Agrupa mensagens por `remote_jid`, pega a mais recente, junta com `contacts` (para foto/nome/grupos/mute) e `leads` (para dados de negócio).
    * **Retorno Crítico:** Inclui `is_muted`, `is_group` (derivado de `@g.us`), `unread_count`.
* **`get_gamification_ranking`**
    * **Função:** Calcula XP e Ranking.
    * **Lógica:** XP = (Vendas * 1000) + (Valor / 10).

---

## 3. Módulos do Sistema (Especificação Funcional)

### 💬 Módulo 1: Chat Avançado (Inbox 2.0 & Lead Command Center)
O Chat é o centro de comando unificado.

**Sidebar Direita (Contexto do Lead - Atualizado):**
Agora possui navegação por **Abas** para organizar a densidade de informações:
1.  **Aba Dados:**
    * **Botões de Ação:** "Adicionar ao CRM" (Verde) / "Remover do CRM" (Vermelho).
    * **Status Visual:** Se removido, campos ficam bloqueados (Ícone Cadeado).
    * **Cronômetro (Deadline):** Visualização e edição do prazo do lead com seletor de Data/Hora.
2.  **Aba Tarefas:**
    * Checklist com suporte a **Prazos Individuais** (ícone de relógio em cada tarefa).
    * Ordenação automática (pendentes primeiro).
3.  **Aba Atividades:**
    * **Timeline:** Feed unificado de logs do sistema (mudanças de etapa/valor) e Notas manuais.
    * **Gestão de Links:** Adicionar/Remover URLs importantes.

**Inbox (Sidebar Esquerda):**
* **Suporte a Grupos:** Identificação automática de JIDs `@g.us`. O sistema exibe o nome do grupo em vez do número.
* **Ações em Massa:** Ao segurar o clique ou selecionar, ativa modo de seleção múltipla (checkboxes).
    * *Ação Mute:* Silencia/Desmuta conversas selecionadas (`contacts.is_muted`).
    * *Ação Delete:* Apaga mensagens do banco.
* **Delete em Cascata:** Ao apagar uma conversa, um Modal pergunta: *"Apagar também o Lead no CRM?"*. Isso garante limpeza total.

**Visualização Multimídia:**
* **Imagens:** Renderização com Lightbox (Zoom).
* **Áudio:** Player nativo com controles de velocidade.
* **Documentos:** Card com botão de download.

### 📊 Módulo 2: Kanban & Pipeline (Híbrido)
**Cards do Kanban:**
* **Cronômetro Visual:**
    * O card exibe um contador regressivo se houver `deadline`.
    * **Cores Semânticas:** Verde (>24h), Amarelo (<24h), Vermelho (Vencido).
    * Quando falta menos de 1 dia, mostra `HH:MM:SS`.
* **Indicadores:** Ícones para tarefas pendentes, valor monetário e nome da empresa.

**Interações Avançadas (UX):**
* **Pan Navigation:** Clicar e arrastar no fundo do board move a rolagem horizontal (estilo Trello/Figma).
* **Smart Drop & Sort:**
    * Lógica: Ordenação manual persistente baseada na coluna `position`.
    * Cálculo: A nova posição é a média matemática: `(Posição Anterior + Posição Posterior) / 2`.
* **Master List View:** Visualização em tabela para Admins verem todos os leads da empresa.

### 🤖 Módulo 3: IA Sentinela (Intelligence Layer)
* **Smart Reply:** Backend recebe as últimas msgs + Contexto -> Envia para LLM -> Retorna sugestão de texto.

### 📢 Módulo 4: Campanhas e Agendamentos
* **Agendamento:** Botão relógio no input -> Salva em `scheduled_messages` -> Cronjob dispara.
* **Campanhas:** Disparo em massa com delay aleatório para evitar banimento.

---

## 4. Fluxos Críticos (Core Business Rules)

### A. O Fluxo "Anti-Ghost" (Gestão de Spam)
Como o sistema decide quem vira Lead e quem é ignorado?

1.  **Chegada da Mensagem:** Webhook `messages.upsert` dispara.
2.  **Verificação de Bloqueio:** O sistema checa `contacts.is_ignored`.
    * Se `TRUE`: A mensagem é salva, mas **nenhum** Lead é criado/atualizado. O chat não sobe para o topo se estiver arquivado.
    * Se `FALSE`: Segue para o passo 3.
3.  **Verificação de CRM:**
    * O número já existe na tabela `leads`?
    * **NÃO:** Cria um novo Lead na etapa inicial do funil padrão.
    * **SIM:** Atualiza `updated_at` e move o card para o topo da lista.

### B. Fluxo de Atividades (Audit Trail)
O sistema deve registrar automaticamente na tabela `lead_activities` sempre que:
1.  Um Lead é criado.
2.  O estágio do funil é alterado (`pipeline_stage_id`).
3.  O valor monetário muda.
4.  Uma tarefa é concluída.
*Isso garante que o vendedor tenha uma "caixa preta" do que aconteceu com o cliente.*

### C. Fluxo de Histórico & Reconexão
* Baileys envia histórico -> Backend itera -> Executa `upsert`.
* Chave de Conflito: `remote_jid + whatsapp_id`. O banco recusa a duplicata.

---

## 5. Diretrizes para Desenvolvimento com IA (Google AI Studio)

Ao gerar código para este projeto, você **DEVE** seguir estas regras estritas:

1.  **Integridade do Schema:**
    * NUNCA invente colunas. Consulte este README e o arquivo SQL.
    * Use `lead_activities` para logs, **não** crie campos JSON dentro de `leads`.
    * Use a FK `created_by` apontando para `profiles` (não `auth.users`) ao listar atividades.
2.  **Data Fetching:**
    * Para listar chats, **SEMPRE** use a RPC `get_my_chat_list`. Nunca tente fazer joins manuais complexos no Frontend, pois é lento e perde dados de Grupos/Mute.
3.  **Componentes Globais:**
    * Use `useLeadData` e `useLeadActivities` para garantir que Chat e Kanban mostrem os mesmos dados em tempo real.
    * Reutilize `DeadlineTimer.tsx` para consistência visual dos cronômetros.
4.  **Performance:**
    * Use **Optimistic UI** em interações de checklist, notas e cronômetros. O usuário não pode esperar o banco responder para ver a alteração.

---

✅ **Instruções Finais para o Usuário**
Este arquivo `README.md` é a **Verdade Absoluta**. Ele detalha tabelas, fluxos, UX e regras de negócio. Qualquer alteração no banco de dados (SQL) deve ser refletida aqui imediatamente para manter a consistência entre o "Manual" e a "Máquina".