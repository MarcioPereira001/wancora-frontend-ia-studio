
# 📘 WANCORA CRM - System Architecture & Master Blueprint

**Versão:** 4.2 (Gaming Mode & AI Agents)
**Status:** Production-Ready / Secure
**Arquitetura:** Event-Driven, Multi-Tenant, Persistent Connection
**Stack Principal:** Next.js 15 (App Router), React 19, Node.js (Baileys Core), Supabase (PostgreSQL + Realtime).

---

## 1. Visão do Produto & Filosofia
O Wancora CRM é um Sistema Operacional de Vendas para WhatsApp. Diferente de ferramentas que apenas "disparam mensagens", o Wancora foca na **Retenção de Contexto**, **Conversão de Leads** e **Auditabilidade Total**.

### A "Experiência Wancora" (UX Guidelines)
1.  **Zero Friction:** O usuário nunca deve sentir que "perdeu" uma mensagem porque a internet caiu ou a aba fechou. O sistema deve ser resiliente e salvar rascunhos/estados.
2.  **Optimistic UI:** Ações como enviar mensagem, criar uma tarefa ou adicionar uma nota, a interface atualiza **instantaneamente** na tela, e só depois confirma o envio com o servidor. O usuário não vê "loading" para ações triviais.
3.  **Contexto Infinito:** O histórico pertence ao Lead, não à conexão. Se o vendedor trocar de número/instância, a conversa com o cliente continua visível e acessível no CRM.
4.  **IA Invisível:** A IA ("Sentinela") não é um robô chato. Ela é um "copiloto" que atua nos bastidores, sugerindo respostas e preenchendo dados.

---

## 2. Arquitetura Técnica Detalhada

### A. O Frontend (Next.js 15 + React 19)
Atualizado para a arquitetura mais moderna e segura do React.
* **AI Security:** As chaves de API configuradas no Frontend são salvas diretamente no banco (`companies.ai_config`) e **nunca** expostas em variáveis de ambiente do navegador. O Backend consome essas chaves de forma segura server-side.
* **Framework:** Next.js 15.1.3 (App Router).
* **UI Library:** React 19 + TailwindCSS + Shadcn/UI.
* **Data Fetching:** TanStack Query v5 (Gerenciamento de cache e estado assíncrono).
* **Excel Export:** `exceljs` (Substituindo `xlsx` por motivos de segurança e performance). Gera planilhas nativas com formatação e filtros.
* **State Management:** Zustand (Persistência local de sessão).
* **Arquitetura "Gaming Mode" (Realtime Agressivo):** Implementada nos módulos críticos (CRM/Kanban).
    * **Snapshot Inicial:** Carrega dados via REST/Supabase SDK ao montar.
    * **WebSocket Subscription:** Mantém a store atualizada via canal `postgres_changes`.
    * **Optimistic UI:** Ações do usuário (ex: mover card) refletem em 0ms na tela antes da confirmação do servidor.
* **Global Sync Indicator (Strict Mode):** Componente flutuante (`GlobalSyncIndicator.tsx`).
    * **Regra de Ouro:** Este componente obedece estritamente ao gatilho manual `forcedSyncId`.
    * **Comportamento:**
        1. O usuário lê o QR Code no modal `/connections`.
        2. O Frontend detecta a conexão e chama `triggerSyncAnimation(id)`.
        3. O Indicador aparece, consome o status do banco (`sync_percent`) até chegar em 100%.
        4. Ao concluir, ele se auto-destrói e limpa o `forcedSyncId`.
    * **Anti-Ruído:** Reconexões automáticas de background (ex: reinício do servidor) atualizam o banco, mas **NÃO** ativam o indicador visual para não poluir a tela do usuário.

### B. O Core Backend (Node.js + @whiskeysockets/baileys)
Este é o coração pulsante. Ele não é apenas uma API REST; é um Gerenciador de Estado Persistente.

* **Gerenciamento de Sessão:** Usa um `Map<sessionId, socket>` em memória RAM para manter a conexão WebSocket ativa.
    * *Nota de Infra:* Em ambientes Serverless, é necessário um "Keep-Alive" (Cron-job) batendo na rota `/health` a cada 14 min.
