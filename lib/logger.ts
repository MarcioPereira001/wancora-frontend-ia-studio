
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

const getCompanyId = () => {
    // Tenta recuperar do localStorage (persistido pelo Zustand) para ser rápido
    try {
        const stored = localStorage.getItem('wancora-auth-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.state?.company?.id || null;
        }
    } catch (e) { return null; }
    return null;
};

const getUserId = () => {
    try {
        const stored = localStorage.getItem('wancora-auth-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.state?.user?.id || null;
        }
    } catch (e) { return null; }
    return null;
};

export const SystemLogger = {
    log: async (level: LogLevel, message: string, meta: any = {}) => {
        // Ignora logs em localhost se não for erro crítico, para não poluir
        if (process.env.NODE_ENV === 'development' && level !== 'error') return;

        try {
            const companyId = getCompanyId();
            const userId = getUserId();

            await supabase.from('system_logs').insert({
                level,
                source: 'frontend',
                message: message?.substring(0, 1000) || 'Erro desconhecido',
                metadata: {
                    ...meta,
                    url: typeof window !== 'undefined' ? window.location.href : '',
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
                },
                company_id: companyId,
                user_id: userId,
                created_at: new Date().toISOString()
            });
        } catch (e) {
            // Se falhar o log, falha silenciosamente para não travar o app
            // console.error("Falha no logger interno:", e); 
        }
    },

    error: (message: string, meta?: any) => SystemLogger.log('error', message, meta),
    warn: (message: string, meta?: any) => SystemLogger.log('warn', message, meta),
    info: (message: string, meta?: any) => SystemLogger.log('info', message, meta),
    
    // Captura global de erros de janela
    initGlobalHandlers: () => {
        if (typeof window === 'undefined') return;

        window.onerror = (msg, url, line, col, error) => {
            SystemLogger.error(msg as string, {
                stack: error?.stack,
                location: `${url}:${line}:${col}`
            });
            return false; // Deixa o erro propagar
        };

        window.onunhandledrejection = (event) => {
            SystemLogger.error(`Unhandled Promise Rejection: ${event.reason}`, {
                reason: event.reason
            });
        };
        
        // Interceptador de console.error para produção
        if (process.env.NODE_ENV === 'production') {
            const originalConsoleError = console.error;
            console.error = (...args) => {
                // Filtra erros de extensão/React internals irrelevantes
                const msg = args.map(a => String(a)).join(' ');
                if (!msg.includes('Extension') && !msg.includes('hydration')) {
                    SystemLogger.error('Console Error Intercepted', { args });
                }
                // Em produção, podemos optar por não mostrar no console original se quisermos "esconder"
                // originalConsoleError.apply(console, args); 
            };
        }
    }
};
