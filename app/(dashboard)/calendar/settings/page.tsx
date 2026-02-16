
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { getMyAvailability, saveAvailabilityRules, updateProfileAvatar, type AvailabilityFormData } from '@/app/actions/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/Modal';
import { 
    Calendar, Globe, Save, Loader2, Copy, Image as ImageIcon, PaintBucket, 
    Palette, LayoutTemplate, Smartphone, Monitor, Upload, ExternalLink, User, Clock, MapPin, Check,
    Move, ZoomIn, ChevronDown, ArrowDown, ArrowRight, ArrowUpRight, ArrowDownRight, 
    Bell, MessageSquare, Plus, Trash2, Smartphone as SmartphoneIcon, Tag, Smile
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '@/types';
import { whatsappService } from '@/services/whatsappService';
import EmojiPicker, { Theme } from 'emoji-picker-react';

const WEEKDAYS = [
  { id: 0, label: 'D', name: 'Domingo' },
  { id: 1, label: 'S', name: 'Segunda' },
  { id: 2, label: 'T', name: 'Terça' },
  { id: 3, label: 'Q', name: 'Quarta' },
  { id: 4, label: 'Q', name: 'Quinta' },
  { id: 5, label: 'S', name: 'Sexta' },
  { id: 6, label: 'S', name: 'Sábado' },
];

const GRADIENT_DIRECTIONS = [
    { label: 'Baixo', value: 'to bottom', icon: ArrowDown },
    { label: 'Direita', value: 'to right', icon: ArrowRight },
    { label: 'Diag. Baixo', value: 'to bottom right', icon: ArrowDownRight },
    { label: 'Diag. Cima', value: 'to top right', icon: ArrowUpRight },
];

// --- TEMPLATES RESTAURADOS E EXPANDIDOS ---
const THEME_TEMPLATES = [
    {
        id: 'wancora_dark',
        name: "Wancora Dark (Padrão)",
        previewColors: ["#09090b", "#22c55e"],
        config: {
            mode: "dark",
            pageBackground: "#09090b",
            cardColor: "rgba(24, 24, 27, 0.95)",
            primaryColor: "#22c55e",
            textColor: "#ffffff",
            titleGradient: ["#ffffff", "#a1a1aa"],
            coverOverlayOpacity: 0.6
        }
    },
    {
        id: 'clean_light',
        name: "Clean Light (Profissional)",
        previewColors: ["#f4f4f5", "#3b82f6"],
        config: {
            mode: "light",
            pageBackground: "#f4f4f5",
            cardColor: "rgba(255, 255, 255, 0.95)",
            primaryColor: "#3b82f6",
            textColor: "#18181b",
            titleGradient: ["#18181b", "#52525b"],
            coverOverlayOpacity: 0.2
        }
    },
    {
        id: 'midnight_blue',
        name: "Midnight Blue (Executivo)",
        previewColors: ["#0f172a", "#60a5fa"],
        config: {
            mode: "dark",
            pageBackground: "#0f172a",
            cardColor: "rgba(30, 41, 59, 0.9)",
            primaryColor: "#60a5fa",
            textColor: "#f1f5f9",
            titleGradient: ["#93c5fd", "#3b82f6"],
            coverOverlayOpacity: 0.5
        }
    },
    {
        id: 'cyberpunk',
        name: "Cyberpunk Neon (Criativo)",
        previewColors: ["#000000", "#d946ef"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to bottom right, #2a0a2e, #000000)",
            cardColor: "rgba(10, 10, 10, 0.9)",
            primaryColor: "#d946ef",
            textColor: "#ffffff",
            titleGradient: ["#d946ef", "#8b5cf6"],
            coverOverlayOpacity: 0.7
        }
    },
    {
        id: 'forest_zen',
        name: "Forest Zen (Natural)",
        previewColors: ["#14532d", "#4ade80"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to bottom, #052e16, #14532d)",
            cardColor: "rgba(20, 83, 45, 0.8)",
            primaryColor: "#4ade80",
            textColor: "#f0fdf4",
            titleGradient: ["#bbf7d0", "#22c55e"],
            coverOverlayOpacity: 0.4
        }
    },
     {
        id: 'sunset_vibes',
        name: "Sunset Vibes (Moderno)",
        previewColors: ["#c2410c", "#fcd34d"],
        config: {
            mode: "dark",
            pageBackground: "linear-gradient(to top right, #431407, #7c2d12)",
            cardColor: "rgba(67, 20, 7, 0.85)",
            primaryColor: "#fb923c",
            textColor: "#fff7ed",
            titleGradient: ["#fdba74", "#fcd34d"],
            coverOverlayOpacity: 0.5
        }
    }
];

// --- NOTIFICATION UTILS ---
const TAGS = [
    { label: 'Nome Lead', value: '[nome_do_lead]' },
    { label: 'Empresa', value: '[empresa]' },
    { label: 'Data', value: '[data]' },
    { label: 'Hora', value: '[hora]' },
    { label: 'Local', value: '[local]' },
    { label: 'Link', value: '[link_reuniao]' }
];

const DEFAULT_ADMIN_MSG = "🔔 *Novo Agendamento*\n\nCliente: [nome_do_lead]\nData: [data] às [hora]\nLocal: [local]";
const DEFAULT_LEAD_MSG = "Olá [nome_do_lead]! 👋\n\nSeu agendamento com *[empresa]* está confirmado para *[data]* às *[hora]*.\n\nAté lá!";

export default function CalendarSettingsPage() {
  const { user, setUser } = useAuthStore();
  const { addToast } = useToast();
  const supabase = createClient();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'notifications'>('general');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Estado para avatar atual (Recuperado)
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Crop State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempAvatarFile, setTempAvatarFile] = useState<File | null>(null);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);

  // Gradient State
  const [bgGradientColors, setBgGradientColors] = useState(["#09090b", "#18181b", "#000000"]);
  const [bgGradientDir, setBgGradientDir] = useState("to bottom right");
  
  // Custom Dropdown State (Templates)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(THEME_TEMPLATES[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Data State
  const [instances, setInstances] = useState<Instance[]>([]);
  const [formData, setFormData] = useState<AvailabilityFormData>({
    name: 'Minha Agenda',
    slug: '',
    days_of_week: [1, 2, 3, 4, 5],
    start_hour: '09:00',
    end_hour: '18:00',
    slot_duration: 30,
    is_active: true,
    event_goal: 'Reunião',
    event_location_type: 'online',
    event_location_details: 'Google Meet',
    cover_url: '',
    theme_config: THEME_TEMPLATES[0].config as any
  });

  // Notification Config State
  const [notifConfig, setNotifConfig] = useState<any>({
      sending_session_id: '',
      admin_phone: '',
      admin_notifications: [],
      lead_notifications: []
  });

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setShowTemplateDropdown(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load Data
  useEffect(() => {
    const init = async () => {
        // 1. Fetch Instances for Selection
        const insts = await whatsappService.getAllInstances();
        setInstances(insts);

        const data = await getMyAvailability();
        if (data) {
            setFormData({
                id: data.id,
                name: data.name,
                slug: data.slug,
                days_of_week: data.days_of_week || [],
                start_hour: data.start_hour ? data.start_hour.slice(0, 5) : '09:00',
                end_hour: data.end_hour ? data.end_hour.slice(0, 5) : '18:00',
                slot_duration: data.slot_duration,
                is_active: data.is_active,
                event_goal: data.event_goal || 'Reunião',
                event_location_type: data.event_location_type || 'online',
                event_location_details: data.event_location_details || 'Google Meet',
                cover_url: data.cover_url || '',
                theme_config: {
                    ...THEME_TEMPLATES[0].config, 
                    ...data.theme_config
                } as any
            });
            setCurrentAvatar(data.owner_avatar || user?.avatar_url || '');
            
            // Gradient Logic
            const currentBg = data.theme_config?.pageBackground || "";
            if (currentBg.includes('linear-gradient')) {
                const dirMatch = currentBg.match(/to\s[a-z]+\s?[a-z]*/);
                if (dirMatch) setBgGradientDir(dirMatch[0]);
                const matches = currentBg.match(/#[0-9a-fA-F]{6}/g);
                if (matches && matches.length >= 2) {
                    setBgGradientColors([matches[0], matches[1], matches[2] || matches[1]]);
                }
            } else if (currentBg.startsWith('#')) {
                setBgGradientColors([currentBg, currentBg, currentBg]);
            }

            // Notifications
            if (data.notification_config) {
                setNotifConfig(data.notification_config);
            } else {
                // Defaults se vazio
                setNotifConfig({
                    sending_session_id: insts.find(i => i.status === 'connected')?.session_id || '',
                    admin_phone: '',
                    admin_notifications: [],
                    lead_notifications: []
                });
            }
        } else if (user?.name) {
            const suggestedSlug = user.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-agenda';
            setFormData(prev => ({ ...prev, slug: suggestedSlug }));
        }
        setIsLoading(false);
    };
    init();
  }, [user]);

  const toggleDay = (dayId: number) => {
      setFormData(prev => {
          const exists = prev.days_of_week.includes(dayId);
          if (exists) return { ...prev, days_of_week: prev.days_of_week.filter(d => d !== dayId) };
          return { ...prev, days_of_week: [...prev.days_of_week, dayId].sort() };
      });
  };

  const handleSave = async () => {
      setIsSaving(true);
      try {
          const payload = { ...formData, notification_config: notifConfig };
          const result = await saveAvailabilityRules(payload);
          
          if (result.error) {
              addToast({ type: 'error', title: 'Erro', message: result.error });
          } else {
              addToast({ type: 'success', title: 'Salvo', message: 'Configurações atualizadas.' });
          }
      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha de comunicação.' });
      } finally {
          setIsSaving(false);
      }
  };

  // ... (Upload handlers mantidos do original)
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file || !user?.company_id) return;
      setUploadingCover(true);
      try {
          const { publicUrl } = await uploadChatMedia(file, user.company_id);
          setFormData(prev => ({ ...prev, cover_url: publicUrl }));
          addToast({ type: 'success', title: 'Sucesso', message: 'Capa atualizada.' });
      } catch (err) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha no upload.' });
      } finally {
          setUploadingCover(false);
      }
  };

  const onSelectAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setTempAvatarFile(file);
      setTempAvatarUrl(URL.createObjectURL(file));
      setCropModalOpen(true);
      e.target.value = ''; 
  };

  const handleCroppedUpload = async (blob: Blob) => {
      if(!user?.company_id) return;
      setCropModalOpen(false);
      setUploadingAvatar(true);
      const file = new File([blob], "avatar.png", { type: "image/png" });
      try {
          const { publicUrl } = await uploadChatMedia(file, user.company_id);
          await updateProfileAvatar(publicUrl);
          if (user) setUser({ ...user, avatar_url: publicUrl });
          setCurrentAvatar(publicUrl);
          addToast({ type: 'success', title: 'Sucesso', message: 'Foto de perfil atualizada.' });
      } catch (err) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha no upload.' });
      } finally {
          setUploadingAvatar(false);
          if (tempAvatarUrl) URL.revokeObjectURL(tempAvatarUrl);
          setTempAvatarUrl(null);
          setTempAvatarFile(null);
      }
  };
  
  // Theme helpers (mantidos)
  const updateTheme = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, theme_config: { ...prev.theme_config!, [field]: value } }));
  };
  const updateTitleGradient = (index: number, color: string) => {
      const colors = [...(formData.theme_config?.titleGradient || [formData.theme_config?.textColor || "#fff", "#ccc"])];
      colors[index] = color;
      updateTheme('titleGradient', colors);
  };
  const updateBgGradient = (index: number, color: string) => {
      const newColors = [...bgGradientColors];
      newColors[index] = color;
      setBgGradientColors(newColors);
      const cssGradient = `linear-gradient(${bgGradientDir}, ${newColors[0]}, ${newColors[1]}, ${newColors[2]})`;
      updateTheme('pageBackground', cssGradient);
  };
  const updateBgDirection = (dir: string) => {
      setBgGradientDir(dir);
      const cssGradient = `linear-gradient(${dir}, ${bgGradientColors[0]}, ${bgGradientColors[1]}, ${bgGradientColors[2]})`;
      updateTheme('pageBackground', cssGradient);
  }
  const handleTemplateSelect = (tpl: any) => {
      setSelectedTemplate(tpl);
      setShowTemplateDropdown(false);
      setFormData(prev => ({ ...prev, theme_config: tpl.config as any }));
      if (tpl.config.pageBackground.includes('linear-gradient')) {
          const matches = tpl.config.pageBackground.match(/#[0-9a-fA-F]{6}/g);
          if (matches) setBgGradientColors([matches[0], matches[1], matches[2] || matches[1]]);
          const dirMatch = tpl.config.pageBackground.match(/to\s[a-z]+\s?[a-z]*/);
          if (dirMatch) setBgGradientDir(dirMatch[0]);
      } else {
          setBgGradientColors([tpl.config.pageBackground, tpl.config.pageBackground, tpl.config.pageBackground]);
      }
  };

  // --- NOTIFICATION HELPERS ---
  const addRule = (target: 'admin' | 'lead') => {
      const field = target === 'admin' ? 'admin_notifications' : 'lead_notifications';
      const newRule = {
          id: Date.now().toString(),
          type: 'on_booking', // Default
          time_amount: 1,
          time_unit: 'hours',
          template: target === 'admin' ? DEFAULT_ADMIN_MSG : DEFAULT_LEAD_MSG,
          active: true
      };
      setNotifConfig({ ...notifConfig, [field]: [...(notifConfig[field] || []), newRule] });
  };

  const removeRule = (target: 'admin' | 'lead', id: string) => {
      const field = target === 'admin' ? 'admin_notifications' : 'lead_notifications';
      setNotifConfig({ ...notifConfig, [field]: notifConfig[field].filter((r: any) => r.id !== id) });
  };

  const updateRule = (target: 'admin' | 'lead', id: string, key: string, value: any) => {
      const field = target === 'admin' ? 'admin_notifications' : 'lead_notifications';
      setNotifConfig({
          ...notifConfig,
          [field]: notifConfig[field].map((r: any) => r.id === id ? { ...r, [key]: value } : r)
      });
  };

  const insertTag = (target: 'admin' | 'lead', id: string, tag: string) => {
      const field = target === 'admin' ? 'admin_notifications' : 'lead_notifications';
      const rules = notifConfig[field];
      const rule = rules.find((r: any) => r.id === id);
      if (rule) {
          const newTemplate = rule.template + " " + tag;
          updateRule(target, id, 'template', newTemplate);
      }
  };

  if (isLoading) return <div className="flex items-center justify-center h-[calc(100vh-100px)]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const publicUrl = `https://wancora-crm.netlify.app/agendar/${formData.slug}`;
  const theme = formData.theme_config;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 px-4">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            Configurar Disponibilidade
            </h1>
            <p className="text-zinc-400 mt-2">Defina horários, aparência e automações.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-green-500/20 w-full md:w-auto">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar Tudo
        </Button>
      </div>

      <div className="flex border-b border-zinc-800 overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap", activeTab === 'general' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>
              Geral & Horários
          </button>
          <button onClick={() => setActiveTab('appearance')} className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap", activeTab === 'appearance' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>
              Página Pública (Editor)
          </button>
          <button onClick={() => setActiveTab('notifications')} className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap", activeTab === 'notifications' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>
              Avisos & Notificações
          </button>
      </div>

      <div className="grid gap-6">
        
        {/* --- GENERAL TAB --- */}
        {activeTab === 'general' && (
            <div className="space-y-6 animate-in slide-in-from-left-4 max-w-3xl">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader><CardTitle className="text-lg text-white">Identidade da Agenda</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Título da Página (Nome Público)</label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-950 border-zinc-800" placeholder="Ex: Consultoria com João" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-2">
                                <Globe className="w-3 h-3" /> Link Personalizado
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-2.5 text-zinc-500 text-sm hidden md:block">wancora-crm.netlify.app/agendar/</span>
                                    <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} className="md:pl-[240px] bg-zinc-950 border-zinc-800 font-mono text-sm text-primary" />
                                </div>
                                <Button size="icon" variant="outline" className="border-zinc-800 bg-zinc-900" onClick={() => { navigator.clipboard.writeText(publicUrl); addToast({ type: 'success', title: 'Copiado', message: 'Link copiado!' }); }}><Copy className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 mt-2">
                            <span className="text-sm text-zinc-300 font-medium">Agenda Ativa</span>
                            <button onClick={() => setFormData({...formData, is_active: !formData.is_active})} className={cn("w-11 h-6 rounded-full transition-colors relative", formData.is_active ? "bg-green-600" : "bg-zinc-700")}><div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-transform", formData.is_active ? "left-6" : "left-1")} /></button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader><CardTitle className="text-lg text-white">Horários</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-3 block">Dias da Semana</label>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map((day) => (
                                    <button key={day.id} onClick={() => toggleDay(day.id)} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border", formData.days_of_week.includes(day.id) ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700")}>{day.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Início</label><Input type="time" value={formData.start_hour} onChange={e => setFormData({...formData, start_hour: e.target.value})} className="bg-zinc-950 border-zinc-800" /></div>
                            <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Fim</label><Input type="time" value={formData.end_hour} onChange={e => setFormData({...formData, end_hour: e.target.value})} className="bg-zinc-950 border-zinc-800" /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* --- APPEARANCE TAB --- */}
        {activeTab === 'appearance' && (
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in slide-in-from-right-4">
                 {/* Left: Editor Controls */}
                 <div className="space-y-6">
                    {/* ... (Conteúdo de Aparência mantido igual ao anterior, resumido aqui) */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader><CardTitle className="text-lg text-white flex items-center gap-2"><ImageIcon className="w-5 h-5 text-blue-500" /> Mídia & Identidade</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Foto de Capa</label>
                                <div className="relative aspect-[3/1] bg-zinc-950 border border-dashed border-zinc-700 rounded-lg overflow-hidden group">
                                    {formData.cover_url ? (
                                        <img src={formData.cover_url} className="w-full h-full object-cover" style={{ objectPosition: `center ${theme?.coverOffsetY || 50}%` }} alt="Capa" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-zinc-600"><ImageIcon className="w-8 h-8" /></div>
                                    )}
                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <span className="text-white text-xs font-bold flex items-center gap-2">
                                            {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Alterar
                                        </span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                                    </label>
                                </div>
                                {formData.cover_url && (
                                    <div className="mt-3 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex justify-between">Ajuste Vertical <span>{theme?.coverOffsetY}%</span></label>
                                            <input type="range" min="0" max="100" value={theme?.coverOffsetY || 50} onChange={(e) => updateTheme('coverOffsetY', parseInt(e.target.value))} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer mt-1" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex justify-between">Opacidade <span>{theme?.coverOverlayOpacity}%</span></label>
                                            <input type="range" min="0" max="1" step="0.1" value={theme?.coverOverlayOpacity || 0.5} onChange={(e) => updateTheme('coverOverlayOpacity', parseFloat(e.target.value))} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer mt-1" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4 border-t border-zinc-800 pt-4">
                                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-700 group cursor-pointer">
                                    {currentAvatar ? <img src={currentAvatar} className="w-full h-full object-cover" alt="Perfil" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">Foto</div>}
                                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {uploadingAvatar ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
                                        <input type="file" className="hidden" accept="image/*" onChange={onSelectAvatarFile} />
                                    </label>
                                </div>
                                <div className="flex-1"><h4 className="text-sm font-bold text-white">Foto do Perfil</h4></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader><CardTitle className="text-lg text-white">Conteúdo do Evento</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Título</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-950 border-zinc-800 font-bold" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Objetivo</label><Input value={formData.event_goal} onChange={e => setFormData({...formData, event_goal: e.target.value})} className="bg-zinc-950 border-zinc-800" /></div>
                                <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Local</label><Input value={formData.event_location_details} onChange={e => setFormData({...formData, event_location_details: e.target.value})} className="bg-zinc-950 border-zinc-800" /></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader><CardTitle className="text-lg text-white flex items-center gap-2"><Palette className="w-5 h-5 text-purple-500" /> Cores & Tema</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                             <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2"><LayoutTemplate className="w-3 h-3" /> Templates Prontos</label>
                                <div className="relative" ref={dropdownRef}>
                                    <button type="button" onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg p-3 text-left text-sm flex items-center justify-between hover:bg-zinc-900 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTemplate.previewColors[0] }} /><div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTemplate.previewColors[1] }} /></div>
                                            <span>{selectedTemplate.name}</span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                                    </button>
                                    {showTemplateDropdown && (
                                        <div className="absolute top-12 left-0 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                            {THEME_TEMPLATES.map((tpl) => (
                                                <button key={tpl.id} onClick={() => handleTemplateSelect(tpl)} className={cn("w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-zinc-800 text-sm text-left transition-colors", selectedTemplate.id === tpl.id ? "bg-zinc-800" : "")}>
                                                    <div className="flex -space-x-1 shrink-0"><div className="w-4 h-4 rounded-full border border-zinc-700 shadow-sm" style={{ backgroundColor: tpl.previewColors[0] }} /><div className="w-4 h-4 rounded-full border border-zinc-700 shadow-sm" style={{ backgroundColor: tpl.previewColors[1] }} /></div>
                                                    <span className={cn("text-zinc-300", selectedTemplate.id === tpl.id ? "text-white font-bold" : "")}>{tpl.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="h-px bg-zinc-800" />
                             <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Gradiente do Título</label>
                                <div className="flex gap-4">
                                    <div className="flex-1 flex gap-2 items-center bg-zinc-950 border border-zinc-800 p-2 rounded"><input type="color" value={theme?.titleGradient?.[0] || "#ffffff"} onChange={e => updateTitleGradient(0, e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none" /><span className="text-xs text-zinc-400">Início</span></div>
                                    <div className="flex-1 flex gap-2 items-center bg-zinc-950 border border-zinc-800 p-2 rounded"><input type="color" value={theme?.titleGradient?.[1] || "#cccccc"} onChange={e => updateTitleGradient(1, e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none" /><span className="text-xs text-zinc-400">Fim</span></div>
                                </div>
                            </div>
                             <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-2"><PaintBucket className="w-3 h-3" /> Fundo da Página</label>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    {bgGradientColors.map((color, i) => (
                                        <div key={i} className="flex flex-col gap-1">
                                            <div className="flex gap-2 items-center bg-zinc-950 border border-zinc-800 p-2 rounded"><input type="color" value={color} onChange={e => updateBgGradient(i, e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" /></div>
                                            <span className="text-[10px] text-zinc-500 text-center uppercase">{i === 0 ? 'Topo' : i === 1 ? 'Meio' : 'Fundo'}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {GRADIENT_DIRECTIONS.map((dir) => (
                                        <button key={dir.value} onClick={() => updateBgDirection(dir.value)} className={cn("flex flex-col items-center justify-center p-2 rounded border transition-all text-xs", bgGradientDir === dir.value ? "bg-zinc-800 border-primary text-white" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600")}>
                                            <dir.icon className="w-4 h-4 mb-1" /><span className="text-[9px] uppercase font-bold">{dir.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Cor Primária</label><div className="flex gap-2"><input type="color" value={theme?.primaryColor} onChange={e => updateTheme('primaryColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" /><Input value={theme?.primaryColor} onChange={e => updateTheme('primaryColor', e.target.value)} className="h-8 text-xs bg-zinc-950 border-zinc-800" /></div></div>
                                <div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Fundo do Cartão</label><div className="flex gap-2"><input type="color" value={theme?.cardColor?.slice(0, 7)} onChange={e => updateTheme('cardColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" /><Input value={theme?.cardColor} onChange={e => updateTheme('cardColor', e.target.value)} className="h-8 text-xs bg-zinc-950 border-zinc-800" /></div></div>
                            </div>
                        </CardContent>
                    </Card>
                 </div>
                 {/* Right: Live Preview Container */}
                 <div className="relative flex flex-col items-center sticky top-6 h-fit">
                     <div className="flex gap-2 mb-4 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                         <button onClick={() => setPreviewDevice('mobile')} className={cn("p-2 rounded text-xs font-bold flex items-center gap-2 transition-all", previewDevice === 'mobile' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}><Smartphone className="w-4 h-4" /> Mobile</button>
                         <button onClick={() => setPreviewDevice('desktop')} className={cn("p-2 rounded text-xs font-bold flex items-center gap-2 transition-all", previewDevice === 'desktop' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300")}><Monitor className="w-4 h-4" /> Desktop</button>
                     </div>
                     <div className={cn("relative transition-all duration-500 border-zinc-800 shadow-2xl overflow-hidden ring-4 ring-zinc-900/50", previewDevice === 'mobile' ? "w-[360px] h-[720px] rounded-[40px] border-[8px]" : "w-[640px] h-[480px] rounded-xl border-[1px]")}>
                         <div className="absolute inset-0 z-0" style={{ background: theme?.pageBackground }}></div>
                         <div className="relative z-10 h-full overflow-y-auto custom-scrollbar no-scrollbar flex flex-col p-4 md:p-6">
                             <div className={cn("flex flex-col h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10", previewDevice === 'desktop' && "flex-row h-auto min-h-[380px]")} style={{ backgroundColor: theme?.cardColor, backdropFilter: 'blur(12px)' }}>
                                <div className={cn("relative shrink-0 flex flex-col bg-black/20", previewDevice === 'mobile' ? "w-full min-h-[280px]" : "w-1/3 h-full border-r border-white/10 justify-start")}>
                                     {formData.cover_url && (
                                         <div className={cn("relative z-0 overflow-hidden", previewDevice === 'desktop' ? "h-[140px] w-full" : "absolute inset-0 h-full")}>
                                             <img src={formData.cover_url} className="w-full h-full object-cover" style={{ objectPosition: `center ${theme?.coverOffsetY || 50}%` }} />
                                             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" style={{ opacity: theme?.coverOverlayOpacity ?? 0.6 }}></div>
                                         </div>
                                     )}
                                     <div className={cn("relative z-10 flex flex-col justify-end", previewDevice === 'mobile' ? "h-full p-6" : "p-6 -mt-10")}>
                                         <div className="flex items-center gap-3 mb-4">
                                            <div className="relative shrink-0">
                                                <div className="w-14 h-14 rounded-full border-2 border-white/20 bg-zinc-800 overflow-hidden shadow-lg">
                                                    {currentAvatar ? <img src={currentAvatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">?</div>}
                                                </div>
                                                <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-black" style={{ backgroundColor: theme?.primaryColor }}></div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5" style={{ color: theme?.textColor }}>WANCORA</p>
                                                <h3 className="text-xs font-bold leading-tight" style={{ color: theme?.textColor }}>{user?.name || 'Consultor'}</h3>
                                            </div>
                                         </div>
                                         <h1 className="text-xl font-bold mb-2 leading-tight" style={ theme?.titleGradient ? { backgroundImage: `linear-gradient(to right, ${theme.titleGradient[0]}, ${theme.titleGradient[1]})`, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', display: 'inline-block', width: 'fit-content' } : { color: theme?.textColor } }>{formData.name}</h1>
                                         <p className="text-xs opacity-70 mb-4" style={{ color: theme?.textColor }}>{formData.event_goal}</p>
                                         <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg border border-white/5 bg-white/5" style={{ color: theme?.textColor }}>
                                                <Clock className="w-3 h-3" style={{ color: theme?.primaryColor }} /><span className="font-medium">{formData.slot_duration} min</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg border border-white/5 bg-white/5" style={{ color: theme?.textColor }}>
                                                <MapPin className="w-3 h-3 text-blue-400" /><span className="font-medium">{formData.event_location_details || 'Online'}</span>
                                            </div>
                                         </div>
                                     </div>
                                </div>
                                <div className={cn("flex-1 p-6 relative flex flex-col gap-4", previewDevice === 'mobile' ? "" : "overflow-y-auto")}>
                                     <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold" style={{ color: theme?.textColor }}>Setembro 2024</span>
                                        <div className="flex gap-1"><div className="w-6 h-6 rounded bg-white/5 border border-white/10"></div><div className="w-6 h-6 rounded bg-white/5 border border-white/10"></div></div>
                                     </div>
                                     <div className="grid grid-cols-7 gap-2 text-center opacity-50 mb-1">{['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-[9px]" style={{ color: theme?.textColor }}>{d}</span>)}</div>
                                     <div className="grid grid-cols-7 gap-2">
                                         {Array.from({length: 28}).map((_, i) => (
                                             <div key={i} className={cn("aspect-square rounded-full flex items-center justify-center text-[10px]", i === 14 ? "font-bold text-black" : "opacity-60")} style={{ backgroundColor: i === 14 ? theme?.primaryColor : 'transparent', color: i === 14 ? '#000' : theme?.textColor }}>{i+1}</div>
                                         ))}
                                     </div>
                                </div>
                             </div>
                         </div>
                         {previewDevice === 'mobile' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-xl z-20"></div>}
                     </div>
                     <div className="mt-4 flex gap-2">
                         <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">Abrir Página Real <ExternalLink className="w-3 h-3" /></a>
                     </div>
                 </div>
             </div>
        )}

        {/* --- NOTIFICATIONS TAB (RESTAURADA) --- */}
        {activeTab === 'notifications' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right-4">
                
                {/* 1. Seleção de Instância */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                            <SmartphoneIcon className="w-5 h-5 text-green-500" /> Dispositivo de Envio
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-zinc-400 text-sm mb-4">Escolha qual WhatsApp conectado enviará os avisos automáticos.</p>
                        <select 
                            value={notifConfig.sending_session_id}
                            onChange={(e) => setNotifConfig({ ...notifConfig, sending_session_id: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="">Selecione uma instância...</option>
                            {instances.map(inst => (
                                <option key={inst.id} value={inst.session_id}>
                                    {inst.name} ({inst.status})
                                </option>
                            ))}
                        </select>
                    </CardContent>
                </Card>

                {/* 2. Admin Settings */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-yellow-500" /> Avisos para o Admin (Você)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Número do Admin (Com DDI)</label>
                            <Input 
                                placeholder="5511999999999" 
                                value={notifConfig.admin_phone || ''}
                                onChange={(e) => setNotifConfig({ ...notifConfig, admin_phone: e.target.value.replace(/\D/g, '') })}
                                className="bg-zinc-950 border-zinc-800"
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">Este número receberá um alerta quando alguém agendar.</p>
                        </div>
                        
                        {/* Rules List */}
                        <div className="space-y-4">
                            {notifConfig.admin_notifications?.map((rule: any) => (
                                <NotificationRuleEditor 
                                    key={rule.id} 
                                    rule={rule} 
                                    onUpdate={(key, val) => updateRule('admin', rule.id, key, val)}
                                    onRemove={() => removeRule('admin', rule.id)}
                                    onTag={(tag) => insertTag('admin', rule.id, tag)}
                                />
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addRule('admin')} className="w-full border-dashed border-zinc-700 hover:bg-zinc-800">
                                <Plus className="w-4 h-4 mr-2" /> Adicionar Regra
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Lead Settings */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-500" /> Avisos para o Cliente (Lead)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p className="text-sm text-zinc-400">Configure as mensagens que o cliente receberá ao agendar.</p>
                        <div className="space-y-4">
                            {notifConfig.lead_notifications?.map((rule: any) => (
                                <NotificationRuleEditor 
                                    key={rule.id} 
                                    rule={rule} 
                                    onUpdate={(key, val) => updateRule('lead', rule.id, key, val)}
                                    onRemove={() => removeRule('lead', rule.id)}
                                    onTag={(tag) => insertTag('lead', rule.id, tag)}
                                />
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addRule('lead')} className="w-full border-dashed border-zinc-700 hover:bg-zinc-800">
                                <Plus className="w-4 h-4 mr-2" /> Adicionar Regra
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

      </div>
      
      {/* --- AVATAR CROP MODAL --- */}
      {cropModalOpen && tempAvatarUrl && (
          <AvatarCropModal 
             isOpen={cropModalOpen}
             imageSrc={tempAvatarUrl}
             onClose={() => {
                 setCropModalOpen(false);
                 setTempAvatarFile(null);
                 if(tempAvatarUrl) URL.revokeObjectURL(tempAvatarUrl);
                 setTempAvatarUrl(null);
             }}
             onConfirm={handleCroppedUpload}
          />
      )}
    </div>
  );
}

// --- SUBCOMPONENTE: EDITOR DE REGRA ---
function NotificationRuleEditor({ rule, onUpdate, onRemove, onTag }: any) {
    const [showEmoji, setShowEmoji] = useState(false);
    const [showTagMenu, setShowTagMenu] = useState(false);
    const tagMenuRef = useRef<HTMLDivElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
                setShowEmoji(false);
            }
            if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
                setShowTagMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleEmojiClick = (emojiData: any) => {
        onUpdate('template', rule.template + emojiData.emoji);
    };

    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 relative group">
            <button onClick={onRemove} className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
            </button>
            
            <div className="flex gap-4 mb-4">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Gatilho</label>
                    <select 
                        value={rule.type} 
                        onChange={(e) => onUpdate('type', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded text-xs p-2 text-white"
                    >
                        <option value="on_booking">Ao Agendar (Imediato)</option>
                        <option value="before_event">Antes do Evento (Lembrete)</option>
                    </select>
                </div>
                
                {rule.type === 'before_event' && (
                    <div className="flex gap-2 items-end">
                        <div>
                             <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Tempo</label>
                             <Input 
                                type="number" 
                                value={rule.time_amount} 
                                onChange={(e) => onUpdate('time_amount', e.target.value)} 
                                className="w-16 h-9 text-xs bg-zinc-900 border-zinc-800"
                             />
                        </div>
                        <div>
                             <select 
                                value={rule.time_unit} 
                                onChange={(e) => onUpdate('time_unit', e.target.value)}
                                className="h-9 bg-zinc-900 border border-zinc-800 rounded text-xs p-2 text-white"
                             >
                                 <option value="minutes">Minutos</option>
                                 <option value="hours">Horas</option>
                                 <option value="days">Dias</option>
                             </select>
                        </div>
                    </div>
                )}
                
                <div className="flex items-end pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Ativo</span>
                        <div 
                            onClick={() => onUpdate('active', !rule.active)}
                            className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", rule.active ? "bg-green-600" : "bg-zinc-800")}
                        >
                            <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", rule.active ? "left-4.5" : "left-0.5")} />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-1">
                     <label className="text-[10px] font-bold text-zinc-500 uppercase">Mensagem</label>
                     <div className="flex gap-1 items-center relative">
                         {/* Tag Menu Button */}
                         <div className="relative" ref={tagMenuRef}>
                             <button 
                                onClick={() => setShowTagMenu(!showTagMenu)}
                                className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center gap-1"
                             >
                                <Tag className="w-3 h-3" /> Config Tags
                             </button>
                             {showTagMenu && (
                                <div className="absolute right-0 top-7 z-50 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 animate-in fade-in zoom-in-95">
                                    <div className="px-2 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/50 rounded-t mb-1">
                                        Variáveis Dinâmicas
                                    </div>
                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
                                        {TAGS.map(tag => (
                                            <button 
                                                key={tag.value} 
                                                onClick={() => { onTag(tag.value); setShowTagMenu(false); }}
                                                className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 rounded hover:text-white transition-colors"
                                            >
                                                {tag.label} <span className="opacity-50 ml-1">{tag.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                             )}
                         </div>

                         {/* Emoji Button */}
                         <div className="relative" ref={emojiRef}>
                             <button 
                                onClick={() => setShowEmoji(!showEmoji)}
                                className={cn(
                                    "text-[10px] border px-2 py-1 rounded transition-colors flex items-center gap-1",
                                    showEmoji ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
                                )}
                             >
                                <Smile className="w-3 h-3" />
                             </button>
                             {showEmoji && (
                                 <div className="absolute right-0 top-8 z-50 shadow-2xl animate-in zoom-in-95 origin-top-right">
                                     <EmojiPicker 
                                        onEmojiClick={handleEmojiClick} 
                                        theme={Theme.DARK} 
                                        width={300} 
                                        height={350} 
                                        searchDisabled 
                                        skinTonesDisabled 
                                        previewConfig={{ showPreview: false }}
                                     />
                                 </div>
                             )}
                         </div>
                     </div>
                </div>
                <Textarea 
                    value={rule.template} 
                    onChange={(e) => onUpdate('template', e.target.value)}
                    className="bg-zinc-900 border-zinc-800 min-h-[80px] text-sm font-mono"
                    placeholder="Escreva a mensagem..."
                />
                <p className="text-[10px] text-zinc-600 mt-1 flex justify-between">
                    <span>Use *asteriscos* para negrito e _underscores_ para itálico.</span>
                    <span>{rule.template.length} caracteres</span>
                </p>
            </div>
        </div>
    );
}

// --- SUBCOMPONENTE: MODAL DE RECORTE (CANVAS) ---
function AvatarCropModal({ isOpen, imageSrc, onClose, onConfirm }: { isOpen: boolean, imageSrc: string, onClose: () => void, onConfirm: (blob: Blob) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            setImage(img);
            const ratio = Math.min(300 / img.width, 300 / img.height);
            setScale(Math.max(ratio, 0.5)); 
        };
    }, [imageSrc]);

    useEffect(() => {
        if (!image || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 300, 300);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 300, 300);
        ctx.save();
        ctx.translate(150, 150);
        ctx.scale(scale, scale);
        ctx.translate(pos.x, pos.y);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        ctx.restore();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(150, 150, 150, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }, [image, scale, pos]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;
        setPos(p => ({ x: p.x + dx, y: p.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleConfirm = () => {
        if (!canvasRef.current) return;
        canvasRef.current.toBlob((blob) => {
            if (blob) onConfirm(blob);
        }, 'image/png');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Foto" maxWidth="sm">
            <div className="flex flex-col items-center gap-4">
                <div 
                    className="w-[300px] h-[300px] border-2 border-zinc-700 rounded-full overflow-hidden cursor-move relative shadow-2xl bg-black"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                >
                    <canvas ref={canvasRef} width={300} height={300} className="w-full h-full" />
                    <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"></div>
                </div>
                <div className="w-full space-y-2 px-4">
                    <label className="text-xs font-bold text-zinc-500 uppercase flex justify-between">Zoom <ZoomIn className="w-3 h-3" /></label>
                    <input type="range" min="0.1" max="3" step="0.05" value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex gap-2 w-full pt-4">
                    <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button onClick={handleConfirm} className="flex-1 bg-primary text-black hover:bg-primary/90">Salvar Foto</Button>
                </div>
            </div>
        </Modal>
    );
}