* **Fingerprint:** Emula `Ubuntu 24.04` para evitar banimentos e desconexões por "versão obsoleta".
* **Protocolo de Dados:**
    * **Entrada:** Webhooks do Baileys (`messages.upsert`, `connection.update`, `messages.update`).
    * **Saída:** API REST para o Frontend (`POST /api/message/send`).
    * **Persistência:** Gravação direta no Supabase via `supabase-js` (Service Role) ignorando RLS.
* **Controle de Concorrência (Message Queue):**
    * Implementação do `messageQueue.js` para processar mensagens recebidas (`messages.upsert`).
    * **Concurrency Limit:** 10 mensagens simultâneas por thread.
    * **Objetivo:** Evitar *Event Loop Lag* e garantir que operações pesadas de banco (Upsert Contact/Lead) não travem o WebSocket do Baileys durante rajadas de mensagens (Storm).
* **Estratégia de Sincronização (Sync Strategy):**
    * **Sync First Protocol (Visual Feedback):** Ao conectar, o Backend atualiza a tabela `instances` com `sync_status` ('importing_contacts' -> 'importing_messages' -> 'completed') e `sync_percent`. Isso permite que o Frontend exiba uma tela de bloqueio com barra de progresso real.
    * **Gerenciamento de Mídia (Supabase Storage):**
        * Bucket: `chat-media` (Público).
        * Estrutura: Organizado por `company_id` para isolamento e facilidade de backup.
        * Fluxo: O Backend intercepta msg com mídia -> Baixa o buffer -> Faz upload -> Salva URL no banco.
    * **Chunking:** Processamos mensagens históricas em lotes seguros (ex: 50 msgs) para evitar *Out of Memory*.
    * **Unwrap:** Função nativa (`unwrapMessage`) para desenrolar mensagens complexas (ViewOnce, Editadas, Docs com Legenda) antes de salvar.
    * **Deduplicação:** Uso rigoroso de `whatsapp_id` + `remote_jid` como chave composta única para evitar mensagens repetidas.
    * **Mutex:** Sistema de bloqueio (`leadCreationLock`) para impedir criação duplicada de leads em rajadas de mensagens.

### C. O Banco de Dados (Supabase / PostgreSQL)
A Fonte da Verdade. Se não está no banco, não existe.

### ⚡ Configuração de Realtime (Gaming Mode)
Para garantir a atualização instantânea da UI (Optimistic UI + Server Sync), as tabelas críticas (`instances`, `leads`, `messages`) foram configuradas com **REPLICA IDENTITY FULL**.

Isso obriga o PostgreSQL a enviar o registro completo (old + new) no payload do WebSocket, permitindo que o Frontend atualize listas e estados complexos sem necessidade de refetch via API.

#### Schema Crítico & Relacionamentos

**1. instances (As Conexões)**
* Gerencia a conexão física.
* `session_id` (Unique): Identificador da sessão do Baileys.
* `company_id` (FK): Isolamento Multi-Tenant.
* `sync_status`: Estado da importação inicial ('waiting', 'importing_contacts', 'importing_messages', 'completed').
* `sync_percent`: Inteiro (0-100) para feedback visual no Frontend.

**2. contacts (A Agenda Inteligente)**
* `jid` (PK): Identificador único (`551199999999@s.whatsapp.net` p/ pessoas, `123456@g.us` p/ grupos).
* `is_ignored` (Boolean): Base do "Anti-Ghost". Se TRUE, mensagens são processadas mas **não** criam Leads novos.
* `is_muted` (Boolean): **[Vital]** Se TRUE, a conversa não gera notificações, mas continua recebendo mensagens (Badge de "Silenciado").
* `name`: Nome salvo manualmente ou Título do Grupo.
* `push_name`: Nome público do perfil do usuário.
* `profile_pic_url`: Foto do avatar (sincronizada via Backend).
* `phone`: Coluna indexada para joins rápidos com a tabela `leads`.
* `is_online` / `last_seen_at`: Suporte a presença em tempo real.
* *Newsletters:* Canais são identificados na RPC `get_my_chat_list` através do sufixo `@newsletter`.

**X. identity_map (LID Resolver - NOVO)**
* Tabela vital para o ecossistema iOS/Multi-Device.
* Mapeia `12345@lid` -> `55119999@s.whatsapp.net`.
* Permite que mensagens vindas de LIDs sejam atribuídas corretamente ao contato principal.

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

