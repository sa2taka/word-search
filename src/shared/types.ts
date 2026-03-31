export type SearchMode = 'contains' | 'prefix' | 'regex';
export type DbStatus = 'idle' | 'downloading' | 'ready' | 'error' | 'updatable';
export type Lang = 'ja' | 'en';

export interface DictMeta {
  version: string;
  url: string;
  compression?: 'br' | 'gz';
  sha256: string;
  bytes: number;
  created_at: string;
  schema: number;
  sources: DictSource[];
}

export interface DictSource {
  name: string;
  license: string;
  version?: string;
  attribution?: string;
  notice_url?: string;
}

export interface EntryRow {
  id: number;
  lang: Lang;
  word: string;
  pos?: string;
  sources: string[];
}

export type WorkerRequest =
  | { type: 'INIT'; metaUrl: string }
  | {
      type: 'SEARCH';
      mode: SearchMode;
      lang: Lang;
      query: string;
      limit: number;
      offset: number;
      requestId: string;
    }
  | { type: 'CANCEL'; requestId: string }
  | { type: 'CHECK_UPDATE'; metaUrl: string }
  | { type: 'UPDATE_DB'; metaUrl: string }
  | { type: 'RESET_DB' };

export type WorkerResponse =
  | {
      type: 'STATUS';
      status: DbStatus;
      message?: string;
      version?: string;
      progress?: number;
      sources?: DictSource[];
    }
  | {
      type: 'SEARCH_RESULT';
      requestId: string;
      totalApprox?: number;
      items: EntryRow[];
    }
  | {
      type: 'ERROR';
      requestId?: string;
      code: ErrorCode;
      message: string;
    };

export type ErrorCode =
  | 'META_FETCH_FAILED'
  | 'DB_DOWNLOAD_FAILED'
  | 'DB_HASH_MISMATCH'
  | 'DB_OPEN_FAILED'
  | 'REGEX_INVALID'
  | 'SQL_ERROR'
  | 'SEARCH_TIMEOUT';
