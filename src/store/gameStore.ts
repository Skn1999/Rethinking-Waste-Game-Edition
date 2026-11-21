import { create } from 'zustand';
import { SAMPLE_QUESTIONS } from '../data/sampleQuestions';
import type {
  DrawAnimationPayload,
  GamePhase,
  GameSettings,
  GameSnapshot,
  LastPhoneAnswer,
  NumberState,
  Question,
  RoundRecord,
  TimerStatus,
  ToastMessage,
} from '../types/game';
import { buildRollSequence, cryptoPickOne, cryptoShuffle } from '../utils/random';

const STORAGE_KEY = 'whos-sorting-state-v1';
const CHANNEL_NAME = 'rethinking-waste';
const MAX_HISTORY = 20;
const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).slice(2)}`;

export const DEFAULT_SETTINGS: GameSettings = {
  eventName: 'Rethinking Waste Cookout',
  eventMeta: 'Sort smart · Cookout Edition',
  range: { min: 1, max: 60 },
  excluded: [],
  timerSeconds: 30,
  sound: false,
  reducedMotion: false,
  allowRepeats: false,
  absentCooldownRounds: 3,
  shuffle: false,
  languageMode: 'bilingual',
};

interface PersistedState {
  settings: GameSettings;
  questions: Question[];
  order: string[];
  currentIndex: number;
  phase: GamePhase;
  numbers: Record<number, NumberState>;
  absentAtRound: Record<number, number>;
  currentNumber: number | null;
  selectedOption: number | null;
  roundOutcomeOverride: boolean | null;
  rounds: RoundRecord[];
  history: GameSnapshot[];
  timerStatus: TimerStatus;
  timerRemainingMs: number;
  timerStartedAt: number | null;
  drawAnimation: DrawAnimationPayload | null;
  poolEmptyPrompt: boolean;
  lastAnsweredByPhone?: LastPhoneAnswer | null;
}

export interface GameStore extends PersistedState {
  toast: ToastMessage | null;
  checkedInNumbers: number[];
  // Setup & settings actions
  updateSettings: (partial: Partial<GameSettings>) => void;
  setNumberRangeAndExcluded: (min: number, max: number, excluded: number[]) => void;
  importQuestions: (questions: Question[]) => void;
  loadSampleQuestions: () => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (id: string, updated: Question) => void;
  deleteQuestion: (id: string) => void;
  moveQuestion: (id: string, direction: 'up' | 'down') => void;
  setQuestionOrderMode: (shuffle: boolean) => void;
  reshuffleOrder: () => void;

  // Backup export / import (P1)
  exportBackup: () => string;
  importBackup: (jsonText: string) => { ok: boolean; error?: string };

  // Game flow actions
  startGame: () => void;
  goToIdle: () => void;
  goToFinale: () => void;
  restartGame: () => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  skipQuestion: () => void;

  // Draw & number pool actions
  drawNumber: () => void;
  completeDrawAnimation: () => void;
  markAbsentAndRedraw: () => void;
  toggleExcludeNumber: (num: number) => void;
  forcePickNumber: (num: number) => void;
  resetNumberPool: () => void;
  dismissPoolEmptyPrompt: () => void;

  // Answer & reveal actions
  showQuestion: () => void;
  selectOption: (optionIndex: number) => void;
  revealAnswer: () => void;
  markRoundOutcome: (isCorrect: boolean) => void;

  // Timer actions
  toggleTimer: () => void;
  resetTimer: () => void;

  // Undo & Toast
  undo: () => void;
  dismissToast: () => void;

  // Broadcast & Guest check-in helpers
  requestStageFullscreen: () => void;
  resetCheckedInGuests: () => Promise<void>;
}

function buildInitialNumbers(
  min: number,
  max: number,
  excluded: number[],
  existing?: Record<number, NumberState>
): Record<number, NumberState> {
  const excludedSet = new Set(excluded);
  const map: Record<number, NumberState> = {};
  for (let n = min; n <= max; n++) {
    if (excludedSet.has(n)) {
      map[n] = 'excluded';
    } else if (existing && existing[n] && existing[n] !== 'excluded') {
      map[n] = existing[n];
    } else {
      map[n] = 'available';
    }
  }
  return map;
}

function createSnapshot(state: PersistedState): GameSnapshot {
  return {
    phase: state.phase,
    currentIndex: state.currentIndex,
    numbers: { ...state.numbers },
    absentAtRound: { ...state.absentAtRound },
    currentNumber: state.currentNumber,
    selectedOption: state.selectedOption,
    roundOutcomeOverride: state.roundOutcomeOverride,
    rounds: [...state.rounds],
    timerStatus: state.timerStatus,
    timerRemainingMs: state.timerRemainingMs,
    timerStartedAt: state.timerStartedAt,
  };
}

function getEligiblePool(
  numbers: Record<number, NumberState>,
  settings: GameSettings,
  checkedInNumbers: number[]
): number[] {
  const { min, max } = settings.range;
  const checkedInSet = new Set(checkedInNumbers);
  const pool: number[] = [];
  for (let n = min; n <= max; n++) {
    if (!checkedInSet.has(n)) continue;
    const st = numbers[n];
    if (st === 'available') {
      pool.push(n);
    } else if (settings.allowRepeats && st === 'answered') {
      pool.push(n);
    }
  }
  return pool;
}

function restoreCooledDownAbsents(
  numbers: Record<number, NumberState>,
  absentAtRound: Record<number, number>,
  completedRounds: number,
  cooldown: number
): { numbers: Record<number, NumberState>; absentAtRound: Record<number, number> } {
  const nextNumbers = { ...numbers };
  const nextAbsentAt = { ...absentAtRound };
  for (const [key, roundIdx] of Object.entries(nextAbsentAt)) {
    const n = Number(key);
    if (nextNumbers[n] === 'absent' && completedRounds - roundIdx >= cooldown) {
      nextNumbers[n] = 'available';
      delete nextAbsentAt[n];
    }
  }
  return { numbers: nextNumbers, absentAtRound: nextAbsentAt };
}

export function getLiveRemainingMs(state: {
  timerStatus: TimerStatus;
  timerRemainingMs: number;
  timerStartedAt: number | null;
}): number {
  if (state.timerStatus !== 'running' || state.timerStartedAt === null) {
    return Math.max(0, state.timerRemainingMs);
  }
  const elapsed = Date.now() - state.timerStartedAt;
  return Math.max(0, state.timerRemainingMs - elapsed);
}

function createDefaultPersistedState(): PersistedState {
  const questions = SAMPLE_QUESTIONS;
  const order = questions.map((q) => q.id);
  return {
    settings: { ...DEFAULT_SETTINGS },
    questions,
    order,
    currentIndex: 0,
    phase: 'idle',
    numbers: buildInitialNumbers(
      DEFAULT_SETTINGS.range.min,
      DEFAULT_SETTINGS.range.max,
      DEFAULT_SETTINGS.excluded
    ),
    absentAtRound: {},
    currentNumber: null,
    selectedOption: null,
    roundOutcomeOverride: null,
    rounds: [],
    history: [],
    timerStatus: 'idle',
    timerRemainingMs: DEFAULT_SETTINGS.timerSeconds * 1000,
    timerStartedAt: null,
    drawAnimation: null,
    poolEmptyPrompt: false,
    lastAnsweredByPhone: null,
  };
}

function extractPersistedState(state: GameStore): PersistedState {
  return {
    settings: state.settings,
    questions: state.questions,
    order: state.order,
    currentIndex: state.currentIndex,
    phase: state.phase,
    numbers: state.numbers,
    absentAtRound: state.absentAtRound,
    currentNumber: state.currentNumber,
    selectedOption: state.selectedOption,
    roundOutcomeOverride: state.roundOutcomeOverride,
    rounds: state.rounds,
    history: state.history,
    timerStatus: state.timerStatus,
    timerRemainingMs: state.timerRemainingMs,
    timerStartedAt: state.timerStartedAt,
    drawAnimation: state.drawAnimation,
    poolEmptyPrompt: state.poolEmptyPrompt,
    lastAnsweredByPhone: state.lastAnsweredByPhone ?? null,
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPersistedState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const defaults = createDefaultPersistedState();
    const mergedSettings: GameSettings = {
      ...defaults.settings,
      ...(parsed.settings ?? {}),
      range: {
        ...defaults.settings.range,
        ...(parsed.settings?.range ?? {}),
      },
      excluded: Array.isArray(parsed.settings?.excluded)
        ? parsed.settings!.excluded
        : defaults.settings.excluded,
    };
    const questions =
      Array.isArray(parsed.questions) && parsed.questions.length > 0
        ? parsed.questions
        : defaults.questions;
    const validIds = new Set(questions.map((q) => q.id));
    const order =
      Array.isArray(parsed.order) && parsed.order.every((id) => validIds.has(id))
        ? parsed.order
        : questions.map((q) => q.id);

    // If a page reloaded right in the middle of drawing, settle smoothly to drawn
    const restoredPhase: GamePhase =
      parsed.phase === 'drawing' ? 'drawn' : (parsed.phase ?? 'idle');

    return {
      ...defaults,
      ...parsed,
      settings: mergedSettings,
      questions,
      order,
      phase: restoredPhase,
      drawAnimation: null,
      numbers: buildInitialNumbers(
        mergedSettings.range.min,
        mergedSettings.range.max,
        mergedSettings.excluded,
        parsed.numbers
      ),
      history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_HISTORY) : [],
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      absentAtRound: parsed.absentAtRound ?? {},
    };
  } catch {
    return createDefaultPersistedState();
  }
}

let channel: BroadcastChannel | null = null;
const fullscreenListeners = new Set<() => void>();

export function subscribeStageFullscreenCommand(cb: () => void): () => void {
  fullscreenListeners.add(cb);
  return () => {
    fullscreenListeners.delete(cb);
  };
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

function pushToRelay(payload: PersistedState): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  void fetch('/api/sync/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: TAB_ID, payload }),
    keepalive: true,
  }).catch(() => {
    // Offline or static hosting — BroadcastChannel + localStorage still work
  });
}

function persistAndBroadcast(state: GameStore): void {
  const payload = extractPersistedState(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota issues in restricted environments
  }
  try {
    getChannel()?.postMessage({
      type: 'STATE_SYNC',
      sender: TAB_ID,
      payload,
    });
  } catch {
    // Ignore BroadcastChannel errors
  }
  pushToRelay(payload);
}

/**
 * Publishes current local state to both BroadcastChannel and the local SSE relay
 * so newly opened Stage tabs immediately mirror the Host's exact state.
 */
export function publishCurrentState(): void {
  const state = useGameStore.getState();
  const payload = extractPersistedState(state);
  try {
    getChannel()?.postMessage({
      type: 'STATE_SYNC',
      sender: TAB_ID,
      payload,
    });
  } catch {
    // Ignore
  }
  pushToRelay(payload);
}

function isValidPersistedState(value: unknown): value is PersistedState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedState>;
  return Boolean(
    candidate.settings &&
      typeof candidate.settings === 'object' &&
      Array.isArray(candidate.questions) &&
      candidate.questions.length > 0 &&
      typeof candidate.phase === 'string'
  );
}

/**
 * Hydrates latest state & checked-in guests from the local sync relay.
 */
export async function hydrateFromRelay(): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/api/sync/state', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      payload?: unknown;
      checkedInNumbers?: unknown;
    };
    const patch: Partial<GameStore> = {};
    if (isValidPersistedState(data?.payload)) {
      Object.assign(patch, data.payload);
    }
    if (Array.isArray(data?.checkedInNumbers)) {
      patch.checkedInNumbers = data.checkedInNumbers.filter(
        (n): n is number => typeof n === 'number' && Number.isInteger(n)
      );
    }
    if (Object.keys(patch).length > 0) {
      useGameStore.setState(patch);
    }
  } catch {
    // Offline or static host
  }
}

export async function hydrateCheckedInGuests(): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/api/guests', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { checkedInNumbers?: unknown };
    if (Array.isArray(data?.checkedInNumbers)) {
      useGameStore.setState({
        checkedInNumbers: data.checkedInNumbers.filter(
          (n): n is number => typeof n === 'number' && Number.isInteger(n)
        ),
      });
    }
  } catch {
    // Offline
  }
}

let toastTimer: number | null = null;

export const useGameStore = create<GameStore>((set, get) => {
  const showToast = (message: string, canUndo = true) => {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    const toast: ToastMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      message,
      canUndo,
      createdAt: Date.now(),
    };
    set({ toast });
    toastTimer = window.setTimeout(() => {
      set((s) => (s.toast?.id === toast.id ? { toast: null } : s));
    }, 5000);
  };

  const commit = (
    updater: (state: GameStore) => Partial<GameStore>,
    options?: { recordHistory?: boolean; toastMessage?: string; canUndo?: boolean }
  ) => {
    set((state) => {
      const nextHistory = options?.recordHistory
        ? [...state.history, createSnapshot(extractPersistedState(state))].slice(
            -MAX_HISTORY
          )
        : state.history;
      const patch = updater(state);
      return {
        ...patch,
        history: nextHistory,
      };
    });
    persistAndBroadcast(get());
    if (options?.toastMessage) {
      showToast(options.toastMessage, options.canUndo ?? Boolean(options.recordHistory));
    }
  };

  const finalizeCurrentRoundIfNeeded = (
    state: GameStore
  ): {
    numbers: Record<number, NumberState>;
    absentAtRound: Record<number, number>;
    rounds: RoundRecord[];
  } => {
    const currentQId = state.order[state.currentIndex];
    const currentQ = state.questions.find((q) => q.id === currentQId);
    let nextNumbers = { ...state.numbers };
    let nextRounds = [...state.rounds];

    if (state.currentNumber !== null && nextNumbers[state.currentNumber] === 'drawn') {
      nextNumbers[state.currentNumber] = 'answered';
    }

    if (currentQ && state.phase === 'revealed') {
      const existingIdx = nextRounds.findIndex(
        (r) => r.questionId === currentQ.id && r.number === state.currentNumber
      );
      const computedCorrect =
        state.roundOutcomeOverride !== null
          ? state.roundOutcomeOverride
          : currentQ.answer !== undefined && state.selectedOption !== null
            ? state.selectedOption === currentQ.answer
            : null;
      const record: RoundRecord = {
        questionId: currentQ.id,
        number: state.currentNumber,
        selectedOption: state.selectedOption,
        correct: computedCorrect,
        timestamp: Date.now(),
      };
      if (existingIdx >= 0) {
        nextRounds[existingIdx] = record;
      } else {
        nextRounds.push(record);
      }
    }

    const restored = restoreCooledDownAbsents(
      nextNumbers,
      state.absentAtRound,
      nextRounds.length,
      state.settings.absentCooldownRounds
    );

    return {
      numbers: restored.numbers,
      absentAtRound: restored.absentAtRound,
      rounds: nextRounds,
    };
  };

  const initial = loadInitialState();

  return {
    ...initial,
    toast: null,
    checkedInNumbers: [],

    updateSettings: (partial) => {
      commit((state) => {
        const nextSettings: GameSettings = {
          ...state.settings,
          ...partial,
        };
        const timerReset =
          partial.timerSeconds !== undefined && state.timerStatus === 'idle'
            ? { timerRemainingMs: nextSettings.timerSeconds * 1000 }
            : {};
        return {
          settings: nextSettings,
          ...timerReset,
        };
      });
    },

    setNumberRangeAndExcluded: (min, max, excluded) => {
      const safeMin = Math.max(1, Math.min(min, max));
      const safeMax = Math.min(999, Math.max(safeMin, max));
      const cleanExcluded = Array.from(
        new Set(excluded.filter((n) => n >= safeMin && n <= safeMax))
      ).sort((a, b) => a - b);

      commit(
        (state) => {
          const nextNumbers = buildInitialNumbers(
            safeMin,
            safeMax,
            cleanExcluded,
            state.numbers
          );
          const nextCurrentNumber =
            state.currentNumber !== null &&
            state.currentNumber >= safeMin &&
            state.currentNumber <= safeMax &&
            nextNumbers[state.currentNumber] !== 'excluded'
              ? state.currentNumber
              : null;
          return {
            settings: {
              ...state.settings,
              range: { min: safeMin, max: safeMax },
              excluded: cleanExcluded,
            },
            numbers: nextNumbers,
            currentNumber: nextCurrentNumber,
            poolEmptyPrompt: false,
          };
        },
        { toastMessage: `Guest range set to ${safeMin}–${safeMax}`, canUndo: false }
      );
    },

    importQuestions: (questions) => {
      if (questions.length === 0) return;
      commit(
        (state) => {
          const ids = questions.map((q) => q.id);
          const order = state.settings.shuffle ? cryptoShuffle(ids) : ids;
          return {
            questions,
            order,
            currentIndex: 0,
            phase: state.phase === 'finale' ? 'idle' : state.phase,
            selectedOption: null,
            roundOutcomeOverride: null,
          };
        },
        {
          toastMessage: `Loaded ${questions.length} questions`,
          canUndo: false,
        }
      );
    },

    loadSampleQuestions: () => {
      commit(
        (state) => {
          const ids = SAMPLE_QUESTIONS.map((q) => q.id);
          const order = state.settings.shuffle ? cryptoShuffle(ids) : ids;
          return {
            questions: SAMPLE_QUESTIONS,
            order,
            currentIndex: 0,
            phase: 'idle',
            selectedOption: null,
            roundOutcomeOverride: null,
          };
        },
        {
          toastMessage: `Loaded ${SAMPLE_QUESTIONS.length} bilingual sample questions`,
          canUndo: false,
        }
      );
    },

    addQuestion: (question) => {
      commit(
        (state) => {
          const existingIds = new Set(state.questions.map((q) => q.id));
          let finalId = question.id.trim() || `q${state.questions.length + 1}`;
          let suffix = 2;
          while (existingIds.has(finalId)) {
            finalId = `${question.id.trim() || 'q'}_${suffix++}`;
          }
          const created: Question = { ...question, id: finalId };
          return {
            questions: [...state.questions, created],
            order: [...state.order, finalId],
          };
        },
        { toastMessage: 'Question added to deck', canUndo: false }
      );
    },

    updateQuestion: (id, updated) => {
      commit(
        (state) => ({
          questions: state.questions.map((q) =>
            q.id === id ? { ...updated, id } : q
          ),
        }),
        { toastMessage: 'Question updated', canUndo: false }
      );
    },

    deleteQuestion: (id) => {
      const state = get();
      if (state.questions.length <= 1) {
        showToast('Keep at least one question in the deck', false);
        return;
      }
      commit(
        (s) => {
          const nextQuestions = s.questions.filter((q) => q.id !== id);
          const nextOrder = s.order.filter((qid) => qid !== id);
          const nextIndex = Math.min(s.currentIndex, Math.max(0, nextOrder.length - 1));
          return {
            questions: nextQuestions,
            order: nextOrder,
            currentIndex: nextIndex,
          };
        },
        { toastMessage: 'Question removed', canUndo: false }
      );
    },

    moveQuestion: (id, direction) => {
      commit((state) => {
        const idx = state.order.indexOf(id);
        if (idx === -1) return {};
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= state.order.length) return {};

        const nextOrder = [...state.order];
        const [moved] = nextOrder.splice(idx, 1);
        nextOrder.splice(targetIdx, 0, moved);

        // Also keep questions array aligned when in as-listed mode
        const byId = new Map(state.questions.map((q) => [q.id, q]));
        const nextQuestions = state.settings.shuffle
          ? state.questions
          : nextOrder
              .map((qid) => byId.get(qid))
              .filter((q): q is Question => Boolean(q));

        return {
          order: nextOrder,
          questions: nextQuestions,
        };
      });
    },

    exportBackup: () => {
      const persisted = extractPersistedState(get());
      return JSON.stringify(
        {
          app: 'whos-sorting',
          version: 1,
          exportedAt: new Date().toISOString(),
          state: {
            ...persisted,
            drawAnimation: null,
            phase: persisted.phase === 'drawing' ? 'drawn' : persisted.phase,
          },
        },
        null,
        2
      );
    },

    importBackup: (jsonText) => {
      try {
        const parsed = JSON.parse(jsonText) as {
          app?: string;
          state?: Partial<PersistedState>;
        } & Partial<PersistedState>;

        const rawState =
          parsed && typeof parsed === 'object' && parsed.state
            ? parsed.state
            : parsed;

        if (
          !rawState ||
          typeof rawState !== 'object' ||
          !Array.isArray(rawState.questions) ||
          rawState.questions.length === 0 ||
          !rawState.settings
        ) {
          return {
            ok: false,
            error:
              'Backup file is missing valid settings or questions. Export a backup from Setup first.',
          };
        }

        const defaults = createDefaultPersistedState();
        const mergedSettings: GameSettings = {
          ...defaults.settings,
          ...rawState.settings,
          range: {
            min: Math.max(1, Number(rawState.settings.range?.min) || 1),
            max: Math.min(999, Number(rawState.settings.range?.max) || 60),
          },
          excluded: Array.isArray(rawState.settings.excluded)
            ? rawState.settings.excluded.map(Number).filter(Number.isInteger)
            : [],
        };

        const validIds = new Set(rawState.questions.map((q) => q.id));
        const restoredOrder =
          Array.isArray(rawState.order) &&
          rawState.order.length > 0 &&
          rawState.order.every((id) => validIds.has(id))
            ? rawState.order
            : rawState.questions.map((q) => q.id);

        const restoredPhase: GamePhase =
          rawState.phase === 'drawing' ? 'drawn' : (rawState.phase ?? 'idle');

        commit(
          () => ({
            settings: mergedSettings,
            questions: rawState.questions!,
            order: restoredOrder,
            currentIndex: Math.min(
              Math.max(0, Number(rawState.currentIndex) || 0),
              restoredOrder.length - 1
            ),
            phase: restoredPhase,
            numbers: buildInitialNumbers(
              mergedSettings.range.min,
              mergedSettings.range.max,
              mergedSettings.excluded,
              rawState.numbers
            ),
            absentAtRound: rawState.absentAtRound ?? {},
            currentNumber:
              typeof rawState.currentNumber === 'number'
                ? rawState.currentNumber
                : null,
            selectedOption:
              typeof rawState.selectedOption === 'number'
                ? rawState.selectedOption
                : null,
            roundOutcomeOverride:
              typeof rawState.roundOutcomeOverride === 'boolean'
                ? rawState.roundOutcomeOverride
                : null,
            rounds: Array.isArray(rawState.rounds) ? rawState.rounds : [],
            timerStatus: 'idle',
            timerRemainingMs: mergedSettings.timerSeconds * 1000,
            timerStartedAt: null,
            drawAnimation: null,
            poolEmptyPrompt: false,
          }),
          {
            recordHistory: true,
            toastMessage: `Backup restored (${rawState.questions.length} questions, ${Array.isArray(rawState.rounds) ? rawState.rounds.length : 0} rounds)`,
          }
        );

        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: `Could not parse backup JSON: ${err instanceof Error ? err.message : 'Invalid file'}`,
        };
      }
    },

    setQuestionOrderMode: (shuffle) => {
      commit((state) => {
        const ids = state.questions.map((q) => q.id);
        const order = shuffle ? cryptoShuffle(ids) : ids;
        return {
          settings: { ...state.settings, shuffle },
          order,
          currentIndex: 0,
        };
      });
    },

    reshuffleOrder: () => {
      commit(
        (state) => ({
          settings: { ...state.settings, shuffle: true },
          order: cryptoShuffle(state.questions.map((q) => q.id)),
          currentIndex: 0,
        }),
        { toastMessage: 'Question deck reshuffled', canUndo: false }
      );
    },

    startGame: () => {
      commit(
        (state) => ({
          phase: state.order.length > 0 ? 'question' : 'idle',
          currentIndex: 0,
          currentNumber: null,
          selectedOption: null,
          roundOutcomeOverride: null,
          drawAnimation: null,
          timerStatus: 'idle',
          timerRemainingMs: state.settings.timerSeconds * 1000,
          timerStartedAt: null,
          poolEmptyPrompt: false,
          lastAnsweredByPhone: null,
        }),
        { recordHistory: true, toastMessage: 'Round 1 ready — press Space to draw a guest' }
      );
    },

    goToIdle: () => {
      commit(
        (state) => ({
          phase: 'idle',
          drawAnimation: null,
          timerStatus: 'idle',
          timerRemainingMs: state.settings.timerSeconds * 1000,
          timerStartedAt: null,
        }),
        { recordHistory: true, toastMessage: 'Stage switched to Idle screen' }
      );
    },

    goToFinale: () => {
      commit(
        (state) => {
          const finalized = finalizeCurrentRoundIfNeeded(state);
          return {
            ...finalized,
            phase: 'finale',
            currentNumber: null,
            selectedOption: null,
            roundOutcomeOverride: null,
            drawAnimation: null,
            timerStatus: 'idle',
            timerRemainingMs: state.settings.timerSeconds * 1000,
            timerStartedAt: null,
          };
        },
        { recordHistory: true, toastMessage: 'Showing Finale stats on Stage' }
      );
    },

    restartGame: () => {
      commit(
        (state) => {
          const ids = state.questions.map((q) => q.id);
          const order = state.settings.shuffle ? cryptoShuffle(ids) : ids;
          return {
            order,
            currentIndex: 0,
            phase: 'idle',
            numbers: buildInitialNumbers(
              state.settings.range.min,
              state.settings.range.max,
              state.settings.excluded
            ),
            absentAtRound: {},
            currentNumber: null,
            selectedOption: null,
            roundOutcomeOverride: null,
            rounds: [],
            drawAnimation: null,
            timerStatus: 'idle',
            timerRemainingMs: state.settings.timerSeconds * 1000,
            timerStartedAt: null,
            poolEmptyPrompt: false,
            lastAnsweredByPhone: null,
          };
        },
        { recordHistory: true, toastMessage: 'Game reset to fresh event' }
      );
    },

    nextQuestion: () => {
      const state = get();
      if (state.phase === 'idle') {
        get().startGame();
        return;
      }
      if (state.phase === 'finale') return;

      const isLast = state.currentIndex >= state.order.length - 1;
      if (isLast) {
        get().goToFinale();
        return;
      }

      commit(
        (s) => {
          const finalized = finalizeCurrentRoundIfNeeded(s);
          return {
            ...finalized,
            currentIndex: Math.min(s.order.length - 1, s.currentIndex + 1),
            phase: 'question',
            currentNumber: null,
            selectedOption: null,
            roundOutcomeOverride: null,
            drawAnimation: null,
            timerStatus: 'idle',
            timerRemainingMs: s.settings.timerSeconds * 1000,
            timerStartedAt: null,
            poolEmptyPrompt: false,
            lastAnsweredByPhone: null,
          };
        },
        {
          recordHistory: true,
          toastMessage: `Round ${state.currentIndex + 2} of ${state.order.length} ready — draw next guest`,
        }
      );
    },

    prevQuestion: () => {
      const state = get();
      if (state.currentIndex <= 0 && state.phase !== 'finale') return;

      commit(
        (s) => {
          const targetIdx =
            s.phase === 'finale'
              ? Math.max(0, s.order.length - 1)
              : Math.max(0, s.currentIndex - 1);
          const nextNumbers = { ...s.numbers };
          if (s.currentNumber !== null && nextNumbers[s.currentNumber] === 'drawn') {
            nextNumbers[s.currentNumber] = 'available';
          }
          return {
            numbers: nextNumbers,
            currentIndex: targetIdx,
            phase: 'question',
            currentNumber: null,
            selectedOption: null,
            roundOutcomeOverride: null,
            drawAnimation: null,
            timerStatus: 'idle',
            timerRemainingMs: s.settings.timerSeconds * 1000,
            timerStartedAt: null,
            poolEmptyPrompt: false,
          };
        },
        { recordHistory: true, toastMessage: 'Returned to previous question' }
      );
    },

    skipQuestion: () => {
      const state = get();
      if (state.phase === 'idle' || state.phase === 'finale') return;
      const isLast = state.currentIndex >= state.order.length - 1;
      commit(
        (s) => {
          const nextNumbers = { ...s.numbers };
          if (s.currentNumber !== null && nextNumbers[s.currentNumber] === 'drawn') {
            nextNumbers[s.currentNumber] = 'available';
          }
          if (isLast) {
            return {
              numbers: nextNumbers,
              phase: 'finale',
              currentNumber: null,
              selectedOption: null,
              roundOutcomeOverride: null,
              drawAnimation: null,
              timerStatus: 'idle',
              timerRemainingMs: s.settings.timerSeconds * 1000,
              timerStartedAt: null,
            };
          }
          return {
            numbers: nextNumbers,
            currentIndex: s.currentIndex + 1,
            phase: 'question',
            currentNumber: null,
            selectedOption: null,
            roundOutcomeOverride: null,
            drawAnimation: null,
            timerStatus: 'idle',
            timerRemainingMs: s.settings.timerSeconds * 1000,
            timerStartedAt: null,
          };
        },
        { recordHistory: true, toastMessage: 'Question skipped' }
      );
    },

    drawNumber: () => {
      const state = get();
      if (state.phase === 'idle') {
        // Auto-enter question 1 and draw smoothly
        if (state.order.length === 0) return;
      }
      if (state.phase === 'finale' || state.phase === 'drawing' || state.phase === 'revealed') return;

      const workingNumbers = { ...state.numbers };
      if (
        state.currentNumber !== null &&
        workingNumbers[state.currentNumber] === 'drawn'
      ) {
        workingNumbers[state.currentNumber] = 'available';
      }

      if (state.checkedInNumbers.length === 0) {
        showToast(
          'No guests checked in yet — have guests scan the QR code to join',
          false
        );
        return;
      }

      const pool = getEligiblePool(
        workingNumbers,
        state.settings,
        state.checkedInNumbers
      );
      if (pool.length === 0) {
        set({ poolEmptyPrompt: true });
        persistAndBroadcast(get());
        showToast(
          'All checked-in guests have played — reset the pool to draw again',
          false
        );
        return;
      }

      const picked = cryptoPickOne(pool);
      if (picked === null) return;

      const reduced =
        state.settings.reducedMotion ||
        (typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

      workingNumbers[picked] = 'drawn';
      const candidates = buildRollSequence(pool, picked, 26);

      commit(
        (s) => ({
          numbers: workingNumbers,
          currentNumber: picked,
          selectedOption: null,
          roundOutcomeOverride: null,
          phase: reduced ? 'drawn' : 'drawing',
          drawAnimation: reduced
            ? null
            : {
                target: picked,
                candidates,
                startedAt: Date.now(),
              },
          poolEmptyPrompt: false,
          timerStatus: 'idle',
          timerRemainingMs: s.settings.timerSeconds * 1000,
          timerStartedAt: null,
          lastAnsweredByPhone: null,
        }),
        { recordHistory: true, toastMessage: `Drawing guest #${picked}` }
      );
    },

    completeDrawAnimation: () => {
      const state = get();
      if (state.phase !== 'drawing') return;
      commit(() => ({
        phase: 'drawn',
        drawAnimation: null,
      }));
    },

    markAbsentAndRedraw: () => {
      const state = get();
      if (state.currentNumber === null) return;
      if (state.phase === 'idle' || state.phase === 'finale') return;

      const absentNum = state.currentNumber;
      const workingNumbers = { ...state.numbers };
      workingNumbers[absentNum] = 'absent';
      const nextAbsentAt = {
        ...state.absentAtRound,
        [absentNum]: state.rounds.length,
      };

      const pool = getEligiblePool(
        workingNumbers,
        state.settings,
        state.checkedInNumbers
      );
      if (pool.length === 0) {
        commit(
          () => ({
            numbers: workingNumbers,
            absentAtRound: nextAbsentAt,
            currentNumber: null,
            phase: 'question',
            drawAnimation: null,
            poolEmptyPrompt: true,
          }),
          {
            recordHistory: true,
            toastMessage: `Number ${absentNum} marked absent · No numbers left in pool`,
          }
        );
        return;
      }

      const picked = cryptoPickOne(pool);
      if (picked === null) return;
      workingNumbers[picked] = 'drawn';

      const reduced =
        state.settings.reducedMotion ||
        (typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

      commit(
        (s) => ({
          numbers: workingNumbers,
          absentAtRound: nextAbsentAt,
          currentNumber: picked,
          selectedOption: null,
          roundOutcomeOverride: null,
          phase: reduced ? 'drawn' : 'drawing',
          drawAnimation: reduced
            ? null
            : {
                target: picked,
                candidates: buildRollSequence(pool, picked, 24),
                startedAt: Date.now(),
              },
          timerStatus: 'idle',
          timerRemainingMs: s.settings.timerSeconds * 1000,
          timerStartedAt: null,
          poolEmptyPrompt: false,
        }),
        {
          recordHistory: true,
          toastMessage: `Number ${absentNum} marked absent · Drawing #${picked}`,
        }
      );
    },

    toggleExcludeNumber: (num) => {
      const state = get();
      const currentState = state.numbers[num];
      if (!currentState) return;

      const isCurrentlyExcluded = currentState === 'excluded';
      const nextNumbers = { ...state.numbers };
      const nextExcluded = isCurrentlyExcluded
        ? state.settings.excluded.filter((n) => n !== num)
        : [...state.settings.excluded, num].sort((a, b) => a - b);

      let nextCurrentNumber = state.currentNumber;
      let nextPhase = state.phase;

      if (isCurrentlyExcluded) {
        nextNumbers[num] = 'available';
      } else {
        nextNumbers[num] = 'excluded';
        if (state.currentNumber === num) {
          nextCurrentNumber = null;
          if (state.phase === 'drawn' || state.phase === 'drawing' || state.phase === 'answering') {
            nextPhase = 'question';
          }
        }
      }

      commit(
        (s) => ({
          numbers: nextNumbers,
          settings: { ...s.settings, excluded: nextExcluded },
          currentNumber: nextCurrentNumber,
          phase: nextPhase,
          drawAnimation: nextCurrentNumber === null ? null : s.drawAnimation,
          poolEmptyPrompt: false,
        }),
        {
          recordHistory: true,
          toastMessage: isCurrentlyExcluded
            ? `Number ${num} restored to pool`
            : `Number ${num} excluded (not handed out)`,
        }
      );
    },

    forcePickNumber: (num) => {
      const state = get();
      if (!(num in state.numbers)) return;
      if (state.phase === 'finale') return;

      const nextNumbers = { ...state.numbers };
      if (state.currentNumber !== null && nextNumbers[state.currentNumber] === 'drawn') {
        nextNumbers[state.currentNumber] = 'available';
      }
      nextNumbers[num] = 'drawn';
      const nextExcluded = state.settings.excluded.filter((n) => n !== num);
      const nextAbsentAt = { ...state.absentAtRound };
      delete nextAbsentAt[num];

      commit(
        (s) => ({
          numbers: nextNumbers,
          absentAtRound: nextAbsentAt,
          settings: { ...s.settings, excluded: nextExcluded },
          currentNumber: num,
          phase:
            s.phase === 'answering' || s.phase === 'revealed'
              ? s.phase
              : 'drawn',
          drawAnimation: null,
          poolEmptyPrompt: false,
        }),
        {
          recordHistory: true,
          toastMessage: `Guest #${num} force-picked`,
        }
      );
    },

    resetNumberPool: () => {
      commit(
        (s) => {
          const excludedSet = new Set(s.settings.excluded);
          const nextNumbers: Record<number, NumberState> = {};
          for (let n = s.settings.range.min; n <= s.settings.range.max; n++) {
            nextNumbers[n] = excludedSet.has(n) ? 'excluded' : 'available';
          }
          return {
            numbers: nextNumbers,
            absentAtRound: {},
            currentNumber: null,
            drawAnimation: null,
            poolEmptyPrompt: false,
            phase:
              s.phase === 'drawn' || s.phase === 'drawing' || s.phase === 'answering'
                ? 'question'
                : s.phase,
          };
        },
        {
          recordHistory: true,
          toastMessage: 'Number pool reset — all active numbers available again',
        }
      );
    },

    dismissPoolEmptyPrompt: () => {
      set({ poolEmptyPrompt: false });
      persistAndBroadcast(get());
    },

    showQuestion: () => {
      const state = get();
      if (state.phase !== 'drawn' && state.phase !== 'question') return;
      if (state.order.length === 0) return;

      commit(
        () => ({
          phase: 'answering',
          drawAnimation: null,
        }),
        {
          recordHistory: true,
          toastMessage:
            state.currentNumber !== null
              ? `Question live on Stage for Guest #${state.currentNumber}`
              : 'Question live on Stage',
        }
      );
    },

    selectOption: (optionIndex) => {
      const state = get();
      if (
        state.phase === 'idle' ||
        state.phase === 'finale' ||
        state.phase === 'question' ||
        state.phase === 'drawing'
      ) {
        return;
      }
      const currentQ = state.questions.find((q) => q.id === state.order[state.currentIndex]);
      if (!currentQ || optionIndex < 0 || optionIndex >= currentQ.options.length) return;

      commit(
        (s) => ({
          selectedOption: optionIndex,
          phase: s.phase === 'revealed' ? 'revealed' : 'answering',
          drawAnimation: null,
        }),
        {
          recordHistory: true,
          toastMessage: `Selected option ${String.fromCharCode(65 + optionIndex)}`,
        }
      );
    },

    revealAnswer: () => {
      const state = get();
      if (state.phase !== 'answering') {
        return;
      }

      const currentQ = state.questions.find((q) => q.id === state.order[state.currentIndex]);
      if (!currentQ) return;

      const remaining = getLiveRemainingMs(state);

      commit(
        (s) => {
          const autoCorrect =
            currentQ.answer !== undefined && s.selectedOption !== null
              ? s.selectedOption === currentQ.answer
              : null;
          const nextRounds = [...s.rounds];
          const existingIdx = nextRounds.findIndex(
            (r) => r.questionId === currentQ.id && r.number === s.currentNumber
          );
          const record: RoundRecord = {
            questionId: currentQ.id,
            number: s.currentNumber,
            selectedOption: s.selectedOption,
            correct: s.roundOutcomeOverride !== null ? s.roundOutcomeOverride : autoCorrect,
            timestamp: Date.now(),
          };
          if (existingIdx >= 0) {
            nextRounds[existingIdx] = record;
          } else {
            nextRounds.push(record);
          }

          return {
            phase: 'revealed',
            drawAnimation: null,
            timerStatus: s.timerStatus === 'running' ? 'paused' : s.timerStatus,
            timerRemainingMs: remaining,
            timerStartedAt: null,
            rounds: nextRounds,
          };
        },
        { recordHistory: true, toastMessage: 'Answer revealed on Stage' }
      );
    },

    markRoundOutcome: (isCorrect) => {
      const state = get();
      const currentQ = state.questions.find((q) => q.id === state.order[state.currentIndex]);
      if (!currentQ) return;

      commit(
        (s) => {
          const nextRounds = [...s.rounds];
          const existingIdx = nextRounds.findIndex(
            (r) => r.questionId === currentQ.id && r.number === s.currentNumber
          );
          const record: RoundRecord = {
            questionId: currentQ.id,
            number: s.currentNumber,
            selectedOption: s.selectedOption,
            correct: isCorrect,
            timestamp: Date.now(),
          };
          if (existingIdx >= 0) {
            nextRounds[existingIdx] = record;
          } else {
            nextRounds.push(record);
          }
          return {
            roundOutcomeOverride: isCorrect,
            rounds: nextRounds,
          };
        },
        {
          recordHistory: true,
          toastMessage: isCorrect ? 'Round marked correct' : 'Round marked incorrect',
        }
      );
    },

    toggleTimer: () => {
      const state = get();
      if (state.timerStatus === 'running') {
        const remaining = getLiveRemainingMs(state);
        commit(() => ({
          timerStatus: 'paused',
          timerRemainingMs: remaining,
          timerStartedAt: null,
        }));
      } else {
        const startFrom =
          state.timerRemainingMs <= 500
            ? state.settings.timerSeconds * 1000
            : state.timerRemainingMs;
        commit((s) => ({
          phase: s.phase === 'drawn' ? 'answering' : s.phase,
          timerStatus: 'running',
          timerRemainingMs: startFrom,
          timerStartedAt: Date.now(),
        }));
      }
    },

    resetTimer: () => {
      commit((s) => ({
        timerStatus: 'idle',
        timerRemainingMs: s.settings.timerSeconds * 1000,
        timerStartedAt: null,
      }));
    },

    undo: () => {
      const state = get();
      if (state.history.length === 0) return;
      const previous = state.history[state.history.length - 1];
      set((s) => ({
        ...previous,
        history: s.history.slice(0, -1),
        drawAnimation: null,
        poolEmptyPrompt: false,
      }));
      persistAndBroadcast(get());
      showToast('Last action undone', false);
    },

    dismissToast: () => {
      if (toastTimer !== null) {
        window.clearTimeout(toastTimer);
        toastTimer = null;
      }
      set({ toast: null });
    },

    requestStageFullscreen: () => {
      try {
        getChannel()?.postMessage({
          type: 'REQUEST_FULLSCREEN',
          sender: TAB_ID,
        });
      } catch {
        // Ignore
      }
      if (typeof fetch !== 'undefined') {
        void fetch('/api/sync/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: TAB_ID, command: 'REQUEST_FULLSCREEN' }),
        }).catch(() => {
          // Ignore offline
        });
      }
      showToast('Sent fullscreen toggle to Stage window', false);
    },

    resetCheckedInGuests: async () => {
      try {
        const res = await fetch('/api/guests/reset', { method: 'POST' });
        if (!res.ok) return;
        set({ checkedInNumbers: [] });
        showToast('All QR guest check-ins cleared for a fresh session', false);
      } catch {
        showToast('Could not reach server to clear check-ins', false);
      }
    },
  };
});