**5. lead_links (Recursos)**
* `company_id` (FK): Obrigatório para RLS.
* `title`, `url`: Links externos úteis vinculados ao lead.

**6. lead_checklists (Tarefas)**
* `company_id` (FK): Obrigatório para RLS.
* `text`: Descrição da tarefa.
* `is_completed`: Boolean.
* `deadline`: Prazo individual por tarefa.

**7. messages (O Histórico)**
* `whatsapp_id` (Unique Index): ID vindo do Baileys.
* `message_type`: Tipo ('text', 'image', 'audio', 'video', 'document', 'poll', 'location', 'sticker').
* `media_url`: Link público da mídia no Supabase Storage.
* `poll_votes` (JSONB): Armazena os votos recebidos em tempo real `[{ voterJid, optionId }]`.
* `remote_jid`: Chave estrangeira para `contacts` (mas **sem FK estrita** para suportar LIDs).

#### Camada de Performance (RPCs & Views)
O Frontend **NÃO** deve fazer queries complexas ("Joins") manualmente. Usamos funções SQL otimizadas:

* **`get_my_chat_list(p_company_id, p_session_id)`**
    * **Função:** Retorna a "Inbox" completa e paginada.
    * **Lógica:** Agrupa mensagens por `remote_jid`, pega a mais recente, junta com `contacts` (para foto/nome/grupos/mute) e `leads` (para dados de negócio). Usa `LEFT JOIN` para garantir que LIDs sem contato apareçam.
    * **Retorno Crítico:** Inclui `is_muted`, `is_group` (derivado de `@g.us`), `unread_count`.
* **`get_gamification_ranking`**
    * **Função:** Calcula XP e Ranking.
    * **Lógica:** XP = (Vendas * 1000) + (Valor / 10).

#### Realtime Strategy (The Database Brain)
O Backend Node.js **não** gerencia mais contadores de mensagens ou ordenação de chat manualmente. Isso foi movido para o PostgreSQL para garantir consistência atômica:

*   **Trigger `handle_new_message_stats`:** Ao inserir uma mensagem, o banco recalcula automaticamente o `unread_count` e o `last_message_at` do contato.
*   **Frontend Subscription:** O Frontend escuta mudanças na tabela `contacts`. Assim que o Trigger roda, a UI recebe o update e reordena a lista de chats em tempo real, sem necessidade de lógica de "sort" no Javascript.

---

## 3. Módulos do Sistema (Especificação Funcional)

### 💬 Módulo 1: Chat Avançado (Inbox 2.0 & Lead Command Center)
O Chat é o centro de comando unificado.

**Inbox (Sidebar Esquerda):**
* **Busca em Tempo Real:** Filtro instantâneo por Nome, Telefone ou Push Name.
* **Identificação de Grupos:** Exibe nome do grupo corretamente (identifica `@g.us`).
* **Indicadores Visuais:**
    * **Bolinha Verde:** Contador de não lidas (some ao clicar).
    * **Badge "Novo":** Rótulo temporário (24h) para leads recém-criados.
* **Gestão de Conversas:**
    * **Seleção Múltipla:** Checkboxes para selecionar vários chats.
    * **Ações em Massa:** Silenciar, Apagar (com opção de apagar Lead em cascata).
* **Deduplicação Inteligente:** O sistema oculta automaticamente sessões secundárias (`@lid`) para evitar que o mesmo contato apareça duas vezes na lista, mantendo apenas a thread principal visível.

**Área de Conversa (Chat Window):**
* **Checks de Leitura:**
    * Cinza (1): Enviado ao Servidor.
    * Cinza (2): Entregue ao Destinatário.
    * **Azul (2):** Lido/Visualizado.
* **Gestão de Histórico (Selection Mode):**
    * Permite selecionar mensagens individuais para **Apagar** (Delete) ou **Encaminhar**.
    * Opção "Limpar Conversa" (Clear Chat) no menu superior para resetar o histórico.

**Menu de Anexos (Clipper) & Tipos de Mensagem Suportados:**
O sistema suporta protocolos complexos além de texto. (`MessageContent.tsx`):

