import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Check,
  Lock,
  MessageCircle,
  Recycle,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CategoryTag } from '../components/ui/CategoryTag';
import { TimerRing } from '../components/ui/TimerRing';
import {
  WASTE_CATEGORIES,
  type GuestGameView,
  type WasteCategory,
} from '../types/game';
import {
  playCorrectGuess,
  playNeutralReveal,
  playWrongGuess,
  playYourTurnAlert,
  unlockAudio,
} from '../utils/sound';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function inferBinCategory(label: string): WasteCategory | null {
  const lower = label.toLowerCase();
  if (lower.includes('bio') || lower.includes('compost')) return 'bio';
  if (lower.includes('cardboard') || lower.includes('kartonki')) return 'cardboard';
  if (lower.includes('paper') || lower.includes('paperi')) return 'paper';
  if (lower.includes('plastic') || lower.includes('muovi')) return 'plastic';
  if (lower.includes('glass') || lower.includes('lasi')) return 'glass';
  if (lower.includes('metal') || lower.includes('metalli')) return 'metal';
  if (lower.includes('mixed') || lower.includes('sekajäte')) return 'mixed';
  if (
    lower.includes('hazard') ||
    lower.includes('e-waste') ||
    lower.includes('vaarallinen') ||
    lower.includes('ser')
  ) {
    return 'hazard';
  }
  if (
    lower.includes('reuse') ||
    lower.includes('repair') ||
    lower.includes('uudelleen')
  ) {
    return 'reuse';
  }
  return null;
}

interface GuestCredentials {
  number: number;
  token: string;
}

