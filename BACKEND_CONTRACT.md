### ARQUIVO: `BACKEND_CONTRACT.md`

```markdown
# 🏛️ Wancora CRM - Backend Architecture & Interface Contract

**Versão do Documento:** 5.1 (Full Feature Set)
**Arquitetura:** Event-Driven Microservices (Node.js + Supabase + Redis)
**Stack:** Baileys (Core), Express (API), BullMQ (Filas), PostgreSQL (Persistência).

Este documento é a **Bíblia Técnica** do Backend. Ele descreve a comunicação entre Frontend e Backend.

Repositsório original: https://github.com/DestravaVendas/wancora-backend.git

📂 Estrutura Global do Projeto (Project Blueprint)
wancora-backend/
├── 📁 auth/
│   └── 📄 supabaseAuth.js        # Persistência de sessão Baileys no Supabase (JSONB fix)
│
├── 📁 controllers/
│   ├── 📄 appointmentController.js # [NOVO] Lógica de confirmação imediata de agendamentos
│   ├── 📄 campaignController.js    # Controle de criação e disparo de campanhas
│   ├── 📄 cloudController.js       # [NOVO] Controlador do Google Drive, Uploads e Conversões
│   └── 📄 whatsappController.js    # Facade para sessão, mensagens, grupos e catálogo
│
├── 📁 lib/
│   └── 📄 schemas.js             # Schemas de validação Zod para payloads
│
├── 📁 middleware/
│   ├── 📄 auth.js                # Autenticação JWT e Validação Multi-Tenant (RBAC)
│   ├── 📄 errorHandler.js        # [NOVO] Captura global de exceções e gravação no banco
│   ├── 📄 limiter.js             # Rate Limiting (Redis) e Proteção DDoS
│   └── 📄 validator.js           # Middleware de validação de Schema
│
├── 📁 routes/
│   ├── 📄 automation.routes.js   # Rotas de automação (campanhas, agenda)
│   ├── 📄 cloud.routes.js        # [NOVO] Rotas de Cloud/Drive (Upload, List, Sync)
│   ├── 📄 management.routes.js   # Rotas de gestão (grupos, comunidades, catálogo)
│   ├── 📄 message.routes.js      # Rotas de mensageria (envio, voto, reação)
│   └── 📄 session.routes.js      # Rotas de sessão (QR, status, logout)
│
├── 📁 services/
│   ├── 📁 ai/
│   │   └── 📄 transcriber.js     # [NOVO] Transcrição de áudio via Gemini Flash
│   │
│   ├── 📁 baileys/
│   │   ├── 📁 handlers/
│   │   │   ├── 📄 contactHandler.js  # Lógica de presença e upsert de contatos
│   │   │   ├── 📄 historyHandler.js  # Processamento de histórico inicial (Sync Barrier)
│   │   │   ├── 📄 mediaHandler.js    # Download e upload de mídia (Sharp optimization)
│   │   │   └── 📄 messageHandler.js  # Processamento central de mensagens
│   │   │dentro de pasta .../baileys/
│   │   ├── 📄 catalog.js         # Sincronização de Produtos do WhatsApp Business
│   │   ├── 📄 community.js       # Gestão de Grupos e Comunidades
│   │   ├── 📄 connection.js      # Core: Gestão de sockets e reconexão
│   │   ├── 📄 listener.js        # Configuração de eventos do socket
│   │   ├── 📄 messageQueue.js    # Fila de processamento de mensagens recebidas
│   │   └── 📄 sender.js          # Protocolo de envio (Com suporte a Streaming do Drive)
│   │   
│   ├── 📁 crm/
│   │   └── 📄 sync.js            # Integração com banco de dados (Leads/Contacts/Locks)
│   │
│   ├── 📁 google/                # [NOVO] Módulo de Integração Drive
│   │   ├── 📄 authService.js     # OAuth2, Refresh Tokens e Autenticação
│   │   └── 📄 driveService.js    # Lógica de Arquivos, Lixeira, Upload e Conversão DOCX
│   │
│   ├── 📁 integrations/
│   │   └── 📄 webhook.js         # Disparo de webhooks externos
│   │
│   ├── 📁 scheduler/
│   │   └── 📄 sentinel.js        # Agente de IA (Gemini) com suporte a Tools (Busca de Arq)
│   │dentro de pasta .../services/
│   └── 📄 redisClient.js         # Infra: Conexão Singleton com Redis
│
├── 📁 utils/
│   ├── 📄 audioConverter.js      # Conversão de áudio para OGG/Opus (FFmpeg)
│   ├── 📄 logger.js              # [NOVO] Utilitário de gravação de logs no Supabase (SystemLogs)
│   ├── 📄 promptBuilder.js       # [NOVO] Engine de Prompts (Espelho do Frontend)
│   └── 📄 wppParsers.js          # Helpers de normalização (JID, Unwrap)
│
├── 📁 workers/
│   ├── 📄 agendaWorker.js        # [NOVO] Cron job para lembretes de agendamento (Redis Lock)
│   ├── 📄 campaignQueue.js       # Definição da fila BullMQ
│   ├── 📄 campaignWorker.js      # Processador de disparo em massa
│   └── 📄 retentionWorker.js     # [NOVO] Worker de Ciclo de Vida (Mover mídia para Drive)
│dentro da raiz
├── 📄 .gitignore
├── 📄 .slugignore
├── 📄 Dockerfile.txt             # Definição de Container
├── 📄 ecosystem.config.cjs       # Configuração PM2
├── 📄 instrument.js              # Monitoramento Sentry
├── 📄 package-lock.json
├── 📄 package.json
└── 📄 server.js                  # Entry Point da aplicação

---

## 1. 🧠 Arquitetura de Sistema

O Backend atua como um **Gateway Inteligente** entre o WhatsApp (Meta) e o Banco de Dados (Supabase). Ele opera em um modelo Híbrido:

1.  **API Server (Síncrono):** Recebe comandos imediatos do Frontend (REST).
2.  **Event Listener (Assíncrono):** Ouve o WebSocket do WhatsApp (Baileys) e reage a eventos (novas mensagens, status).
3.  **Worker Fleet (Background):** Processa tarefas pesadas (Campanhas em Massa) via Redis para garantir rate-limiting e anti-ban.

## 1.1. Estratégias de Resiliência e Infraestrutura
**Auto-Reconnect (Resurrection Strategy):** No boot do servidor, o sistema executa a função restoreSessions(), que identifica instâncias com status connected ou connecting no Supabase e reinicia os sockets automaticamente com um delay escalonado de 2 segundos entre cada uma para evitar picos de CPU.
**Browser Spoofing:** A conexão utiliza a emulação Browsers.ubuntu("Chrome") para mitigar o erro Timeout 408 comum em ambientes de hospedagem como o Render.
**Memory Management:** O processo é configurado com --max-old-space-size=4096 para suportar o alto consumo de memória do Baileys em múltiplas sessões simultâneas.

### Princípios de Design
* **Database-First:** O Backend não mantém estado de negócio em memória. Tudo é persistido no Supabase.
* **Idempotência:** Operações de escrita usam `UPSERT` para evitar duplicidade em condições de corrida.
* **Service Role:** O Backend opera com privilégios administrativos (`SUPABASE_KEY` de serviço) para ignorar RLS.

## 1.2. Protocolos de Estabilidade (Stability Protocols)

**Graceful Shutdown (Zero-Conflict Deploy):**
O servidor implementa listeners para `SIGTERM` e `SIGINT`. Ao receber sinal de desligamento (ex: novo deploy no Render), o sistema:
1. Interrompe a aceitação de novas requisições HTTP.
2. Encerra proativamente todas as conexões WebSocket do Baileys (`sock.end()`).
3. Aguarda 1.5s para limpeza de buffers.
*Objetivo:* Prevenir o erro `440 Stream Errored (conflict)` onde a sessão velha briga com a nova.

**BR Number Sanitization (Correção 9º Dígito):**
No serviço de envio (`Sender`), o sistema intercepta números brasileiros (`+55`).
1. Executa `sock.onWhatsApp(jid)` para consultar a API do WhatsApp.
2. Obtém o JID canônico (com ou sem o 9º dígito, dependendo da região/operadora).
3. Realiza o envio para o JID correto validado.
*Objetivo:* Eliminar falhas de envio para números antigos/novos ou portados.

---

## 2. 🗄️ Interface de Dados (Supabase Schema)

Consulte o `DATABASE_SCHEMA.md` para a definição completa das tabelas.
O Backend é responsável por escrever em: `instances`, `contacts`, `messages`, `baileys_auth_state`, `campaign_logs`.

### 2.1. Protocolo de Leitura (Frontend Consumption)
O Frontend não acessa as tabelas `messages` ou `contacts` diretamente para montar a lista de chats. Ele utiliza RPCs (Remote Procedure Calls) para garantir performance e agregação de dados.

**RPC: `get_my_chat_list` (Inbox v5.0)**
*   **Contrato:** O Frontend recebe um objeto plano ("flat") que combina dados de 4 tabelas (`contacts`, `leads`, `messages`, `pipeline_stages`).
*   **Campos de Gestão (Novos):**
    *   `lead_tags`: Array de strings. Usado para filtrar conversas por etiqueta no Frontend.
    *   `stage_name` e `stage_color`: Permite visualizar em qual etapa do funil o cliente está direto na lista de chat.
    *   `is_online`: Booleano atualizado em tempo real via trigger de presença.
*   **Ordenação:** Sempre decrescente por `last_message_at`.

---

## 3. 🔌 API REST (Endpoints de Comando)

**Base URL:** `https://seu-backend.onrender.com/api/v1`
**Headers:** `Content-Type: application/json`

