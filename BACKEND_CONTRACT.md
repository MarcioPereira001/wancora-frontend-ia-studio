# 🏛️ Wancora CRM - Backend Architecture & Interface Contract

**Versão da Documentação:** 2.0 (Build Arquiteto + Anti-Bootloop)
**Status do Sistema:** Produção / Estável
**Tecnologia:** Node.js (Baileys), Supabase (Postgres + Realtime), Redis (BullMQ).

Este documento serve como a **Fonte Única de Verdade** para o desenvolvimento do Frontend. Qualquer interação com o servidor deve seguir estritamente as especificações abaixo.

---

## 1. 🧠 Arquitetura e Fluxo de Dados

O sistema opera em um modelo **Híbrido (REST + Realtime via Database)**.

1.  **Escrita (Comandos):** O Frontend envia comandos (Enviar Msg, Conectar, Criar Campanha) via **API REST** para o Backend (Render).
2.  **Leitura (Dados):** O Frontend **NUNCA** pede dados ao Backend via REST. Ele lê diretamente do **Supabase**.
3.  **Atualizações (Realtime):** O Backend processa o WhatsApp e salva o resultado no Supabase. O Frontend escuta mudanças no banco (`postgres_changes`) para atualizar a UI.

> **Regra de Ouro:** O Backend é um "Motor de Processamento". O Supabase é o "Canal de Comunicação".

---

## 2. 🗄️ Estrutura de Dados (Supabase Schema)

O Frontend deve consumir estas tabelas e funções.

### 2.1. Tabela: `instances` (Controle de Sessão)
Gerencia o estado da conexão do WhatsApp.
* **`session_id`** (Text, PK): Identificador da sessão (ex: "empresa-uid").
* **`status`** (Text):
    * `qrcode`: O Backend gerou um QR Code novo. Exibir na tela.
    * `connected`: Sessão ativa e operante.
    * `disconnected`: Sessão caiu ou está reconectando.
* **`qrcode_url`** (Text): String Base64 do QR Code.
* **`profile_pic_url`** (Text): Foto do perfil da instância conectada.
* **`updated_at`**: Timestamp da última atualização (usado para *heartbeat*).

### 2.2. Tabela: `messages` (Chat)
Armazena histórico e mensagens novas.
* **`remote_jid`** (Text): ID do contato (Suporta `@s.whatsapp.net` e `@lid`).
* **`from_me`** (Bool): `true` = Enviada por nós, `false` = Recebida.
* **`content`** (Text): Texto da mensagem ou JSON (para enquetes).
* **`message_type`** (Enum): `text`, `image`, `video`, `audio`, `document`, `sticker`, `poll`, `location`, `contact`.
* **`media_url`** (Text): URL pública do arquivo no Supabase Storage.
* **`status`** (Text): `sent`, `received`. (Nota: Backend não gerencia `read/ack` ainda).
* **`lead_id`** (UUID): FK para a tabela `leads`.

### 2.3. Tabela: `contacts` (Agenda)
Contatos brutos sincronizados do WhatsApp.
* **`jid`** (Text, PK): ID único.
* **`name`**: Nome salvo na agenda do celular.
* **`push_name`**: Nome público do perfil do usuário.
* **`profile_pic_url`**: URL da foto do contato.

### 2.4. Função RPC: `get_my_chat_list` (Lista de Conversas)
**CRÍTICO:** O Frontend **DEVE** usar esta função para renderizar a Sidebar. Ela faz a deduplicação e ordenação correta.
* **Parâmetros:** `p_company_id` (UUID).
* **Retorno:** Lista de contatos ordenada pela última mensagem, com contagem de não lidas e dados do Lead mesclados.

---

## 3. 🔌 API REST (Referência de Endpoints)

**Base URL:** `https://seu-backend.onrender.com`

### 3.1. Gestão de Sessão

#### `POST /session/start`
Inicia o processo de conexão. O Backend limpa sessões mortas automaticamente.
* **Body:** `{ "sessionId": "string", "companyId": "uuid" }`
* **Resposta:** `{ "status": "STARTED" }`
* *Obs:* Após chamar isso, escute a tabela `instances` para pegar o QR Code.

#### `POST /session/logout`
Desconecta e limpa dados da sessão no servidor.
* **Body:** `{ "sessionId": "string", "companyId": "uuid" }`

#### `GET /session/status/:companyId`
Verifica se o servidor está rodando.
* **Resposta:** `{ "status": "online", "session": "connected" | "disconnected" }`

---

### 3.2. Envio de Mensagens (`POST /message/send`)

