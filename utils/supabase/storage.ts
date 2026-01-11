import { createClient } from './client';

export const uploadChatMedia = async (file: File, companyId: string) => {
  const supabase = createClient();
  
  // Limpa caracteres especiais do nome do arquivo
  const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  // Gera caminho: company_id/timestamp_nome
  const filePath = `${companyId}/${Date.now()}_${cleanName}`;

  const { data, error } = await supabase.storage
    .from('chat-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Erro upload:", error);
    throw new Error("Falha ao fazer upload da mídia.");
  }

  // Pega a URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('chat-media')
    .getPublicUrl(filePath);

  return { publicUrl, fileName: cleanName };
};
