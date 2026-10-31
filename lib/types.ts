export interface Folder { id: string; name: string; color: string; count: number; parent_id?: string | null }
export interface Document {
  id: string; title: string; authors: string[]; year?: number; kind: string;
  folder_id: string | null; status: string; page_count: number; created_at: string;
  source_url?: string; license?: string; summary?: string; file_size?: number;
  is_starter?: boolean; error?: string;
  pages?: { page_number: number; text: string }[];
}
export interface SearchResult { document: Document; page_number: number; excerpt: string; score: number; match_type: string; location_label?: string; start_char?: number; end_char?: number }
export type DiscoveryKind = 'any' | 'book' | 'paper';
export interface DiscoveryAsset { url: string; format: string; mime_type?: string; access_status?: string; license?: string }
export interface Discovery {
  id: string; title: string; authors: string[]; year?: number; source: string; source_url: string;
  read_url?: string; import_url?: string; format?: string; assets?: DiscoveryAsset[];
  pdf_url?: string; doi?: string; license?: string; importable: boolean; access_reason?: string;
  access_status?: string; verification_status?: string; version?: string; summary?: string;
}
export interface Status { mode: string; storage: string; embedding_model: string; embedding_ready: boolean; auth_required: boolean; [key: string]: unknown }
export interface Job { id: string; status: string; stage: string; document_id?: string; error?: string }
export type SearchMode = 'discover' | 'search' | 'ask';
