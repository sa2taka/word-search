export type SearchMode = 'wildcard' | 'contains' | 'prefix' | 'regex' | 'initial' | 'number-pattern' | 'vowel';
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
  score: number;
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
  | { type: 'RESET_DB' }
  | {
      type: 'WORD_SPLIT';
      lang: Lang;
      query: string;
      limit: number;
      requestId: string;
    }
  | {
      type: 'CROSS_SEARCH';
      lang: Lang;
      query1: string;
      query2: string;
      limit: number;
      requestId: string;
    };

export type EntryPair = [EntryRow, EntryRow];

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
      type: 'WORD_SPLIT_RESULT';
      requestId: string;
      pairs: EntryPair[];
    }
  | {
      type: 'CROSS_SEARCH_RESULT';
      requestId: string;
      pairs: EntryPair[];
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
  | 'DB_OPEN_FAILED'
  | 'REGEX_INVALID'
  | 'SQL_ERROR'
  | 'SEARCH_TIMEOUT'
  | 'WORD_TOO_LONG'
  | 'QUERY_EMPTY';
