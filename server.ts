import crypto from 'node:crypto';
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

interface ServerQuestion {
  id: string;
  type: 'multiple-choice' | 'which-bin' | 'true-false' | 'discussion';
  category: string;
  prompt: string;
  promptFi?: string;
  image?: string;
  options: string[];
  optionsFi?: string[];
  answer?: number;
  explanation: string;
  explanationFi?: string;
  notes?: string;
}

interface ServerRoundRecord {
  questionId: string;
  number: number | null;
  selectedOption: number | null;
  correct: boolean | null;
  timestamp: number;
}

interface ServerGamePayload {
  settings: {
    eventName: string;
    eventMeta: string;
    range: { min: number; max: number };
    excluded: number[];
    timerSeconds: number;
    sound: boolean;
    reducedMotion: boolean;
    allowRepeats: boolean;
    absentCooldownRounds: number;
    shuffle: boolean;
    languageMode: 'bilingual' | 'en' | 'fi';
  };
  questions: ServerQuestion[];
  order: string[];
  currentIndex: number;
  phase: 'idle' | 'question' | 'drawing' | 'drawn' | 'answering' | 'revealed' | 'finale';
  numbers: Record<number, string>;
  absentAtRound: Record<number, number>;
  currentNumber: number | null;
  selectedOption: number | null;
  roundOutcomeOverride: boolean | null;
  rounds: ServerRoundRecord[];
  history: unknown[];
  timerStatus: 'idle' | 'running' | 'paused';
  timerRemainingMs: number;
  timerStartedAt: number | null;
  drawAnimation: {
    target: number;
    candidates: number[];
    startedAt: number;
  } | null;
  poolEmptyPrompt: boolean;
  lastAnsweredByPhone?: {
    number: number;
    optionIndex: number;
    correct: boolean | null;
    timestamp: number;
  } | null;
}

interface GuestSession {
  number: number;
  joinedAt: number;
}

interface SanitizedGuestQuestion {
  id: string;
  type: ServerQuestion['type'];
  category: string | null;
  prompt: string;
  promptFi?: string;
  image?: string;
  options: string[];
  optionsFi?: string[];
  answer?: number;
  explanation?: string;
  explanationFi?: string;
}

interface SanitizedGuestState {
  eventName: string;
  eventMeta: string;
  languageMode: 'bilingual' | 'en' | 'fi';
  reducedMotion: boolean;
  phase: ServerGamePayload['phase'];
  currentIndex: number;
  totalQuestions: number;
  currentNumber: number | null;
  selectedOption: number | null;
  roundOutcomeOverride: boolean | null;
  timerStatus: ServerGamePayload['timerStatus'];
  timerRemainingMs: number;
  timerStartedAt: number | null;
  timerSeconds: number;
  checkedInCount: number;
  currentQuestion: SanitizedGuestQuestion | null;
  finaleStats: {
    played: number;
    correct: number;
    scoredCount: number;
    accuracy: number;
  } | null;
  updatedAt: number;
}

let nextClientId = 1;
const sseClients = new Map<number, SseClient>();
const guestSseClients = new Map<number, SseClient>();
const guestsByToken = new Map<string, GuestSession>();
const checkedInNumbers = new Set<number>();

let latestSyncState: {
  sender: string;
  payload: ServerGamePayload;
  updatedAt: number;
} | null = null;

function isValidGamePayload(value: unknown): value is ServerGamePayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServerGamePayload>;
  return Boolean(
    candidate.settings &&
      typeof candidate.settings === 'object' &&
      Array.isArray(candidate.questions) &&
      candidate.questions.length > 0 &&
      typeof candidate.phase === 'string'
  );
}

function getSortedCheckedInNumbers(): number[] {
  return Array.from(checkedInNumbers).sort((a, b) => a - b);
}

function getLiveRemainingMs(payload: ServerGamePayload): number {
  if (payload.timerStatus !== 'running' || payload.timerStartedAt === null) {
    return Math.max(0, payload.timerRemainingMs);
  }
  const elapsed = Date.now() - payload.timerStartedAt;
  return Math.max(0, payload.timerRemainingMs - elapsed);
}

