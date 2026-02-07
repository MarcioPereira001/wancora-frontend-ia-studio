
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
* **Stack:** Next.js 15.5.12 (Security Patch Applied).
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
* **Desktop Environment:**
    * **Zustand Store (`useDesktopStore`):** Gerencia o estado global das janelas (posição `x,y`, tamanho, ordem `z-index`, minimização e foco).
    * **Apps Isolados:** Cada funcionalidade (Drive, Editor) é um componente independente carregado dentro de um `WindowFrame` genérico.
* **Buffer de Atualizações (Chat List):** Implementação de um `Update Buffer` com *debounce* de 1 segundo na lista de contatos (`useChatList`).
    * **Motivo:** O Supabase Realtime envia eventos um a um. Em disparos em massa, isso causava "flickering" visual. O buffer acumula eventos e renderiza a lista apenas uma vez por segundo, garantindo estabilidade visual (0 FPS drop).
* **Strict Typing & Safety:**
    * **No-Any Policy:** Componentes críticos como `MessageContent` e `ChatInput` foram refatorados para usar Interfaces Estritas (`PollContent`, `CardContent`, `LocationContent`).
    * **JSON Parsing Seguro:** Implementação de `safeParse` para evitar que mensagens malformadas do WhatsApp (ex: JSON incompleto) quebrem a renderização da tela branca (White Screen of Death).
* **Memory Leak Protection:**
    * O componente de áudio (`ChatInputArea`) agora implementa limpeza forçada de `MediaStreamTracks` ao desmontar, impedindo que o ícone de "Microfone Ativo" persista no navegador após sair do chat.

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

### Melhorias de Estabilidade (v5.1 - Stability Patch)
* **Event-Driven Queue:** O processamento de mensagens (`messageQueue.js`) abandonou o loop recursivo (`setImmediate`) em favor de uma arquitetura baseada em eventos. Isso reduz o uso de CPU em ociosidade (Idle) para quase 0%.
* **Smart Media Handling:**
    * **Sharp Optimization:** Imagens recebidas são redimensionadas para HD (max 1280px) e convertidas para JPEG antes do upload. Isso previne que fotos de 40MB (iPhone Pro) saturem o Storage ou a banda do usuário.
    * **Stream Uploads:** Uploads para o Google Drive agora usam `multipart/form-data` e Streams, eliminando o erro de *Payload Too Large* e *Out of Memory* ao lidar com arquivos grandes.
* **BullMQ Chunking:** A inserção de jobs de campanha no Redis agora é feita em lotes (Chunks de 500), prevenindo timeouts na conexão Redis durante disparos massivos (10k+ leads).

### Confiabilidade de Background (v5.2 - Resilience Patch)
* **Redis Distributed Lock (Agenda):** O Worker de agendamentos (`agendaWorker.js`) agora implementa um padrão de *Mutex* distribuído (`SET NX EX`). Isso garante atomicidade: mesmo se você escalar o backend para 10 containers, apenas um processará os lembretes, eliminando o risco de mensagens duplicadas para o cliente.
* **Persistent Retry Cache:** O contador de retentativas de decriptação (`msgRetryCounterCache`) do Baileys foi movido da memória RAM para o Redis.
    * **Impacto:** Se o servidor reiniciar durante uma conversa intensa, ele não perde a chave de sessão de criptografia, prevenindo a temida mensagem *"Aguardando mensagem. Isso pode levar alguns instantes"*.
* **Sentinel Safety:** O Agente de IA agora possui um "Sandbox" de execução para Tools. Se a IA alucinar parâmetros inválidos (ex: tentar enviar um arquivo que não existe), o erro é capturado e tratado internamente sem derrubar o processo do Node.js.
* **Thumbnail Timeout:** A geração de prévias de links (Cards) agora tem um timeout rígido de 5 segundos. Se o site de destino for lento, o bot envia o link sem imagem em vez de travar a fila de envio.

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

**Header da Lista (Instance Switcher):**
*  **Seletor de Instância:** Dropdown no topo da lista de conversas permite alternar instantaneamente entre diferentes números conectados (ex: "Comercial 1", "Suporte").
*  **Status Visual:** Indica qual conexão está ativa no momento.
*  **Navegação Rápida:** Atalhos para "Nova Instância" e "Arquivados".

