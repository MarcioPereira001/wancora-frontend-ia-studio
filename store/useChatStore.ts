
import { create } from 'zustand';
import { ChatContact, Message, Lead, Instance } from '@/types';

interface ChatState {
  // Estado de Seleção
  activeContact: ChatContact | null;
  activeLead: Lead | null;
  selectedInstance: Instance | null;
  
  // Estado de Mensagens
  messages: Message[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  
  // Estado de UI
  searchTerm: string;
  isMsgSelectionMode: boolean;
  selectedMsgIds: Set<string>;
  replyToMessage: Message | null;
  
  // Novo: Indicador de Digitação
  isTyping: boolean;

  // Actions
  setActiveContact: (contact: ChatContact | null) => void;
  setActiveLead: (lead: Lead | null) => void;
  setSelectedInstance: (instance: Instance | null) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (message: Message) => void;
  setLoadingMessages: (loading: boolean) => void;
  setHasMoreMessages: (hasMore: boolean) => void;
  setSearchTerm: (term: string) => void;
  
  // Selection Actions
  toggleMsgSelectionMode: () => void;
  toggleMessageSelection: (id: string) => void;
  clearSelection: () => void;
  
  // Reply Actions
  setReplyToMessage: (message: Message | null) => void;
  
  // Typing Action
  setTyping: (isTyping: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeContact: null,
  activeLead: null,
  selectedInstance: null,
  messages: [],
  loadingMessages: false,
  hasMoreMessages: true,
  searchTerm: '',
  isMsgSelectionMode: false,
  selectedMsgIds: new Set(),
  replyToMessage: null,
  isTyping: false,

  setActiveContact: (contact) => set({ activeContact: contact, isMsgSelectionMode: false, selectedMsgIds: new Set(), replyToMessage: null, isTyping: false }),
  setActiveLead: (lead) => set({ activeLead: lead }),
  setSelectedInstance: (instance) => set({ selectedInstance: instance }),
  
  setMessages: (messagesOrUpdater) => set((state) => ({
    messages: typeof messagesOrUpdater === 'function' ? messagesOrUpdater(state.messages) : messagesOrUpdater
  })),
  
  addMessage: (message) => set((state) => {
      // Evita duplicatas
      if (state.messages.some(m => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
  }),

  setLoadingMessages: (loading) => set({ loadingMessages: loading }),
  setHasMoreMessages: (hasMore) => set({ hasMoreMessages: hasMore }),
  setSearchTerm: (term) => set({ searchTerm: term }),

  toggleMsgSelectionMode: () => set((state) => ({ 
      isMsgSelectionMode: !state.isMsgSelectionMode,
      selectedMsgIds: new Set() 
  })),

  toggleMessageSelection: (id) => set((state) => {
      const newSet = new Set(state.selectedMsgIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { selectedMsgIds: newSet };
  }),

  clearSelection: () => set({ isMsgSelectionMode: false, selectedMsgIds: new Set() }),
  
  setReplyToMessage: (message) => set({ replyToMessage: message }),
  
  setTyping: (isTyping) => set({ isTyping }),
}));