Endpoint unificado para todos os tipos de mídia. O Backend gerencia o buffer e upload.

**Headers:** `Content-Type: application/json`

#### Payload: Texto Simples
```json
{
  "sessionId": "...",
  "to": "5511999999999", // Aceita números puros ou JID
  "type": "text",
  "content": "Olá, tudo bem?"
}
```

#### Payload: Mídia (Imagem/Vídeo/Documento)
O Frontend deve enviar a URL pública. O Backend baixa e re-envia.

```json
{
  "sessionId": "...",
  "to": "...",
  "type": "image", // ou "video", "document"
  "url": "https://meu-bucket.com/foto.jpg",
  "caption": "Legenda da foto",
  "mimetype": "application/pdf", // Opcional para documentos
  "fileName": "contrato.pdf" // Opcional para documentos
}
```

#### Payload: Áudio (PTT - Voz)
Para enviar como se fosse gravado na hora (onda sonora verde).

```json
{
  "sessionId": "...",
  "to": "...",
  "type": "audio",
  "url": "https://...",
  "ptt": true 
}
```

#### Payload: Enquete (Poll)
```json
{
  "sessionId": "...",
  "to": "...",
  "type": "poll",
  "poll": {
    "name": "Qual o melhor horário?",
    "options": ["Manhã", "Tarde", "Noite"],
    "selectableOptionsCount": 1 // 0 = Múltipla escolha
  }
}
```

#### Payload: Localização
```json
{
  "sessionId": "...",
  "to": "...",
  "type": "location",
  "location": {
    "latitude": -23.5505,
    "longitude": -46.6333
  }
}
```

### 3.3. Campanhas em Massa (Marketing)
O sistema usa uma fila Redis (BullMQ) para envio em massa com segurança (Anti-Ban).

#### `POST /campaigns/send` (Disparar)
Coloca uma lista de contatos na fila de processamento.

**Body:**
```json
{
  "companyId": "uuid",
  "sessionId": "string",
  "tagId": "uuid", // (Opcional) Enviar para leads com esta tag
  "message": "Texto da campanha",
  "mediaUrl": "https://..." // (Opcional)
}
```
**Comportamento:** O Worker processa em background com Delay Aleatório (15s a 45s) entre envios.

#### `POST /campaigns/pause` | `/campaigns/resume`
Pausa ou retoma a fila da empresa.

---

## 4. ⚙️ Comportamentos Internos (Black Box)
O Frontend não precisa implementar lógica para isso, mas deve saber que existe:

### 4.1. Anti-Bootloop (Erro 440)
Se o WhatsApp desconectar a sessão por conflito, o Backend automaticamente limpa as credenciais e gera um novo QR Code na tabela `instances`. O Frontend deve apenas reagir a essa mudança na UI.

### 4.2. Smart Sync (Histórico)
Ao conectar, o Backend baixa o histórico completo, mas salva apenas as 20 últimas mensagens de cada conversa para economizar banco. O Frontend não precisa pedir histórico antigo.

### 4.3. Mutex & Deduplicação
O Backend possui um sistema de Lock em memória RAM. Se um cliente enviar 5 mensagens simultâneas, o Backend garante que apenas 1 Lead seja criado no banco.

### 4.4. Suporte a LID (Privacidade)
O sistema aceita IDs do tipo `user@lid`. O Frontend deve tratar `remote_jid` como uma string opaca e não tentar formatar/limpar, pois isso pode quebrar o vínculo com contatos ocultos.

### 4.5. Enriquecimento de Dados (Smart Name)
Se um lead estiver salvo como número (ex: +55...), e o contato enviar uma mensagem com o nome de perfil ("João"), o Backend atualiza o nome na tabela `leads` automaticamente.

---

## 5. 🚨 Tratamento de Erros e Logs
Logs no Render:
* `⚡ [MSG]`: Mensagem recebida com sucesso.
* `📥 [MEDIA]`: Download de mídia em andamento.
* `🚫 [FATAL]`: Sessão caiu e precisa de novo QR.
* `🔄 [RETRY]`: Instabilidade de rede, reconectando sozinho.

**Mensagens Técnicas:** O Backend filtra silenciosamente eventos como `protocolMessage` e `senderKeyDistribution` para não poluir o banco ou a UI.

---

**Fim do Contrato.** Qualquer alteração na lógica de envio ou estrutura de banco deve ser refletida aqui.

**IMPORTANTE: SE FOR NECESSÁRIO GERAR ARQUIVOS PARA BACKEND GERE NO CHAT DA CONVERSA SEMPRE.**