### 3.1. Gestão de Sessão (`Connection Service`)

#### `POST /session/start`
Inicia o processo de conexão em background.
* **Body:** `{ "sessionId": "string", "companyId": "uuid" }`
* **Comportamento:** "Fire-and-forget". O Frontend deve escutar a tabela `instances` para exibir o QR Code.

#### `POST /session/logout`
Encerra a conexão e limpa a tabela de autenticação.
* **Body:** `{ "sessionId": "string", "companyId": "uuid" }`

### 3.2. Mensageria (`Sender Service`)

#### `POST /message/send`
Envia mensagens com **Protocolo de Humanização** (Digitando... -> Pausa -> Envio).

* **Body (Genérico):**
    ```json
    {
     "sessionId": "...",
     "companyId": "...",
     "to": "5511999999999",
     "type": "text", // enum: text, image, video, audio, document, poll, location, contact, card
     "text": "Conteúdo...",
     "url": "https://...", // URL pública (Supabase/S3)
     "driveFileId": "google_drive_id", // [NOVO] Envia direto do Drive (Streaming RAM)
     "fileName": "doc.pdf",
     "ptt": true
    }
    ```

**Payloads Especiais:**

1.  **Enquete (Poll)**
    ```json
    {
      "type": "poll",
      "poll": {
        "name": "Título da Enquete",
        "options": ["Opção A", "Opção B"],
        "selectableOptionsCount": 1
      }
    }
    ```
