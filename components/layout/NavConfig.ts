
import { 
  LayoutDashboard, Users, MessageSquare, Send, Bot, 
  QrCode, Settings, Calendar, Monitor, LogOut, Bell
} from 'lucide-react';

export const NAV_ITEMS = {
  // Operacional (Esquerda no Desktop / Bottom no Mobile)
  main: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: MessageSquare, label: 'Chat', href: '/chat' },
    { icon: Users, label: 'CRM', href: '/crm' },
    { icon: Send, label: 'Campanhas', href: '/campaigns' },
    { icon: Bot, label: 'Agentes', href: '/agents' },
    { icon: Monitor, label: 'Mesa', href: '/cloud' }, // Movido para Main no Mobile para caber 6 itens
  ],
  // Utilitário (Direita no Desktop / Menu Perfil no Mobile)
  utility: [
    { icon: Monitor, label: 'Área de Trabalho', href: '/cloud' }, // Desktop Only na direita
    { icon: Calendar, label: 'Agenda', href: '/calendar' },
    { icon: QrCode, label: 'Conexões', href: '/connections' },
    { icon: Settings, label: 'Configurações', href: '/settings' },
  ]
};
