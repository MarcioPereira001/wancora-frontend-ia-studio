
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const numberValue = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
}

// SAFE DATE PARSER (CRÍTICO PARA SAFARI/OPERA GX/APPLE)
// O Safari quebra com datas SQL padrão ("YYYY-MM-DD HH:MM:SS").
// Esta função converte para ISO 8601 ("YYYY-MM-DDTHH:MM:SS") antes de criar o objeto Date.
export function safeDate(dateInput: string | Date | null | undefined): Date | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;

    // Se for string, tenta corrigir formatos incompatíveis com WebKit
    let cleanDate = dateInput;
    
    // Corrige espaço para T (Ex: "2023-01-01 12:00" -> "2023-01-01T12:00")
    if (typeof cleanDate === 'string' && cleanDate.includes(' ') && !cleanDate.includes('T')) {
        cleanDate = cleanDate.replace(' ', 'T');
    }

    const d = new Date(cleanDate);
    
    // Verifica se é Data Inválida
    if (isNaN(d.getTime())) return null;
    
    return d;
}

export function cleanJid(jid: string) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

export function formatPhone(jid: string | null | undefined): string {
  if (!jid) return 'Desconhecido';
  const clean = cleanJid(jid).replace(/\D/g, '');
  
  // Se for grupo (@g.us) e não tiver nome
  if (jid.includes('@g.us')) {
      return `Grupo ${clean.slice(0, 4)}...`;
  }

  // Formato +55 (DDD) 9xxxx-xxxx
  if (clean.length >= 10) {
      let ddd = '';
      let num = '';
      
      if (clean.startsWith('55') && clean.length >= 12) {
          ddd = clean.substring(2, 4);
          num = clean.substring(4);
          if (num.length === 9) {
              return `+55 (${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
          }
          if (num.length === 8) {
              return `+55 (${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
          }
      } else if (clean.length === 10 || clean.length === 11) {
          // Sem DDI (Assumindo BR ou local)
          ddd = clean.substring(0, 2);
          num = clean.substring(2);
          if (num.length === 9) {
              return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
          }
      }
  }
  return `+${clean}`;
}

// LÓGICA DE OURO v4: HIERARQUIA DE NOMES (NULL SAFE)
export function getDisplayName(contact: any): string {
    if (!contact) return "Usuário";

    if (contact.is_group || contact.remote_jid?.includes('@g.us')) {
        if (contact.name && contact.name !== contact.remote_jid) return contact.name;
        return "Grupo Sem Nome";
    }
    
    if (contact.name && contact.name.trim() !== '') {
        return contact.name;
    }
    
    if (contact.push_name && contact.push_name.trim() !== '') {
        return `~${contact.push_name}`; 
    }
    
    return formatPhone(contact.remote_jid || contact.jid || contact.phone_number || '');
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