**Inbox (Sidebar Esquerda):**
*  **Busca em Tempo Real:** Filtro instantâneo por Nome, Telefone ou Push Name.
*  **Identificação de Grupos:** Exibe nome do grupo corretamente (identifica `@g.us`).
*  **Indicadores Visuais:**
    *   **Bolinha Verde:** Contador de não lidas (some ao clicar).
    *   **Badge "Novo":** Rótulo temporário (24h) para leads recém-criados.
*  **Filtros Inteligentes:** Tags para filtrar por Fase do Funil ou Etiquetas.

* **Gestão de Conversas:**
    * **Seleção Múltipla:** Checkboxes para selecionar vários chats.
    * **Ações em Massa:** Silenciar, Apagar (com opção de apagar Lead em cascata).
* **Deduplicação Inteligente:** O sistema oculta automaticamente sessões secundárias (`@lid`) para evitar que o mesmo contato apareça duas vezes na lista, mantendo apenas a thread principal visível.

**Área de Conversa (Chat Window):**
* **Checks de Leitura:**
    * Cinza (1): Enviado ao Servidor.
    * Cinza (2): Entregue ao Destinatário.
    * **Azul (2):** Lido/Visualizado.
* **Header Funcional:**
    *   Menu de Opções: "Limpar Conversa" (Delete All for Me) e Seleção Múltipla.
    *   Status de Presença: Exibe "Digitando...", "Online" ou "Visto por último".
* **Input Avançado:**
    *   **Gravador PTT Universal:** Gravação de áudio compatível com iOS/Android (MP4/AAC) com conversão automática no backend para OGG/Opus (Onda Sonora).
    *   **Emoji Picker:** Integrado e otimizado.

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
Agora possui navegação por **Abas** e controle de visibilidade:
* **Modo Retrátil:** Botão de recolher/expandir para focar na conversa. Abertura automática ao clicar no nome do contato.

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

### 📅 Módulo 5: Agenda 2.0 & Automação Inteligente
Sistema completo de agendamento público e interno com motor de notificações.
* **Visão Híbrida:** Botão flutuante para alternar instantaneamente entre Mês e Semana.
* **Link Público (/agendar/[slug]):** Página de booking externa otimizada (Mobile-first) que respeita as regras de disponibilidade definidas.
* **Engine de Notificações (Worker):**
    * **Gatilhos Configuráveis:** Suporte a avisos para o Admin ("Você tem uma reunião") e para o Lead ("Lembrete: Reunião em 1h").
    * **Templates Dinâmicos:** Variáveis como `[lead_name]`, `[data]`, `[hora]`, `[empresa]`.
    * **Cron Jobs:** Worker dedicado (`agendaWorker.js`) roda a cada 5 minutos verificando agendamentos futuros na tabela `appointments`.

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

### ☁️ Módulo 7: Área de Trabalho (Wancora OS)
Um ambiente desktop simulado dentro do navegador para produtividade máxima.
* **Window Manager (Zustand):**
    * Gerenciamento de janelas (`useDesktopStore`) com suporte a minimizar, maximizar, focar e persistência de posição.
    * **Wallpaper Engine:** Suporte a papéis de parede personalizados, com padrão do sistema definido como "System Grid" (Cyberpunk Aesthetic).
* **Drive App (Híbrido):** 
    * Explorador de arquivos integrado ao Google Drive.
    * **Busca Ao Vivo:** Modal dedicado para encontrar e importar arquivos que já existem no Google Drive da empresa mas não estão no cache.
    * **Lixeira Blindada:** A lixeira lê diretamente da API do Google (sem cache), bloqueia navegação em subpastas e permite esvaziamento total.
* **Ciclo de Vida (Retention Policy):** Mídias de chat antigas (>30 dias) são movidas automaticamente do Storage rápido (Supabase) para o Armazenamento frio (Google Drive) para economizar custos.
* **Apps:** Editor (Word-like), Planilha (Excel-like) e Visualizador de Mídia.
* **Editor App (Word-like):** 
    * Editor de texto rico (Rich Text) baseado em Quill.
    * **Conversão Server-Side:** Capacidade de abrir arquivos `.docx` e Google Docs convertendo-os para HTML via Backend (`mammoth`), preservando a formatação original.
    * Salva diretamente no Drive como `.docx`.
