
export interface ThemeConfig {
    mode: 'dark' | 'light';
    pageBackground: string;
    cardColor: string;
    primaryColor: string;
    textColor: string;
    titleGradient?: string[];
    coverOffsetY?: number;
    coverOverlayOpacity?: number;
}

export interface ThemeTemplate {
    id: string;
    name: string;
    previewColors: string[];
    config: ThemeConfig;
}

export const THEME_TEMPLATES: ThemeTemplate[] = [
    // --- TEMAS ESCUROS (DARK) ---
    {
        id: 'wancora_dark',
        name: "Wancora Standard",
        previewColors: ["#09090b", "#22c55e"],
        config: {
            mode: "dark",
            pageBackground: "#09090b",
            cardColor: "rgba(24, 24, 27, 0.9)",
            primaryColor: "#22c55e",
            textColor: "#ffffff",
            titleGradient: ["#ffffff", "#a1a1aa"],
            coverOverlayOpacity: 0.5
        }
    },
    {
        id: 'midnight_blue',
        name: "Midnight Blue",
        previewColors: ["#0f172a", "#3b82f6"],
        config: {
            mode: "dark",
            pageBackground: "#020617",
            cardColor: "rgba(15, 23, 42, 0.95)",
            primaryColor: "#3b82f6",
            textColor: "#f8fafc",
            titleGradient: ["#60a5fa", "#2563eb"],
            coverOverlayOpacity: 0.6
        }
    },
    {
        id: 'deep_forest',
        name: "Deep Forest",
        previewColors: ["#052e16", "#10b981"],
        config: {
            mode: "dark",
            pageBackground: "#022c22",
            cardColor: "rgba(6, 78, 59, 0.9)",
            primaryColor: "#10b981",
            textColor: "#ecfdf5",
            titleGradient: ["#34d399", "#059669"],
            coverOverlayOpacity: 0.4
        }
    },
    {
        id: 'cyberpunk',
        name: "Cyberpunk Neon",
        previewColors: ["#000000", "#d946ef"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to bottom right, #2e1065, #000000)",
            cardColor: "rgba(0, 0, 0, 0.8)",
            primaryColor: "#d946ef",
            textColor: "#fae8ff",
            titleGradient: ["#f0abfc", "#c026d3"],
            coverOverlayOpacity: 0.7
        }
    },
    {
        id: 'obsidian',
        name: "Obsidian Black",
        previewColors: ["#000000", "#ffffff"],
        config: {
            mode: "dark",
            pageBackground: "#000000",
            cardColor: "rgba(20, 20, 20, 0.95)",
            primaryColor: "#ffffff",
            textColor: "#ffffff",
            titleGradient: ["#ffffff", "#71717a"],
            coverOverlayOpacity: 0.8
        }
    },
    {
        id: 'dracula',
        name: "Dracula",
        previewColors: ["#282a36", "#bd93f9"],
        config: {
            mode: "dark",
            pageBackground: "#282a36",
            cardColor: "rgba(68, 71, 90, 0.9)",
            primaryColor: "#bd93f9",
            textColor: "#f8f8f2",
            titleGradient: ["#ff79c6", "#bd93f9"],
            coverOverlayOpacity: 0.5
        }
    },

    // --- TEMAS CLAROS (LIGHT) ---
    {
        id: 'clean_light',
        name: "Minimalist Light",
        previewColors: ["#ffffff", "#000000"],
        config: {
            mode: "light",
            pageBackground: "#f4f4f5",
            cardColor: "rgba(255, 255, 255, 0.95)",
            primaryColor: "#18181b",
            textColor: "#09090b",
            titleGradient: ["#18181b", "#52525b"],
            coverOverlayOpacity: 0.2
        }
    },
    {
        id: 'paper',
        name: "Paper White",
        previewColors: ["#f8fafc", "#475569"],
        config: {
            mode: "light",
            pageBackground: "#ffffff",
            cardColor: "#ffffff",
            primaryColor: "#3b82f6",
            textColor: "#334155",
            titleGradient: ["#1e293b", "#475569"],
            coverOverlayOpacity: 0.1
        }
    },
    {
        id: 'soft_rose',
        name: "Soft Rose",
        previewColors: ["#fff1f2", "#fb7185"],
        config: {
            mode: "light",
            pageBackground: "#fff1f2",
            cardColor: "rgba(255, 255, 255, 0.8)",
            primaryColor: "#e11d48",
            textColor: "#881337",
            titleGradient: ["#be123c", "#fb7185"],
            coverOverlayOpacity: 0.2
        }
    },
    {
        id: 'corporate',
        name: "Corporate Blue",
        previewColors: ["#eff6ff", "#1e40af"],
        config: {
            mode: "light",
            pageBackground: "#eff6ff",
            cardColor: "rgba(255, 255, 255, 0.9)",
            primaryColor: "#1d4ed8",
            textColor: "#1e3a8a",
            titleGradient: ["#1e3a8a", "#3b82f6"],
            coverOverlayOpacity: 0.3
        }
    },

    // --- GRADIENTES & COLORIDOS ---
    {
        id: 'sunset',
        name: "Sunset Vibes",
        previewColors: ["#c2410c", "#f59e0b"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to bottom right, #7c2d12, #b45309)",
            cardColor: "rgba(20, 10, 5, 0.8)",
            primaryColor: "#f97316",
            textColor: "#fff7ed",
            titleGradient: ["#fbbf24", "#f97316"],
            coverOverlayOpacity: 0.5
        }
    },
    {
        id: 'ocean',
        name: "Ocean Breeze",
        previewColors: ["#0891b2", "#06b6d4"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to top right, #155e75, #0891b2)",
            cardColor: "rgba(8, 51, 68, 0.85)",
            primaryColor: "#22d3ee",
            textColor: "#ecfeff",
            titleGradient: ["#67e8f9", "#06b6d4"],
            coverOverlayOpacity: 0.4
        }
    },
    {
        id: 'royal',
        name: "Royal Purple",
        previewColors: ["#581c87", "#a855f7"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to bottom, #3b0764, #6b21a8)",
            cardColor: "rgba(59, 7, 100, 0.85)",
            primaryColor: "#c084fc",
            textColor: "#faf5ff",
            titleGradient: ["#e879f9", "#a855f7"],
            coverOverlayOpacity: 0.6
        }
    },

    // --- GLASSMORPHISM (TRANSPARENTE) ---
    {
        id: 'glass_dark',
        name: "Glass Dark",
        previewColors: ["#444444", "#ffffff"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(45deg, #000000, #434343)",
            cardColor: "rgba(255, 255, 255, 0.05)",
            primaryColor: "#ffffff",
            textColor: "#ffffff",
            titleGradient: ["#ffffff", "#a3a3a3"],
            coverOverlayOpacity: 0.5
        }
    },
    {
        id: 'glass_light',
        name: "Glass Light",
        previewColors: ["#e5e5e5", "#000000"],
        config: {
            mode: "light",
            pageBackground: "linear-gradient(to right, #8e9eab, #eef2f3)",
            cardColor: "rgba(255, 255, 255, 0.4)",
            primaryColor: "#000000",
            textColor: "#000000",
            titleGradient: ["#000000", "#404040"],
            coverOverlayOpacity: 0.1
        }
    }
];
