
# 🏛️ Wancora CRM - Backend Architecture & Interface Contract

**Versão do Documento:** 3.0 (Golden Master / Production Ready)
**Arquitetura:** Event-Driven Microservices (Node.js + Supabase + Redis)
**Stack:** Baileys (Core), Express (API), BullMQ (Filas), PostgreSQL (Persistência).

Este documento é a **Bíblia Técnica** do Backend. Ele descreve não apenas "o que" o backend faz, mas "como" ele garante escalabilidade, consistência e segurança.

---

## 1. 🧠 Arquitetura de Sistema

O Backend atua como um **Gateway Inteligente** entre o WhatsApp (Meta) e o Banco de Dados (Supabase). Ele opera em um modelo Híbrido:

1.  **API Server (Síncrono):** Recebe comandos imediatos do Frontend (REST).
2.  **Event Listener (Assíncrono):** Ouve o WebSocket do WhatsApp (Baileys) e reage a eventos (novas mensagens, status).
3.  **Worker Fleet (Background):** Processa tarefas pesadas (Campanhas em Massa) via Redis para garantir rate-limiting e anti-ban.

### Princípios de Design
*   **Database-First:** O Backend não mantém estado de negócio em memória. Tudo é persistido no Supabase.
*   **Idempotência:** Operações de escrita usam `UPSERT` para evitar duplicidade em condições de corrida (Race Conditions).
*   **Service Role:** O Backend opera com privilégios administrativos (`SUPABASE_KEY` de serviço) para ignorar RLS quando necessário (ex: Workers).

---

## 2. 🗄️ Interface de Dados (Supabase Schema)

O Frontend interage com o resultado do processamento do Backend através destas tabelas e funções.

### 2.1. Tabelas Core (Escrita pelo Backend)

| Tabela | Função Crítica | Regra de Integridade |
| :--- | :--- | :--- |
| **`instances`** | Estado da conexão WebSocket. | `session_id` é a chave mestra. O Backend atualiza `updated_at` como heartbeat. |
| **`contacts`** | Agenda sincronizada. | O Backend faz Upsert constante. `is_ignored` controla o fluxo de Leads. |
| **`messages`** | Histórico de Chat. | **Sem FK restrita** para `contacts` (Suporte a LID). Chave única: `remote_jid` + `whatsapp_id`. |
| **`baileys_auth_state`** | Sessão criptografada. | Armazena chaves do Signal Protocol. Nunca editar manualmente. |

### 2.2. Tabelas de Negócio (Leitura pelo Backend)

| Tabela | Função Crítica | Observação |
| :--- | :--- | :--- |
| **`campaigns`** | Definição de disparos em massa. | O Worker lê daqui e incrementa `processed_count` via RPC. |
| **`leads`** | Dados do cliente. | O Backend cria automaticamente (Auto-Lead) se `contacts.is_ignored = false`. |

### 2.3. Funções RPC Obrigatórias

*   **`get_my_chat_list`**: (Vital) Retorna a Inbox ordenada e deduplicada. O Frontend **NÃO** deve fazer queries manuais na tabela `messages`.
*   **`increment_campaign_count`**: (Vital) Função atômica usada pelo Worker para atualizar o progresso da campanha em tempo real sem *lock* de linha.

---

## 3. 🔌 API REST (Endpoints de Comando)

**Base URL:** `https://seu-backend.onrender.com/api/v1`
**Headers:** `Content-Type: application/json`

### 3.1. Gestão de Sessão (`Connection Service`)

#### `POST /session/start`
Inicia o processo de conexão em background.
*   **Body:** `{ "sessionId": "string", "companyId": "uuid" }`
*   **Comportamento:** "Fire-and-forget". Retorna 200 imediatamente. O Backend começa a gerar o QR Code e atualiza a tabela `instances`. O Frontend deve escutar o banco para exibir o QR.

#### `POST /session/logout`
Encerra a conexão e limpa a tabela de autenticação.
*   **Body:** `{ "sessionId": "string", "companyId": "uuid" }`

### 3.2. Mensageria (`Sender Service`)

#### `POST /message/send`
Envia mensagens com **Protocolo de Humanização** (Digitando... -> Pausa -> Envio).

*   **Body (Genérico):**
    ```json
    {
      "sessionId": "...",
      "companyId": "...", // Obrigatório para Log no Banco
      "to": "5511999999999", // Aceita números ou JIDs
      "type": "text", // enum: text, image, video, audio, document, poll, location, contact, pix
      "text": "Conteúdo...", // Para texto ou caption
      "url": "https://...", // Para mídia (Deve ser link público)
      "fileName": "contrato.pdf", // Apenas documentos
      "ptt": true // Se true, envia áudio como "Gravado na hora" (Onda verde)
    }
    ```

