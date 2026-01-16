# 📘 WANCORA CRM - System Architecture & Master Blueprint

**Versão:** 3.6 (Enterprise Gold Standard - Final Fusion)
**Status:** Production-Ready
**Arquitetura:** Event-Driven, Multi-Tenant, Persistent Connection
**Stack Principal:** Next.js 14 (App Router), Node.js (Baileys Core), Supabase (PostgreSQL + Realtime).

---

## 1. Visão do Produto & Filosofia
O Wancora CRM é um Sistema Operacional de Vendas para WhatsApp. Diferente de ferramentas que apenas "disparam mensagens", o Wancora foca na **Retenção de Contexto**, **Conversão de Leads** e **Auditabilidade Total**.

### A "Experiência Wancora" (UX Guidelines)
1.  **Zero Friction:** O usuário nunca deve sentir que "perdeu" uma mensagem porque a internet caiu ou a aba fechou. O sistema deve ser resiliente e salvar rascunhos/estados.
2.  **Optimistic UI:** Ações como enviar mensagem, criar uma tarefa ou adicionar uma nota, a interface atualiza **instantaneamente** na tela, e só depois confirma o envio com o servidor. O usuário não vê "loading" para ações triviais.
3.  **Contexto Infinito:** O histórico pertence ao Lead, não à conexão. Se o vendedor trocar de número/instância, a conversa com o cliente continua visível e acessível no CRM.
4.  **IA Invisível:** A IA ("Sentinela") não é um robô chato. Ela é um "copiloto" que atua nos bastidores, sugerindo respostas e preenchendo dados.

---

## 2. Arquitetura Técnica Detalhada

### A. O Core Backend (Node.js + @whiskeysockets/baileys)
Este é o coração pulsante. Ele não é apenas uma API REST; é um Gerenciador de Estado Persistente.

* **Gerenciamento de Sessão:** Usa um `Map<sessionId, socket>` em memória RAM para manter a conexão WebSocket ativa.
    * *Nota de Infra:* Em ambientes Serverless, é necessário um "Keep-Alive" (Cron-job) batendo na rota `/health` a cada 14 min.
* **Fingerprint:** Emula `Ubuntu 24.04` para evitar banimentos e desconexões por "versão obsoleta".
* **Protocolo de Dados:**
    * **Entrada:** Webhooks do Baileys (`messages.upsert`, `connection.update`, `messages.update`).
    * **Saída:** API REST para o Frontend (`POST /api/message/send`).
    * **Persistência:** Gravação direta no Supabase via `supabase-js` (Service Role) ignorando RLS.
* **Estratégia de Sincronização (Sync Strategy):**
    * **Gerenciamento de Mídia (Supabase Storage):**
        * Bucket: `chat-media` (Público).
        * Fluxo: O Backend intercepta msg com mídia -> Baixa o buffer -> Faz upload no Storage -> Salva a URL pública na coluna `messages.media_url`.
    * **Chunking:** Processamos mensagens históricas em lotes seguros (ex: 50 msgs) para evitar *Out of Memory*.
    * **Unwrap:** Função nativa (`unwrapMessage`) para desenrolar mensagens complexas (ViewOnce, Editadas, Docs com Legenda) antes de salvar.
    * **Deduplicação:** Uso rigoroso de `whatsapp_id` + `remote_jid` como chave composta única para evitar mensagens repetidas.
    * **Mutex:** Sistema de bloqueio (`leadCreationLock`) para impedir criação duplicada de leads em rajadas de mensagens.

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

#### Realtime Strategy (The Hammer Fix)
* O Frontend escuta o canal `public:messages` filtrando apenas por `company_id`.
* Ao receber **qualquer** evento de `INSERT` para a empresa, dispara um **Force Refresh** na lista de mensagens e na Sidebar.
* *Motivo:* Garante que mensagens de LIDs (que não batem com o ID do contato aberto) ou de outros dispositivos sejam renderizadas imediatamente, confiando na consistência do Banco de Dados.

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

1.  **📍 Localização (Location):**
    * **Envio:** Captura `navigator.geolocation`.
    * **Renderização:** Exibe um "Fake Static Map" (CSS Styled) com coordenadas e link para Google Maps.
2.  **📊 Enquete (Poll):**
    * **Estrutura JSON:** `{ name: "Pergunta", options: ["A", "B"], selectableOptionsCount: 1 }`.
    * **Renderização:** Card interativo com opções selecionáveis visualmente.
3.  **💲 Pix (Cobrança):**
    * **Detecção:** Mensagens do tipo `pix` ou texto começando com "Chave Pix:".
    * **UI:** Card estilizado verde com botão de "Copiar Chave" e ícone QR Code.
4.  **👤 Contato (vCard):**
    * **Envio:** Envia VCard padrão (compatível com botão "Salvar" no celular).
    * **Renderização:** Card estilo VCard com botão de Download (.vcf).
5.  **🎤 Áudio PTT:**
    * **Envio:** Gravação nativa via `MediaRecorder`. Envia com flag `ptt: true` (Onda sonora verde no WhatsApp).
    * **Renderização:** Player nativo encapsulado em container estilizado.
6.  **📁 Arquivo de Áudio:** Upload de MP3/WAV como arquivo (ícone de música/fones).
7.  **📄 Documentos:** PDF/Docx com prévia do nome do arquivo e botão de download.
8.  **📷 Galeria/Câmera:** Envio de imagens e vídeos com legenda.

