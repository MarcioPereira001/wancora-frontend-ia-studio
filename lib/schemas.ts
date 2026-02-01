
import { z } from 'zod';

// Validação de UUID
const uuidSchema = z.string().uuid({ message: "ID inválido (UUID requerido)" });

// Schema para envio de mensagens (Bate com BACKEND_CONTRACT.md)
export const SendMessageSchema = z.object({
  sessionId: z.string().min(1, "Session ID obrigatório"),
  companyId: uuidSchema,
  to: z.string().min(5, "Destinatário inválido"),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'poll', 'location', 'contact', 'pix', 'card']),
  text: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  fileName: z.string().optional(),
  ptt: z.boolean().optional(),
  caption: z.string().optional(),
  
  // Estruturas Complexas
  poll: z.object({
    name: z.string().min(1),
    options: z.array(z.string()).min(2),
    selectableOptionsCount: z.number().min(1)
  }).optional(),
  
  location: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  
  contact: z.object({
    displayName: z.string(),
    vcard: z.string().optional(),
    phone: z.string()
  }).optional(),
  
  // Novo tipo Card (Rich Link)
  card: z.object({
      title: z.string().min(1, "Título obrigatório"),
      description: z.string().optional(),
      link: z.string().url("Link inválido"),
      thumbnailUrl: z.string().url().optional().or(z.literal(""))
  }).optional(),

  mimetype: z.string().optional()
}).refine(data => {
    // Regras condicionais
    if (data.type === 'text' && !data.text) return false;
    if (['image', 'video', 'audio', 'document'].includes(data.type) && !data.url) return false;
    if (data.type === 'poll' && !data.poll) return false;
    if (data.type === 'card' && !data.card) return false;
    return true;
}, {
    message: "Payload inválido para o tipo de mensagem especificado."
});

// Schema para Campanhas
export const CampaignSendSchema = z.object({
    companyId: uuidSchema,
    name: z.string().min(3, "Nome da campanha muito curto"),
    message: z.string().min(1, "Mensagem vazia"),
    selectedTags: z.array(z.string()).min(1, "Selecione pelo menos uma tag"),
    scheduledAt: z.string().datetime().nullable().optional()
});
