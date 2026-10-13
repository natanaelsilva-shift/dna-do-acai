export type ServerPrintSettings = {
  automaticEnabled: boolean;
  storeName: string;
  paperWidth: 58 | 80;
  charactersPerLine: number;
  maxAttempts: number;
  updatedAt: string;
};

export type ServerPrintSettingsResponse = {
  settings?: ServerPrintSettings;
  error?: string;
};

export type PrintJobResponse = {
  jobId?: string;
  message?: string;
  error?: string;
};