**Sidebar Direita (Lead Command Center - Atualizado):**
Agora possui navegação por **Abas** para organizar a densidade de informações:
1.  **Aba Dados:**
    * **Botões de Ação:** "Adicionar ao CRM" (Verde) / "Remover do CRM" (Vermelho).
    * **Status Visual:** Se removido, campos ficam bloqueados (Ícone Cadeado).
    * **Cronômetro (Deadline):** Visualização e edição do prazo do lead com seletor de Data/Hora.
2.  **Aba Tarefas:**
    * Checklist com suporte a **Prazos Individuais** (ícone de relógio em cada tarefa).
    * Ordenação automática (pendentes primeiro).
3.  **Aba Atividades:**
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

### 🤖 Módulo 3: IA Sentinela (Intelligence Layer)
* **Smart Reply:** Backend recebe as últimas msgs + Contexto -> Envia para LLM -> Retorna sugestão de texto.

### 📢 Módulo 4: Campanhas e Agendamentos
* **Agendamento:** Botão relógio no input -> Salva em `scheduled_messages` com status `pending` -> Cronjob dispara.
* **Campanhas:** Disparo em massa com delay aleatório para evitar banimento.

---

## 4. Fluxos Críticos (Core Business Rules)

### A. Fluxo "Anti-Ghost" & Identidade
Como o sistema decide quem vira Lead e quem é ignorado?

1.  **Chegada da Mensagem:** Webhook `messages.upsert` dispara.
2.  **Verificação de Bloqueio:** O sistema checa `contacts.is_ignored`.
    * Se `TRUE`: A mensagem é salva, mas **nenhum** Lead é criado/atualizado.
    * Se `FALSE`: Segue para o passo 3.
3.  **LID Safe:** O sistema aceita mensagens de IDs ocultos (`@lid`) sem quebrar (graças à remoção de FK restrita).
4.  **Trigger de Unificação:** O Trigger `sync_lid_to_phone_contact` no banco garante que, se uma mensagem chegar via LID, o contato principal (telefone) sobe para o topo da lista.
5.  **Smart Name:** Se o Lead está salvo apenas como número, e o contato manda mensagem com um Nome de Perfil (PushName), o sistema atualiza o nome do Lead automaticamente.

### B. Fluxo de Sincronização (Remover/Adicionar)
* **Remover:** Define `contacts.is_ignored = true` e deleta o Lead. O Backend para de processar mensagens para o CRM.
* **Adicionar:** Define `contacts.is_ignored = false`. O sistema cria um novo Lead na primeira etapa e restaura a comunicação.

### C. Fluxo de Histórico & Reconexão
* Baileys envia histórico -> Backend itera (em chunks) -> Executa `upsert`.
* Chave de Conflito: `remote_jid + whatsapp_id`. O banco recusa a duplicata.

### D. Gestão de Identidade (LID vs Phone)
O WhatsApp moderno utiliza dois identificadores:
1.  **Phone JID:** `551199999999@s.whatsapp.net` (Identidade Principal).
2.  **LID:** `123456789@lid` (Identidade Privada/Oculta).

**Estratégia de Implementação (LID Safe v3.5):**
* **Dual Support:** O sistema aceita nativamente ambos os formatos na tabela `messages`.
* **Upsert Inteligente:** O Backend (`upsertContact`) detecta se o sufixo é `@lid` e salva corretamente na tabela `contacts`, evitando erros de chave estrangeira.
* **Database Constraints:** A chave estrangeira restrita (`FK`) entre mensagens e contatos foi removida intencionalmente para permitir que mensagens de LIDs (ou Status) sejam salvas mesmo antes da criação do contato, garantindo zero perda de dados.
* **Frontend:** A interface trata o `remote_jid` como opaco. Se for LID, exibe normalmente; se for Phone, formata.

---

## 5. Diretrizes para Desenvolvimento com IA (Google AI Studio)

Ao gerar código para este projeto, você **DEVE** seguir estas regras estritas:

1.  **Integridade do Schema:**
    * NUNCA invente colunas. Consulte este README e o arquivo SQL.
    * Use `lead_activities` para logs, **não** crie campos JSON dentro de `leads`.
    * Use a FK `created_by` apontando para `profiles` (não `auth.users`) ao listar atividades.
2.  **Data Fetching:**
    * Para listar chats, **SEMPRE** use a RPC `get_my_chat_list`. Nunca tente fazer joins manuais complexos no Frontend, pois é lento e perde dados de Grupos/Mute.
3.  **Componentes Globais:**
    * Use `useLeadData` e `useLeadActivities` para garantir que Chat e Kanban mostrem os mesmos dados em tempo real.
    * Reutilize `DeadlineTimer.tsx` para consistência visual dos cronômetros.
4.  **Tipagem:** Respeite os tipos `poll`, `location`, `contact` no envio de mensagens (`whatsappController.js` e `routes.js` já estão adaptados para receber payloads estruturados).
5.  **Performance:**
    * Use **Optimistic UI** em interações de checklist, notas e cronômetros. O usuário não pode esperar o banco responder para ver a alteração.

---

✅ **Instruções Finais para o Usuário**
Este arquivo `README.md` é a **Verdade Absoluta**. Ele detalha tabelas, fluxos, UX e regras de negócio. Qualquer alteração no banco de dados (SQL) deve ser refletida aqui imediatamente para manter a consistência entre o "Manual" e a "Máquina".