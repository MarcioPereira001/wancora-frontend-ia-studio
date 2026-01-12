📘 WANCORA CRM - System Architecture & Master Blueprint
Versão: 3.0 (Enterprise Gold Standard) Arquitetura: Event-Driven, Multi-Tenant, Persistent Connection Stack Principal: Next.js 14 (App Router), Node.js (Baileys Core), Supabase (PostgreSQL + Realtime).

1. Visão do Produto & Filosofia
O Wancora CRM é um Sistema Operacional de Vendas para WhatsApp. Diferente de ferramentas que apenas "disparam mensagens", o Wancora foca na Retenção de Contexto e na Conversão de Leads.

A "Experiência Wancora" (UX Guidelines)
Zero Friction: O usuário nunca deve sentir que "perdeu" uma mensagem porque a internet caiu. O sistema deve ser resiliente.

Optimistic UI: Ao enviar uma mensagem, ela aparece instantaneamente na tela (cinza), e só depois confirma o envio (check). O usuário não espera o servidor responder para ver sua ação.

Contexto Infinito: O histórico pertence ao Lead, não à conexão. Se o vendedor trocar de número/instância, a conversa com o cliente continua visível no CRM.

IA Invisível: A IA ("Sentinela") não é um robô chato. Ela é um "copiloto" que sussurra sugestões no ouvido do vendedor e preenche dados do CRM automaticamente.

2. Arquitetura Técnica Detalhada
A. O Core Backend (Node.js + @whiskeysockets/baileys)
Este é o coração pulsante. Ele não é apenas uma API REST; é um Gerenciador de Estado Persistente.

Gerenciamento de Sessão: Usa um Map<sessionId, socket> em memória.

Protocolo de Dados:

Entrada: Webhooks do Baileys (messages.upsert, connection.update).

Saída: API REST para o Frontend (POST /message/send).

Persistência: Gravação direta no Supabase via supabase-js (Service Role).

Estratégia de Sincronização (Sync Strategy):

syncFullHistory: true: Baixamos o histórico para popular a base.

Chunking: Processamos mensagens em lotes seguros (ex: últimas 50) para evitar Out of Memory.

Deduplicação: Uso rigoroso de whatsapp_id como chave única.

Master View: Owners e Admins possuem permissão especial (Admins and Owners can view all company leads) para auditar todos os leads via Lista ou Kanban.

B. O Banco de Dados (Supabase / PostgreSQL)
A Fonte da Verdade. Se não está no banco, não existe.

Schema Crítico & Relacionamentos
instances

Gerencia a conexão física.

Regra: name pode ser nulo no insert para evitar erros de Race Condition. O Frontend define o nome.

contacts (Agenda)

jid (PK): Identificador único (551199999999@s.whatsapp.net).

name: Nome salvo manualmente ou vindo de Grupos.

push_name: Nome público do perfil (usado como fallback).

profile_pic_url: Foto do avatar.

leads (O Negócio)

Vinculado a um contato via lógica de negócio (telefone).

pipeline_stage_id: Define onde ele está no Kanban.

status: Status macro ('new', 'open', 'won', 'lost').

owner_id (FK -> auth.users): O responsável pelo lead (para filtros e segurança).

position (Float8): Indexador numérico para ordenação manual dos cards (Smart Drop).

messages (O Histórico)

whatsapp_id (Unique Index): A garantia de não haver duplicatas.

remote_jid (FK -> contacts.jid): Relacionamento físico obrigatório.

lead_id (FK -> leads.id): Relacionamento lógico (pode ser nulo).

session_id: Rastreabilidade de qual instância baixou a mensagem.

C. Segurança & RBAC (Role-Based Access Control)

Owner/Admin:** Acesso total a todos os dados da `company_id`.

Agent (Colaborador):**

Pipelines: Vê apenas pipelines onde está listado na tabela `pipeline_assignments`.

Leads: Vê apenas leads que ele é dono (`owner_id`) OU leads que estão em pipelines que ele tem acesso.

Database: A segurança é garantida via RLS Policies (PostgreSQL), não apenas no frontend. O banco bloqueia queries não autorizadas.

3. Módulos do Sistema (Especificação Funcional)
📱 Módulo 1: Gerenciador de Instâncias (Multi-Device)
Visual: Cards mostrando status (QR Code, Conectado, Desconectado).

Comportamento:

Ao criar: Backend inicia sessão -> Frontend exibe QR Code via Realtime.

Ao deletar: Backend fecha socket, limpa dados da tabela instances e baileys_auth_state. (Opcional: Limpar messages daquela sessão).

Seleção: O usuário escolhe no topo do Chat qual instância ele quer operar. O chat filtra: WHERE session_id = selected_id.

💬 Módulo 2: Chat Avançado (The Inbox)
Layout: Sidebar Esquerda (Lista) + Janela Central (Chat) + Sidebar Direita (Dados do CRM/Lead).

Lista de Conversas (Left Panel):

Ordenação: Mais recentes primeiro.

Display Name Logic:

contacts.name (Nome editado/Grupo)