2.  **Localização**
    ```json
    {
      "type": "location",
      "location": {
        "latitude": -23.5505,
        "longitude": -46.6333
      }
    }
    ```
3.  **Card (Rich Link)**
    Gera um balão visual com foto, título e link clicável (Ad-Hoc Link Preview).
    ```json
    {
      "type": "card",
      "card": {
        "title": "Título em Negrito",
        "description": "Descrição auxiliar (opcional)",
        "link": "https://seu-site.com/oferta",
        "thumbnailUrl": "https://link-da-imagem.jpg" // Obrigatório ser JPEG/PNG acessível publicamente
      }
    }
    ```


### 3.2.1. Protocolo de Humanização (Deep Dive)
O envio não é apenas um disparo de socket, mas um fluxo que simula o comportamento humano para evasão de algoritmos de detecção de spam.

1.  **Delay Dinâmico Inteligente:** O tempo de espera agora é calculado com base na configuração individual do Agente de IA (`timingConfig`) + o tamanho do texto gerado.
    *   Fórmula: `Random(Min, Max)` configurado no agente.
    *   Fator Texto: Textos longos (> 200 chars) tendem automaticamente para o tempo máximo configurado.
2.  **Presence Simulation:**
    *   **Texto:** Ativa `composing`. O tempo de "digitando" é sincronizado com o delay calculado acima.
    *   **Áudio:** Ativa `recording`. Tempo calculado: `random(2000ms, 5000ms)`.
3.  **Final Pause:** Transição para o status `paused` antes do disparo efetivo do payload.
4.  **PTT Nativo:** Áudios enviados com `ptt: true` forçam o mimetype `audio/ogg; codecs=opus` para garantir a renderização da onda sonora (waveform) no cliente final.

#### `POST /message/vote`
Registra o voto de um usuário (ou do próprio dono) em uma enquete enviada.
* **Body:**
    ```json
    {
      "companyId": "uuid",
      "sessionId": "string",
      "remoteJid": "551199999999@s.whatsapp.net",
      "pollId": "mensagem_id_da_enquete", // ID do Supabase
      "optionId": 0 // Índice da opção (0, 1, 2...)
    }
    ```
### 3.2.2. Estrutura de Interações (JSONB)
O Backend salva interações ricas diretamente nas colunas JSONB da tabela `messages`:

**Reações (`reactions`):**
```json
[
  { "text": "❤️", "actor": "551199999999@s.whatsapp.net", "ts": 1715000000000 }
]```
**Votos de Enquete (poll_votes):**
```json
[
  { 
    "voterJid": "551199999999@s.whatsapp.net", 
    "selectedOptions": ["Opção A"], 
    "ts": 1715000000000 
  }
]```

**Status:** Documentação alinhada com o estado atual do código (V5 Master Fix). O sistema agora é "Self-Documenting" para futuras manutenções.
---

### 3.3. Campanhas (`Campaign Controller`)

#### `POST /campaigns/send`
Inicia um worker de disparo em massa para leads filtrados por tags.
* **Body:**
    ```json
    {
      "companyId": "uuid",
      "name": "Nome da Campanha",
      "selectedTags": ["tag1", "tag2"],
      "message": "Texto da mensagem... Olá {{name}}",
      "scheduledAt": null // Opcional
    }
    ```

### 3.4. Diagnóstico

#### `GET /health`
Verifica se o servidor está online.
* **Response:** `{ "status": "online", "timestamp": "..." }`

### 3.5. Gestão Total (Grupos, Canais, Comunidades e Perfil)

#### `POST /management/group/create`
Cria um novo grupo com participantes iniciais.
* **Body:** `{ "sessionId": "string", "companyId": "uuid", "subject": "Nome", "participants": ["5511999999999"] }`