*   **Comportamento de Segurança (Race Condition Fix):**
    A rota faz um `UPSERT` na tabela `messages` imediatamente após o envio. Se o Listener do Baileys tentar salvar a mesma mensagem milissegundos depois, o banco rejeita a duplicata silenciosamente, garantindo integridade.

### 3.3. Campanhas (`Campaign Controller`)

#### `POST /campaigns/send`
Enfileira um lote de mensagens no Redis (BullMQ).

*   **Body:**
    ```json
    {
      "companyId": "uuid",
      "name": "Promoção Black Friday",
      "message": "Olá {{name}}, temos ofertas!",
      "selectedTags": ["VIP", "Quente"] // Opcional
    }
    ```
*   **Processamento:**
    1.  Backend cria registro na tabela `campaigns` com status `processing`.
    2.  Query seleciona Leads elegíveis.
    3.  Jobs são enviados para a fila `campaigns` no Redis.
    4.  Worker processa um a um.

---

## 4. ⚙️ Lógica Interna & Workers (Black Box)

Detalhes de como o Backend opera "nos bastidores" para garantir estabilidade.

### 4.1. Campaign Worker (Fila Inteligente)
O arquivo `backend/workers/campaignWorker.js` gerencia o disparo em massa.
*   **Concorrência:** 1 Job por vez (Serial).
*   **Rate Limiting:** Delay aleatório entre **15s e 40s** por mensagem. Isso é inegociável para evitar banimento do número.
*   **Session Resolution (Async Fix):** O Worker resolve o `sessionId` ativamente no momento do envio, garantindo que use a conexão mais recente, mesmo que o QR Code tenha mudado durante a campanha.
*   **Feedback Visual:** A cada envio (sucesso ou falha), o Worker chama a RPC `increment_campaign_count` para atualizar a barra de progresso no Dashboard em tempo real.

### 4.2. Sync Service & Mutex (Integridade de Dados)
Para evitar que uma rajada de mensagens crie 10 leads duplicados para o mesmo número:
*   **Lock em Memória:** O Backend usa um `Set` (`leadCreationLock`) para bloquear a criação de leads para um número específico enquanto uma operação já está em andamento.
*   **Smart Name:** Se um lead existe apenas como número, e o contato envia uma mensagem com `pushName` (Nome do Perfil), o Backend atualiza o nome do Lead automaticamente.

### 4.3. Listener de Histórico (Smart Sync)
Ao conectar um novo WhatsApp com 50.000 mensagens:
1.  **Filtro:** Ignora mensagens com mais de 3 meses.
2.  **Prioridade:** Seleciona apenas os 100 chats mais ativos.
3.  **Limite:** Baixa apenas as 10 últimas mensagens de cada chat.
4.  **Chunking:** Salva no banco em lotes de 50 para não estourar a memória da instância.

### 4.4. Anti-Crash & Stubs
O Baileys exige acesso a chaves de criptografia de mensagens antigas.
*   **`getMessage` Stub:** Implementado em `connection.js`. Retorna um objeto vazio seguro caso o Baileys peça uma mensagem que não está mais em cache, evitando que o processo Node.js encerre abruptamente (Crash Loop).

---

## 5. 📡 Realtime & WebSocket Events

O Frontend deve escutar o Supabase para reagir a mudanças de estado.

### Canal: `public:instances`
*   **Filtro:** `company_id=eq.SEU_ID`
*   **Evento:** `UPDATE`
*   **Ação:**
    *   Se `status == 'qrcode'`, renderizar `new.qrcode_url`.
    *   Se `status == 'connected'`, redirecionar para Dashboard.
    *   Se `status == 'disconnected'`, mostrar botão de reconectar.

### Canal: `public:messages`
*   **Filtro:** `company_id=eq.SEU_ID`
*   **Evento:** `INSERT`
*   **Ação:** Atualizar a lista de mensagens do chat aberto E atualizar o contador da Sidebar.

### Canal: `public:campaigns`
*   **Filtro:** `company_id=eq.SEU_ID`
*   **Evento:** `UPDATE`
*   **Ação:** Atualizar barra de progresso e status (`processed_count`, `failed_count`).

---

## 6. 🚨 Tratamento de Erros e Logs

*   **Erro 401/403 (Logout):** O Backend detecta desconexão crítica no `connection.update`. Ele limpa automaticamente as tabelas `instances` e `baileys_auth_state`. O Frontend deve apenas voltar para a tela de QR Code.
*   **Mídia Falha:** Se o download de uma imagem falhar, a mensagem é salva como texto `[Erro no Download]` para não perder o contexto da conversa.
*   **Redis Down:** O sistema tenta reconectar, mas as campanhas pausam. O chat direto (REST) continua funcionando.

---

**Fim do Contrato.** Qualquer alteração de código no Backend DEVE ser refletida neste documento.
