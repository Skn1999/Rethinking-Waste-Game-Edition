import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface SseClient {
  id: number;
  res: express.Response;
}

let nextClientId = 1;
const sseClients = new Map<number, SseClient>();
let latestSyncState: { sender: string; payload: unknown; updatedAt: number } | null =
  null;

function broadcastSse(eventName: string, data: unknown): void {
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    try {
      client.res.write(serialized);
    } catch {
      sseClients.delete(id);
    }
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Lightweight live sync relay for Host <-> Stage across browser storage partitions
  app.get('/api/sync/state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      payload: latestSyncState?.payload ?? null,
      updatedAt: latestSyncState?.updatedAt ?? null,
    });
  });

  app.post('/api/sync/state', (req, res) => {
    const body = req.body as { sender?: string; payload?: unknown } | undefined;
    if (!body || !body.payload) {
      res.status(400).json({ error: 'Missing payload' });
      return;
    }
    const sender = typeof body.sender === 'string' ? body.sender : '';
    const updatedAt = Date.now();
    latestSyncState = { sender, payload: body.payload, updatedAt };
    broadcastSse('state', { sender, payload: body.payload, updatedAt });
    res.json({ ok: true, updatedAt });
  });

  app.post('/api/sync/command', (req, res) => {
    const body = req.body as { sender?: string; command?: string } | undefined;
    if (!body || !body.command) {
      res.status(400).json({ error: 'Missing command' });
      return;
    }
    const sender = typeof body.sender === 'string' ? body.sender : '';
    broadcastSse('command', { sender, command: body.command });
    res.json({ ok: true });
  });

  app.get('/api/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const id = nextClientId++;
    sseClients.set(id, { id, res });

    // Send latest state immediately upon connection
    if (latestSyncState) {
      res.write(
        `event: state\ndata: ${JSON.stringify(latestSyncState)}\n\n`
      );
    } else {
      res.write(`: connected\n\n`);
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(id);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(id);
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Who's Sorting? server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