* **Sheet App (Excel-like):** [NOVO]
    * Editor de planilhas nativo leve (sem dependências pesadas de UI).
    * Suporte a fórmulas básicas, formatação de células e persistência de estado local.
    * Exporta e Salva como `.xlsx` (Excel) usando `exceljs` no cliente.
* **Visualizador de Mídia:** Preview nativo de imagens e vídeos armazenados na nuvem.

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

### E. Smart Sync Strategy (Política "Zero Dirt + Active Chat")
Para garantir que o CRM inicie útil imediatamente, o sistema adota uma política híbrida durante a importação inicial:
1.  **Contatos & Mensagens:** O sistema baixa e salva todo o histórico necessário.
2.  **Criação de Leads (Active History):** O histórico de conversas ativas (mensagens recentes) **CRIA LEADS AUTOMATICAMENTE**. Isso garante que o Kanban já nasça povoado com as negociações em andamento.
3.  **Smart Fetch de Mídia:** O sistema detecta ativamente contatos sem foto e força uma busca em background.

### F. Regras Estritas de Lead (Lead Guard)
O sistema possui um **"Centralized Gatekeeper"** (`ensureLeadExists` em `sync.js`) que atua como autoridade única para criação de Leads.

*   **Trigger:** Acionado tanto por mensagens Realtime quanto pelo processamento de Histórico (Active Chats).
*   **Blindagem de Identidade (LID Resolver):**
    *   Resolve IDs ocultos (`@lid`) para o telefone real antes de criar o lead.
    *   O sistema resolve IDs de dispositivo (`@lid`) para o telefone real. Isso impede o bug do "Status Online Fantasma", onde um chat vazio aparecia na lista apenas porque o dispositivo do contato ficou online.
*   **Política de Nomes (Trust the Book):** Se o nome vem da agenda do celular, ele é sagrado. Ignoramos filtros de validação para garantir que apelidos, números ou símbolos salvos intencionalmente pelo usuário sejam exibidos corretamente no CRM.
*   **Regras de Exclusão (Hard Block):**
    *   🚫 Grupos (`@g.us`) e Canais (`@newsletter`).
    *   🚫 Broadcasts e Status.
    *   🚫 O próprio número do usuário (Self).
    *   🚫 Contatos marcados como "Removido do CRM" (`is_ignored = true`).
*   **Estratégia de Nomes (Null Safe Policy v4.3):**
    *   O sistema tenta identificar: Agenda > Business > PushName.
    *   **Permissividade Total:** Se nenhum nome for encontrado, o Lead é criado com `name = NULL`.
    *   **Frontend Fallback:** A interface exibe o número formatado (`+55...`) até que o "Auto-Healing" capture um nome real numa interação futura.

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

## 6. Deploy e Infraestrutura (Docker & Security)
O serviço Backend foi modernizado para rodar em containers (Docker), eliminando a dependência de gerenciadores de processo como PM2 em favor de uma arquitetura Cloud-Native.

### Containerização (Dockerfile)
O projeto inclui um `Dockerfile` otimizado baseado em `node:20-slim`.
*   **Dependências de Sistema:** Instala automaticamente `ffmpeg`, `libvips` e dependências do Chromium para garantir funcionamento do Baileys e manipulação de mídia.
*   **Segurança:** Roda como usuário não-root onde possível e utiliza `helmet` para proteção de headers HTTP.
*   **Limites:** Configurado para `max-old-space-size=4096` (4GB) para suportar alta carga de sessões em memória.

### Rate Limiting (Proteção DDoS)
Middleware de segurança (`middleware/limiter.js`) ativo em todas as rotas.
*   **Backend:** `rate-limiter-flexible` com fallback:
    *   **Produção (Redis):** Implementa punição exponencial (Ban de 1min -> 10min -> 1h -> 24h) baseada em reincidência.
    *   **Dev (Memória):** Limite simples sem persistência.
*   **Limite Padrão:** 200 requisições/minuto por IP ou Token de Usuário.

### Comandos de Deploy
```bash
# Build e Run Local (Docker)
docker build -t wancora-backend ./backend
docker run -p 3001:3001 --env-file backend/.env wancora-backend

# Deploy (Render/Railway)
# Apenas aponte para o repositório. O Dockerfile na pasta /backend será detectado automaticamente.
# Configure o Root Directory como "backend".```

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