#### `POST /management/group/update`
Gerencia configurações e metadados.
* **Body:**
    ```json
    {
      "sessionId": "string",
      "groupId": "123456@g.us",
      "action": "add" | "remove" | "promote" | "demote" | "subject" | "description" | "invite_code" | "picture",
      "value": "...", // URL da imagem se action='picture', ou texto para subject/desc
      "participants": ["jid1"] // Apenas para ações de membros
    }
    ```
#### `POST /management/group/metadata`
Busca os dados técnicos do grupo em tempo real (incluindo lista de participantes atualizada e descrição), direto do socket do WhatsApp.
* **Body:** `{ "sessionId": "string", "groupId": "123@g.us" }`
* **Response:**
  ```json
  {
    "success": true,
    "metadata": {
      "id": "...",
      "subject": "Nome do Grupo",
      "desc": "Descrição...",
      "participants": [ { "id": "...", "admin": "admin" | null }, ... ]
    }
  }
```
#### `POST /management/community/create`
Cria uma Comunidade (Grupo Pai) para aninhamento de subgrupos.
* **Body:** `{ "sessionId": "string", "companyId": "uuid", "subject": "Nome da Comunidade", "description": "Descrição" }`

#### `POST /management/group/create`
Cria um grupo padrão.
* **Body:** `{ "sessionId": "string", "companyId": "uuid", "subject": "Nome", "participants": ["5511999999999"] }`

#### POST /management/catalog/sync
Força a sincronização dos produtos do WhatsApp Business para o banco de dados (Tabela products).
**Body:** { "sessionId": "string", "companyId": "uuid" }

### 3.6. Webhooks de Saída (Outgoing Events)
Se configurado na instância, o Wancora envia POST requests para a URL definida.

**Evento: `message.upsert` (Nova Mensagem)**
Payload enviado para o seu n8n/Typebot:
```json
{
  "event": "message.upsert",
  "timestamp": "2024-03-20T10:00:00Z",
  "data": {
    "company_id": "uuid",
    "session_id": "string",
    "remote_jid": "551199999999@s.whatsapp.net",
    "pushName": "João Silva",
    "content": "Olá",
    "message_type": "text",
    "media_url": "https://...",
    "whatsapp_id": "BAE5F...",
    "from_me": false,
    "isGroup": false
  }
}```

### 3.7. Automação de Agenda (Automation Service)
`POST /appointments/confirm` (Disparo Imediato)
Acionado pelo Frontend público (`/agendar/[slug]`) ou interno logo após criar um agendamento.
* **Função:** Lê as regras de `notification_config` do usuário e dispara as mensagens do tipo `on_booking` (Confirmação imediata) para o Admin e para o Lead.
* **Body:**
```json
{
  "appointmentId": "uuid",
  "companyId": "uuid",
}```

### 3.8. Cloud Drive (Google Integration)

#### `POST /cloud/google/connect`
Inicia o fluxo de autorização OAuth2.
* **Body:** `{ "companyId": "uuid" }`
* **Response:** `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }`

#### `GET /cloud/google/callback` (PÚBLICO)
Rota de callback do Google. Troca o `code` por tokens e salva em `integrations_google`.
* **Query Params:** `?code=...&state={companyId}`
* **Comportamento:** Redireciona o navegador para o Frontend (`/cloud`).

#### `POST /cloud/google/list`
Lista arquivos. Usa estratégia "Hybrid Cache": lê do banco `drive_cache` imediatamente e dispara sync com API Google em background.
* **Body:** `{ "companyId": "uuid" }`
* **Query:** `?folderId=...` (Opcional. Se omitido, lista a raiz).
* **Response:** `{ "files": [ ... ], "source": "hybrid" }`

#### `POST /cloud/google/list-remote` (Navegação Remota)
Lista arquivos de uma pasta específica diretamente da API do Google (bypass de cache) para o modal de importação.
* **Body:** `{ "companyId": "uuid", "folderId": "google_folder_id_ou_root" }`
* **Response:** `{ "files": [ ... ] }`

#### `POST /cloud/google/upload`
Faz upload de um arquivo diretamente para o Google Drive via Streaming (Multipart).
* **Header:** `Content-Type: multipart/form-data`
* **Form Data Fields:**
  * `file`: (Binary) O arquivo em si.
  * `companyId`: uuid
  * `name`: string (Nome do arquivo ex: contrato.pdf)
  * `mimeType`: string (Mime type ex: application/pdf)
  * `folderId`: string | "null" (ID da pasta pai ou string "null" para raiz)
* **Comportamento:** O arquivo é processado em memória (RAM) e enviado via Stream para o Google, sem salvar no disco do servidor e sem travar o Event Loop com JSON gigantes.

#### `POST /cloud/google/search-live`
Realiza uma busca em tempo real na API do Google Drive (ignora o cache local).
* **Body:** `{ "companyId": "uuid", "query": "termo de busca" }`
* **Response:** `{ "files": [ ... ] }`
* **Uso:** Usado no modal de importação de arquivos existentes.

