import { DB_FILENAME } from '../shared/constants';
import type { DbStorage } from './storage';

const VERSION_FILENAME = `${DB_FILENAME}.version`;
const SHA256_FILENAME = `${DB_FILENAME}.sha256`;

export class OpfsStorage implements DbStorage {
  private dir: FileSystemDirectoryHandle | null = null;

  private async getDir(): Promise<FileSystemDirectoryHandle> {
    if (!this.dir) {
      this.dir = await navigator.storage.getDirectory();
    }
    return this.dir;
  }

  async exists(): Promise<boolean> {
    try {
      const dir = await this.getDir();
      await dir.getFileHandle(DB_FILENAME);
      return true;
    } catch {
      return false;
    }
  }

  async read(): Promise<Uint8Array> {
    const dir = await this.getDir();
    const handle = await dir.getFileHandle(DB_FILENAME);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async write(data: Uint8Array): Promise<void> {
    const dir = await this.getDir();
    const handle = await dir.getFileHandle(DB_FILENAME, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data.buffer as ArrayBuffer);
    await writable.close();
  }

  async remove(): Promise<void> {
    try {
      const dir = await this.getDir();
      await dir.removeEntry(DB_FILENAME);
    } catch {
      // noop
    }
  }

  async readVersion(): Promise<string | null> {
    try {
      const dir = await this.getDir();
      const handle = await dir.getFileHandle(VERSION_FILENAME);
      const file = await handle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async writeVersion(version: string): Promise<void> {
    const dir = await this.getDir();
    const handle = await dir.getFileHandle(VERSION_FILENAME, { create: true });
    const writable = await handle.createWritable();
    await writable.write(version);
    await writable.close();
  }

  async removeVersion(): Promise<void> {
    try {
      const dir = await this.getDir();
      await dir.removeEntry(VERSION_FILENAME);
    } catch {
      // noop
    }
  }

  async readSha256(): Promise<string | null> {
    try {
      const dir = await this.getDir();
      const handle = await dir.getFileHandle(SHA256_FILENAME);
      const file = await handle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async writeSha256(sha256: string): Promise<void> {
    const dir = await this.getDir();
    const handle = await dir.getFileHandle(SHA256_FILENAME, { create: true });
    const writable = await handle.createWritable();
    await writable.write(sha256);
    await writable.close();
  }

  async removeSha256(): Promise<void> {
    try {
      const dir = await this.getDir();
      await dir.removeEntry(SHA256_FILENAME);
    } catch {
      // noop
    }
  }
}
