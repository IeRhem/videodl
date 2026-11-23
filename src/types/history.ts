export type HistoryStatus = 'completed' | 'failed' | 'cancelled';

export interface HistoryRecord {
  id: string;
  url: string;
  title: string;
  sourceExtractor: string;
  format: string;
  destinationPath: string;
  status: HistoryStatus;
  errorMessage: string | null;
  completedAt: string;
}