#### `POST /cloud/google/import`
Importa metadados de arquivos selecionados do Google Drive para o cache local (`drive_cache`), tornando-os visíveis no "Meu Drive" do sistema.
* **Body:** 
   ```json
   { 
     "companyId": "uuid", 
     "files": [ { "id": "google_id", "name": "...", "mimeType": "..." }, ... ] 
   }
Response: { "success": true, "count": 10 }
```
#### POST /convert/docx
Serviço de conversão de documentos. Baixa um arquivo DOCX (ou Google Doc exportado) do Drive, converte para HTML compatível com o Editor de Texto e retorna o conteúdo.
Body: { "companyId": "uuid", "fileId": "google_file_id" }
Response:
```JSON
{ 
  "success": true, 
  "html": "<p>Conteúdo do documento...</p>", 
  "filename": "nome_do_arquivo.docx" 
}
```
#### `POST /cloud/google/send-to-whatsapp`
Faz streaming do arquivo do Drive diretamente para o WhatsApp sem salvar em disco local (apenas buffer em memória).
* **Body:** 
   ```json
  { 
    "companyId": "uuid", 
    "fileId": "google_file_id", 
    "to": "5511999999999", 
    "caption": "Aqui está o arquivo solicitado." 
  }
  ```
#### `POST /cloud/google/empty-trash`
Esvazia permanentemente a lixeira do Google Drive da empresa conectada.
* **Body:** `{ "companyId": "uuid" }`
* **Response:** `{ "success": true }`

---

## 4. ⚙️ Lógica Interna & Workers (Black Box)

## 4.1. Sincronização de Dados e Name Hunter V3
O processo de sincronização inicial (messaging-history.set) utiliza uma arquitetura de proteção e enriquecimento de dados:
1.  **Initial Sync:** Baixa contatos e histórico.
2. **Smart Fetch de Mídia (Active Retrieval):** O payload de histórico do WhatsApp raramente traz a URL da foto de perfil. O Backend implementa um loop inteligente que detecta a ausência da foto e executa `sock.profilePictureUrl(jid)` ativamente para cada contato durante a importação, garantindo avatares visíveis desde o primeiro segundo.
3. Concurrency Lock: Uma flag isProcessingHistory atua como um Mutex para impedir que o histórico seja processado em duplicidade, o que causaria inconsistência no banco.
4. **Name Hunter V3 (Trust the Book Policy):** 
   O sistema agora implementa uma política de confiança total na agenda.
   * **Lógica:** Se o contato vier com um nome (`c.name`) durante o sync, ele é considerado "Vindo da Agenda" (`isFromBook`).
   * **Bypass de Validação:** Nomes vindos da agenda IGNORAM a validação de "Nome Genérico". Se o usuário salvou o contato como "123" ou "❤️", o sistema respeita e salva exatamente assim.
   * **Fallback:** Se não houver nome na agenda, o sistema usa o `pushName` (Perfil público), mas aplica filtros estritos para evitar nomes como ".~." ou emojis soltos.
5. Data Propagation: Ao descobrir um nome real via WhatsApp, o backend propaga essa atualização automaticamente para a tabela leads, garantindo que o Kanban e o Chat reflitam a identidade correta do contato.
6. Optimistic Sync Delay: Um atraso de 300ms é aplicado antes do upsertMessage para garantir que o contato e o lead já tenham sido criados/atualizados, evitando erros de chave estrangeira.
7.  **Smart Fetcher (Refresh Contact Info):** A cada mensagem recebida (`messages.upsert`), o sistema executa uma validação agressiva:
    *   **Nome:** Se o `pushName` da mensagem for diferente do banco, atualiza imediatamente.
    *   **Foto:** Se a foto for antiga (> 24h) ou inexistente, força um download via socket.
    *   **Business:** Verifica se é conta comercial se o dado for antigo (> 48h).
    *   **Auto-Healing:** Se o Lead existe mas estava sem nome (NULL), o sistema aplica o novo nome descoberto.
8.  **Gestão de Presença (Presence Update):**
    *   O Backend escuta eventos `presence.update` do Baileys.
    *   Atualiza as colunas `is_online` e `last_seen_at` na tabela `contacts` em tempo real.
    *   O Frontend assina estas mudanças para mostrar a "bolinha verde" na lista de chats.
9.  **LID Resolver (Multi-Device Fix):**
    *   O WhatsApp moderno envia mensagens de IDs secundários (`@lid`) que não batem com o telefone.
    *   O Backend intercepta esses IDs na chegada (`message.upsert`), consulta a tabela `identity_map` e normaliza para o JID do telefone (`@s.whatsapp.net`) *antes* de passar para o CRM.
    *   Isso evita leads duplicados ou mensagens que não aparecem no chat do contato correto.

### 4.1.1. Regra de Higiene de Nomes (Database Enforced)
Um *Trigger* (`sanitize_contact_data`) no banco de dados garante que números de telefone nunca sejam salvos na coluna `name`.
- Se o Backend enviar o JID no campo `name`, o banco converterá para `NULL`.
- O campo `name` é exclusivo para nomes salvos na agenda ou identificados via Perfil Público (`push_name`).

