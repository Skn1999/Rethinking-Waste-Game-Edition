import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FastForward,
  Flag,
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  StickyNote,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CategoryTag } from '../components/ui/CategoryTag';
import { Kbd } from '../components/ui/Kbd';
import { NumberTile } from '../components/ui/NumberTile';
import { OptionRow, type OptionRowState } from '../components/ui/OptionRow';
import { TimerRing } from '../components/ui/TimerRing';
import { Toast } from '../components/ui/Toast';
import { useSlotRoll } from '../hooks/useSlotRoll';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { publishCurrentState, useGameStore } from '../store/gameStore';
import type { NumberState, Question } from '../types/game';
import {
  playCorrectGuess,
  playNeutralReveal,
  playNumberDrawn,
  playRollTick,
  playTimerWarningTick,
  playWrongGuess,
  unlockAudio,
} from '../utils/sound';

export function HostPage() {
  const settings = useGameStore((s) => s.settings);
  const questions = useGameStore((s) => s.questions);
  const order = useGameStore((s) => s.order);
  const currentIndex = useGameStore((s) => s.currentIndex);
  const phase = useGameStore((s) => s.phase);
  const numbers = useGameStore((s) => s.numbers);
  const currentNumber = useGameStore((s) => s.currentNumber);
  const selectedOption = useGameStore((s) => s.selectedOption);
  const roundOutcomeOverride = useGameStore((s) => s.roundOutcomeOverride);
  const rounds = useGameStore((s) => s.rounds);
  const history = useGameStore((s) => s.history);
  const drawAnimation = useGameStore((s) => s.drawAnimation);
  const poolEmptyPrompt = useGameStore((s) => s.poolEmptyPrompt);
  const toast = useGameStore((s) => s.toast);

  const startGame = useGameStore((s) => s.startGame);
  const goToIdle = useGameStore((s) => s.goToIdle);
  const goToFinale = useGameStore((s) => s.goToFinale);
  const restartGame = useGameStore((s) => s.restartGame);
  const nextQuestion = useGameStore((s) => s.nextQuestion);
  const prevQuestion = useGameStore((s) => s.prevQuestion);
  const skipQuestion = useGameStore((s) => s.skipQuestion);
  const drawNumber = useGameStore((s) => s.drawNumber);
  const completeDrawAnimation = useGameStore((s) => s.completeDrawAnimation);
  const markAbsentAndRedraw = useGameStore((s) => s.markAbsentAndRedraw);
  const toggleExcludeNumber = useGameStore((s) => s.toggleExcludeNumber);
  const forcePickNumber = useGameStore((s) => s.forcePickNumber);
  const resetNumberPool = useGameStore((s) => s.resetNumberPool);
  const dismissPoolEmptyPrompt = useGameStore((s) => s.dismissPoolEmptyPrompt);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const selectOption = useGameStore((s) => s.selectOption);
  const revealAnswer = useGameStore((s) => s.revealAnswer);
  const markRoundOutcome = useGameStore((s) => s.markRoundOutcome);
  const toggleTimer = useGameStore((s) => s.toggleTimer);
  const resetTimer = useGameStore((s) => s.resetTimer);
  const undo = useGameStore((s) => s.undo);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const requestStageFullscreen = useGameStore((s) => s.requestStageFullscreen);
  const updateSettings = useGameStore((s) => s.updateSettings);

  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [copiedStageLink, setCopiedStageLink] = useState(false);

  // Publish current host state to the sync relay on mount so an open Stage tab catches up immediately
  useEffect(() => {
    publishCurrentState();
  }, []);

  const { remainingMs, totalSeconds, status: timerStatus } = useSyncedTimer();
  const lastWarnSecRef = useRef<number | null>(null);

  // Subtle warning woodblock pulse during the final 5 seconds of a live countdown
  useEffect(() => {
    if (!settings.sound || timerStatus !== 'running') {
      lastWarnSecRef.current = null;
      return;
    }
    const sec = Math.ceil(remainingMs / 1000);
    if (sec >= 1 && sec <= 5 && sec !== lastWarnSecRef.current) {
      lastWarnSecRef.current = sec;
      playTimerWarningTick();
    }
  }, [remainingMs, timerStatus, settings.sound]);

  const onRollStep = useCallback(
    (progress: number) => {
      if (settings.sound) {
        playRollTick(progress);
      }
    },
    [settings.sound]
  );

  const onRollDone = useCallback(() => {
    if (settings.sound) {
      playNumberDrawn();
    }
    completeDrawAnimation();
  }, [completeDrawAnimation, settings.sound]);

  const { displayedNumber, isRolling } = useSlotRoll({
    isDrawing: phase === 'drawing',
    drawAnimation,
    currentNumber,
    reducedMotion: settings.reducedMotion,
    onStep: onRollStep,
    onFinish: onRollDone,
  });

  const questionsById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  const currentQuestion: Question | null = order[currentIndex]
    ? questionsById.get(order[currentIndex]) ?? null
    : null;

  const nextUpQuestion: Question | null = order[currentIndex + 1]
    ? questionsById.get(order[currentIndex + 1]) ?? null
    : null;

  const numberList = useMemo(() => {
    const arr: number[] = [];
    for (let n = settings.range.min; n <= settings.range.max; n++) {
      arr.push(n);
    }
    return arr;
  }, [settings.range.min, settings.range.max]);

  const poolCounts = useMemo(() => {
    const counts: Record<NumberState, number> = {
      available: 0,
      drawn: 0,
      absent: 0,
      answered: 0,
      excluded: 0,
    };
    for (const n of numberList) {
      const st = numbers[n] ?? 'available';
      counts[st] += 1;
    }
    return counts;
  }, [numberList, numbers]);

  const stats = useMemo(() => {
    const scored = rounds.filter((r) => r.correct !== null);
    const correct = scored.filter((r) => r.correct === true).length;
    const accuracy =
      scored.length > 0 ? Math.round((correct / scored.length) * 100) : 0;
    return { played: rounds.length, correct, scoredCount: scored.length, accuracy };
  }, [rounds]);

  const currentRoundOutcome: boolean | null = useMemo(() => {
    if (roundOutcomeOverride !== null) return roundOutcomeOverride;
    if (
      currentQuestion &&
      currentQuestion.answer !== undefined &&
      selectedOption !== null
    ) {
      return selectedOption === currentQuestion.answer;
    }
    return null;
  }, [roundOutcomeOverride, currentQuestion, selectedOption]);

  const handleDraw = useCallback(() => {
    const prevNum = useGameStore.getState().currentNumber;
    if (settings.sound) unlockAudio();
    drawNumber();
    const after = useGameStore.getState();
    // If reduced motion skipped the 2.5s roll and landed immediately on a new number, chime now
    if (
      settings.sound &&
      after.phase === 'drawn' &&
      after.currentNumber !== null &&
      after.currentNumber !== prevNum
    ) {
      playNumberDrawn();
    }
  }, [drawNumber, settings.sound]);

  const handleAbsent = useCallback(() => {
    const prevNum = useGameStore.getState().currentNumber;
    if (settings.sound) unlockAudio();
    markAbsentAndRedraw();
    const after = useGameStore.getState();
    if (
      settings.sound &&
      after.phase === 'drawn' &&
      after.currentNumber !== null &&
      after.currentNumber !== prevNum
    ) {
      playNumberDrawn();
    }
  }, [markAbsentAndRedraw, settings.sound]);

  const handleReveal = useCallback(() => {
    if (phase !== 'answering') return;
    if (settings.sound) {
      unlockAudio();
      if (
        !currentQuestion ||
        currentQuestion.type === 'discussion' ||
        selectedOption === null ||
        currentQuestion.answer === undefined
      ) {
        playNeutralReveal();
      } else if (selectedOption === currentQuestion.answer) {
        playCorrectGuess();
      } else {
        playWrongGuess();
      }
    }
    revealAnswer();
  }, [phase, settings.sound, currentQuestion, selectedOption, revealAnswer]);

  const handleMarkOutcome = useCallback(
    (isCorrect: boolean) => {
      if (settings.sound) {
        unlockAudio();
        if (isCorrect) {
          playCorrectGuess();
        } else {
          playWrongGuess();
        }
      }
      markRoundOutcome(isCorrect);
    },
    [markRoundOutcome, settings.sound]
  );

  // Global keyboard shortcuts (H9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        handleDraw();
        return;
      }
      if (key === 'q' || e.key === 'Enter') {
        if (phase === 'drawn' || phase === 'question') {
          e.preventDefault();
          showQuestion();
          return;
        }
      }
      if (key === 'r') {
        e.preventDefault();
        handleReveal();
        return;
      }
      if (key === 'n') {
        e.preventDefault();
        nextQuestion();
        return;
      }
      if (key === 'a') {
        e.preventDefault();
        handleAbsent();
        return;
      }
      if (key === 't') {
        e.preventDefault();
        toggleTimer();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (key === 'f') {
        e.preventDefault();
        requestStageFullscreen();
        return;
      }
      if (key === '1' || key === '2' || key === '3' || key === '4') {
        e.preventDefault();
        selectOption(Number(key) - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    phase,
    handleDraw,
    showQuestion,
    handleReveal,
    nextQuestion,
    handleAbsent,
    toggleTimer,
    undo,
    requestStageFullscreen,
    selectOption,
  ]);

  const handleCopyStageUrl = async () => {
    try {
      const url = `${window.location.origin}/stage`;
      await navigator.clipboard.writeText(url);
      setCopiedStageLink(true);
      window.setTimeout(() => setCopiedStageLink(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  const getOptionState = (idx: number): OptionRowState => {
    if (!currentQuestion) return 'idle';
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

  const isInRound = phase !== 'idle' && phase !== 'finale';
  const isRevealed = phase === 'revealed';
  const isLastQuestion = currentIndex >= order.length - 1;
  const selectedTileState =
    selectedTile !== null ? (numbers[selectedTile] ?? 'available') : null;

  return (
    <div className="min-h-screen bg-[#08090A] text-[#F7F8F8] flex flex-col">
      <TopNav />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
        {/* Empty Pool Prompt */}
        {poolEmptyPrompt && (
          <Card
            variant="raised"
            padding="sm"
            className="border-[#F5A524]/60 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="text-[14px] text-[#F7F8F8]">
              <span className="font-semibold text-[#F5A524]">
                All numbers have played
              </span>{' '}
              — reset the number pool to keep drawing?
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={resetNumberPool}>
                Reset Pool
              </Button>
              <Button variant="ghost" onClick={dismissPoolEmptyPrompt}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* Primary 12-column Bento Grid (16px gap) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT 7 COLUMNS: Current Question + Controls + Next Up */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Current Question Module */}
            <Card
              category={isInRound && currentQuestion ? currentQuestion.category : undefined}
              className="flex flex-col gap-5"
            >
              {/* Quiet metadata line */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-[12px] font-medium text-[#8A8F98]">
                  <span className="text-[#F7F8F8]">{settings.eventName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-mono">
                    {phase === 'idle'
                      ? 'Idle on Stage'
                      : phase === 'finale'
                        ? 'Finale Screen'
                        : `Question ${currentIndex + 1} / ${order.length}`}
                  </span>
                  {isInRound && currentQuestion && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">
                        {currentQuestion.type.replace('-', ' ')}
                      </span>
                    </>
                  )}
                </div>

                {isInRound && currentQuestion && (
                  <CategoryTag
                    category={currentQuestion.category}
                    languageMode={settings.languageMode}
                  />
                )}
              </div>

              {/* Phase-specific Body */}
              {phase === 'idle' ? (
                <div className="py-10 text-center space-y-4">
                  <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                    Stage is idling · Ready to start
                  </p>
                  <h1 className="text-[28px] font-semibold tracking-display text-[#F7F8F8] text-balance">
                    Who&apos;s sorting? / Kuka lajittelee?
                  </h1>
                  <p className="text-[14px] text-[#8A8F98] max-w-md mx-auto">
                    {order.length} questions loaded and{' '}
                    <span className="tabular-mono text-[#F7F8F8]">
                      {poolCounts.available}
                    </span>{' '}
                    guest numbers in the pool. Open Stage on your projector, then start Round 1.
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <Button variant="primary" size="lg" kbd="N" onClick={startGame}>
                      <Play className="w-4 h-4" />
                      Start Round 1
                    </Button>
                  </div>
                </div>
              ) : phase === 'finale' ? (
                <div className="py-8 text-center space-y-4">
                  <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#C8F560]">
                    Finale live on Stage
                  </p>
                  <h1 className="text-[26px] font-semibold tracking-display text-[#F7F8F8]">
                    Event complete — {stats.correct} of {stats.scoredCount} sorted right
                  </h1>
                  <p className="text-[14px] text-[#8A8F98] max-w-md mx-auto">
                    Stage is displaying collective stats ({stats.accuracy}% group sorting accuracy across {stats.played} rounds).
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <Button variant="secondary" onClick={prevQuestion}>
                      <ChevronLeft className="w-4 h-4" />
                      Back to Last Question
                    </Button>
                    <Button variant="primary" onClick={restartGame}>
                      <RotateCcw className="w-4 h-4" />
                      Start Fresh Event
                    </Button>
                  </div>
                </div>
              ) : currentQuestion ? (
                <>
                  {/* Question Prompt */}
                  <div>
                    <h1 className="text-[22px] font-semibold tracking-display text-[#F7F8F8] leading-snug text-balance">
                      {settings.languageMode === 'fi' && currentQuestion.promptFi
                        ? currentQuestion.promptFi
                        : currentQuestion.prompt}
                    </h1>
                    {settings.languageMode === 'bilingual' &&
                      currentQuestion.promptFi && (
                        <p className="text-[14px] text-[#8A8F98] mt-1 leading-snug">
                          {currentQuestion.promptFi}
                        </p>
                      )}
                  </div>

                  {/* Stage Visibility Banner for Draw-First Flow */}
                  {(phase === 'question' || phase === 'drawing' || phase === 'drawn') && (
                    <div className="rounded-[8px] bg-[#08090A] border border-[#23252A] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                      <span className="text-[#8A8F98]">
                        {phase === 'question' && (
                          <>
                            <span className="text-[#F7F8F8] font-medium">
                              Question hidden on Stage
                            </span>{' '}
                            — draw a guest number first so nobody reads ahead.
                          </>
                        )}
                        {phase === 'drawing' && (
                          <>
                            <span className="text-[#C8F560] font-medium">
                              Rolling numbers on Stage
                            </span>{' '}
                            — question stays hidden until you reveal it.
                          </>
                        )}
                        {phase === 'drawn' && (
                          <>
                            <span className="text-[#C8F560] font-medium">
                              Guest #{currentNumber} called on Stage
                            </span>{' '}
                            — press <span className="text-[#F7F8F8]">Show Question</span> when they&apos;re ready.
                          </>
                        )}
                      </span>
                      {phase === 'drawn' && (
                        <Button
                          variant="primary"
                          kbd="Q"
                          onClick={showQuestion}
                          className="h-7 px-2.5 text-[12px]"
                        >
                          Show Question
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Clickable Options (1–4) OR Open Discussion prompt */}
                  {currentQuestion.type === 'discussion' ? (
                    <div className="rounded-[10px] bg-[#08090A] border border-[#23252A] p-4 flex items-start gap-3">
                      <MessageCircle className="w-4 h-4 text-[#C8F560] mt-0.5 shrink-0" />
                      <div className="text-[13px] text-[#8A8F98] leading-relaxed">
                        <span className="text-[#F7F8F8] font-medium">
                          Open discussion — no right or wrong answer.
                        </span>{' '}
                        Draw a guest number, show the prompt, then press{' '}
                        <span className="text-[#F7F8F8]">Reveal</span> to show the talking point on Stage.
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 transition-opacity duration-150 ${
                        phase === 'question' || phase === 'drawing'
                          ? 'opacity-55 pointer-events-none'
                          : ''
                      }`}
                    >
                      {currentQuestion.options.map((opt, idx) => (
                        <OptionRow
                          key={`${currentQuestion.id}-${idx}`}
                          index={idx}
                          label={opt}
                          labelFi={currentQuestion.optionsFi?.[idx]}
                          isBinOption={currentQuestion.type === 'which-bin'}
                          languageMode={settings.languageMode}
                          state={getOptionState(idx)}
                          size="console"
                          shortcutKey={String(idx + 1)}
                          interactive={phase === 'drawn' || phase === 'answering' || phase === 'revealed'}
                          onClick={() => selectOption(idx)}
                        />
                      ))}
                    </div>
                  )}

                  {/* H10: Host-Only Presenter Notes (never shown on Stage) */}
                  {currentQuestion.notes && (
                    <div className="rounded-[8px] bg-[#18191C] border border-[#23252A] px-3.5 py-2.5 flex items-start gap-2.5">
                      <StickyNote
                        className="w-4 h-4 text-[#C8F560] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                          Presenter notes · Host only
                        </div>
                        <p className="text-[13px] text-[#F7F8F8] mt-0.5 leading-snug">
                          {currentQuestion.notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Host-Only Answer Peek (before reveal) OR Revealed Explanation & Manual Override */}
                  {!isRevealed ? (
                    <div className="pt-3 border-t border-[#23252A] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#8A8F98]">
                      <span>
                        Host key:{' '}
                        <span className="text-[#F7F8F8] font-medium">
                          {currentQuestion.answer !== undefined
                            ? `${String.fromCharCode(65 + currentQuestion.answer)} — ${currentQuestion.options[currentQuestion.answer]}`
                            : 'Talking point ready on Reveal'}
                        </span>{' '}
                        (hidden on Stage until Reveal)
                      </span>
                      {currentQuestion.type !== 'discussion' && (
                        <span>Tap an option or press 1–4 to log guest&apos;s pick</span>
                      )}
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-[#23252A] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CategoryTag
                            category={currentQuestion.category}
                            languageMode={settings.languageMode}
                            variant="chip"
                          />
                          {currentQuestion.type !== 'discussion' &&
                            currentRoundOutcome !== null && (
                              <span
                                className={`text-[12px] font-medium ${
                                  currentRoundOutcome
                                    ? 'text-[#4CC38A]'
                                    : 'text-[#F2555A]'
                                }`}
                              >
                                {currentRoundOutcome
                                  ? '✓ Counted correct'
                                  : '✕ Counted incorrect'}
                              </span>
                            )}
                        </div>

                        {/* Manual Correct / Incorrect toggle (H5) — hidden for discussion */}
                        {currentQuestion.type !== 'discussion' && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant={
                                currentRoundOutcome === true
                                  ? 'primary'
                                  : 'secondary'
                              }
                              onClick={() => handleMarkOutcome(true)}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Correct
                            </Button>
                            <Button
                              variant={
                                currentRoundOutcome === false
                                  ? 'danger'
                                  : 'secondary'
                              }
                              onClick={() => handleMarkOutcome(false)}
                            >
                              <X className="w-3.5 h-3.5" />
                              Wrong
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="text-[13px] text-[#F7F8F8] leading-relaxed">
                        {settings.languageMode === 'fi' &&
                        currentQuestion.explanationFi
                          ? currentQuestion.explanationFi
                          : currentQuestion.explanation}
                        {settings.languageMode === 'bilingual' &&
                          currentQuestion.explanationFi && (
                            <p className="text-[#8A8F98] mt-1">
                              {currentQuestion.explanationFi}
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </Card>

            {/* Primary Controls Bar (H2, H5, H8, H9) */}
            <Card padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Contextual primary action — Draw -> Show Question -> Reveal -> Next */}
                  {phase === 'idle' ? (
                    <>
                      <Button variant="primary" kbd="Space" onClick={handleDraw}>
                        <Sparkles className="w-3.5 h-3.5" />
                        Draw first guest
                      </Button>
                      <Button variant="secondary" kbd="N" onClick={startGame}>
                        <Play className="w-3.5 h-3.5" />
                        Start Round 1
                      </Button>
                    </>
                  ) : phase === 'finale' ? (
                    <Button variant="primary" onClick={restartGame}>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restart Event
                    </Button>
                  ) : phase === 'question' || phase === 'drawing' ? (
                    <Button
                      variant="primary"
                      kbd="Space"
                      disabled={isRolling}
                      onClick={handleDraw}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isRolling ? 'Drawing...' : 'Draw a number'}
                    </Button>
                  ) : phase === 'drawn' ? (
                    <>
                      <Button variant="primary" kbd="Q" onClick={showQuestion}>
                        <Play className="w-3.5 h-3.5" />
                        Show question
                      </Button>
                      <Button
                        variant="secondary"
                        kbd="Space"
                        onClick={handleDraw}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Redraw
                      </Button>
                    </>
                  ) : phase === 'answering' ? (
                    <Button
                      variant="primary"
                      kbd="R"
                      onClick={handleReveal}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {currentQuestion?.type === 'discussion'
                        ? 'Reveal talking point'
                        : 'Reveal the bin'}
                    </Button>
                  ) : (
                    <Button variant="primary" kbd="N" onClick={nextQuestion}>
                      <span>{isLastQuestion ? 'Show Finale' : 'Next round'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {isInRound && (
                    <Button
                      variant="secondary"
                      kbd="A"
                      disabled={currentNumber === null || isRolling}
                      onClick={handleAbsent}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Absent
                    </Button>
                  )}
                </div>

                {/* Secondary Navigation & Undo */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    disabled={currentIndex === 0 && phase !== 'finale'}
                    onClick={prevQuestion}
                    title="Previous question"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                  </Button>
                  {isInRound && (
                    <Button
                      variant="ghost"
                      onClick={skipQuestion}
                      title="Skip question without recording"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                      Skip
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    kbd="Z"
                    disabled={history.length === 0}
                    onClick={undo}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo
                  </Button>
                  {phase !== 'idle' && (
                    <Button variant="ghost" onClick={goToIdle}>
                      Idle
                    </Button>
                  )}
                  {phase !== 'finale' && (
                    <Button variant="ghost" onClick={goToFinale}>
                      <Flag className="w-3.5 h-3.5" />
                      Finale
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Next-Up Preview + Collective Stats (H1) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <Card padding="sm" className="sm:col-span-7 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                    Next Up
                  </span>
                  {nextUpQuestion && (
                    <CategoryTag
                      category={nextUpQuestion.category}
                      languageMode={settings.languageMode}
                    />
                  )}
                </div>
                {nextUpQuestion ? (
                  <div>
                    <p className="text-[14px] font-medium text-[#F7F8F8] line-clamp-2">
                      {nextUpQuestion.prompt}
                    </p>
                    {settings.languageMode === 'bilingual' &&
                      nextUpQuestion.promptFi && (
                        <p className="text-[12px] text-[#8A8F98] mt-0.5 line-clamp-1">
                          {nextUpQuestion.promptFi}
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#8A8F98]">
                    Finale stats screen comes next.
                  </p>
                )}
              </Card>

              <Card padding="sm" className="sm:col-span-5 flex flex-col justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                  Cookout Stats
                </span>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <div className="tabular-mono text-[20px] font-semibold text-[#F7F8F8]">
                      {stats.played}
                    </div>
                    <div className="text-[11px] text-[#8A8F98]">Played</div>
                  </div>
                  <div>
                    <div className="tabular-mono text-[20px] font-semibold text-[#4CC38A]">
                      {stats.correct}
                    </div>
                    <div className="text-[11px] text-[#8A8F98]">Correct</div>
                  </div>
                  <div>
                    <div className="tabular-mono text-[20px] font-semibold text-[#F7F8F8]">
                      {stats.scoredCount > 0 ? `${stats.accuracy}%` : '—'}
                    </div>
                    <div className="text-[11px] text-[#8A8F98]">Group</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: Draw & Timer Panel + Guest Number Grid */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Draw + Timer Module (H3, H4, H6) */}
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#8A8F98]">
                  Who&apos;s Sorting?
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={settings.sound ? 'secondary' : 'ghost'}
                    onClick={() => {
                      const next = !settings.sound;
                      updateSettings({ sound: next });
                      if (next) {
                        unlockAudio();
                        playNeutralReveal();
                      }
                    }}
                    title={
                      settings.sound
                        ? 'Mute roll & reveal sounds'
                        : 'Enable roll & reveal sounds'
                    }
                  >
                    {settings.sound ? (
                      <Volume2 className="w-3.5 h-3.5 text-[#C8F560]" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                    {settings.sound ? 'Sound On' : 'Muted'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleCopyStageUrl}
                    title="Copy Stage link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedStageLink ? 'Copied' : 'Stage URL'}
                  </Button>
                  <Button
                    variant="secondary"
                    kbd="F"
                    onClick={requestStageFullscreen}
                    title="Toggle fullscreen on Stage"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Fullscreen
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Drawn Number Box */}
                <div className="col-span-7 rounded-[12px] bg-[#08090A] border border-[#23252A] p-4 flex flex-col items-center justify-center min-h-[124px]">
                  <span className="text-[11px] uppercase tracking-[0.04em] text-[#8A8F98] mb-1">
                    {isRolling
                      ? 'Rolling...'
                      : displayedNumber !== null
                        ? 'Called Guest'
                        : 'Awaiting Draw'}
                  </span>
                  <div
                    className={`tabular-mono text-[52px] font-semibold leading-none tracking-display ${
                      displayedNumber !== null && !isRolling
                        ? 'text-[#C8F560] drawn-text-glow'
                        : displayedNumber !== null
                          ? 'text-[#F7F8F8]'
                          : 'text-[#5C616B]'
                    }`}
                  >
                    {displayedNumber !== null ? `#${displayedNumber}` : '—'}
                  </div>
                </div>

                {/* Synced Timer Panel */}
                <div className="col-span-5 rounded-[12px] bg-[#08090A] border border-[#23252A] p-3 flex flex-col items-center justify-center gap-2 min-h-[124px]">
                  <TimerRing
                    totalSeconds={totalSeconds}
                    remainingMs={remainingMs}
                    size={62}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      kbd="T"
                      onClick={toggleTimer}
                      className="h-7 px-2 text-[12px]"
                    >
                      {timerStatus === 'running' ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      {timerStatus === 'running' ? 'Pause' : 'Timer'}
                    </Button>
                    <button
                      type="button"
                      onClick={resetTimer}
                      title="Reset timer"
                      aria-label="Reset timer"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-[#23252A] text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#18191C] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Keyboard Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-[#23252A] text-[11px] text-[#8A8F98]">
                <span className="inline-flex items-center gap-1">
                  <Kbd>Space</Kbd> Draw
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>Q</Kbd> Show Q
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>A</Kbd> Absent
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>1–4</Kbd> Pick
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>R</Kbd> Reveal
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>N</Kbd> Next
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>Z</Kbd> Undo
                </span>
              </div>
            </Card>

            {/* Interactive Number Grid (H7) */}
            <Card className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#F7F8F8]">
                    Guest Numbers ({settings.range.min}–{settings.range.max})
                  </h2>
                  <p className="text-[12px] text-[#8A8F98] tabular-mono mt-0.5">
                    {poolCounts.available} available · {poolCounts.answered} answered ·{' '}
                    {poolCounts.absent} absent · {poolCounts.excluded} excluded
                  </p>
                </div>
                <Button variant="ghost" onClick={resetNumberPool}>
                  Reset Pool
                </Button>
              </div>

              {/* Contextual Action Bar when a tile is clicked */}
              {selectedTile !== null && selectedTileState && (
                <div className="rounded-[8px] bg-[#18191C] border border-[#23252A] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[13px]">
                    <span className="tabular-mono font-semibold text-[#C8F560]">
                      #{selectedTile}
                    </span>{' '}
                    <span className="text-[#8A8F98] capitalize">
                      ({selectedTileState})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (settings.sound) {
                          unlockAudio();
                          playNumberDrawn();
                        }
                        forcePickNumber(selectedTile);
                        setSelectedTile(null);
                      }}
                      className="h-7 px-2.5 text-[12px]"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Force-Pick
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        toggleExcludeNumber(selectedTile);
                        setSelectedTile(null);
                      }}
                      className="h-7 px-2.5 text-[12px]"
                    >
                      {selectedTileState === 'excluded'
                        ? 'Restore to Pool'
                        : 'Exclude'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setSelectedTile(null)}
                      aria-label="Close number actions"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] text-[#8A8F98] hover:text-[#F7F8F8] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Grid of NumberTiles */}
              <div className="grid grid-cols-10 gap-1.5 max-h-[340px] overflow-y-auto pr-0.5">
                {numberList.map((num) => (
                  <NumberTile
                    key={num}
                    number={num}
                    state={numbers[num] ?? 'available'}
                    selected={selectedTile === num}
                    onClick={() =>
                      setSelectedTile((prev) => (prev === num ? null : num))
                    }
                  />
                ))}
              </div>

              {/* Clean State Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-[#23252A] text-[11px] text-[#8A8F98]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-[#111214] border border-[#3A3D46]" />
                  Available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-[#C8F560]" />
                  Drawn
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] border border-dashed border-[#F5A524]" />
                  Absent
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-[#18191C] border border-[#23252A]" />
                  Answered
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-[#08090A] border border-[#1A1C20]" />
                  Excluded
                </span>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Toast
        message={toast?.message ?? null}
        canUndo={toast?.canUndo}
        onUndo={undo}
        onDismiss={dismissToast}
      />
    </div>
  );
}