/**
 * Produces a strictly spoiler-free state snapshot for guest phones:
 * - Never includes host-only presenter `notes`
 * - Hides the question completely until phase is `answering` or `revealed`
 * - Strips `answer`, `explanation`, and `which-bin` category until `phase === 'revealed'`
 * - Hides `currentNumber` while the slot roll is still spinning (`phase === 'drawing'`)
 */
function sanitizeStateForGuest(
  payload: ServerGamePayload | null | undefined,
  updatedAt: number
): SanitizedGuestState {
  if (!payload) {
    return {
      eventName: 'Rethinking Waste Cookout',
      eventMeta: 'Sort smart · Cookout Edition',
      languageMode: 'bilingual',
      reducedMotion: false,
      phase: 'idle',
      currentIndex: 0,
      totalQuestions: 0,
      currentNumber: null,
      selectedOption: null,
      roundOutcomeOverride: null,
      timerStatus: 'idle',
      timerRemainingMs: 30000,
      timerStartedAt: null,
      timerSeconds: 30,
      checkedInCount: checkedInNumbers.size,
      currentQuestion: null,
      finaleStats: null,
      updatedAt,
    };
  }

  const isRevealed = payload.phase === 'revealed';
  const showQuestionToGuest = payload.phase === 'answering' || isRevealed;
  const activeQId = Array.isArray(payload.order)
    ? payload.order[payload.currentIndex]
    : undefined;
  const rawQuestion = activeQId
    ? payload.questions.find((q) => q.id === activeQId) ?? null
    : null;

  let currentQuestion: SanitizedGuestQuestion | null = null;
  if (showQuestionToGuest && rawQuestion) {
    currentQuestion = {
      id: rawQuestion.id,
      type: rawQuestion.type,
      category:
        rawQuestion.type === 'which-bin' && !isRevealed
          ? null
          : rawQuestion.category,
      prompt: rawQuestion.prompt,
      promptFi: rawQuestion.promptFi,
      image: rawQuestion.image,
      options: rawQuestion.options,
      optionsFi: rawQuestion.optionsFi,
      ...(isRevealed
        ? {
            answer: rawQuestion.answer,
            explanation: rawQuestion.explanation,
            explanationFi: rawQuestion.explanationFi,
          }
        : {}),
    };
  }

  let finaleStats: SanitizedGuestState['finaleStats'] = null;
  if (payload.phase === 'finale') {
    const rounds = Array.isArray(payload.rounds) ? payload.rounds : [];
    const scored = rounds.filter((r) => r.correct !== null);
    const correct = scored.filter((r) => r.correct === true).length;
    finaleStats = {
      played: rounds.length,
      correct,
      scoredCount: scored.length,
      accuracy: scored.length > 0 ? Math.round((correct / scored.length) * 100) : 0,
    };
  }

  return {
    eventName: payload.settings.eventName,
    eventMeta: payload.settings.eventMeta,
    languageMode: payload.settings.languageMode,
    reducedMotion: payload.settings.reducedMotion,
    phase: payload.phase,
    currentIndex: payload.currentIndex,
    totalQuestions: Array.isArray(payload.order) ? payload.order.length : 0,
    // Do not reveal winning number to phones before the slot-machine roll finishes
    currentNumber: payload.phase === 'drawing' ? null : payload.currentNumber,
    selectedOption: payload.selectedOption,
    roundOutcomeOverride: isRevealed ? payload.roundOutcomeOverride : null,
    timerStatus: payload.timerStatus,
    timerRemainingMs: payload.timerRemainingMs,
    timerStartedAt: payload.timerStartedAt,
    timerSeconds: payload.settings.timerSeconds,
    checkedInCount: checkedInNumbers.size,
    currentQuestion,
    finaleStats,
    updatedAt,
  };
}

function broadcastToPool(
  pool: Map<number, SseClient>,
  eventName: string,
  data: unknown
): void {
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of pool.entries()) {
    try {
      client.res.write(serialized);
    } catch {
      pool.delete(id);
    }
  }
}

function broadcastGuests(): void {
  const numbers = getSortedCheckedInNumbers();
  const payload = {
    checkedInNumbers: numbers,
    count: numbers.length,
    updatedAt: Date.now(),
  };
  broadcastToPool(sseClients, 'guests', payload);
  broadcastToPool(guestSseClients, 'guests', payload);
}