### 4.2. Campaign Worker (Fila Inteligente)
Gerencia o disparo em massa.
* **Rate Limiting:** Delay aleatório entre **15s e 40s** por mensagem.
* **Session Resolution:** Resolve o `sessionId` ativamente no momento do envio.
* **Anti-Ban:** Executa apenas 1 job por vez (concorrência serial).

### 4.3. Persistência de Estado (Supabase Auth Store)
Diferente de implementações que usam arquivos locais (auth_info_multi), este backend utiliza um provedor customizado:
* **Atomic Upserts:** As chaves criptográficas e credenciais são salvas na tabela baileys_auth_state usando operações de Upsert em Lote, otimizando a latência de rede.
* **Buffer Serialization:** Utiliza BufferJSON.replacer e reviver para converter chaves binárias do Baileys em strings JSON compatíveis com o PostgreSQL sem perda de integridade.

#### 4.4. Engine de Campanhas (BullMQ + Spintax)
O motor de disparos em massa opera sob regras rígidas de segurança:
* **Serial Processing:** Configurado com concurrency: 1, garantindo que apenas uma mensagem seja processada por vez em toda a fila da empresa.
* **Smart Throttling:** Além do delay humano, o worker aplica um intervalo aleatório entre 15s e 40s entre cada job de envio.
* **Spintax Engine:** Suporte nativo para variações de texto no formato {Olá|Oi|Bom dia}, reduzindo a pegada de similaridade das mensagens enviadas.
* **Atomic Stats:** Atualização de contadores (processed_count, failed_count) via RPC no Postgres para garantir precisão em tempo real.

### 4.5. Agenda Automation Worker (Notification Engine)
Este worker é responsável por processar as regras de aviso configuradas na tabela `availability_rules`.
* **Frequência:** Cron Job a cada 1 minuto.
* **Lógica de Execução:**
    1.  **Mutex:** Utiliza Redis Lock (`SET NX`) para garantir execução única em ambiente escalável.
    2.  **Escopo:** Busca agendamentos (`appointments`) criados recentemente (para confirmação) ou futuros (para lembretes).
    3.  **Contexto:** Faz Join com `availability_rules` para ler `notification_config`, `meeting_url`, `event_location_details` e `timezone`.
    4.  **Enriquecimento de Mensagem:**
        *   Aplica a formatação de data/hora baseada no **Timezone** configurado na regra (evita erro de UTC/GMT-3).
        *   Se o agendamento não tiver link específico, usa o `meeting_url` da regra global como fallback.
        *   Se o agendamento não tiver local específico, usa o `event_location_details` da regra global.
    5.  **Disparo:** Envia via `whatsappController` usando a sessão definida no config.
    6.  **Idempotência:** Marca flags `confirmation_sent` ou `reminder_sent` no banco.
    
### 4.6. AI Sentinel & BYOK Architecture
O serviço de inteligência (`sentinel.js`) implementa uma estratégia de resolução de credenciais em tempo de execução para suportar Multi-Tenant real:

1.  **Context Load:** Ao processar uma mensagem, o sistema identifica o `company_id`.
2.  **Key Resolution Strategy:**
    *   **Prioridade 1 (Tenant):** Busca `companies.ai_config->apiKey`. Se existir, instancia um cliente Gemini exclusivo para aquela requisição.
    *   **Prioridade 2 (System):** Se não houver chave na empresa, utiliza `process.env.API_KEY` como fallback global.
3.  **Isolation:** Instâncias de clientes IA são cacheadas em memória (`Map<apiKey, Client>`) para performance, mas isoladas logicamente.

* **Gatilhos Imediatos (`on_booking`):**
    *   Devem ser disparados via **Database Webhook** ou processados imediatamente após a inserção do agendamento, sem esperar o Cron.

### 4.7. Smart Sync Strategy (Filtragem de Histórico)
Para otimizar o tempo de carregamento e reduzir custos de armazenamento, o sistema implementa uma estratégia de "Janela Deslizante" na importação inicial:
1. O Baileys envia o histórico completo bruto.
2. O Backend agrupa as mensagens por conversa (`remote_jid`).
3. Apenas as **10 mensagens mais recentes** de cada conversa são processadas e salvas.
4. Para essas mensagens selecionadas, o sistema **força o download de mídias** e a **atualização da foto de perfil** do contato.
5. Mensagens antigas (>10) são descartadas silenciosamente para manter o banco leve e rápido.

### 4.8. Regras Estritas de Lead (Lead Guard)
O sistema possui um **"Centralized Gatekeeper"** (`ensureLeadExists` em `sync.js`) que atua como autoridade única para criação de Leads.

*   **Trigger Universal:** Tanto o Histórico (`historyHandler` com flag `createLead: true`) quanto Mensagens Novas (`messageHandler`) chamam esta função.
*   **Regras de Exclusão (Hard Block):**
    *   Grupos (`@g.us`) -> Bloqueado (Grupos não viram leads de funil, apenas chats).
    *   Canais (`@newsletter`) -> **BLOQUEIO TOTAL** (Ignorado pelo sistema).
    *   Broadcasts (`status@broadcast`) -> **BLOQUEIO TOTAL** (Stories ignorados).
    *   Self (`meu próprio número`) -> Bloqueado.
    *   **Ignorados:** Se `contacts.is_ignored = true`, o lead é bloqueado (Feature "Remover do CRM").

