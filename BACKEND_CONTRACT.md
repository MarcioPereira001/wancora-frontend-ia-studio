### ARQUIVO: `BACKEND_CONTRACT.md`

```markdown
# 🏛️ Wancora CRM - Backend Architecture & Interface Contract

**Versão do Documento:** 5.1 (Full Feature Set)
**Arquitetura:** Event-Driven Microservices (Node.js + Supabase + Redis)
**Stack:** Baileys (Core), Express (API), BullMQ (Filas), PostgreSQL (Persistência).

Este documento é a **Bíblia Técnica** do Backend. Ele descreve a comunicação entre Frontend e Backend.

📂 Estrutura Global do Projeto Validado e Existente (Project Blueprint)
wancora-backend/
├── 📁 auth/
│   └── 📄 supabaseAuth.js       # Gerenciamento de estado e persistência Baileys no Supabase
├── 📁 controllers/
│   ├── 📄 campaignController.js  # Orquestração de criação e disparo de campanhas
│   └── 📄 whatsappController.js  # Facade para controle de sessões, mensagens e enquetes
├── 📁 services/
│   ├── 📁 baileys/
│   │   ├── 📄 connection.js      # Core: Gestão de sockets, QR Code e auto-reconnect
│   │   ├── 📄 listener.js        # Eventos: Sincronização de histórico, mensagens e contatos
│   │   └── 📄 sender.js          # Protocolo: Envio humanizado, mídias e PIX nativo
│   ├── 📁 crm/
│   │   └── 📄 sync.js            # Integração: Upsert de contatos, leads e mensagens no DB
│   └── 📄 redisClient.js         # Infra: Conexão Singleton com Redis para BullMQ
├── 📁 utils/
│   └── 📄 wppParsers.js          # Helpers: Normalização de payloads e extração de conteúdo
├── 📁 workers/
│   ├── 📄 campaignQueue.js       # Fila: Definição e enfileiramento de jobs (BullMQ)
│   └── 📄 campaignWorker.js      # Processador: Execução serial de disparos com Anti-Ban
├── 📄 app.js                     # Placeholder (Lógica centralizada no server.js)
├── 📄 package.json               # Manifesto: Dependências, scripts e metadados do Node.js
├── 📄 package-lock.json          # Lockfile: Versões exatas das dependências instaladas
├── 📄 routes.js                  # Roteamento: Definição de todos os endpoints da API REST
├── 📄 server.js                  # Entry Point: Inicialização do Express, Worker e Boot
└── 📄 .env                       # Config: Variáveis de ambiente (URL/Keys do Supabase e Redis)

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

---

## 2. 🗄️ Interface de Dados (Supabase Schema)

Consulte o `DATABASE_SCHEMA.md` para a definição completa das tabelas.
O Backend é responsável por escrever em: `instances`, `contacts`, `messages`, `baileys_auth_state`, `campaign_logs`.

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
      "type": "text", // enum: text, image, video, audio, document, poll, location, contact, pix
      "text": "Conteúdo...",
      "url": "https://...",
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

###3.2.1. Protocolo de Humanização (Deep Dive)
O envio não é apenas um disparo de socket, mas um fluxo que simula o comportamento humano para evasão de algoritmos de detecção de spam:
**Reaction Delay:** Pausa aleatória inicial entre 500ms e 1500ms.
**Presence Simulation:** Ativação do status composing (digitando) ou recording (gravando áudio).
**Production Time:** Cálculo dinâmico de tempo de digitação baseado no comprimento do texto (100ms por caractere, limitado a 10 segundos).
**Final Pause:** Transição para o status paused antes do disparo efetivo do payload.

3.  **PIX**
    * Envie `type: 'pix'` e a chave no campo `text`. O backend converte para Botão Nativo de Cópia.

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

---

## 4. ⚙️ Lógica Interna & Workers (Black Box)

## 4.1. Sincronização de Dados e Name Hunter V3
O processo de sincronização inicial (messaging-history.set) utiliza uma arquitetura de proteção e enriquecimento de dados:
1. Concurrency Lock: Uma flag isProcessingHistory atua como um Mutex para impedir que o histórico seja processado em duplicidade, o que causaria inconsistência no banco.
2. Name Hunter V3: O sistema mapeia nomes da agenda (notify, verifiedName, short) em um mapa de memória (contactsMap) antes de salvar as mensagens. Se um nome for identificado como "genérico" (apenas números ou igual ao JID), o sistema tenta substituí-lo pelo pushName mais recente.
3. Data Propagation: Ao descobrir um nome real via WhatsApp, o backend propaga essa atualização automaticamente para a tabela leads, garantindo que o Kanban e o Chat reflitam a identidade correta do contato.
4. Optimistic Sync Delay: Um atraso de 300ms é aplicado antes do upsertMessage para garantir que o contato e o lead já tenham sido criados/atualizados, evitando erros de chave estrangeira.

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
* **Frequência:** Cron Job a cada 5 ou 10 minutos.
* **Lógica de Execução:**
    1.  Busca agendamentos (`appointments`) futuros (próximas 24h).
    2.  Faz Join com `availability_rules` para ler o `notification_config`.
    3.  Verifica se existe gatilho pendente (Ex: `before_event` com `time_amount: 1 hour`).
    4.  **Disparo:** Se o horário atual bater com a regra ( `start_time - time_amount`), envia a mensagem via `whatsappController`.
    5.  **Idempotência:** Marca o agendamento como notificado (`reminder_sent = true`) para evitar spam.

* **Gatilhos Imediatos (`on_booking`):**
    *   Devem ser disparados via **Database Webhook** ou processados imediatamente após a inserção do agendamento, sem esperar o Cron.
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
A atualização destes campos dispara o `GlobalSyncIndicator` no Frontend via WebSocket.

- **STATUS DE CONEXÃO (`status`):**
  - `connecting`: Socket inicializando (Spinner amarelo).
  - `qrcode`: Aguardando leitura (QR Code visível).
  - `connected`: Conexão estabelecida (Ícone Verde).
  - `disconnected`: Sessão encerrada ou falha crítica.

- **ESTÁGIOS DE SINCRONIZAÇÃO (`sync_status`):**
  1. `waiting`: Conectado, aguardando início do download.
  2. `importing_contacts`: Baixando lista de contatos e metadados.
  3. `importing_messages`: Baixando histórico de mensagens (Chunking).
  4. `processing_history`: Indexando mensagens e rodando IA (Se ativado).
  5. `completed`: Sincronização finalizada. Barra em 100%.

// Anterior(Consultar) ### 8.5. STATUS DE INSTÂNCIA (TABELA: instances)
// Anterior(Consultar)- STATUS: connecting | SIGNIFICADO: Socket inicializando | AÇÃO: Mostrar Spinner.
// Anterior(Consultar)- STATUS: qrcode | SIGNIFICADO: Aguardando leitura | AÇÃO: Renderizar QR Code.
// Anterior(Consultar)- STATUS: connected | SIGNIFICADO: Conexão estabelecida | AÇÃO: Ícone Verde.
// Anterior(Consultar)- STATUS: syncing | SIGNIFICADO: Processando histórico | AÇÃO: Barra de Progresso.
// Anterior(Consultar)- STATUS: online | SIGNIFICADO: Sistema estável | AÇÃO: Liberar Funções.
// Anterior(Consultar)- STATUS: disconnected | SIGNIFICADO: Sessão encerrada | AÇÃO: Botão Reconectar.

### 8.6. TIPOS DE MENSAGEM (TABELA: messages)
- ENUMS SUPORTADOS: text, image, video, audio, document, sticker, poll, location, contact, pix.
- NOTA: Mensagens 'pix' usam botão nativo de cópia, mas são salvas como 'pix' para relatórios.