export function PlayPage() {
  // Guest bearer token is intentionally stored in React memory only (never in localStorage)
  const [guest, setGuest] = useState<GuestCredentials | null>(null);
  const [gameState, setGameState] = useState<GuestGameView | null>(null);
  const [checkedInCount, setCheckedInCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [sessionResetNotice, setSessionResetNotice] = useState<boolean>(false);
  const [submittingIdx, setSubmittingIdx] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const lastTurnAlertKeyRef = useRef<string | null>(null);
  const lastRevealSoundKeyRef = useRef<string | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Hydrate initial sanitized state & connect to live SSE stream with polling fallback
  useEffect(() => {
    let active = true;
    let pollId: number | null = null;

    const fetchGuestState = async () => {
      try {
        const res = await fetch('/api/guests/state', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          state?: GuestGameView;
          checkedInCount?: number;
        };
        if (!active) return;
        if (data?.state) {
          setGameState(data.state);
          setCheckedInCount(data.state.checkedInCount);
        } else if (typeof data?.checkedInCount === 'number') {
          setCheckedInCount(data.checkedInCount);
        }
      } catch {
        // Offline / retrying
      }
    };

    void fetchGuestState();

    const startPoll = () => {
      if (pollId !== null) return;
      pollId = window.setInterval(() => {
        void fetchGuestState();
      }, 1000);
    };

    const stopPoll = () => {
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        es = new EventSource('/api/guests/stream');
        es.onopen = () => {
          if (!active) return;
          setConnected(true);
          stopPoll();
        };
        es.onerror = () => {
          if (!active) return;
          setConnected(false);
          startPoll();
        };
        es.addEventListener('guest_state', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as GuestGameView;
            if (!active || !parsed) return;
            setGameState(parsed);
            setCheckedInCount(parsed.checkedInCount);
          } catch {
            // Ignore malformed SSE frame
          }
        });
        es.addEventListener('guests', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as {
              count?: number;
            };
            if (!active || typeof parsed?.count !== 'number') return;
            setCheckedInCount(parsed.count);
          } catch {
            // Ignore
          }
        });
        es.addEventListener('guest_reset', () => {
          if (!active) return;
          setGuest((prev) => {
            if (prev) {
              setSessionResetNotice(true);
            }
            return null;
          });
          setSubmittingIdx(null);
          setSubmitError(null);
          lastTurnAlertKeyRef.current = null;
        });
      } catch {
        startPoll();
      }
    } else {
      startPoll();
    }

    return () => {
      active = false;
      stopPoll();
      es?.close();
    };
  }, []);

  // Tick local countdown timer smoothly when timer is running
  useEffect(() => {
    if (gameState?.timerStatus !== 'running') return;
    setNowTick(Date.now());
    const id = window.setInterval(() => setNowTick(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [gameState?.timerStatus, gameState?.timerStartedAt]);

  const remainingMs = useMemo(() => {
    if (!gameState) return 30000;
    if (gameState.timerStatus !== 'running' || gameState.timerStartedAt === null) {
      return Math.max(0, gameState.timerRemainingMs);
    }
    return Math.max(0, gameState.timerRemainingMs - (nowTick - gameState.timerStartedAt));
  }, [gameState, nowTick]);

  // Clear per-round errors when round or phase shifts
  useEffect(() => {
    setSubmitError(null);
    if (gameState?.phase !== 'answering') {
      setSubmittingIdx(null);
    }
  }, [gameState?.phase, gameState?.currentIndex]);

  const isMyTurn = Boolean(
    guest && gameState && gameState.currentNumber === guest.number
  );

  // Trigger audio chime + haptic pulse the moment THIS guest is called up
  useEffect(() => {
    if (!guest || !gameState) return;
    if (
      gameState.currentNumber === guest.number &&
      (gameState.phase === 'drawn' || gameState.phase === 'answering')
    ) {
      const roundKey = `${gameState.currentIndex}:${guest.number}`;
      if (lastTurnAlertKeyRef.current !== roundKey) {
        lastTurnAlertKeyRef.current = roundKey;
        if (soundEnabledRef.current) {
          playYourTurnAlert();
        }
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([140, 70, 140]);
          }
        } catch {
          // Ignore unsupported vibration
        }
      }
    }
  }, [guest, gameState]);

  // Trigger outcome chime on the called guest's phone when their answer reveals
  useEffect(() => {
    if (!guest || !gameState) return;
    if (gameState.phase !== 'revealed' || gameState.currentNumber !== guest.number) {
      return;
    }
    const revealKey = `${gameState.currentIndex}:${guest.number}:revealed`;
    if (lastRevealSoundKeyRef.current === revealKey) return;
    lastRevealSoundKeyRef.current = revealKey;

    if (!soundEnabledRef.current) return;
    const q = gameState.currentQuestion;
    if (
      !q ||
      q.type === 'discussion' ||
      q.answer === undefined ||
      gameState.selectedOption === null
    ) {
      playNeutralReveal();
    } else if (gameState.selectedOption === q.answer) {
      playCorrectGuess();
    } else {
      playWrongGuess();
    }
  }, [guest, gameState]);

  const handleJoin = useCallback(async () => {
    // Unlock mobile Web Audio API synchronously inside the user tap gesture
    unlockAudio();
    setJoining(true);
    setJoinError(null);
    setSessionResetNotice(false);

    try {
      const res = await fetch('/api/guests/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as {
        number?: number;
        token?: string;
        checkedInCount?: number;
        gameState?: GuestGameView;
        error?: string;
      };

      if (!res.ok || typeof data.number !== 'number' || !data.token) {
        setJoinError(data.error ?? 'Could not claim a guest number right now.');
        return;
      }

      setGuest({ number: data.number, token: data.token });
      if (data.gameState) {
        setGameState(data.gameState);
      }
      if (typeof data.checkedInCount === 'number') {
        setCheckedInCount(data.checkedInCount);
      }

      if (soundEnabledRef.current) {
        playNeutralReveal();
      }
    } catch {
      setJoinError('Network hiccup — please check your Wi-Fi and tap again.');
    } finally {
      setJoining(false);
    }
  }, []);

  const handleSubmitAnswer = useCallback(
    async (optionIndex: number) => {
      if (!guest || !gameState || submittingIdx !== null) return;
      if (gameState.phase !== 'answering' || gameState.currentNumber !== guest.number) {
        return;
      }

      unlockAudio();
      setSubmittingIdx(optionIndex);
      setSubmitError(null);

      try {
        const res = await fetch('/api/guests/answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${guest.token}`,
          },
          body: JSON.stringify({ optionIndex }),
        });

        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          setSubmitError(data.error ?? 'Answer could not be submitted.');
          setSubmittingIdx(null);
          if (res.status === 401) {
            setGuest(null);
            setSessionResetNotice(true);
          }
          return;
        }
        // SSE immediately pushes revealed state; fetch once as quick backup
        const stateRes = await fetch('/api/guests/state', { cache: 'no-store' });
        if (stateRes.ok) {
          const refreshed = (await stateRes.json()) as { state?: GuestGameView };
          if (refreshed?.state) {
            setGameState(refreshed.state);
          }
        }
      } catch {
        setSubmitError('Could not reach the game server. Tap again to retry.');
        setSubmittingIdx(null);
      }
    },
    [guest, gameState, submittingIdx]
  );

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      unlockAudio();
      playNeutralReveal();
    }
  };

  const lang = gameState?.languageMode ?? 'bilingual';
  const eventName = gameState?.eventName ?? 'Rethinking Waste Cookout';
  const phase = gameState?.phase ?? 'idle';
  const currentQ = gameState?.currentQuestion ?? null;
  const showTimer =
    gameState !== null &&
    (gameState.timerStatus === 'running' ||
      (gameState.timerStatus === 'paused' &&
        remainingMs < gameState.timerSeconds * 1000));

  // ---------------------------------------------------------------------------
  // PRE-JOIN SCREEN: Frictionless One-Tap Check-In & Audio Unlock
  // ---------------------------------------------------------------------------
  if (!guest) {
    return (
      <div className="min-h-[100dvh] bg-[#08090A] text-[#F7F8F8] flex flex-col">
        <div className="flex-1 w-full max-w-md mx-auto px-5 py-8 flex flex-col justify-between gap-8">
          {/* Top Brand */}
          <header className="flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8F98]">
            <span className="inline-flex items-center gap-2 text-[#F7F8F8]">
              <Recycle className="w-4 h-4 text-[#C8F560]" />
              Rethinking Waste
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-mono">
              <Users className="w-3.5 h-3.5 text-[#4CC38A]" />
              {checkedInCount} joined
            </span>
          </header>

          {/* Center Welcome Hero */}
          <main className="space-y-5 my-auto">
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-[#8A8F98]">
                {eventName}
              </p>
              <h1 className="text-[40px] font-semibold tracking-display leading-[1.04] text-[#F7F8F8] text-balance">
                {lang === 'fi' ? 'Kuka lajittelee?' : "Who's sorting?"}
              </h1>
              {lang === 'bilingual' && (
                <p className="text-[22px] font-medium tracking-display text-[#C8F560]">
                  Kuka lajittelee?
                </p>
              )}
            </div>

            <div className="rounded-[14px] bg-[#111214] border border-[#23252A] p-4 space-y-3 text-[14px] text-[#8A8F98] leading-relaxed">
              <p className="text-[#F7F8F8]">
                {lang === 'fi'
                  ? 'Saat oman osallistujanumeron yhdellä painalluksella. Kun numerosi arvotaan, puhelimesi hälyttää ja voit vastata suoraan näytöltä.'
                  : lang === 'en'
                    ? 'Tap once to get your personal number. When your number is called on the big screen, your phone chimes and unlocks the answer buttons for you.'
                    : 'Tap once to claim your number. When you’re called on Stage, your phone chimes and unlocks the answer buttons just for you.'}
              </p>
              {lang === 'bilingual' && (
                <p className="text-[13px] text-[#8A8F98]">
                  Napauta kerran saadaksesi numerosi. Puhelimesi hälyttää kun on sinun vuorosi vastata!
                </p>
              )}
            </div>

            {sessionResetNotice && (
              <div className="rounded-[10px] bg-[#18191C] border border-[#F5A524]/50 px-3.5 py-2.5 text-[13px] text-[#F5A524]">
                The host started a fresh check-in session. Tap below to get a new number.
              </div>
            )}

            {joinError && (
              <div className="rounded-[10px] bg-[#F2555A]/10 border border-[#F2555A]/50 px-3.5 py-2.5 text-[13px] text-[#F2555A]">
                {joinError}
              </div>
            )}
          </main>

          {/* Bottom Thumb-Zone Primary Action */}
          <footer className="space-y-3 pb-2">
            <button
              type="button"
              disabled={joining}
              onClick={() => void handleJoin()}
              className="w-full min-h-[56px] rounded-[12px] bg-[#C8F560] hover:bg-[#D6FA80] active:scale-[0.99] text-[#08090A] font-semibold text-[16px] px-5 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              <span>
                {joining
                  ? 'Claiming your number...'
                  : lang === 'fi'
                    ? 'Hae numerosi & ota äänet käyttöön'
                    : 'Get My Number & Enable Sound'}
              </span>
            </button>
            <p className="text-center text-[12px] text-[#5C616B]">
              {lang === 'fi'
                ? 'Ei kirjautumista · Pidä tämä välilehti auki pelin ajan'
                : 'No sign-up needed · Keep this screen open during the game'}
            </p>
          </footer>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // JOINED GUEST VIEW: Live Synced Waiting / Called / Answering / Revealed
  // ---------------------------------------------------------------------------
  const isRevealed = phase === 'revealed';
  const revealCorrect =
    isRevealed && currentQ && currentQ.type !== 'discussion'
      ? gameState?.roundOutcomeOverride !== null &&
        gameState?.roundOutcomeOverride !== undefined
        ? gameState.roundOutcomeOverride
        : currentQ.answer !== undefined && gameState?.selectedOption !== null
          ? gameState?.selectedOption === currentQ.answer
          : null
      : null;

  return (
    <div className="min-h-[100dvh] bg-[#08090A] text-[#F7F8F8] flex flex-col">
      {/* Slim Sticky Header (< 15% of viewport) */}
      <header className="sticky top-0 z-30 h-14 bg-[#08090A]/95 backdrop-blur-md border-b border-[#23252A]">
        <div className="max-w-md mx-auto h-full px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="tabular-mono text-[16px] font-semibold px-2.5 py-1 rounded-[8px] bg-[#C8F560] text-[#08090A] leading-none">
              #{guest.number}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#F7F8F8] truncate">
                {eventName}
              </div>
              <div className="text-[11px] text-[#8A8F98] flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connected ? 'bg-[#4CC38A]' : 'bg-[#F5A524]'
                  }`}
                />
                <span>{connected ? 'Live' : 'Syncing...'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-mono">{checkedInCount} joined</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute sound alerts' : 'Unmute sound alerts'}
            className={`w-11 h-11 rounded-[10px] border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              soundEnabled
                ? 'bg-[#111214] border-[#23252A] text-[#C8F560]'
                : 'bg-[#111214] border-[#23252A] text-[#5C616B]'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Column */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-5 flex flex-col justify-between gap-5">
        <AnimatePresence mode="wait">
          {/* 1. FINALE */}
          {phase === 'finale' && gameState?.finaleStats ? (
            <motion.section
              key="play-finale"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="my-auto space-y-5 text-center"
            >
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#C8F560]">
                  {lang === 'fi' ? 'Peli päättyi' : 'Cookout Finale'}
                </p>
                <h1 className="text-[32px] font-semibold tracking-display text-[#F7F8F8]">
                  {lang === 'fi' ? 'Kiitos lajittelusta!' : 'Thanks for sorting!'}
                </h1>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-[12px] bg-[#111214] border border-[#23252A] py-4 px-2">
                  <div className="tabular-mono text-[28px] font-semibold text-[#F7F8F8]">
                    {gameState.finaleStats.played}
                  </div>
                  <div className="text-[11px] text-[#8A8F98] mt-1">Rounds</div>
                </div>
                <div className="rounded-[12px] bg-[#111214] border border-[#23252A] py-4 px-2">
                  <div className="tabular-mono text-[28px] font-semibold text-[#4CC38A]">
                    {gameState.finaleStats.correct}
                  </div>
                  <div className="text-[11px] text-[#8A8F98] mt-1">Right</div>
                </div>
                <div className="rounded-[12px] bg-[#111214] border border-[#23252A] py-4 px-2">
                  <div className="tabular-mono text-[28px] font-semibold text-[#C8F560]">
                    {gameState.finaleStats.scoredCount > 0
                      ? `${gameState.finaleStats.accuracy}%`
                      : '—'}
                  </div>
                  <div className="text-[11px] text-[#8A8F98] mt-1">Group</div>
                </div>
              </div>

              <p className="text-[14px] text-[#8A8F98]">
                {lang === 'fi'
                  ? 'Nauttikaa juhlista — jokainen oikea lajittelu ratkaisee.'
                  : 'Enjoy the cookout — every smart sort counts!'}
              </p>
            </motion.section>
          ) : phase === 'drawn' && isMyTurn ? (
            /* 2. YOUR TURN — JUST CALLED UP! */
            <motion.section
              key="play-my-turn-drawn"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="my-auto rounded-[18px] bg-[#111214] border-2 border-[#C8F560] p-6 text-center space-y-4"
            >
              <div className="w-14 h-14 mx-auto rounded-[14px] bg-[#C8F560]/15 border border-[#C8F560]/40 flex items-center justify-center text-[#C8F560]">
                <Bell className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#C8F560]">
                  {lang === 'fi'
                    ? 'Sinun vuorosi!'
                    : lang === 'en'
                      ? "It's your turn!"
                      : "It's your turn! · Sinun vuorosi!"}
                </p>
                <div className="tabular-mono text-[76px] font-semibold leading-none tracking-display text-[#C8F560] drawn-text-glow py-1">
                  #{guest.number}
                </div>
              </div>

              <p className="text-[15px] text-[#F7F8F8] leading-relaxed">
                {lang === 'fi'
                  ? 'Katso näytölle — kysymys ilmestyy puhelimeesi ihan kohta!'
                  : 'Eyes on Stage — your question will appear right here in a second!'}
              </p>
            </motion.section>
          ) : (phase === 'answering' || phase === 'revealed') && currentQ ? (
            /* 3. QUESTION LIVE (ACTIVE TURN OR READ-ONLY SPECTATOR) & REVEAL */
            <motion.section
              key={`play-question-${currentQ.id}-${phase}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col gap-4"
            >
              {/* Turn Ownership Status Strip */}
              {isMyTurn ? (
                <div
                  className={`rounded-[12px] px-4 py-3 border flex items-center justify-between gap-3 ${
                    isRevealed
                      ? revealCorrect === true
                        ? 'bg-[#4CC38A]/12 border-[#4CC38A]/60 text-[#4CC38A]'
                        : revealCorrect === false
                          ? 'bg-[#F2555A]/12 border-[#F2555A]/60 text-[#F2555A]'
                          : 'bg-[#18191C] border-[#23252A] text-[#F7F8F8]'
                      : 'bg-[#C8F560]/12 border-[#C8F560]/60 text-[#C8F560]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                      {isRevealed
                        ? revealCorrect === true
                          ? lang === 'fi'
                            ? 'Oikein lajiteltu!'
                            : 'Spot on! · Oikein!'
                          : revealCorrect === false
                            ? lang === 'fi'
                              ? 'Läheltä liippasi!'
                              : 'Close one! · Läheltä liippasi!'
                            : 'Answer revealed'
                        : lang === 'fi'
                          ? 'Sinun vuorosi vastata!'
                          : "Your turn — tap your answer!"}
                    </div>
                    {!isRevealed && currentQ.type !== 'discussion' && (
                      <div className="text-[12px] text-[#F7F8F8]/80 mt-0.5">
                        Your tap reveals the answer on Stage immediately.
                      </div>
                    )}
                  </div>
                  {showTimer && !isRevealed && (
                    <TimerRing
                      totalSeconds={gameState!.timerSeconds}
                      remainingMs={remainingMs}
                      size={48}
                      strokeWidth={3.5}
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-[12px] bg-[#111214] border border-[#23252A] px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Lock className="w-4 h-4 text-[#8A8F98] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#F7F8F8]">
                        {gameState?.currentNumber !== null
                          ? `Guest #${gameState?.currentNumber} is answering`
                          : 'Spectator view'}
                      </div>
                      <div className="text-[12px] text-[#8A8F98]">
                        {isRevealed
                          ? 'Answer revealed on Stage'
                          : gameState?.currentNumber !== null
                            ? `Only #${gameState?.currentNumber} can answer this round`
                            : 'Follow along on Stage'}
                      </div>
                    </div>
                  </div>
                  {showTimer && !isRevealed && (
                    <TimerRing
                      totalSeconds={gameState!.timerSeconds}
                      remainingMs={remainingMs}
                      size={44}
                      strokeWidth={3.5}
                    />
                  )}
                </div>
              )}

              {/* Question Card */}
              <div className="rounded-[14px] bg-[#111214] border border-[#23252A] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[12px] text-[#8A8F98]">
                  <span className="tabular-mono">
                    Round {(gameState?.currentIndex ?? 0) + 1} /{' '}
                    {gameState?.totalQuestions ?? 0}
                  </span>
                  {currentQ.category ? (
                    <CategoryTag category={currentQ.category} languageMode={lang} />
                  ) : (
                    <span className="uppercase tracking-[0.04em] text-[11px]">
                      {lang === 'fi' ? 'Minne kuuluu?' : 'Which bin?'}
                    </span>
                  )}
                </div>

                <h2 className="text-[20px] font-semibold tracking-display leading-snug text-[#F7F8F8] text-balance">
                  {lang === 'fi' && currentQ.promptFi
                    ? currentQ.promptFi
                    : currentQ.prompt}
                </h2>
                {lang === 'bilingual' && currentQ.promptFi && (
                  <p className="text-[14px] text-[#8A8F98] leading-snug">
                    {currentQ.promptFi}
                  </p>
                )}
              </div>

              {/* Options or Open Discussion */}
              {currentQ.type === 'discussion' ? (
                <div className="rounded-[14px] bg-[#111214] border border-[#23252A] p-5 flex items-start gap-3.5">
                  <MessageCircle className="w-5 h-5 text-[#C8F560] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-[15px] font-semibold text-[#F7F8F8]">
                      {isMyTurn
                        ? 'Share your answer out loud!'
                        : 'Open discussion round'}
                    </div>
                    <p className="text-[13px] text-[#8A8F98] leading-relaxed">
                      {isMyTurn
                        ? 'No right or wrong answer here — tell the crowd your tip or story!'
                        : 'Listen in as the called guest shares their story with the room.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {currentQ.options.map((opt, idx) => {
                    const optFi = currentQ.optionsFi?.[idx];
                    const displayPrimary = lang === 'fi' && optFi ? optFi : opt;
                    const displaySecondary =
                      lang === 'bilingual' && optFi && optFi !== opt ? optFi : null;
                    const binCat =
                      currentQ.type === 'which-bin' ? inferBinCategory(opt) : null;
                    const binHex = binCat ? WASTE_CATEGORIES[binCat].hex : null;

                    const isPicked = gameState?.selectedOption === idx;
                    const isCorrectOpt = isRevealed && currentQ.answer === idx;
                    const isWrongPick =
                      isRevealed && isPicked && currentQ.answer !== idx;
                    const canTap =
                      isMyTurn && phase === 'answering' && submittingIdx === null;

                    let cardStyle =
                      'bg-[#111214] border-[#23252A] text-[#F7F8F8]';
                    if (isCorrectOpt) {
                      cardStyle =
                        'bg-[#4CC38A]/15 border-[#4CC38A] text-[#F7F8F8]';
                    } else if (isWrongPick) {
                      cardStyle =
                        'bg-[#F2555A]/15 border-[#F2555A] text-[#F7F8F8]';
                    } else if (isRevealed) {
                      cardStyle =
                        'bg-[#0D0E10] border-[#1E2025] text-[#8A8F98] opacity-55';
                    } else if (submittingIdx === idx || isPicked) {
                      cardStyle =
                        'bg-[#18191C] border-[#C8F560] text-[#F7F8F8]';
                    } else if (canTap) {
                      cardStyle =
                        'bg-[#111214] border-[#2C2F36] text-[#F7F8F8] active:scale-[0.99] hover:border-[#C8F560]/70 hover:bg-[#18191C]';
                    } else {
                      // Spectator locked state
                      cardStyle =
                        'bg-[#0E0F11] border-[#1E2024] text-[#8A8F98] opacity-75';
                    }

                    return (
                      <button
                        key={`${currentQ.id}-opt-${idx}`}
                        type="button"
                        disabled={!canTap}
                        onClick={() => void handleSubmitAnswer(idx)}
                        className={`w-full min-h-[58px] rounded-[12px] border px-4 py-3.5 text-left flex items-center gap-3.5 transition-all ${cardStyle} ${
                          canTap ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-[8px] border flex items-center justify-center tabular-mono text-[13px] font-semibold shrink-0 ${
                            isCorrectOpt
                              ? 'bg-[#4CC38A] border-[#4CC38A] text-[#08090A]'
                              : isWrongPick
                                ? 'bg-[#F2555A] border-[#F2555A] text-[#08090A]'
                                : submittingIdx === idx
                                  ? 'bg-[#C8F560] border-[#C8F560] text-[#08090A]'
                                  : 'bg-[#18191C] border-[#2C2F36] text-[#8A8F98]'
                          }`}
                        >
                          {isCorrectOpt ? (
                            <Check className="w-4 h-4" />
                          ) : isWrongPick ? (
                            <X className="w-4 h-4" />
                          ) : (
                            OPTION_KEYS[idx] ?? idx + 1
                          )}
                        </span>

                        {binHex && (
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: binHex }}
                            aria-hidden="true"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-medium leading-snug">
                            {displayPrimary}
                          </div>
                          {displaySecondary && (
                            <div className="text-[12px] text-[#8A8F98] mt-0.5">
                              {displaySecondary}
                            </div>
                          )}
                        </div>

                        {submittingIdx === idx && (
                          <span className="text-[12px] text-[#C8F560] font-medium shrink-0">
                            Sending...
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {submitError && (
                <div className="rounded-[10px] bg-[#F2555A]/10 border border-[#F2555A]/50 px-3.5 py-2.5 text-[13px] text-[#F2555A]">
                  {submitError}
                </div>
              )}

              {/* Revealed Explanation Card */}
              {isRevealed && currentQ.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[12px] bg-[#18191C] border border-[#23252A] p-4 space-y-2"
                >
                  {currentQ.category && (
                    <CategoryTag
                      category={currentQ.category}
                      languageMode={lang}
                      variant="chip"
                    />
                  )}
                  <p className="text-[14px] text-[#F7F8F8] leading-relaxed">
                    {lang === 'fi' && currentQ.explanationFi
                      ? currentQ.explanationFi
                      : currentQ.explanation}
                  </p>
                  {lang === 'bilingual' && currentQ.explanationFi && (
                    <p className="text-[13px] text-[#8A8F98] leading-relaxed">
                      {currentQ.explanationFi}
                    </p>
                  )}
                </motion.div>
              )}
            </motion.section>
          ) : (
            /* 4. WAITING / DRAWING / ANOTHER GUEST DRAWN */
            <motion.section
              key={`play-waiting-${phase}-${gameState?.currentNumber ?? 'none'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="my-auto space-y-5"
            >
              <div className="rounded-[18px] bg-[#111214] border border-[#23252A] p-6 text-center space-y-4">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#8A8F98]">
                  {lang === 'fi' ? 'Sinun numerosi' : 'Your Guest Number'}
                </p>

                <div className="tabular-mono text-[84px] font-semibold leading-none tracking-display text-[#C8F560] drawn-text-glow">
                  #{guest.number}
                </div>

                <div className="pt-2 border-t border-[#23252A] space-y-1.5">
                  {phase === 'drawing' ? (
                    <>
                      <p className="text-[16px] font-medium text-[#F7F8F8]">
                        {lang === 'fi'
                          ? 'Arvotaan osallistujaa...'
                          : 'Drawing a guest on Stage...'}
                      </p>
                      <p className="text-[13px] text-[#8A8F98]">
                        Eyes up — could be you!
                      </p>
                    </>
                  ) : phase === 'drawn' && gameState?.currentNumber !== null ? (
                    <>
                      <p className="text-[16px] font-medium text-[#F7F8F8]">
                        Guest #{gameState?.currentNumber} was called up
                      </p>
                      <p className="text-[13px] text-[#8A8F98]">
                        {lang === 'fi'
                          ? `Vieras #${gameState?.currentNumber} vuorossa — seuraava kierros voi olla sinun!`
                          : 'Sit tight — the question will appear here in read-only mode.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[16px] font-medium text-[#F7F8F8]">
                        {lang === 'fi'
                          ? 'Olet mukana pelissä!'
                          : "You're checked in!"}
                      </p>
                      <p className="text-[13px] text-[#8A8F98] leading-relaxed">
                        {lang === 'fi'
                          ? 'Pidä tämä sivu auki — puhelimesi hälyttää, kun numerosi arvotaan.'
                          : 'Keep this screen open — your phone will chime when your number is called.'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Sound check helper */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    setSoundEnabled(true);
                    playYourTurnAlert();
                  }}
                  className="min-h-[44px] px-4 rounded-[10px] bg-[#111214] border border-[#23252A] hover:border-[#343740] text-[13px] font-medium text-[#8A8F98] hover:text-[#F7F8F8] inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#C8F560]" />
                  <span>Test turn alert sound</span>
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
