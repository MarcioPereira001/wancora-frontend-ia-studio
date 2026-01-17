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

export function cleanJid(jid: string) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

export function formatPhone(jid: string): string {
  if (!jid) return 'Desconhecido';
  const clean = cleanJid(jid);
  
  // Se for grupo (@g.us) e não tiver nome, formata como "Grupo ..."
  if (jid.includes('@g.us')) {
      return `Grupo ${clean.slice(0, 4)}...`;
  }

  // Formato simples +55 (DDD) 9xxxx-xxxx
  if (clean.length >= 12 && clean.startsWith('55')) {
      const ddd = clean.substring(2, 4);
      const num = clean.substring(4);
      if (num.length === 9) {
          return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
      }
      if (num.length === 8) {
          return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
      }
      return `+55 (${ddd}) ${num}`;
  }
  return `+${clean}`;
}

// LÓGICA DE OURO: HIERARQUIA DE NOMES INTELIGENTE v2.0
export function getDisplayName(contact: any): string {
    if (!contact) return "Usuário";

    // 1. Grupos (Prioridade Total para o Nome se existir)
    if (contact.is_group || contact.remote_jid?.includes('@g.us')) {
        if (contact.name && contact.name !== contact.remote_jid) return contact.name;
        if (contact.push_name) return contact.push_name;
        return "Grupo (Sem Nome)";
    }
    
    // 2. Contato Salvo na Agenda (contact.name)
    // Ignora se o nome for igual ao ID (alguns backends salvam o ID no nome por erro)
    if (contact.name && contact.name !== contact.remote_jid && !contact.name.includes('@') && !contact.name.includes(':')) {
        return contact.name;
    }
    
    // 3. Nome do Perfil (push_name) - O Fallback Inteligente
    // Isso resolve 90% dos casos de "sem nome"
    if (contact.push_name && contact.push_name !== contact.remote_jid) {
        return contact.push_name;
    }
    
    // 4. Fallback Final: Formatação bonita do Número
    return formatPhone(contact.remote_jid || contact.jid);
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));