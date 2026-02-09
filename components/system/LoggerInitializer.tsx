
'use client';

import { useEffect } from 'react';
import { SystemLogger } from '@/lib/logger';

export function LoggerInitializer() {
    useEffect(() => {
        // Inicializa listeners de erro, promise rejection e console hijacking
        SystemLogger.initGlobalHandlers();
        
        // Log de inicialização (apenas info)
        // SystemLogger.info("🛡️ [LOGGER] Telemetria e Interceptação Ativas.");
    }, []);
    
    return null;
}