// Wire up BroadcastChannel, localStorage, and SSE relay cross-tab listeners
if (typeof window !== 'undefined') {
  const ch = getChannel();
  if (ch) {
    ch.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: 'STATE_SYNC'; sender: string; payload: PersistedState }
        | { type: 'REQUEST_STATE'; sender: string }
        | { type: 'REQUEST_FULLSCREEN'; sender: string }
        | undefined;
      if (!data || data.sender === TAB_ID) return;

      if (data.type === 'STATE_SYNC' && data.payload) {
        useGameStore.setState({
          ...data.payload,
        });
      } else if (data.type === 'REQUEST_STATE') {
        if (!window.location.pathname.startsWith('/stage')) {
          publishCurrentState();
        }
      } else if (data.type === 'REQUEST_FULLSCREEN') {
        fullscreenListeners.forEach((cb) => cb());
      }
    };
  }

  // Storage event fallback for browsers waking from sleep
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as PersistedState;
        useGameStore.setState({ ...parsed });
      } catch {
        // Ignore parse error
      }
    }
  });

  // Server-Sent Events relay (bridges iframe <-> top-level tab across Chrome Storage Partitioning)
  let lastAppliedRelayTs = 0;
  let fallbackPollId: number | null = null;

  const applyRelayState = (payload: unknown, updatedAt?: number | null) => {
    if (!isValidPersistedState(payload)) return;
    if (typeof updatedAt === 'number' && updatedAt > 0) {
      if (updatedAt <= lastAppliedRelayTs) return;
      lastAppliedRelayTs = updatedAt;
    }
    useGameStore.setState({ ...payload });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota issues
    }
  };

  const applyCheckedInGuests = (raw: unknown) => {
    if (!Array.isArray(raw)) return;
    const valid = raw.filter(
      (n): n is number => typeof n === 'number' && Number.isInteger(n)
    );
    useGameStore.setState({ checkedInNumbers: valid });
  };

  const startStageFallbackPoll = () => {
    if (fallbackPollId !== null) return;
    if (
      !window.location.pathname.startsWith('/stage') &&
      !window.location.pathname.startsWith('/host')
    ) {
      return;
    }
    fallbackPollId = window.setInterval(async () => {
      try {
        const res = await fetch('/api/sync/state', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          payload?: PersistedState | null;
          updatedAt?: number | null;
          checkedInNumbers?: unknown;
        };
        if (data?.payload) {
          applyRelayState(data.payload, data.updatedAt);
        }
        if (data?.checkedInNumbers) {
          applyCheckedInGuests(data.checkedInNumbers);
        }
      } catch {
        // Ignore offline
      }
    }, 600);
  };

  const stopStageFallbackPoll = () => {
    if (fallbackPollId !== null) {
      window.clearInterval(fallbackPollId);
      fallbackPollId = null;
    }
  };

  if (typeof EventSource !== 'undefined') {
    const connectSse = () => {
      try {
        const es = new EventSource('/api/sync/stream');
        es.onopen = () => {
          stopStageFallbackPoll();
        };
        es.onerror = () => {
          startStageFallbackPoll();
        };
        es.addEventListener('state', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as {
              sender?: string;
              payload?: PersistedState;
              updatedAt?: number;
            };
            if (!parsed || parsed.sender === TAB_ID || !parsed.payload) return;
            applyRelayState(parsed.payload, parsed.updatedAt);
          } catch {
            // Ignore malformed SSE frame
          }
        });
        es.addEventListener('guests', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as {
              checkedInNumbers?: unknown;
            };
            if (parsed?.checkedInNumbers) {
              applyCheckedInGuests(parsed.checkedInNumbers);
            }
          } catch {
            // Ignore malformed SSE frame
          }
        });
        es.addEventListener('command', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as {
              sender?: string;
              command?: string;
            };
            if (!parsed || parsed.sender === TAB_ID) return;
            if (parsed.command === 'REQUEST_FULLSCREEN') {
              fullscreenListeners.forEach((cb) => cb());
            }
          } catch {
            // Ignore
          }
        });
      } catch {
        startStageFallbackPoll();
      }
    };
    connectSse();
  }
}