### 4.9. LID Identity Resolver (Multi-Device Fix)
O backend atua como um proxy de tradução para eventos de JID.
1. **Interceptação:** Ao receber eventos de `messages.upsert`, `presence.update` ou `history`, o sistema verifica se o ID termina em `@lid`.
2. **Resolução:** Consulta a tabela `identity_map`.
   * Se mapeado: Substitui o `remote_jid` pelo telefone real (`@s.whatsapp.net`) antes de processar.
   * Se não mapeado: Bloqueia a criação de chats fantasmas no Frontend.
3. **Aprendizado:** O vínculo é salvo/atualizado automaticamente sempre que um evento `contacts.upsert` traz o par `{ id: phone, lid: lid }`.

### 4.10. Retention Worker (Lifecycle Management)
Worker responsável pela economia de custos de armazenamento e backup de longo prazo.
* **Frequência:** Diária (03:00 AM).
* **Lógica:**
    1. Varre mensagens com mídia (`media_url`) armazenadas no Supabase Storage.
    2. Filtra arquivos criados há mais de `storage_retention_days` (Configurado na empresa, padrão 30 dias).
    3. **Migração:** Faz upload do arquivo para o Google Drive na pasta "Lixeira Wancora (Arquivos Antigos)".
    4. **Limpeza:** Deleta o arquivo do Supabase Storage (liberando espaço).
    5. **Atualização:** Atualiza a mensagem com o novo Link do Drive e um aviso de arquivamento.

---

## 5. 📡 Realtime & WebSocket Events (Webhook Specs)

O Frontend deve escutar o Supabase (`public:table`) para reagir a mudanças. O Backend garante a integridade desses dados.

* **`instances` (UPDATE):** Monitorar QR Code e Progresso de Sync (`sync_percent`).
* **`messages` (INSERT/UPDATE):** Novas mensagens ou votos de enquete (`poll_votes`).
* **`contacts` (UPSERT):** Mudanças de foto de perfil ou nome.
* **`campaigns` (UPDATE):** Barra de progresso de disparos em massa.

---

## 6. 🚨 Tratamento de Erros Padronizado

Em caso de falha, a API retorna:
```json
{
  "error": "Descrição do erro legível",
  "details": { ... } // Opcional
}
400: Dados inválidos (ex: falta sessionId).

404: Recurso não encontrado (ex: sessão não existe).

500: Erro interno (Redis, Banco ou Baileys crash).```

### 6.1. Telemetria de Erros (System Logs) [NOVO]
O Backend implementa um padrão de "Observabilidade Silenciosa".
1.  **Interceptação Global:** Qualquer exceção não tratada (`uncaughtException`, `unhandledRejection`) ou erro 500 em rotas é interceptado pelo middleware `errorHandler.js`.
2.  **Persistência:** O erro é gravado na tabela `system_logs` via `utils/logger.js`.
3.  **Console Hijacking:** As funções nativas `console.error` e `console.warn` foram sobrescritas para também enviar cópias para o banco de dados. Isso permite debugar erros do Baileys e de bibliotecas externas sem acesso ao terminal do servidor.
4.  **Loop Breaker:** O Logger possui proteção interna para evitar que erros de gravação de log gerem novos logs (Recursão Infinita).

---

## 7. 🛠️ Normalização de Dados (Parsers)
O backend expõe utilitários para tratar a complexidade das mensagens do WhatsApp:
* **Unwrap Logic:** Desenrola automaticamente mensagens do tipo viewOnce, ephemeral, documentWithCaption e editedMessage.
* **Type Mapping:** Converte os tipos internos do Baileys para o Enum do banco de dados (pollCreationMessage -> poll, liveLocationMessage -> location).
* **Media Handling:** O sistema realiza o download e upload para o Supabase Storage apenas para mensagens em tempo real, preservando a performance durante a sincronização de histórico.

---

## 8. 📝 DICIONÁRIO DE LOGS E STATUS REAIS (MONITORAMENTO SIMPLIFICADO)
Esta seção detalha os indicadores técnicos emitidos pelo Backend para monitoramento do fluxo de dados em tempo real.

### 8.1. CICLO DE VIDA DA CONEXÃO (connection.js)
- [START] Sessão {id} (Empresa: {id}): Início da criação do socket.
- [QR CODE] Novo QR gerado para {id}: String de pareamento disponível.
- [CONECTADO] Sessão {id} online!: Handshake concluído com sucesso.
- [DESCONECTADO] Código: {code}. Reconectar? {true/false}: Log de queda com motivo técnico.
- [RETRY] {id} em {ms}ms (Tentativa {n}): Estratégia de ressurreição ativa.
- [DELETE] Parando sessão {id}: Encerramento da instância em memória.

