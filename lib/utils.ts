
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

export function formatPhone(jid: string | null | undefined): string {
  if (!jid) return 'Desconhecido';
  const clean = cleanJid(jid).replace(/\D/g, '');
  
  // Se for grupo (@g.us) e não tiver nome
  if (jid.includes('@g.us')) {
      return `Grupo ${clean.slice(0, 4)}...`;
  }

  // Formato simples +55 (DDD) 9xxxx-xxxx
  if (clean.length >= 10) {
      // Tenta detectar DDI 55
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

// LÓGICA DE OURO v3: HIERARQUIA DE NOMES (NULL SAFE)
export function getDisplayName(contact: any): string {
    if (!contact) return "Usuário";

    // 1. Grupos (Prioridade Total para o Nome se existir)
    if (contact.is_group || contact.remote_jid?.includes('@g.us')) {
        if (contact.name && contact.name !== contact.remote_jid) return contact.name;
        if (contact.push_name) return contact.push_name;
        return "Grupo (Sem Nome)";
    }
    
    // 2. Nome da Agenda (contact.name) - Se não for NULL e não for telefone
    if (contact.name && contact.name.trim() !== '') {
        // Validação extra: Se o nome for igual ao telefone, ignora
        const cleanName = contact.name.replace(/\D/g, '');
        const cleanPhone = (contact.phone_number || contact.remote_jid || '').replace(/\D/g, '');
        
        if (cleanName !== cleanPhone) {
            return contact.name;
        }
    }
    
    // 3. Nome do Perfil (push_name)
    if (contact.push_name && contact.push_name.trim() !== '') {
        return contact.push_name;
    }
    
    // 4. Fallback: Número Formatado
    return formatPhone(contact.remote_jid || contact.jid || contact.phone_number || '');
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
