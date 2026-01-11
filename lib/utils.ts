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
  // Remove sufixos como @s.whatsapp.net ou :1 (device ID)
  return jid.split('@')[0].split(':')[0];
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));