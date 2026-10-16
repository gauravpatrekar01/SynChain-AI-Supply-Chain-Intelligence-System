export interface CopilotHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotResponse {
  reply: string;
  response: string;
  provider: string;
  model?: string | null;
  status: 'success' | 'fallback';
  fallback_reason?: string | null;
  retry_after?: number | null;
  sources?: Record<string, unknown>;
}

export type ReportFocus = 'overview' | 'inventory' | 'suppliers' | 'shipments';

export interface AIReport {
  focus: ReportFocus;
  summary: string;
  findings: Array<{
    title: string;
    detail: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    metric_keys: string[];
  }>;
  recommended_actions: Array<{
    action: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    metric_keys: string[];
  }>;
  source_metrics: Record<string, number | null>;
  generated_at: string;
  snapshot_at: string;
  provider: 'gemini' | 'local';
  model?: string | null;
  fallback: boolean;
  limitations: string[];
}
