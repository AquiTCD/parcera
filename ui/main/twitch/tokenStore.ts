import { safeStorage, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface TwitchTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // timestamp
}

export class TwitchTokenStore {
  private filePath: string;

  constructor() {
    // Separate file from main config for security/safeStorage
    this.filePath = path.join(app.getPath('userData'), 'twitch_tokens.enc');
  }

  saveTokens(tokens: TwitchTokens): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system.');
    }

    const data = JSON.stringify(tokens);
    const encrypted = safeStorage.encryptString(data);
    fs.writeFileSync(this.filePath, encrypted);
  }

  loadTokens(): TwitchTokens | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[Twitch] safeStorage not available, cannot decrypt tokens.');
      return null;
    }

    try {
      const encrypted = fs.readFileSync(this.filePath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted) as TwitchTokens;
    } catch (e) {
      console.error('[Twitch] Failed to decrypt or parse tokens:', e);
      return null;
    }
  }

  clearTokens(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}

export const twitchTokenStore = new TwitchTokenStore();
