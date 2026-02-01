
/**
 * Utilitário de Lógica de Calendário (Robust Edition)
 * Responsável por gerar slots e validar colisões com suporte a eventos cross-day.
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

// Helper: Adiciona minutos a uma data base
function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
}

export function generateSlots(
  dateStr: string, // YYYY-MM-DD
  rule: RuleConfig,
  busySlots: BusySlot[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  // 1. Definir limites do dia de trabalho (Work Window)
  // Usa datas completas para comparação precisa
  const [year, month, day] = dateStr.split('-').map(Number);
  
  const workStart = new Date(year, month - 1, day);
  const [startH, startM] = rule.start_hour.split(':').map(Number);
  workStart.setHours(startH, startM, 0, 0);

  const workEnd = new Date(year, month - 1, day);
  const [endH, endM] = rule.end_hour.split(':').map(Number);
  workEnd.setHours(endH, endM, 0, 0);

  // Se o fim for menor que o início (ex: 09:00 as 02:00), assume que termina no dia seguinte
  if (workEnd < workStart) {
      workEnd.setDate(workEnd.getDate() + 1);
  }

  const duration = rule.slot_duration;
  const bufferBefore = rule.buffer_before || 0;
  const bufferAfter = rule.buffer_after || 0;
  const step = duration + bufferAfter; // Buffer depois conta para o próximo slot

  // 2. Normalizar Busy Slots para Intervalos de Tempo Reais
  const busyIntervals = busySlots.map(slot => ({
      start: new Date(slot.start_time).getTime(),
      end: new Date(slot.end_time).getTime()
  }));

  let currentSlotStart = new Date(workStart);

  // 3. Iterar gerando slots
  while (addMinutes(currentSlotStart, duration) <= workEnd) {
      const slotStartTime = currentSlotStart.getTime();
      const slotEndTime = addMinutes(currentSlotStart, duration).getTime();
      
      // Janela Efetiva do Slot (Incluindo Buffer Antes se necessário para colisão)
      // A colisão deve considerar o tempo real ocupado pelo slot
      const effectiveStart = slotStartTime - (bufferBefore * 60000);
      const effectiveEnd = slotEndTime; // Buffer after é tempo morto depois, já garantido pelo step

      // 4. Detecção de Colisão Robusta
      const isBusy = busyIntervals.some(busy => {
          // Lógica de Interseção de Intervalos:
          // (Slot começa antes do Busy terminar) E (Slot termina depois do Busy começar)
          return effectiveStart < busy.end && effectiveEnd > busy.start;
      });

      // 5. Validação de Passado (Se for hoje)
      let isPast = false;
      const now = new Date();
      // Adiciona uma margem de segurança de 30min para não agendar muito em cima
      const nowWithMargin = new Date(now.getTime() + 30 * 60000); 
      
      if (slotStartTime < nowWithMargin.getTime()) {
          isPast = true;
      }

      slots.push({
          time: currentSlotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          available: !isBusy && !isPast
      });

      // Próximo slot: Início atual + Duração + Buffer Depois
      currentSlotStart = addMinutes(currentSlotStart, step);
  }

  return slots;
}