leads.name (Nome no CRM)

contacts.push_name (Nome do Perfil)

Número formatado.

Janela de Chat (Main):

Media Support:

Áudio: Player nativo com timeline.

Imagem/Vídeo: Modal de preview (Lightbox).

Documentos: Card com ícone de download.

Enquetes: Renderização nativa com botões de opção.

Input Area:

Gravador de Áudio (Microfone com timer e cancelamento).

Anexo (Menu Popover para Tipos de Mídia).

Botão "IA Sugerir" (Chama a API do Gemini/Sentinela).

📊 Módulo 3: Kanban & Pipeline (Híbrido)
Modos de Visualização:
Kanban Board: Visualização padrão por colunas.

Master List View (Tabela): Visualização em lista linear para Admins/Owners verem todos os leads da empresa, independente de atribuição.

Interações Avançadas (UX):

Pan Navigation: Clicar e arrastar no fundo do board move a rolagem horizontal (estilo Trello/Figma).

Smart Drop & Sort:

Lógica: Ordenação manual persistente baseada na coluna `position`.

Cálculo: Ao soltar um card, a nova posição é a média matemática entre o card anterior e o posterior ((A + B) / 2).

Filtros & Atribuição:

Seletor de Responsável: Dropdown para filtrar por `owner_id`.

Filtro de Funil: Seletor para trocar de Pipeline sem colisão de UI.

Visual do Card:

Avatar do Dono no rodapé.

Tags, Valor Monetário e Empresa.

🤖 Módulo 4: IA Sentinela (Intelligence Layer)
Conceito: Uma camada de inteligência que observa as mensagens.

Tabela agents:

prompt_instruction: A "persona" da IA (ex: "Você é um vendedor agressivo").

knowledge_base: Texto livre com dados da empresa (ex: Tabela de preços).

Funcionalidade "Smart Reply":

Backend recebe as últimas 10 msgs + Contexto do Lead.

Envia para LLM (Gemini/OpenAI).

Retorna sugestão de texto para o campo de input (não envia sozinho).

📢 Módulo 5: Campanhas (Broadcasts)
Estrutura:

Criar Campanha (Nome, Template de Msg).

Selecionar Público (Tags ou Pipeline Stage).

Disparo (Worker em Background com delay aleatório para evitar banimento).

Tabelas: campaigns (Config) -> campaign_leads (Fila individual).

👥 Módulo 6: Gestão de Equipe (Team Management)
Local: /settings/team
Funcionalidades:

Listagem: Ver todos os membros e seus cargos (Owner, Admin, Agent).

Convite: Geração de Link de Convite (/register?ref=COMPANY_UUID).

Fluxo: O novo usuário acessa o link -> Cria conta -> O Backend intercepta o ref -> Vincula automaticamente à company_id do convite (sem criar nova empresa).

4. Fluxos Críticos (Core Business Rules)
A. O Fluxo "Anti-Ghost" (Lead Generation)
Problema: Receber mensagem de número desconhecido e perder a venda. Solução Wancora:

Trigger: messages.upsert (tipo notify).

Verificação: O número existe na tabela leads?

Ação (Se Não):

Busca a etapa position: 0 do Pipeline padrão.

Cria um novo Lead: name: push_name, status: new.

Vinculação: Salva a mensagem com lead_id preenchido.

Resultado: O Kanban "brotou" um novo card na coluna "Novos".

B. O Fluxo de Histórico & Reconexão (Data Integrity)
Problema: Mensagens duplicadas ao reconectar ou trocar de celular. Solução Wancora:

Baileys envia histórico.

Backend itera sobre mensagens.

Executa supabase.from('messages').upsert().

Chave de Conflito: remote_jid + whatsapp_id.

Resultado: O banco recusa a duplicata ou atualiza o status (ex: de 'sent' para 'read'), mantendo o chat limpo.

5. Diretrizes para Desenvolvimento com IA (Google AI Studio)
Ao gerar código para este projeto, você DEVE seguir estas regras:

Integridade do Schema: NUNCA invente colunas. Consulte o Schema SQL fornecido. Se precisar de um dado novo, crie a migration SQL primeiro.

Código Backend (Node.js):

Mantenha a estrutura de sessions Map.

Use upsertContact e ensureLeadExists em todas as entradas de mensagem.

Código Frontend (React/Next.js):

NÃO USE MOCKS. Use supabase.from(...).select(...).

Use Tipagem Estrita (types/index.ts).

No Chat, use useChatList com filtro de session_id.

Code Patching: Não reescreva arquivos inteiros se apenas uma função mudou. Indique onde inserir o código.

Performance: Em queries de chat, sempre use paginação ou limites (.limit(50)) para não travar o navegador.

✅ Instruções Finais para o Usuário
Salve este arquivo como README_WANCORA.md na raiz do seu projeto.

No Google AI Studio, faça upload deste arquivo.

No prompt do sistema, diga: "Você é o Arquiteto Sênior do Wancora CRM. Use o arquivo README_WANCORA.md como sua única fonte de verdade para arquitetura e regras de negócio."