import type { DictSource, Lang } from '../../src/shared/types';

export interface EntryInput {
  lang: Lang;
  word: string;
  pos?: string;
  source: string;
}

export interface LicenseFile {
  filename: string;
  content: string;
}

export interface DictSourcePlugin {
  readonly id: string;
  readonly sourceInfo: DictSource;
  readonly licenseFile: LicenseFile;
  download(cacheDir: string, force?: boolean): Promise<string>;
  parse(downloadedPath: string): AsyncIterable<EntryInput>;
}

export interface BuildOptions {
  outDir: string;
  cacheDir: string;
  force: boolean;
}
