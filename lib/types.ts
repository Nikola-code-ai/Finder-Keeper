export interface Folder { id: string; name: string; color: string; count: number; parent_id?: string | null; published?: boolean; published_at?: string | null; description?: string }

// The commons: readers, reading flows, open shelves, reviews, comments.
export interface ReaderProfile {
  handle: string | null; display_name: string; bio: string; joined?: string;
  owner?: boolean; you?: boolean; following?: boolean;
  shelf_count?: number; flow_count?: number; review_count?: number; follower_count?: number; following_count?: number;
}
export type FlowStepKind = 'start' | 'read' | 'choice' | 'synthesize' | 'note';
export interface FlowDocument { id: string; title: string; authors?: string[] | null; year?: number | null; kind?: string | null; page_count?: number | null; license?: string | null; source_url?: string | null; is_starter?: boolean | null; readable?: boolean }
export interface FlowStep { id: string; kind: FlowStepKind; title: string; note?: string; document?: FlowDocument; page?: number; location?: string; excerpt?: string; query?: string; detour?: boolean }
export interface FlowEdge { from: string; to: string; label?: string }
export interface FlowGraph { steps: FlowStep[]; edges: FlowEdge[] }
export interface Flow {
  id: string; owner_id: string; title: string; goal: string; description: string; folder_id: string | null; folder_name?: string | null;
  graph: FlowGraph; source: string; model?: string | null; published: boolean; published_at?: string | null; created_at: string; updated_at: string;
  author: ReaderProfile; progress: string[]; step_count: number; done_count: number; complete: boolean; comment_count: number; reader_count: number; href: string;
}
export interface Shelf { id: string; name: string; color: string; description: string; published_at?: string | null; count: number; comment_count: number; author: ReaderProfile; href: string; documents?: (Document & { readable: boolean })[] }
export interface Review { id: string; document_id: string | null; work_key: string; title: string; authors: string[]; year?: number | null; rating: number; body: string; created_at: string; updated_at: string; author: ReaderProfile; href?: string | null }
export type CommentTarget = 'shelf' | 'flow' | 'review';
export interface Comment { id: string; target_kind: CommentTarget; target_id: string; body: string; created_at: string; author: ReaderProfile; owner_id: string }
export interface FeedItem { kind: 'shelf' | 'flow' | 'review' | 'comment'; id: string; at: string; title: string; summary: string; author: ReaderProfile; href: string; rating?: number; work_key?: string; target_kind?: CommentTarget }
export interface ReaderPage extends ReaderProfile { shelves: Shelf[]; flows: Flow[]; reviews: Review[] }
export interface SharedCollection { id: string; name: string; color: string; owner_email: string; role: string; count: number; documents: Document[] }
export interface Share { id: string; folder_id: string; email: string | null; role: string; link: string | null; owner_email: string; folder_name?: string | null }
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
