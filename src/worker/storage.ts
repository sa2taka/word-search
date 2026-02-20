export interface DbStorage {
  exists(): Promise<boolean>;
  read(): Promise<Uint8Array>;
  write(data: Uint8Array): Promise<void>;
  remove(): Promise<void>;
  readVersion(): Promise<string | null>;
  writeVersion(version: string): Promise<void>;
  removeVersion(): Promise<void>;
}
