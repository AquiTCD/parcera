import { BrowserWindow, shell } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import { twitchTokenStore } from './tokenStore';

const PORT = 8677;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

export class TwitchOAuthHandler {
  private server: http.Server | null = null;
  private state: string | null = null;

  async startAuth(clientId: string, clientSecret: string): Promise<void> {
    this.state = crypto.randomBytes(16).toString('hex');

    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'chat:read chat:edit channel:read:subscriptions moderation:read bits:read channel:read:redemptions moderator:read:followers');
    authUrl.searchParams.append('state', this.state);

    this.startLocalServer(clientId, clientSecret);
    shell.openExternal(authUrl.toString());
  }

  private startLocalServer(clientId: string, clientSecret: string) {
    if (this.server) {
      this.server.close();
    }

    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${PORT}`);

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (state !== this.state) {
          res.writeHead(400);
          res.end('State mismatch error.');
          return;
        }

        if (code) {
          try {
            const tokens = await this.exchangeCodeForTokens(clientId, clientSecret, code);
            twitchTokenStore.saveTokens(tokens);

            // Sync with backend immediately
            const { syncTwitchWithBackend } = await import('../index');
            syncTwitchWithBackend();

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f0f0f; color: white;">
                  <h1 style="color: #9146FF;">Authentication Successful!</h1>
                  <p>You can close this window and return to Parcera.</p>
                  <script>setTimeout(() => window.close(), 3000);</script>
                </body>
              </html>
            `);

            // Notify UI
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('twitch-auth-status', { success: true });
            });

          } catch (e: any) {
            console.error('[Twitch] Token exchange failed:', e);
            res.writeHead(500);
            res.end('Authentication failed during token exchange.');
          } finally {
            this.stopLocalServer();
          }
        } else {
          res.writeHead(400);
          res.end('Authorization code missing.');
          this.stopLocalServer();
        }
      }
    });

    this.server.listen(PORT);
  }

  private async exchangeCodeForTokens(clientId: string, clientSecret: string, code: string) {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data: any = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };
  }

  private stopLocalServer() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export const twitchOAuthHandler = new TwitchOAuthHandler();
