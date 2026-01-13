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
  const clean = cleanJid(jid);
  // Formato simples +55 (DDD) 9xxxx-xxxx
  if (clean.length >= 12 && clean.startsWith('55')) {
      const ddd = clean.substring(2, 4);
      const num = clean.substring(4);
      if (num.length === 9) {
          return `+55 (${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
      }
      return `+55 (${ddd}) ${num}`;
  }
  return `+${clean}`;
}

export function getDisplayName(contact: any): string {
    if (contact.is_group) {
        return contact.name || contact.push_name || "Grupo Desconhecido";
    }
    // 1. Nome Salvo no CRM
    if (contact.name && contact.name !== contact.remote_jid && contact.name !== cleanJid(contact.remote_jid)) {
        return contact.name;
    }
    // 2. Nome do Perfil WhatsApp (Push Name)
    if (contact.push_name) {
        return contact.push_name;
    }
    // 3. Número Formatado
    return formatPhone(contact.remote_jid);
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));