export interface Resource {
  id: string;
  title: string;
  source_url: string;
  source_type: string;
  content: string;
  summary: string;
  last_fetched: string | null;
  linked_ticket_id: string | null;
}

export interface ResourceFetchRequest {
  urls: string[];
  source_type?: string;
  max_content_length?: number;
}

export interface ResourceFetchResponse {
  resources: Resource[];
  errors: Record<string, string>;
}
