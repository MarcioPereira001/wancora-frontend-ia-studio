
/**
 * Utilitário de Lógica de Calendário
 * Responsável por gerar slots e validar colisões.
 */

interface TimeSlot {
  time: string; // "09:00"
  available: boolean;
}

interface RuleConfig {
  start_hour: string; // "09:00:00"
  end_hour: string;   // "18:00:00"
  slot_duration: number; // minutos
  buffer_before: number;
  buffer_after: number;
}

interface BusySlot {
  start_time: string; // ISO String
  end_time: string;   // ISO String
}

// Converte "HH:MM:SS" para minutos desde meia-noite
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Converte minutos desde meia-noite para "HH:MM"
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function generateSlots(
  dateStr: string, // YYYY-MM-DD
  rule: RuleConfig,
  busySlots: BusySlot[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  const startMinutes = timeToMinutes(rule.start_hour);
  const endMinutes = timeToMinutes(rule.end_hour);
  const duration = rule.slot_duration;
  const totalBuffer = (rule.buffer_before || 0) + (rule.buffer_after || 0);
  const step = duration + totalBuffer;

  let current = startMinutes;

  // Normaliza os busySlots para minutos do dia atual
  const busyIntervals = busySlots.map(slot => {
    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);
    return {
      start: start.getHours() * 60 + start.getMinutes(),
      end: end.getHours() * 60 + end.getMinutes()
    };
  });

  while (current + duration <= endMinutes) {
    const slotStart = current;
    const slotEnd = current + duration;

    // Verifica colisão
    const isBusy = busyIntervals.some(busy => {
      // (Slot começa antes do busy terminar) E (Slot termina depois do busy começar)
      return slotStart < busy.end && slotEnd > busy.start;
    });

    // Verifica se é passado (se for hoje)
    let isPast = false;
    const now = new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    // Nota: mês no JS é 0-indexado
    if (
      now.getFullYear() === year &&
      now.getMonth() === month - 1 &&
      now.getDate() === day
    ) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (slotStart <= nowMinutes) isPast = true;
    }

    slots.push({
      time: minutesToTime(slotStart),
      available: !isBusy && !isPast
    });

    current += step;
  }

  return slots;
}
