export interface HandlerInfo {
  method: string;
  path: string;
}

export interface FetchResult {
  status: number;
  contentType: string | null;
  body: unknown;
  durationMs: number;
}

export interface EvalResult {
  handlers: HandlerInfo[];
  error: string | null;
}
