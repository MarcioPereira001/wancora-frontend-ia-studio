
'use client';

import { useEffect } from 'react';
import { SystemLogger } from '@/lib/logger';

export function LoggerInitializer() {
    useEffect(() => {
        SystemLogger.initGlobalHandlers();
        // console.log("🛡️ [LOGGER] Telemetria ativa.");
    }, []);
    return null;
}
