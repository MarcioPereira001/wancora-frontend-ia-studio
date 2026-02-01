import { createClient } from './client';

export const uploadChatMedia = async (file: File, companyId: string) => {
  const supabase = createClient();
  
  // Limpa caracteres especiais mas MANTÉM a extensão e legibilidade
  const fileExt = file.name.split('.').pop();
  const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
  const cleanName = fileNameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
  
  // Gera caminho: company_id/timestamp_nome.ext
  const finalName = `${Date.now()}_${cleanName}.${fileExt}`;
  const filePath = `${companyId}/${finalName}`;

  const { data, error } = await supabase.storage
    .from('chat-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Erro upload:", error);
    throw new Error(`Erro upload: ${error.message}`);
  }

  // Pega a URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('chat-media')
    .getPublicUrl(filePath);

  // Retorna o nome original do arquivo para exibição no chat
  return { publicUrl, fileName: file.name }; 
};