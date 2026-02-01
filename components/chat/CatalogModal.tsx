
'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { Loader2, ShoppingBag, Send, RefreshCw } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendProduct: (product: any) => void;
}

export function CatalogModal({ isOpen, onClose, onSendProduct }: CatalogModalProps) {
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const { selectedInstance } = useChatStore();
  const supabase = createClient();
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchProducts = async () => {
      setLoading(true);
      try {
          const { data } = await supabase
              .from('products')
              .select('*')
              .eq('company_id', user?.company_id)
              .eq('is_hidden', false);
          setProducts(data || []);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      if (isOpen && user?.company_id) {
          fetchProducts();
      }
  }, [isOpen, user?.company_id]);

  const handleSync = async () => {
      if (!selectedInstance) return;
      setSyncing(true);
      try {
          const res = await api.post('/management/catalog/sync', {
              sessionId: selectedInstance.session_id,
              companyId: user?.company_id
          });
          
          if (res.result?.products?.length === 0) {
              addToast({ type: 'info', title: 'Catálogo Vazio', message: 'Nenhum produto encontrado no WhatsApp Business.' });
          } else {
              addToast({ type: 'success', title: 'Sincronizado', message: `${res.result?.count} produtos atualizados.` });
              // Aguarda um pouco para o banco atualizar
              setTimeout(fetchProducts, 500);
          }
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro de Sync', message: e.message || 'Certifique-se que o número é WhatsApp Business.' });
      } finally {
          setSyncing(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Catálogo de Produtos" maxWidth="lg">
        <div className="min-h-[300px] flex flex-col">
            <div className="flex justify-between items-center mb-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-purple-500" />
                    <p className="text-sm text-zinc-300">Produtos do WhatsApp Business</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="text-xs h-8 border-zinc-700 bg-zinc-900 hover:bg-zinc-800">
                    {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                    Sincronizar
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : products.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 flex flex-col items-center">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-bold text-zinc-400">Nenhum produto encontrado.</p>
                        <p className="text-xs mt-2 max-w-xs opacity-70">
                            Certifique-se de que sua conta é WhatsApp Business e você cadastrou produtos no aplicativo oficial.
                        </p>
                        <Button variant="ghost" size="sm" onClick={fetchProducts} className="mt-4 text-xs"><RefreshCw className="w-3 h-3 mr-1" /> Recarregar lista</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {products.map(p => (
                            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden group hover:border-zinc-600 transition-colors">
                                <div className="h-32 bg-zinc-800 relative flex items-center justify-center overflow-hidden">
                                    {p.image_url ? (
                                        <img src={p.image_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <ShoppingBag className="text-zinc-700 w-8 h-8" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button size="sm" onClick={() => onSendProduct(p)} className="bg-green-600 hover:bg-green-500">
                                            <Send className="w-4 h-4 mr-2" /> Enviar
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h4 className="text-sm font-bold text-white truncate" title={p.name}>{p.name}</h4>
                                    <p className="text-xs text-zinc-400 mt-1 font-mono">
                                        {p.currency || 'BRL'} {p.price?.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </Modal>
  );
}
