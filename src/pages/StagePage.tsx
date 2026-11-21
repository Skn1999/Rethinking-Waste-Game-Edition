import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize2, MessageCircle, Minimize2, Recycle, Users } from 'lucide-react';
import {
  QrCodeSvg,
  getDisplayJoinUrl,
  getGuestJoinUrl,
} from '../components/QrCodeSvg';
import { Card } from '../components/ui/Card';
import { CategoryTag } from '../components/ui/CategoryTag';
import { OptionRow, type OptionRowState } from '../components/ui/OptionRow';
import { TimerRing } from '../components/ui/TimerRing';
import { useSlotRoll } from '../hooks/useSlotRoll';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import {
  hydrateFromRelay,
  subscribeStageFullscreenCommand,
  useGameStore,
} from '../store/gameStore';
import { WASTE_CATEGORY_LIST, type Question } from '../types/game';

/**
 * Read-only 16:9 big-screen projector Stage (/stage).
 * Strictly isolated: NEVER displays host-only data (correct answer before reveal,
 * presenter notes, or the guest number grid).
 */
export function StagePage() {
  const settings = useGameStore((s) => s.settings);
  const questions = useGameStore((s) => s.questions);
  const order = useGameStore((s) => s.order);
  const currentIndex = useGameStore((s) => s.currentIndex);
  const phase = useGameStore((s) => s.phase);
  const currentNumber = useGameStore((s) => s.currentNumber);
  const selectedOption = useGameStore((s) => s.selectedOption);
  const rounds = useGameStore((s) => s.rounds);
  const drawAnimation = useGameStore((s) => s.drawAnimation);
  const checkedInNumbers = useGameStore((s) => s.checkedInNumbers);
  const joinUrl = useMemo(() => getGuestJoinUrl(), []);
  const displayJoinUrl = useMemo(() => getDisplayJoinUrl(), []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsHintVisible, setFsHintVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { remainingMs, totalSeconds, status: timerStatus } = useSyncedTimer();

  const prefersReduced =
    settings.reducedMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const { displayedNumber, isRolling } = useSlotRoll({
    isDrawing: phase === 'drawing',
    drawAnimation,
    currentNumber,
    reducedMotion: prefersReduced,
  });

  const currentQuestion: Question | null = useMemo(() => {
    const id = order[currentIndex];
    if (!id) return null;
    return questions.find((q) => q.id === id) ?? null;
  }, [questions, order, currentIndex]);

  useEffect(() => {
    void hydrateFromRelay();
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [currentQuestion?.id]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFsHintVisible(false);
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser blocked programmatic fullscreen without local user gesture
      setFsHintVisible(true);
      window.setTimeout(() => setFsHintVisible(false), 4000);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyDown);
    const unsub = subscribeStageFullscreenCommand(() => {
      void toggleFullscreen();
    });
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [toggleFullscreen]);

  const finaleStats = useMemo(() => {
    const scored = rounds.filter((r) => r.correct !== null);
    const correct = scored.filter((r) => r.correct === true).length;
    const accuracy =
      scored.length > 0 ? Math.round((correct / scored.length) * 100) : 0;
    const uniqueGuests = new Set(
      rounds.map((r) => r.number).filter((n): n is number => n !== null)
    ).size;
    return {
      played: rounds.length,
      correct,
      scoredCount: scored.length,
      accuracy,
      uniqueGuests,
    };
  }, [rounds]);

  const getOptionState = (idx: number): OptionRowState => {
    if (!currentQuestion) return 'idle';
    // Strict ST8 isolation: never show correct answer until phase === 'revealed'
    if (phase === 'revealed') {
      const isCorrect = currentQuestion.answer === idx;
      const isPicked = selectedOption === idx;
      if (isCorrect) return 'correct';
      if (isPicked && !isCorrect) return 'wrong';
      return 'dimmed';
    }
    if (selectedOption === idx) return 'selected';
    return 'idle';
  };

  const lang = settings.languageMode;
  const isRevealed = phase === 'revealed';
  const showTimer =
    timerStatus === 'running' ||
    (timerStatus === 'paused' && remainingMs < totalSeconds * 1000);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#08090A] text-[#F7F8F8] select-none flex flex-col">
      {/* Discrete hover-only Fullscreen toggle */}
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        className={`fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] bg-[#111214]/90 border border-[#23252A] text-[12px] text-[#8A8F98] hover:text-[#F7F8F8] hover:border-[#343740] transition-opacity duration-150 cursor-pointer ${
          fsHintVisible ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5" />
        )}
        <span>{fsHintVisible ? 'Click for Fullscreen' : 'Fullscreen'}</span>
      </button>

      {/* Main Stage Content */}
      <AnimatePresence mode="wait">
        {phase === 'idle' ? (
          <motion.div
            key="stage-idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 flex flex-col justify-between p-[clamp(24px,3vw,56px)]"
          >
            {/* Top Event Identity */}
            <div className="flex items-center justify-between text-[clamp(14px,1.15vw,22px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
              <span>Rethinking Waste</span>
              <span>{settings.eventName}</span>
            </div>

            {/* Center Ambient Hero + QR Check-In Card */}
            <div className="relative flex-1 grid grid-cols-12 items-center gap-[clamp(24px,3vw,56px)] px-[clamp(8px,1.5vw,28px)] min-h-0">
              {!prefersReduced && (
                <motion.div
                  aria-hidden="true"
                  animate={{
                    scale: [1, 1.08, 1],
                    opacity: [0.14, 0.24, 0.14],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="pointer-events-none absolute left-[18%] top-1/2 -translate-y-1/2 w-[clamp(260px,30vw,540px)] h-[clamp(260px,30vw,540px)] rounded-full blur-[110px]"
                  style={{ backgroundColor: '#C8F560' }}
                />
              )}

              {/* Left 7 Cols: Title & Join Prompt */}
              <div className="relative z-10 col-span-7 space-y-[clamp(12px,1.4vw,24px)] text-left">
                {settings.eventMeta && (
                  <p className="text-[clamp(16px,1.25vw,24px)] font-medium text-[#8A8F98]">
                    {settings.eventMeta}
                  </p>
                )}
                <h1 className="text-[clamp(54px,6.2vw,124px)] font-semibold tracking-display leading-[0.98] text-[#F7F8F8] text-balance">
                  {lang === 'fi' ? 'Kuka lajittelee?' : "Who's sorting?"}
                </h1>
                {lang === 'bilingual' && (
                  <p className="text-[clamp(26px,2.8vw,56px)] font-medium tracking-display text-[#C8F560]">
                    Kuka lajittelee?
                  </p>
                )}
                <p className="text-[clamp(18px,1.45vw,28px)] text-[#8A8F98] max-w-2xl pt-2 leading-snug">
                  {lang === 'fi'
                    ? 'Skannaa QR-koodi saadaksesi numerosi — puhelimesi hälyttää, kun on sinun vuorosi vastata!'
                    : lang === 'en'
                      ? 'Scan the QR code to get your number — your phone chimes when you’re up to answer!'
                      : 'Scan to claim your number & answer on your phone · Skannaa ja hae numerosi!'}
                </p>
              </div>

              {/* Right 5 Cols: High-Contrast QR Check-In Card */}
              <div className="relative z-10 col-span-5 flex justify-center">
                <Card
                  variant="hero"
                  padding="none"
                  className="w-full max-w-[clamp(300px,28vw,460px)] p-[clamp(20px,2vw,36px)] flex flex-col items-center text-center gap-[clamp(14px,1.3vw,22px)]"
                >
                  <div className="text-[clamp(13px,1.05vw,18px)] font-semibold uppercase tracking-[0.06em] text-[#C8F560]">
                    {lang === 'fi'
                      ? 'Skannaa & liity mukaan'
                      : lang === 'en'
                        ? 'Scan to Join & Play'
                        : 'Scan to Join · Skannaa mukaan'}
                  </div>

                  <div className="bg-white rounded-[14px] p-[clamp(10px,0.9vw,16px)] shadow-sm">
                    <QrCodeSvg
                      value={joinUrl}
                      size="100%"
                      className="w-[clamp(170px,16vw,270px)] h-[clamp(170px,16vw,270px)] block"
                      label="Scan QR code to check in and receive your guest number"
                    />
                  </div>

                  <div className="space-y-1.5 w-full">
                    <div className="inline-flex items-center justify-center gap-2 text-[clamp(16px,1.35vw,24px)] font-semibold text-[#F7F8F8] tabular-mono">
                      <Users className="w-[clamp(16px,1.3vw,22px)] h-[clamp(16px,1.3vw,22px)] text-[#4CC38A]" />
                      <span>
                        {checkedInNumbers.length}{' '}
                        {lang === 'fi'
                          ? 'mukana'
                          : checkedInNumbers.length === 1
                            ? 'guest joined'
                            : 'guests joined'}
                      </span>
                    </div>
                    <div className="text-[clamp(11px,0.85vw,15px)] tabular-mono text-[#8A8F98] truncate px-2">
                      {displayJoinUrl}
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Bottom Sorting Palette Strip */}
            <Card padding="sm" className="px-[clamp(16px,1.6vw,32px)] py-[clamp(12px,1vw,20px)]">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                {WASTE_CATEGORY_LIST.map((cat) => (
                  <CategoryTag
                    key={cat}
                    category={cat}
                    languageMode={lang}
                    size="md"
                  />
                ))}
              </div>
            </Card>
          </motion.div>
        ) : phase === 'finale' ? (
          <motion.div
            key="stage-finale"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 flex flex-col justify-between p-[clamp(24px,3vw,56px)] gap-[clamp(16px,1.8vw,32px)]"
          >
            <div className="flex items-center justify-between text-[clamp(14px,1.15vw,22px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
              <span>Rethinking Waste</span>
              <span>{settings.eventName}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-[clamp(24px,2.8vw,48px)] max-w-[1600px] w-full mx-auto">
              <div className="space-y-3 text-center">
                <h1 className="text-[clamp(48px,5.2vw,104px)] font-semibold tracking-display leading-none text-[#F7F8F8]">
                  {lang === 'fi'
                    ? 'Kiitos lajittelusta!'
                    : 'Thanks for sorting!'}
                </h1>
                {lang === 'bilingual' && (
                  <p className="text-[clamp(24px,2.4vw,48px)] font-medium tracking-display text-[#C8F560]">
                    Kiitos lajittelusta!
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-[clamp(16px,1.5vw,28px)]">
                <Card variant="hero" className="text-center py-[clamp(24px,2.8vw,52px)]">
                  <div className="tabular-mono text-[clamp(56px,6.2vw,120px)] font-semibold leading-none text-[#F7F8F8]">
                    {finaleStats.played}
                  </div>
                  <div className="text-[clamp(14px,1.2vw,24px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98] mt-3">
                    {lang === 'fi' ? 'Pelatut kierrokset' : 'Questions Played'}
                  </div>
                </Card>

                <Card variant="hero" className="text-center py-[clamp(24px,2.8vw,52px)]">
                  <div className="tabular-mono text-[clamp(56px,6.2vw,120px)] font-semibold leading-none text-[#4CC38A]">
                    {finaleStats.correct}
                  </div>
                  <div className="text-[clamp(14px,1.2vw,24px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98] mt-3">
                    {lang === 'fi' ? 'Oikein lajiteltu' : 'Sorted Correctly'}
                  </div>
                </Card>

                <Card variant="hero" className="text-center py-[clamp(24px,2.8vw,52px)]">
                  <div className="tabular-mono text-[clamp(56px,6.2vw,120px)] font-semibold leading-none text-[#C8F560] drawn-text-glow">
                    {finaleStats.scoredCount > 0 ? `${finaleStats.accuracy}%` : '—'}
                  </div>
                  <div className="text-[clamp(14px,1.2vw,24px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98] mt-3">
                    {lang === 'fi' ? 'Yhteistulos' : 'Group Accuracy'}
                  </div>
                </Card>
              </div>
            </div>

            <div className="text-center text-[clamp(16px,1.35vw,26px)] text-[#8A8F98]">
              {lang === 'fi'
                ? 'Nauttikaa grillijuhlista — muistetaan oikeat astiat kotimatkallakin.'
                : lang === 'en'
                  ? 'Enjoy the cookout — every smart sort counts.'
                  : 'Enjoy the cookout · Nauttikaa grillijuhlista — every smart sort counts.'}
            </div>
          </motion.div>
        ) : currentQuestion &&
          (phase === 'question' || phase === 'drawing' || phase === 'drawn') ? (
          <motion.div
            key={`stage-draw-spotlight-${currentIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 flex flex-col p-[clamp(18px,2vw,36px)] gap-[clamp(14px,1.1vw,20px)] min-h-0"
          >
            {/* Quiet Stage Top Row — no question or category spoiled before reveal */}
            <header className="flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 text-[clamp(14px,1.05vw,20px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                <span className="text-[#F7F8F8]">{settings.eventName}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-mono">
                  {lang === 'fi' ? 'Kierros' : 'Round'}{' '}
                  {String(currentIndex + 1).padStart(2, '0')} /{' '}
                  {String(order.length).padStart(2, '0')}
                </span>
              </div>
              <span className="text-[clamp(14px,1.05vw,20px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                Rethinking Waste
              </span>
            </header>

            {/* Full-Stage Centered Number Draw Hero */}
            <Card
              variant="hero"
              padding="none"
              className="flex-1 p-[clamp(28px,3vw,60px)] flex flex-col items-center justify-between text-center relative overflow-hidden"
            >
              {/* Top Prompt */}
              <div className="space-y-1">
                <p className="text-[clamp(18px,1.6vw,30px)] font-medium uppercase tracking-[0.05em] text-[#8A8F98]">
                  {displayedNumber === null
                    ? lang === 'fi'
                      ? 'Kuka lajittelee seuraavaksi?'
                      : "Who's sorting next?"
                    : isRolling
                      ? lang === 'fi'
                        ? 'Arvotaan osallistujaa...'
                        : 'Drawing a guest...'
                      : lang === 'fi'
                        ? 'Vuorossa numero'
                        : 'Up next to sort'}
                </p>
                {lang === 'bilingual' && displayedNumber === null && (
                  <p className="text-[clamp(14px,1.15vw,22px)] text-[#5C616B]">
                    Kuka lajittelee seuraavaksi?
                  </p>
                )}
              </div>

              {/* Giant Centerpiece Number */}
              <div className="relative flex-1 flex items-center justify-center w-full">
                {displayedNumber === null ? (
                  <div className="tabular-mono text-[clamp(160px,22vw,380px)] font-semibold leading-none text-[#23252A]">
                    ?
                  </div>
                ) : (
                  <motion.div
                    key={isRolling ? 'spotlight-rolling' : `spotlight-settled-${displayedNumber}`}
                    initial={
                      !isRolling && !prefersReduced
                        ? { scale: 1.14, opacity: 0.85 }
                        : { opacity: 1 }
                    }
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className={`tabular-mono text-[clamp(180px,24vw,420px)] font-semibold leading-none tracking-display ${
                      isRolling
                        ? 'text-[#F7F8F8]'
                        : 'text-[#C8F560] drawn-text-glow'
                    }`}
                  >
                    {displayedNumber}
                  </motion.div>
                )}
              </div>

              {/* Bottom Call-up Cue */}
              <div className="min-h-[clamp(40px,3.6vw,68px)] flex flex-col items-center justify-center">
                {displayedNumber === null ? (
                  <p className="text-[clamp(18px,1.45vw,28px)] text-[#8A8F98]">
                    {lang === 'fi'
                      ? 'Pidä numerosi valmiina!'
                      : lang === 'en'
                        ? 'Hold up your number — drawing any second!'
                        : 'Hold up your number · Pidä numerosi valmiina!'}
                  </p>
                ) : isRolling ? (
                  <p className="text-[clamp(18px,1.45vw,28px)] text-[#8A8F98]">
                    {lang === 'fi' ? 'Kenen numero osuu?' : 'Who is it going to be?'}
                  </p>
                ) : (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="text-[clamp(22px,1.9vw,38px)] font-medium text-[#F7F8F8]"
                  >
                    {lang === 'fi'
                      ? `Numero ${displayedNumber} — astu esiin! Kysymys tulossa...`
                      : lang === 'en'
                        ? `Guest #${displayedNumber} — step on up! Question coming up...`
                        : `Guest #${displayedNumber}, step on up! · Numero ${displayedNumber}, astu esiin!`}
                  </motion.p>
                )}
              </div>
            </Card>
          </motion.div>
        ) : currentQuestion ? (
          <motion.div
            key={`stage-round-${currentQuestion.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 flex flex-col p-[clamp(18px,2vw,36px)] gap-[clamp(14px,1.1vw,20px)] min-h-0"
          >
            {/* Quiet Stage Top Row */}
            <header className="flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 text-[clamp(14px,1.05vw,20px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                <span className="text-[#F7F8F8]">{settings.eventName}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-mono">
                  {String(currentIndex + 1).padStart(2, '0')} /{' '}
                  {String(order.length).padStart(2, '0')}
                </span>
              </div>

              {currentQuestion.type === 'which-bin' && !isRevealed ? (
                <span className="text-[clamp(14px,1.15vw,22px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                  {lang === 'fi'
                    ? 'Minne kuuluu?'
                    : lang === 'en'
                      ? 'Which bin?'
                      : 'Which bin? · Minne kuuluu?'}
                </span>
              ) : (
                <CategoryTag
                  category={currentQuestion.category}
                  languageMode={lang}
                  size="stage"
                />
              )}
            </header>

            {/* 12-column Bento Stage */}
            <div className="flex-1 grid grid-cols-12 gap-[clamp(14px,1.1vw,20px)] min-h-0">
              {/* LEFT 8 COLUMNS: Question, Options & Reveal Explanation */}
              <Card
                variant="hero"
                category={
                  currentQuestion.type === 'which-bin' && !isRevealed
                    ? undefined
                    : currentQuestion.category
                }
                padding="none"
                className="col-span-8 p-[clamp(22px,2.2vw,44px)] flex flex-col justify-between gap-[clamp(16px,1.5vw,28px)] min-h-0 overflow-hidden"
              >
                {/* Question Headline + Optional Image */}
                <div className="flex items-start justify-between gap-6 min-h-0">
                  <div className="space-y-[clamp(8px,0.7vw,14px)] min-w-0 flex-1">
                    <h1 className="text-[clamp(36px,3.65vw,80px)] font-semibold tracking-display leading-[1.08] text-[#F7F8F8] line-clamp-3 text-balance">
                      {lang === 'fi' && currentQuestion.promptFi
                        ? currentQuestion.promptFi
                        : currentQuestion.prompt}
                    </h1>
                    {lang === 'bilingual' && currentQuestion.promptFi && (
                      <p className="text-[clamp(18px,1.5vw,32px)] font-medium text-[#8A8F98] leading-snug line-clamp-2">
                        {currentQuestion.promptFi}
                      </p>
                    )}
                  </div>

                  {currentQuestion.image && (
                    <div className="w-[clamp(120px,13vw,240px)] aspect-square rounded-[12px] border border-[#23252A] bg-[#18191C] overflow-hidden shrink-0 flex items-center justify-center">
                      {!imageError ? (
                        <img
                          src={currentQuestion.image}
                          alt={currentQuestion.prompt}
                          referrerPolicy="no-referrer"
                          onError={() => setImageError(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Recycle className="w-12 h-12 text-[#5C616B]" />
                      )}
                    </div>
                  )}
                </div>

                {/* Options Grid OR Open Discussion Module */}
                {currentQuestion.type === 'discussion' ? (
                  <div className="rounded-[14px] bg-[#08090A] border border-[#23252A] px-[clamp(20px,2vw,36px)] py-[clamp(18px,1.8vw,32px)] flex items-center gap-[clamp(14px,1.4vw,24px)]">
                    <div className="w-[clamp(44px,3.2vw,64px)] h-[clamp(44px,3.2vw,64px)] rounded-[12px] bg-[#18191C] border border-[#23252A] flex items-center justify-center shrink-0">
                      <MessageCircle className="w-[clamp(22px,1.6vw,32px)] h-[clamp(22px,1.6vw,32px)] text-[#C8F560]" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[clamp(20px,1.7vw,34px)] font-semibold text-[#F7F8F8] tracking-display">
                        {lang === 'fi'
                          ? 'Avoin keskustelu — ei oikeaa tai väärää vastausta'
                          : lang === 'en'
                            ? 'Open discussion — no right or wrong answer'
                            : 'Open discussion · Avoin keskustelu'}
                      </div>
                      <p className="text-[clamp(15px,1.2vw,24px)] text-[#8A8F98]">
                        {lang === 'fi'
                          ? 'Jaa oma tarinasi tai vinkkisi muille!'
                          : lang === 'en'
                            ? 'Share your story or tip with the crowd.'
                            : 'Share your story with the crowd · Jaa oma vinkkisi!'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`grid gap-[clamp(10px,0.9vw,18px)] ${
                      currentQuestion.type === 'which-bin' ||
                      currentQuestion.type === 'true-false'
                        ? 'grid-cols-2'
                        : 'grid-cols-1'
                    }`}
                  >
                    {currentQuestion.options.map((opt, idx) => (
                      <OptionRow
                        key={`${currentQuestion.id}-stage-${idx}`}
                        index={idx}
                        label={opt}
                        labelFi={currentQuestion.optionsFi?.[idx]}
                        isBinOption={currentQuestion.type === 'which-bin'}
                        languageMode={lang}
                        state={getOptionState(idx)}
                        size="stage"
                      />
                    ))}
                  </div>
                )}

                {/* Reveal Explanation Slide-up Card (ST6) */}
                <AnimatePresence>
                  {isRevealed && (
                    <motion.div
                      initial={
                        prefersReduced ? { opacity: 0 } : { opacity: 0, y: 16 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="rounded-[12px] bg-[#18191C] border border-[#23252A] px-[clamp(18px,1.6vw,32px)] py-[clamp(14px,1.2vw,24px)] flex items-start gap-[clamp(14px,1.2vw,24px)]"
                    >
                      <CategoryTag
                        category={currentQuestion.category}
                        languageMode={lang}
                        variant="chip"
                        size="stage"
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[clamp(18px,1.45vw,28px)] font-medium text-[#F7F8F8] leading-snug">
                          {lang === 'fi' && currentQuestion.explanationFi
                            ? currentQuestion.explanationFi
                            : currentQuestion.explanation}
                        </p>
                        {lang === 'bilingual' &&
                          currentQuestion.explanationFi && (
                            <p className="text-[clamp(14px,1.1vw,22px)] text-[#8A8F98] leading-snug">
                              {currentQuestion.explanationFi}
                            </p>
                          )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* RIGHT 4 COLUMNS: Hero Drawn Number + Timer Ring (ST4, ST5) */}
              <Card
                variant="hero"
                padding="none"
                className="col-span-4 p-[clamp(22px,2vw,40px)] flex flex-col items-center justify-between text-center min-h-0 relative overflow-hidden"
              >
                {/* Top Label */}
                <div className="w-full flex flex-col items-center gap-1">
                  <span className="text-[clamp(14px,1.1vw,20px)] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                    {displayedNumber === null
                      ? lang === 'fi'
                        ? 'Kuka lajittelee?'
                        : "Who's sorting?"
                      : isRolling
                        ? lang === 'fi'
                          ? 'Arvotaan numero...'
                          : 'Drawing a number...'
                        : lang === 'fi'
                          ? 'Vuorossa numero'
                          : 'Now answering'}
                  </span>
                  {lang === 'bilingual' && displayedNumber === null && (
                    <span className="text-[clamp(12px,0.9vw,16px)] text-[#5C616B]">
                      Kuka lajittelee?
                    </span>
                  )}
                </div>

                {/* Giant Drawn Number (320px at 1920x1080) */}
                <div className="relative flex-1 flex items-center justify-center w-full">
                  {displayedNumber === null ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="tabular-mono text-[clamp(120px,13vw,260px)] font-semibold leading-none text-[#23252A]">
                        ?
                      </div>
                      <p className="text-[clamp(14px,1.1vw,20px)] text-[#5C616B]">
                        {lang === 'fi'
                          ? 'Odotetaan arvontaa'
                          : 'Waiting for draw'}
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      key={
                        isRolling
                          ? 'rolling'
                          : `settled-${displayedNumber}`
                      }
                      initial={
                        !isRolling && !prefersReduced
                          ? { scale: 1.12, opacity: 0.85 }
                          : { opacity: 1 }
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={`tabular-mono text-[clamp(136px,16.6vw,340px)] font-semibold leading-none tracking-display ${
                        isRolling
                          ? 'text-[#F7F8F8]'
                          : 'text-[#C8F560] drawn-text-glow'
                      }`}
                    >
                      {displayedNumber}
                    </motion.div>
                  )}
                </div>

                {/* Bottom Zone: Timer Ring (visible while running/paused) */}
                <div className="h-[clamp(88px,7vw,132px)] flex items-center justify-center">
                  <AnimatePresence>
                    {showTimer && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="flex items-center gap-4"
                      >
                        <TimerRing
                          totalSeconds={totalSeconds}
                          remainingMs={remainingMs}
                          size={96}
                          strokeWidth={4.5}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
