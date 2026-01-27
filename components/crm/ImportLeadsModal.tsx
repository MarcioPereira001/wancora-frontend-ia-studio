
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, Download } from 'lucide-react';
import ExcelJS from 'exceljs';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportLeadsModal({ isOpen, onClose, onSuccess }: ImportLeadsModalProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();

  const [step, setStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [stages, setStages] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Carrega Estágios do Funil
  useEffect(() => {
      if (isOpen && user?.company_id) {
          const fetchStages = async () => {
              const { data } = await supabase
                  .from('pipeline_stages')
                  .select('id, name')
                  .eq('company_id', user.company_id)
                  .order('position');
              if (data) {
                  setStages(data);
                  if (data.length > 0) setSelectedStage(data[0].id);
              }
          };
          fetchStages();
          setStep('upload');
          setFile(null);
          setParsedData([]);
          setLogs([]);
      }
  }, [isOpen, user?.company_id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const uploadedFile = e.target.files?.[0];
      if (!uploadedFile) return;

      setFile(uploadedFile);
      setProcessing(true);

      try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(await uploadedFile.arrayBuffer());
          const worksheet = workbook.getWorksheet(1);
          
          if (!worksheet) throw new Error("Planilha vazia ou inválida.");

          const jsonData: any[] = [];
          
          // Assume que a linha 1 é cabeçalho
          worksheet.eachRow((row, rowNumber) => {
              if (rowNumber === 1) return; // Pula cabeçalho
              
              // Mapeamento simples por índice (A=1, B=2...)
              // A: Nome, B: Telefone, C: Email, D: Tags (separadas por virgula), E: Notas
              const name = row.getCell(1).text;
              const phone = row.getCell(2).text?.replace(/\D/g, '');
              const email = row.getCell(3).text;
              const tagsRaw = row.getCell(4).text;
              const notes = row.getCell(5).text;

              if (name && phone) {
                  jsonData.push({
                      name,
                      phone,
                      email,
                      tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : [],
                      notes
                  });
              }
          });

          setParsedData(jsonData);
          setStep('preview');
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro ao ler arquivo', message: error.message });
      } finally {
          setProcessing(false);
      }
  };

  const handleImport = async () => {
      if (!user?.company_id || !selectedStage) return;
      
      setStep('processing');
      setProcessing(true);
      const newLogs: string[] = [];
      let successCount = 0;
      let dupCount = 0;

      // Processamento em Lote (Sequencial para não travar o banco com muitas conexões)
      for (const item of parsedData) {
          try {
              // 1. Verifica Duplicidade
              const { data: existing } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('company_id', user.company_id)
                  .eq('phone', item.phone)
                  .maybeSingle();

              if (existing) {
                  newLogs.push(`⚠️ Duplicado: ${item.name} (${item.phone}) - Ignorado`);
                  dupCount++;
                  continue;
              }

              // 2. Insere
              const { error } = await supabase.from('leads').insert({
                  company_id: user.company_id,
                  pipeline_stage_id: selectedStage,
                  name: item.name,
                  phone: item.phone,
                  email: item.email,
                  tags: item.tags,
                  notes: item.notes,
                  status: 'new',
                  owner_id: user.id,
                  position: Date.now()
              });

              if (error) throw error;
              
              successCount++;
              // Delay artificial pequeno para não estourar rate limit se for mto grande
              if (successCount % 10 === 0) await new Promise(r => setTimeout(r, 50));

          } catch (e: any) {
              newLogs.push(`❌ Erro: ${item.name} - ${e.message}`);
          }
      }

      setLogs(newLogs);
      setProcessing(false);
      addToast({ type: 'success', title: 'Importação Concluída', message: `${successCount} leads importados. ${dupCount} duplicados.` });
      
      setTimeout(() => {
          onSuccess();
          onClose();
      }, 2000);
  };

  const downloadTemplate = () => {
      // Gera um CSV simples para exemplo
      const csvContent = "data:text/csv;charset=utf-8,Nome,Telefone,Email,Tags,Notas\nJoão Silva,5511999999999,joao@email.com,VIP,Interessado em planos";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "template_importacao_wancora.csv");
      document.body.appendChild(link);
      link.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar Leads (XLSX/CSV)" maxWidth="lg">
        <div className="space-y-6 min-h-[300px]">
            
            {step === 'upload' && (
                <div className="flex flex-col items-center justify-center space-y-6 h-full py-8">
                    <div className="w-full max-w-md p-8 border-2 border-dashed border-zinc-700 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors flex flex-col items-center text-center">
                        <Upload className="w-12 h-12 text-zinc-500 mb-4" />
                        <label className="cursor-pointer">
                            <span className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-green-500/20">
                                Escolher Arquivo
                            </span>
                            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                        </label>
                        <p className="text-zinc-500 text-xs mt-4">Suporta arquivos .xlsx e .csv</p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <button onClick={downloadTemplate} className="text-primary text-xs hover:underline flex items-center gap-1">
                            <Download className="w-3 h-3" /> Baixar Planilha Modelo
                        </button>
                        <div className="text-zinc-600 text-[10px] bg-zinc-950 p-2 rounded border border-zinc-800">
                            Colunas: A=Nome | B=Telefone | C=Email | D=Tags (sep. vírgula) | E=Notas
                        </div>
                    </div>
                </div>
            )}

            {step === 'preview' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8 text-green-500" />
                            <div>
                                <p className="text-sm font-bold text-white">{file?.name}</p>
                                <p className="text-xs text-zinc-400">{parsedData.length} registros encontrados</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setParsedData([]); }}>Trocar</Button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Destino (Etapa do Funil)</label>
                        <select 
                            value={selectedStage} 
                            onChange={e => setSelectedStage(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-white"
                        >
                            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar border border-zinc-800 rounded-lg">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                                <tr>
                                    <th className="p-2">Nome</th>
                                    <th className="p-2">Telefone</th>
                                    <th className="p-2">Tags</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 text-zinc-300">
                                {parsedData.slice(0, 20).map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 truncate max-w-[100px]">{row.name}</td>
                                        <td className="p-2 font-mono">{row.phone}</td>
                                        <td className="p-2 truncate max-w-[100px]">{row.tags.join(', ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {parsedData.length > 20 && (
                            <div className="p-2 text-center text-zinc-500 text-xs bg-zinc-900">
                                ...e mais {parsedData.length - 20} linhas
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleImport} className="bg-green-600 hover:bg-green-500 text-white w-full">
                            <Check className="w-4 h-4 mr-2" /> Confirmar Importação
                        </Button>
                    </div>
                </div>
            )}

            {step === 'processing' && (
                <div className="flex flex-col items-center justify-center space-y-6 py-8 animate-in fade-in">
                    {processing ? (
                        <>
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-zinc-400 animate-pulse">Processando leads...</p>
                        </>
                    ) : (
                        <>
                            <Check className="w-12 h-12 text-green-500" />
                            <p className="text-white font-bold">Concluído!</p>
                        </>
                    )}
                    
                    <div className="w-full max-h-[150px] overflow-y-auto bg-zinc-950 p-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-400">
                        {logs.length === 0 ? "Iniciando..." : logs.map((log, i) => <div key={i}>{log}</div>)}
                        {logs.length > 0 && processing && <div>...</div>}
                    </div>
                </div>
            )}
        </div>
    </Modal>
  );
}