1.  **📍 Localização (Location):**
    * **Envio:** Captura `navigator.geolocation`.
    * **Renderização:** Exibe um "Fake Static Map" (CSS Styled) com coordenadas e link para Google Maps.
2.  **📊 Enquete (Poll) [Atualizado]:**
    * **Estrutura JSON:** `{ name: "Pergunta", options: ["A", "B"], selectableOptionsCount: 1 }`.
    * **Renderização:** Card interativo com opções selecionáveis e **Barra de Progresso Real** baseada nos votos recebidos.
3.  **💲 Pix Nativo (Copia e Cola):**
    * **Backend:** Transforma `type: 'pix'` em `interactiveMessage` (Native Flow).
    * **UX do Cliente:** Recebe um card oficial com botão **"COPIAR CHAVE PIX"** que interage com a área de transferência do sistema.
    * **UX do Vendedor:** Vê um card estilizado verde no CRM com a chave e QR Code.
4.  **👤 Contato (vCard):**
    * **Envio:** Envia VCard padrão (compatível com botão "Salvar" no celular).
    * **Renderização:** Card estilo VCard com botão de Download (.vcf).
5.  **🎤 Áudio PTT:**
    * **Envio:** Gravação nativa via `MediaRecorder`. Envia com flag `ptt: true` (Onda sonora verde no WhatsApp).
    * **Renderização:** Player nativo encapsulado em container estilizado.
6.  **📁 Arquivo de Áudio:** Upload de MP3/WAV como arquivo (ícone de música/fones).
7.  **📄 Documentos:** PDF/Docx com prévia do nome do arquivo e botão de download.
8.  **📷 Galeria/Câmera:** Envio de imagens e vídeos com legenda.

**Sidebar Direita (Lead Command Center - Atualizado):**
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

### 📊 Módulo 2: Kanban & Pipeline (Híbrido)
**Cards do Kanban:**
* **Cronômetro Visual:**
    * **Verde:** No prazo (> 24h).
    * **Amarelo:** Atenção (< 24h, mostra segundos).
    * **Vermelho:** Vencido (conta o tempo de atraso).
* **Foto do Lead:** Sincronizada com o perfil do WhatsApp.
* **Indicadores:** Ícones para tarefas pendentes, valor monetário e nome da empresa.

**Interações Avançadas (UX):**
* **Pan Navigation:** Clicar e arrastar no fundo do board move a rolagem horizontal (estilo Trello/Figma).
* **Smart Drop & Sort:**
    * Lógica: Ordenação manual persistente baseada na coluna `position`.
    * Cálculo: A nova posição é a média matemática: `(Posição Anterior + Posição Posterior) / 2`.
* **Master List View:** Visualização em tabela para Admins verem todos os leads da empresa.

### 🤖 Módulo 3: Agentes de IA & Automação (Gemini 3 Flash)
* **Gestão de Personas:** Interface dedicada (`/agents`) para configurar o "System Prompt" e "Base de Conhecimento".
* **Simulador (Sandbox):** Chat de teste integrado para validar as respostas do Agente antes de ativá-lo em produção.
* **Otimizador de Prompt:** Função de IA que reescreve instruções do usuário para torná-las mais eficientes para o LLM.
* **Arquitetura BYOK (Bring Your Own Key):** Cada empresa pode configurar sua própria chave de API (Google AI Studio) diretamente no painel de configurações. Isso garante:
    *   **Limites Independentes:** O consumo de uma empresa não afeta a cota das outras.
    *   **Privacidade:** Dados processados na conta do próprio cliente (se configurado).
    *   **Fallback do Sistema:** Se o cliente não configurar, o sistema usa a chave mestre do servidor.

### 📢 Módulo 4: Campanhas e Agendamentos
* **Agendamento:** Botão relógio no input -> Salva em `scheduled_messages` com status `pending` -> Cronjob dispara.
* **Campanhas:** Disparo em massa com delay aleatório para evitar banimento.

