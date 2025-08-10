export interface ErrorResponse {
  statusCode: number;
  message: string;
  code?: string;
  timestamp: string;
  path: string;
  details?: unknown;
}

export interface ValidationError {
  field: string;
  message: string[];
}