function broadcastGameState(sender: string, payload: ServerGamePayload, updatedAt: number): void {
  broadcastToPool(sseClients, 'state', { sender, payload, updatedAt });
  broadcastToPool(
    guestSseClients,
    'guest_state',
    sanitizeStateForGuest(payload, updatedAt)
  );
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,128})$/.exec(header.trim());
  return match ? match[1] : null;
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
      checkedInNumbers: getSortedCheckedInNumbers(),
    });
  });

  app.post('/api/sync/state', (req, res) => {
    const body = req.body as { sender?: string; payload?: unknown } | undefined;
    if (!body || !isValidGamePayload(body.payload)) {
      res.status(400).json({ error: 'Invalid or missing game state payload' });
      return;
    }
    const sender = typeof body.sender === 'string' ? body.sender : '';
    const updatedAt = Date.now();
    latestSyncState = { sender, payload: body.payload, updatedAt };
    broadcastGameState(sender, body.payload, updatedAt);
    res.json({ ok: true, updatedAt });
  });

  app.post('/api/sync/command', (req, res) => {
    const body = req.body as { sender?: string; command?: string } | undefined;
    if (!body || typeof body.command !== 'string' || !body.command.trim()) {
      res.status(400).json({ error: 'Missing command' });
      return;
    }
    const sender = typeof body.sender === 'string' ? body.sender : '';
    broadcastToPool(sseClients, 'command', { sender, command: body.command });
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

    if (latestSyncState) {
      res.write(`event: state\ndata: ${JSON.stringify(latestSyncState)}\n\n`);
    } else {
      res.write(`: connected\n\n`);
    }

    const numbers = getSortedCheckedInNumbers();
    res.write(
      `event: guests\ndata: ${JSON.stringify({
        checkedInNumbers: numbers,
        count: numbers.length,
        updatedAt: Date.now(),
      })}\n\n`
    );

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

  // ---------------------------------------------------------------------------
  // Guest Check-In, Sanitized Live Stream & Exclusive Turn Answering API
  // ---------------------------------------------------------------------------

  app.get('/api/guests', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const numbers = getSortedCheckedInNumbers();
    res.json({
      checkedInNumbers: numbers,
      count: numbers.length,
    });
  });

  app.post('/api/guests/join', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rangeMin = Math.max(
      1,
      Number(latestSyncState?.payload?.settings?.range?.min) || 1
    );
    const rangeMax = Math.min(
      999,
      Math.max(rangeMin, Number(latestSyncState?.payload?.settings?.range?.max) || 60)
    );
    const excludedSet = new Set<number>(
      Array.isArray(latestSyncState?.payload?.settings?.excluded)
        ? latestSyncState!.payload.settings.excluded
        : []
    );

    let assignedNumber: number | null = null;
    for (let n = rangeMin; n <= rangeMax; n++) {
      if (!excludedSet.has(n) && !checkedInNumbers.has(n)) {
        assignedNumber = n;
        break;
      }
    }

    if (assignedNumber === null) {
      res.status(409).json({
        error: `All guest numbers (${rangeMin}–${rangeMax}) are currently claimed.`,
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    guestsByToken.set(token, {
      number: assignedNumber,
      joinedAt: Date.now(),
    });
    checkedInNumbers.add(assignedNumber);
    broadcastGuests();

    const updatedAt = latestSyncState?.updatedAt ?? Date.now();
    res.status(201).json({
      number: assignedNumber,
      token,
      checkedInCount: checkedInNumbers.size,
      gameState: sanitizeStateForGuest(latestSyncState?.payload, updatedAt),
    });
  });

  app.post('/api/guests/reset', (_req, res) => {
    guestsByToken.clear();
    checkedInNumbers.clear();
    broadcastGuests();
    broadcastToPool(guestSseClients, 'guest_reset', { resetAt: Date.now() });
    res.json({ ok: true, checkedInNumbers: [] });
  });

  app.get('/api/guests/state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const updatedAt = latestSyncState?.updatedAt ?? Date.now();
    res.json({
      state: sanitizeStateForGuest(latestSyncState?.payload, updatedAt),
      updatedAt,
      checkedInCount: checkedInNumbers.size,
    });
  });

  app.get('/api/guests/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const id = nextClientId++;
    guestSseClients.set(id, { id, res });

    const updatedAt = latestSyncState?.updatedAt ?? Date.now();
    res.write(
      `event: guest_state\ndata: ${JSON.stringify(
        sanitizeStateForGuest(latestSyncState?.payload, updatedAt)
      )}\n\n`
    );
    res.write(
      `event: guests\ndata: ${JSON.stringify({
        checkedInNumbers: getSortedCheckedInNumbers(),
        count: checkedInNumbers.size,
        updatedAt: Date.now(),
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(heartbeat);
        guestSseClients.delete(id);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      guestSseClients.delete(id);
    });
  });

  app.post('/api/guests/answer', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing guest authorization token.' });
      return;
    }

    const session = guestsByToken.get(token);
    if (!session) {
      res.status(401).json({
        error: 'Session expired or reset. Tap Join to get a fresh number.',
      });
      return;
    }

    if (!latestSyncState?.payload) {
      res.status(409).json({ error: 'The game has not started yet.' });
      return;
    }

    const currentPayload = latestSyncState.payload;

    if (currentPayload.phase !== 'answering') {
      res.status(409).json({
        error:
          currentPayload.phase === 'revealed'
            ? 'This round has already been revealed.'
            : 'Answering is not open yet — wait for the question.',
      });
      return;
    }

    // Strict server-side exclusive turn ownership check
    if (currentPayload.currentNumber !== session.number) {
      res.status(403).json({
        error:
          currentPayload.currentNumber !== null
            ? `Only Guest #${currentPayload.currentNumber} can answer right now.`
            : 'No guest is currently active.',
      });
      return;
    }

    const activeQId = currentPayload.order[currentPayload.currentIndex];
    const currentQ = currentPayload.questions.find((q) => q.id === activeQId);
    if (!currentQ) {
      res.status(409).json({ error: 'No active question found.' });
      return;
    }

    if (currentQ.type === 'discussion') {
      res.status(400).json({
        error: 'Open discussion rounds are answered out loud with the room.',
      });
      return;
    }

    const body = req.body as { optionIndex?: unknown } | undefined;
    const optionIndex = body?.optionIndex;
    if (
      typeof optionIndex !== 'number' ||
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= currentQ.options.length
    ) {
      res.status(400).json({ error: 'Invalid answer option selected.' });
      return;
    }

    // Auto-reveal immediately on Stage, Host, and all Guest phones
    const remainingMs = getLiveRemainingMs(currentPayload);
    const autoCorrect =
      currentQ.answer !== undefined ? optionIndex === currentQ.answer : null;
    const now = Date.now();

    const nextRounds = Array.isArray(currentPayload.rounds)
      ? [...currentPayload.rounds]
      : [];
    const existingIdx = nextRounds.findIndex(
      (r) => r.questionId === currentQ.id && r.number === session.number
    );
    const record: ServerRoundRecord = {
      questionId: currentQ.id,
      number: session.number,
      selectedOption: optionIndex,
      correct: autoCorrect,
      timestamp: now,
    };
    if (existingIdx >= 0) {
      nextRounds[existingIdx] = record;
    } else {
      nextRounds.push(record);
    }

    const updatedPayload: ServerGamePayload = {
      ...currentPayload,
      selectedOption: optionIndex,
      roundOutcomeOverride: null,
      phase: 'revealed',
      drawAnimation: null,
      timerStatus:
        currentPayload.timerStatus === 'running'
          ? 'paused'
          : currentPayload.timerStatus,
      timerRemainingMs: remainingMs,
      timerStartedAt: null,
      rounds: nextRounds,
      lastAnsweredByPhone: {
        number: session.number,
        optionIndex,
        correct: autoCorrect,
        timestamp: now,
      },
    };

    latestSyncState = {
      sender: 'server-guest-answer',
      payload: updatedPayload,
      updatedAt: now,
    };
    broadcastGameState('server-guest-answer', updatedPayload, now);

    res.json({
      ok: true,
      number: session.number,
      optionIndex,
      correct: autoCorrect,
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