### 📅 Módulo 5: Agenda 2.0 & Automação
Sistema completo de agendamento público e interno.
* **Visão Híbrida:** Botão flutuante para alternar instantaneamente entre Mês e Semana (Grid adaptativo).
* **Link Público (/agendar):** Página de booking externa otimizada com verificação de conflitos em tempo real via RPC.
* **Engine de Automação de Avisos:**
    * **Gatilhos Configuráveis:** Envio de mensagem ao agendar (`on_booking`) ou lembretes pré-reunião (`before_event`).
    * **Templates Dinâmicos:** Suporte a variáveis como `[lead_name]`, `[data]`, `[hora]`.
    * **Multicanal:** Configuração distinta para avisos ao Admin (Dono da agenda) e ao Cliente (Lead).

### 🛡️ Módulo 6: Controle de Acesso (RBAC)
O sistema implementa uma hierarquia de permissões estrita baseada na coluna `role` da tabela `profiles`:

1.  **Owner (Proprietário):**
    *   Acesso irrestrito a todos os módulos.
    *   Gestão de Assinatura/Billing.
    *   Pode deletar a empresa.
2.  **Admin (Gerente):**
    *   **Visão de Deus:** Vê todos os leads de todos os vendedores no Kanban e Dashboard.
    *   Gestão de Equipe (Convidar/Remover membros).
    *   Gestão de Pipelines e Conexões WhatsApp.
3.  **Agent (Vendedor):**
    *   **Visão de Túnel:** Só visualiza e edita leads onde ele é o `owner_id`.
    *   Dashboard restrito às suas próprias métricas de venda.
    *   Não acessa configurações globais da empresa.
---

## 4. Fluxos Críticos (Core Business Rules)

### A. Inbox & Visualização (Chat Rules)
1.  **Zero Empty Contacts:** A lista de chat (Sidebar) é renderizada via SQL `INNER JOIN messages`. Contatos da agenda sem mensagens **não** aparecem na lista.
2.  **Rich Previews:** O sidebar exibe prévias formatadas para todos os tipos de mensagem:
    *   📸 Foto/Vídeo: Ícone de câmera + legenda.
    *   📊 Enquete: "📊 Título da Enquete".
    *   📍 Loc: "📍 Localização".
    *   👤 Contato: "👤 Nome do Contato".
3.  **Indicadores:**
    *   Status Online / Visto por Último (Realtime).
    *   Checks de Entrega e Leitura (Cinza/Azul).

### B. Gestão de Identidade e Leads
1.  **Criação Seletiva:** Leads são criados apenas via mensagens diretas (Private Chat). Grupos e Canais são ignorados pelo CRM.
2.  **Hierarquia de Nomes (Source of Truth):**
    *   **Nível 1 (Agenda):** Se você salvou o contato no celular, esse nome prevalece.
    *   **Nível 2 (Business):** Se é uma empresa verificada, usa o nome comercial.
    *   **Nível 3 (PushName):** Usa o nome que a pessoa definiu no perfil dela.
    *   **Nível 4 (Fallback):** Se tudo falhar, mantém `NULL` no banco e o Frontend formata `+55 (11) 99999-9999`.

### C. Fluxo de Sincronização (Remover/Adicionar)
* **Remover:** Define `contacts.is_ignored = true` e deleta o Lead. O Backend para de processar mensagens para o CRM.
* **Adicionar:** Define `contacts.is_ignored = false`. O sistema cria um novo Lead na primeira etapa e restaura a comunicação.

### D. Fluxo de Histórico & Reconexão
* Baileys envia histórico -> Backend itera (em chunks) -> Executa `upsert`.
* Chave de Conflito: `remote_jid + whatsapp_id`. O banco recusa a duplicata.


**Estratégia de Implementação (LID Safe v3.5):**
* **Dual Support:** O sistema aceita nativamente ambos os formatos na tabela `messages`.
* **Upsert Inteligente:** O Backend (`upsertContact`) detecta se o sufixo é `@lid` e salva corretamente na tabela `contacts`, evitando erros de chave estrangeira.
* **Database Constraints:** A chave estrangeira restrita (`FK`) entre mensagens e contatos foi removida intencionalmente para permitir que mensagens de LIDs (ou Status) sejam salvas mesmo antes da criação do contato, garantindo zero perda de dados.
* **Frontend:** A interface trata o `remote_jid` como opaco. Se for LID, exibe normalmente; se for Phone, formata.

