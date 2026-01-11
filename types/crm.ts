export interface Lead {
  id: string;
  company_id: string;
  stage_id: string;
  name: string;
  phone: string;
  email?: string;
  value_potential?: number;
  temperature?: 'cold' | 'warm' | 'hot';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  notes?: string;
  created_at?: string;
  owner_id?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
  color: string;
  company_id: string;
  items?: Lead[];
}

export interface PipelineStage {
  id: string;
  pipeline_id?: string;
  name: string;
  position: number;
  color: string;
}