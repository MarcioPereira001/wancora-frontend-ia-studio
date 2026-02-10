
import { createClient } from "@/utils/supabase/client";

// Configuração do Batching
const BATCH_INTERVAL = 5000; // 5 segundos
const MAX_BATCH_SIZE = 10;   // Máximo de logs por envio
const MAX_RETRIES = 2;

type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
    level: LogLevel;
    message: string;
    metadata: any;
    company_id: string | null;
    user_id: string | null;
    created_at: string;
}

// Fila em memória (Singleton fora do ciclo do React)
let logQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

const supabase = createClient();

// Helpers para extrair contexto sem hooks (funciona em listeners globais)
const getContext = () => {
    try {
        if (typeof window === 'undefined') return { companyId: null, userId: null };
        const stored = localStorage.getItem('wancora-auth-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                companyId: parsed.state?.company?.id || null,
                userId: parsed.state?.user?.id || null
            };
        }
    } catch (e) { /* ignore */ }
    return { companyId: null, userId: null };
};

// Processador da Fila
const flushQueue = async () => {
    if (logQueue.length === 0 || isFlushing) return;

    isFlushing = true;
    const batch = logQueue.splice(0, MAX_BATCH_SIZE); // Retira o lote da fila

    try {
        // Envio em Lote (Bulk Insert)
        const { error } = await supabase.from('system_logs').insert(batch.map(entry => ({
            level: entry.level,
            source: 'frontend',
            message: entry.message,
            metadata: entry.metadata,
            company_id: entry.company_id,
            user_id: entry.user_id,
            created_at: entry.created_at
        })));

        if (error) {
            console.warn("Falha ao enviar logs para Supabase:", error.message);
            // Em caso de falha de rede, poderíamos re-enfileirar, mas para logs
            // preferimos perder dados a arriscar loop infinito ou memory leak no cliente.
        }
    } catch (e) {
        console.error("Erro crítico no Logger Frontend:", e);
    } finally {
        isFlushing = false;
        // Se ainda sobrou algo na fila (chegou enquanto enviava), agendar próximo flush
        if (logQueue.length > 0) {
            scheduleFlush();
        }
    }
};

const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushQueue, BATCH_INTERVAL);
};

export const SystemLogger = {
    log: (level: LogLevel, message: string, meta: any = {}) => {
        // Ignora logs informativos em localhost para não poluir
        if (process.env.NODE_ENV === 'development' && level !== 'error' && level !== 'fatal') {
            // Uncomment to see logs in dev console
            // console.log(`[${level}] ${message}`, meta);
            return;
        }

        const { companyId, userId } = getContext();

        const entry: LogEntry = {
            level,
            message: message?.substring(0, 1000) || 'Erro desconhecido',
            metadata: {
                ...meta,
                url: typeof window !== 'undefined' ? window.location.href : '',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
            },
            company_id: companyId,
            user_id: userId,
            created_at: new Date().toISOString()
        };

        logQueue.push(entry);

        // Se a fila encheu, envia imediatamente. Senão, agenda.
        if (logQueue.length >= MAX_BATCH_SIZE) {
            if (flushTimer) clearTimeout(flushTimer);
            flushQueue();
        } else {
            scheduleFlush();
        }
    },

    error: (message: string, meta?: any) => SystemLogger.log('error', message, meta),
    warn: (message: string, meta?: any) => SystemLogger.log('warn', message, meta),
    info: (message: string, meta?: any) => SystemLogger.log('info', message, meta),
    
    // Inicializador de listeners globais
    initGlobalHandlers: () => {
        if (typeof window === 'undefined') return;

        // 1. Uncaught Errors
        window.onerror = (msg, url, line, col, error) => {
            SystemLogger.error(`Global Error: ${msg}`, {
                stack: error?.stack,
                location: `${url}:${line}:${col}`
            });
            // Retorna false para não suprimir o erro no console do dev
            return false; 
        };

        // 2. Unhandled Promises
        window.onunhandledrejection = (event) => {
            SystemLogger.error(`Unhandled Promise: ${event.reason}`, {
                reason: typeof event.reason === 'object' ? JSON.stringify(event.reason, Object.getOwnPropertyNames(event.reason)) : String(event.reason)
            });
        };

        // 3. Flush ao sair da página (Tentativa de "Best Effort")
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                flushQueue();
            }
        });

        // 4. Console Hijack Seguro (Opcional - Ative com cuidado)
        const originalConsoleError = console.error;
        console.error = (...args) => {
            originalConsoleError.apply(console, args);
            
            // Filtro Anti-Loop: Não logar erros que parecem vir do próprio logger ou libs de monitoramento
            const msg = args.map(a => String(a)).join(' ');
            if (msg.includes('system_logs') || msg.includes('Extension')) return;
            
            // Debounce simples para console.error repetitivo
            // (Na verdade o batching já faz isso, mas aqui evitamos poluir a fila com spam)
            SystemLogger.error('Console Error', { args: msg.substring(0, 500) });
        };
    }
};