### E. Smart Sync Strategy (Política "Zero Dirt")
Para garantir que o CRM inicie limpo e organizado, o sistema adota uma política restrita durante a importação inicial:
1.  **Contatos & Mensagens:** O sistema baixa e salva todo o histórico necessário na tabela `contacts` e `messages`.
2.  **Bloqueio de Leads:** O histórico **NÃO CRIA LEADS**. Isso impede que conversas antigas de 5 anos atrás poluam a coluna "Novos" do seu Kanban.
3.  **Criação Just-in-Time:** Um Lead só é criado quando o contato envia uma **nova mensagem em tempo real** (Realtime). Isso garante que o Pipeline contenha apenas oportunidades ativas e vivas.
4.  **Smart Fetch de Mídia:** O sistema detecta ativamente contatos sem foto e força uma busca em background, garantindo que a lista de chat fique visualmente rica sem travar o processamento.

### F. Regras Estritas de Lead (Lead Guard)
O sistema possui um **"Centralized Gatekeeper"** (`ensureLeadExists` em `sync.js`) que atua como autoridade única e blindada para criação de Leads.

*   **Trigger:** Exclusivo para mensagens **Realtime** (Notify). Mensagens de histórico (Append) são ignoradas pelo guardião.
*   **Blindagem de Identidade (LID Resolver):**
    *   O sistema detecta IDs ocultos (`@lid`) e força a resolução para o número de telefone real antes de criar o lead.
    *   Se o número não for um telefone válido (E.164), a criação é rejeitada.
*   **Regras de Exclusão (Hard Block):**
    *   🚫 Grupos (`@g.us`) e Canais (`@newsletter`).
    *   🚫 Broadcasts e Status.
    *   🚫 O próprio número do usuário (Self).
    *   🚫 Contatos marcados como "Removido do CRM" (`is_ignored = true`).
*   **Sanitização de Nomes (Name Hunter v5):**
    *   Nomes genéricos (apenas números ou iguais ao telefone) são rejeitados.
    *   O sistema aguarda um nome válido (Agenda ou PushName) ou aplica um "Auto-Healing" assim que um nome real é detectado em uma nova mensagem.

---

## 5. Configuração / Variáveis de Ambiente (.env)
O Backend exige as seguintes variáveis para operar:

```env
PORT=3001
SUPABASE_URL="[https://sua-url.supabase.co](https://sua-url.supabase.co)"
SUPABASE_KEY="sua-service-role-key" # Necessário para ignorar RLS nos Workers
REDIS_URL="redis://..." # Obrigatório para filas de campanha
WEB_CONCURRENCY=1 # Opcional, para Render/Heroku
NODE_VERSION=20.20.0```

## 6. Deploy e Infraestrutura (Render)
O serviço Backend é configurado para rodar como um Web Service no Render (ou similar).
Docker/Node: Roda sobre Node.js 20.
Healthcheck: O Render deve monitorar a rota /health.
Redis: Um serviço Redis externo é necessário para gerenciar a fila de campanhas (bullmq).

## 7. Diretrizes para Desenvolvimento com IA (Google AI Studio)
Ao gerar código para este projeto, você DEVE seguir estas regras estritas:
Integridade do Schema:
NUNCA invente colunas. Consulte este README e o arquivo SQL.
Use lead_activities para logs, não crie campos JSON dentro de leads.
Use a FK created_by apontando para profiles (não auth.users) ao listar atividades.
Data Fetching:
Para listar chats, SEMPRE use a RPC get_my_chat_list. Nunca tente fazer joins manuais complexos no Frontend, pois é lento e perde dados de Grupos/Mute.
Componentes Globais:
Use useLeadData e useLeadActivities para garantir que Chat e Kanban mostrem os mesmos dados em tempo real.
Reutilize DeadlineTimer.tsx para consistência visual dos cronômetros.
Tipagem: Respeite os tipos poll, location, contact no envio de mensagens (whatsappController.js e routes.js já estão adaptados para receber payloads estruturados).
Performance:
Use Optimistic UI em interações de checklist, notas e cronômetros. O usuário não pode esperar o banco responder para ver a alteração.

✅ Instruções Finais para o Usuário Este arquivo README.md é a Verdade Absoluta. Ele detalha tabelas, fluxos, UX e regras de negócio. Qualquer alteração no banco de dados (SQL) deve ser refletida aqui imediatamente para manter a consistência entre o "Manual" e a "Máquina".
