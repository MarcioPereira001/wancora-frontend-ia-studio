
import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { Appointment } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface CalendarState {
  appointments: Appointment[];
  isLoading: boolean;
  viewMode: 'month' | 'week';
  selectedDate: Date;
  
  // Actions
  initializeCalendar: (companyId: string) => Promise<void>;
  setAppointments: (apps: Appointment[]) => void;
  setViewMode: (mode: 'month' | 'week') => void;
  setSelectedDate: (date: Date) => void;
  toggleTaskCompletionOptimistic: (id: string, isCompleted: boolean) => void;
  addAppointmentOptimistic: (app: Appointment) => void;
  updateAppointmentOptimistic: (app: Appointment) => void;
  removeAppointmentOptimistic: (id: string) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    appointments: [],
    isLoading: true,
    viewMode: 'month',
    selectedDate: new Date(),

    setAppointments: (appointments) => set({ appointments }),
    setViewMode: (viewMode) => set({ viewMode }),
    setSelectedDate: (selectedDate) => set({ selectedDate }),

    initializeCalendar: async (companyId: string) => {
        const supabase = createClient();
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        console.log(`📅 [Calendar] Inicializando para Empresa: ${companyId}`);

        // 1. Snapshot Inicial (Blindado por Company ID)
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                lead:leads (id, name, phone)
            `)
            .eq('company_id', companyId) // Segurança Multi-Tenant
            .eq('user_id', user.id) // Agenda Pessoal (Expansível para Team View no futuro)
            .gte('start_time', new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString());

        if (!error && data) {
            set({ appointments: data as unknown as Appointment[], isLoading: false });
        }

        // 2. Realtime Subscription
        if (channel) supabase.removeChannel(channel);

        channel = supabase.channel(`calendar-room:${companyId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'appointments',
                filter: `company_id=eq.${companyId}` // Filtro no Socket
            }, async (payload) => {
                const currentApps = get().appointments;
                
                // INSERT
                if (payload.eventType === 'INSERT') {
                    const newApp = payload.new as Appointment;
                    if (newApp.user_id === user.id) {
                        // Hydrate Lead Data se necessário
                        if (newApp.lead_id) {
                            const { data: leadData } = await supabase.from('leads').select('id, name, phone').eq('id', newApp.lead_id).single();
                            if(leadData) newApp.lead = leadData;
                        }
                        if (!currentApps.find(a => a.id === newApp.id)) {
                            set({ appointments: [...currentApps, newApp] });
                        }
                    }
                }
                // UPDATE
                else if (payload.eventType === 'UPDATE') {
                    if (payload.new.user_id === user.id) {
                        const existing = currentApps.find(a => a.id === payload.new.id);
                        const updated = { ...payload.new, lead: existing?.lead } as Appointment; // Mantém lead data se já tinha
                        
                        // Se o lead mudou, precisa buscar o novo (Edge case)
                        if (payload.new.lead_id && payload.new.lead_id !== existing?.lead_id) {
                             const { data: leadData } = await supabase.from('leads').select('id, name, phone').eq('id', payload.new.lead_id).single();
                             if(leadData) updated.lead = leadData;
                        }

                        set({ appointments: currentApps.map(a => a.id === updated.id ? updated : a) });
                    }
                }
                // DELETE
                else if (payload.eventType === 'DELETE') {
                    set({ appointments: currentApps.filter(a => a.id !== payload.old.id) });
                }
            })
            .subscribe();
    },

    toggleTaskCompletionOptimistic: (id, isCompleted) => {
        set((state) => ({
            appointments: state.appointments.map(a => 
                a.id === id 
                ? { ...a, completed_at: isCompleted ? new Date().toISOString() : null } 
                : a
            )
        }));
    },

    addAppointmentOptimistic: (app) => {
        set((state) => ({
            appointments: [...state.appointments, app]
        }));
    },

    updateAppointmentOptimistic: (app) => {
        set((state) => ({
            appointments: state.appointments.map(a => a.id === app.id ? app : a)
        }));
    },

    removeAppointmentOptimistic: (id) => {
        set((state) => ({
            appointments: state.appointments.filter(a => a.id !== id)
        }));
    }
  };
});