### 8.2. SINCRONIZAÇÃO E NAME HUNTER V3 (listener.js)
- [HISTÓRICO] Iniciando Processamento Único...: Início da leitura de dados históricos.
- [MAPA] {n} nomes identificados na memória.: Resultado do mapeamento de contatos.
- [FILTRO] {n} mensagens prontas para Sync Sequencial.: Volume após filtros de limite.
- [SYNC] {percent}% ({atual}/{total}): Progresso real da barra de sincronização.
- [HISTÓRICO] Concluído com sucesso.: Finalização do ciclo e transição para Online.
- [HISTÓRICO] Disparo duplicado ignorado...: Ativação do Mutex de segurança.

### 8.3. MENSAGERIA E HUMANIZAÇÃO (sender.js)
- [HUMAN-SEND] Iniciando protocolo para: {jid}: Início dos delays de humanização.
- [ANTI-BAN] Número {jid} não verificado no WhatsApp.: Alerta de conta inexistente.
- Erro no envio seguro: {erro}: Falha técnica no disparo da mensagem.

### 8.4. ENGINE DE CAMPANHAS E WORKERS (campaignWorker.js)
- [BOOT] Restaurando {n} sessões...: Recuperação automática de conexões no início.
- Aguardando...: Worker em estado de throttling (delay anti-ban).
- Enviado: Sucesso no processamento de um job de disparo.
- Falha: Erro no envio para um lead específico (log salvo em campaign_logs).

### 8.5. STATUS DE INSTÂNCIA & SYNC (TABELA: instances)
O Backend atualiza estes campos em tempo real. O Frontend decide quando mostrá-los (Apenas no First-Sync via QR Code).

- **STATUS DE CONEXÃO (`status`):**
  - `connecting`: Socket inicializando.
  - `qrcode`: Aguardando leitura (QR Code gerado).
  - `connected`: Conexão estabelecida.
  - `disconnected`: Sessão encerrada ou falha crítica.

- **ESTÁGIOS DE SINCRONIZAÇÃO (`sync_status`):**
  1. `waiting`: Conectado, aguardando início do download.
  2. `importing_contacts`: Baixando lista de contatos e metadados.
  3. `importing_messages`: Baixando histórico de mensagens (Batching/Lotes).
  4. `processing_history`: Indexando mensagens no banco.
  5. `completed`: Sincronização finalizada (Sinal para o Frontend fechar a barra).
  
  *Nota: O Backend envia esses status em toda conexão, mas o Frontend só exibe a barra se o usuário tiver acabado de parear o dispositivo.*

// Anterior(Consultar) ### 8.5. STATUS DE INSTÂNCIA (TABELA: instances)
// Anterior(Consultar)- STATUS: connecting | SIGNIFICADO: Socket inicializando | AÇÃO: Mostrar Spinner.
// Anterior(Consultar)- STATUS: qrcode | SIGNIFICADO: Aguardando leitura | AÇÃO: Renderizar QR Code.
// Anterior(Consultar)- STATUS: connected | SIGNIFICADO: Conexão estabelecida | AÇÃO: Ícone Verde.
// Anterior(Consultar)- STATUS: syncing | SIGNIFICADO: Processando histórico | AÇÃO: Barra de Progresso.
// Anterior(Consultar)- STATUS: online | SIGNIFICADO: Sistema estável | AÇÃO: Liberar Funções.
// Anterior(Consultar)- STATUS: disconnected | SIGNIFICADO: Sessão encerrada | AÇÃO: Botão Reconectar.

### 8.6. TIPOS DE MENSAGEM (TABELA: messages)
- ENUMS SUPORTADOS: text, image, video, audio, document, sticker, poll, location, contact, card.
- NOTA: 'card' é renderizado como um Link Preview forçado (externalAdReply).

---

## 9. SERVER ACTIONS (Next.js Logic Layer)
Funcionalidades de IA que rodam no servidor Next.js (Server-Side) para suportar a interface do usuário sem expor chaves de API.

### 9.1. Geração de Personas (`gemini.ts`)

#### `generateAgentPromptAction`
Cria um System Prompt estruturado baseado em inputs brutos do usuário.
*   **Input:**
    ```json
    {
      "companyName": "Wancora Tech",
      "product": "CRM SaaS",
      "audience": "Pequenas empresas",
      "tone": "Profissional",
      "extra": "Focar em automação"
    }
    ```
*   **Output:** `{ "text": "VOCÊ É um especialista em vendas... [Prompt Completo]" }`
*   **Modelo:** `gemini-3-flash-preview` (Otimizado para instrução).

#### `simulateChatAction`
Simula a resposta do agente em um ambiente de teste (Sandbox).
*   **Input:**
    ```json
    {
      "history": [{ "role": "user", "parts": [{ "text": "Oi" }] }],
      "systemInstruction": "Prompt mestre do agente...",
      "knowledgeBase": "Resumo dos arquivos textual..."
    }
    ```
*   **Output:** `{ "text": "Olá! Como posso ajudar com o CRM hoje?" }`
*   **Nota:** Não persiste dados no banco.

