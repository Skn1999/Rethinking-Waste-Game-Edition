import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Download,
  FileUp,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Shuffle,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { QuestionEditorModal } from '../components/QuestionEditorModal';
import { TopNav } from '../components/TopNav';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CategoryTag } from '../components/ui/CategoryTag';
import { Toast } from '../components/ui/Toast';
import { useGameStore } from '../store/gameStore';
import type { LanguageMode, Question } from '../types/game';
import {
  playCorrectGuess,
  playNumberDrawn,
  playWrongGuess,
  unlockAudio,
} from '../utils/sound';
import {
  parseQuestionsInput,
  type ImportResult,
} from '../utils/importQuestions';
import {
  formatExcludedNumbers,
  parseExcludedNumbers,
} from '../utils/numberRange';

const SAMPLE_JSON_SNIPPET = `[
  {
    "id": "q01",
    "type": "which-bin",
    "category": "bio",
    "prompt": "A greasy pizza box. Which bin?",
    "promptFi": "Rasvainen pizzalaatikko. Minne kuuluu?",
    "options": ["cardboard", "bio", "mixed", "paper"],
    "answer": 1,
    "explanation": "Grease ruins cardboard recycling. Clean parts go to cardboard, greasy parts to bio.",
    "explanationFi": "Rasva pilaa kartongin kierrätyksen. Puhtaat osat kartonkiin, rasvaiset biojätteeseen."
  }
]`;

const SAMPLE_CSV_SNIPPET = `id,type,category,prompt,promptFi,options,answer,explanation,explanationFi
q01,which-bin,bio,"A greasy pizza box. Which bin?","Rasvainen pizzalaatikko. Minne kuuluu?",cardboard|bio|mixed|paper,1,"Grease ruins cardboard recycling. Greasy parts go to bio.","Rasva pilaa kartongin. Rasvaiset osat biojätteeseen."
q02,true-false,plastic,"You must wash yogurt tubs with hot soap.","Jogurttipurkit pitää pestä kuumalla saippualla.",True|False,1,"False! A quick scrape or cold rinse is plenty.","Tarua! Kaapiminen tai kylmä huuhtelu riittää."`;

const TIMER_PRESETS = [15, 30, 45, 60];

export function SetupPage() {
  const settings = useGameStore((s) => s.settings);
  const questions = useGameStore((s) => s.questions);
  const order = useGameStore((s) => s.order);
  const toast = useGameStore((s) => s.toast);

  const updateSettings = useGameStore((s) => s.updateSettings);
  const setNumberRangeAndExcluded = useGameStore(
    (s) => s.setNumberRangeAndExcluded
  );
  const importQuestions = useGameStore((s) => s.importQuestions);
  const loadSampleQuestions = useGameStore((s) => s.loadSampleQuestions);
  const addQuestion = useGameStore((s) => s.addQuestion);
  const updateQuestion = useGameStore((s) => s.updateQuestion);
  const deleteQuestion = useGameStore((s) => s.deleteQuestion);
  const moveQuestion = useGameStore((s) => s.moveQuestion);
  const setQuestionOrderMode = useGameStore((s) => s.setQuestionOrderMode);
  const reshuffleOrder = useGameStore((s) => s.reshuffleOrder);
  const exportBackup = useGameStore((s) => s.exportBackup);
  const importBackup = useGameStore((s) => s.importBackup);
  const restartGame = useGameStore((s) => s.restartGame);
  const undo = useGameStore((s) => s.undo);
  const dismissToast = useGameStore((s) => s.dismissToast);

  // Local form state for range & excluded numbers
  const [minInput, setMinInput] = useState(String(settings.range.min));
  const [maxInput, setMaxInput] = useState(String(settings.range.max));
  const [excludedInput, setExcludedInput] = useState(() =>
    formatExcludedNumbers(settings.excluded)
  );
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Keep local range inputs synced if a backup restores different settings
  useEffect(() => {
    setMinInput(String(settings.range.min));
    setMaxInput(String(settings.range.max));
    setExcludedInput(formatExcludedNumbers(settings.excluded));
  }, [settings.range.min, settings.range.max, settings.excluded]);

  // Deck / Importer / Editor / Backup state
  const [deckTab, setDeckTab] = useState<'deck' | 'import'>('deck');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const orderedQuestions = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    return order
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q));
  }, [questions, order]);

  const totalRangeCount = Math.max(
    0,
    settings.range.max - settings.range.min + 1
  );
  const activePoolCount = Math.max(
    0,
    totalRangeCount - settings.excluded.length
  );

  const handleApplyRange = () => {
    const min = Number(minInput);
    const max = Number(maxInput);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 999) {
      setRangeError('Enter whole numbers between 1 and 999.');
      return;
    }
    if (min > max) {
      setRangeError('Minimum number must be less than or equal to maximum.');
      return;
    }
    const parsed = parseExcludedNumbers(excludedInput, min, max);
    if (parsed.invalidTokens.length > 0) {
      setRangeError(
        `Ignored out-of-range or invalid entries: ${parsed.invalidTokens.join(', ')}`
      );
    } else {
      setRangeError(null);
    }
    setNumberRangeAndExcluded(min, max, parsed.numbers);
    setExcludedInput(formatExcludedNumbers(parsed.numbers));
  };

  const handleValidateImport = (text: string) => {
    setImportText(text);
    if (!text.trim()) {
      setImportPreview(null);
      return;
    }
    setImportPreview(parseQuestionsInput(text));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      handleValidateImport(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCommitImport = () => {
    if (!importPreview || importPreview.questions.length === 0) return;
    importQuestions(importPreview.questions);
    setDeckTab('deck');
  };

  const handleExportBackup = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whos-sorting-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleBackupFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const result = importBackup(content);
      if (!result.ok) {
        setBackupError(result.error ?? 'Unable to restore backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveQuestion = (q: Question) => {
    if (editingQuestion) {
      updateQuestion(editingQuestion.id, q);
    } else {
      addQuestion(q);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090A] text-[#F7F8F8] flex flex-col">
      <TopNav />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-display text-[#F7F8F8] leading-tight">
              Event Setup
            </h1>
            <p className="text-[14px] text-[#8A8F98] mt-1">
              Configure your guest ticket range, import questions, and launch the live Host Console.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={restartGame}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Event Progress
            </Button>
            <Link
              to="/host"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[6px] bg-[#C8F560] text-[#08090A] text-[13px] font-semibold hover:bg-[#d5fa7c] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Go to Host Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 12-column Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Event, Range & Settings (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* S1: Event & Number Range */}
            <Card>
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-[15px] font-semibold text-[#F7F8F8]">
                  Event &amp; Guest Numbers
                </h2>
                <span className="text-[12px] text-[#8A8F98] tabular-mono">
                  {activePoolCount} active · {settings.excluded.length} excluded
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="event-name"
                    className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                  >
                    Event name
                  </label>
                  <input
                    id="event-name"
                    type="text"
                    value={settings.eventName}
                    onChange={(e) =>
                      updateSettings({ eventName: e.target.value })
                    }
                    placeholder="Rethinking Waste Cookout"
                    className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[14px] text-[#F7F8F8] placeholder:text-[#5C616B] focus:border-[#C8F560]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="event-meta"
                    className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                  >
                    Subtitle, date or venue (optional)
                  </label>
                  <input
                    id="event-meta"
                    type="text"
                    value={settings.eventMeta}
                    onChange={(e) =>
                      updateSettings({ eventMeta: e.target.value })
                    }
                    placeholder="Helsinki Courtyard · Summer Cookout"
                    className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[14px] text-[#F7F8F8] placeholder:text-[#5C616B] focus:border-[#C8F560]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="range-min"
                      className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                    >
                      First number
                    </label>
                    <input
                      id="range-min"
                      type="number"
                      min={1}
                      max={999}
                      value={minInput}
                      onChange={(e) => setMinInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] tabular-mono text-[14px] text-[#F7F8F8]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="range-max"
                      className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                    >
                      Last number
                    </label>
                    <input
                      id="range-max"
                      type="number"
                      min={1}
                      max={999}
                      value={maxInput}
                      onChange={(e) => setMaxInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] tabular-mono text-[14px] text-[#F7F8F8]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="excluded-numbers"
                    className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                  >
                    Excluded numbers (not handed out at door)
                  </label>
                  <input
                    id="excluded-numbers"
                    type="text"
                    value={excludedInput}
                    onChange={(e) => setExcludedInput(e.target.value)}
                    placeholder="e.g. 13, 27, 51-60"
                    className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] tabular-mono text-[13px] text-[#F7F8F8] placeholder:text-[#5C616B]"
                  />
                  <p className="text-[12px] text-[#5C616B] mt-1">
                    Separate with commas or ranges like 45-60. You can also toggle numbers live in the Host Console.
                  </p>
                </div>

                {rangeError && (
                  <p className="text-[12px] text-[#F5A524] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{rangeError}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Link
                    to="/print-cards"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[6px] border border-[#23252A] text-[13px] font-medium text-[#F7F8F8] hover:bg-[#18191C] hover:border-[#343740] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#C8F560]" />
                    <span>Print A4 Number Cards</span>
                  </Link>
                  <Button variant="secondary" onClick={handleApplyRange}>
                    Apply Number Range
                  </Button>
                </div>
              </div>
            </Card>

            {/* S4 & S5: Game Settings */}
            <Card>
              <h2 className="text-[15px] font-semibold text-[#F7F8F8] mb-4">
                Round Rules &amp; Stage Display
              </h2>

              <div className="space-y-5">
                {/* Language Mode */}
                <div>
                  <span className="block text-[12px] font-medium text-[#8A8F98] mb-2">
                    Question &amp; bin language
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-[8px] bg-[#08090A] border border-[#23252A]">
                    {(
                      [
                        { id: 'bilingual', label: 'EN + FI' },
                        { id: 'en', label: 'English' },
                        { id: 'fi', label: 'Suomi' },
                      ] as { id: LanguageMode; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings({ languageMode: opt.id })}
                        className={`h-8 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          settings.languageMode === opt.id
                            ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                            : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Order */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-[#8A8F98]">
                      Question order
                    </span>
                    {settings.shuffle && (
                      <button
                        type="button"
                        onClick={reshuffleOrder}
                        className="inline-flex items-center gap-1 text-[12px] text-[#C8F560] hover:underline cursor-pointer"
                      >
                        <Shuffle className="w-3 h-3" />
                        Reshuffle now
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-[8px] bg-[#08090A] border border-[#23252A]">
                    <button
                      type="button"
                      onClick={() => setQuestionOrderMode(false)}
                      className={`h-8 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                        !settings.shuffle
                          ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                          : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                      }`}
                    >
                      As listed
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionOrderMode(true)}
                      className={`h-8 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                        settings.shuffle
                          ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                          : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                      }`}
                    >
                      Shuffled
                    </button>
                  </div>
                </div>

                {/* Timer length & Cooldown */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="timer-seconds"
                      className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                    >
                      Timer length (s)
                    </label>
                    <div className="flex items-center gap-1.5 mb-2">
                      {TIMER_PRESETS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => updateSettings({ timerSeconds: sec })}
                          className={`flex-1 h-7 rounded-[6px] tabular-mono text-[12px] border transition-colors cursor-pointer ${
                            settings.timerSeconds === sec
                              ? 'bg-[#18191C] border-[#C8F560] text-[#F7F8F8]'
                              : 'bg-[#08090A] border-[#23252A] text-[#8A8F98] hover:text-[#F7F8F8]'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                    <input
                      id="timer-seconds"
                      type="number"
                      min={5}
                      max={300}
                      value={settings.timerSeconds}
                      onChange={(e) => {
                        const val = Math.max(5, Math.min(300, Number(e.target.value) || 30));
                        updateSettings({ timerSeconds: val });
                      }}
                      className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] tabular-mono text-[13px] text-[#F7F8F8]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="absent-cooldown"
                      className="block text-[12px] font-medium text-[#8A8F98] mb-1.5"
                    >
                      Absent return (rounds)
                    </label>
                    <p className="text-[11px] text-[#5C616B] mb-2 leading-tight">
                      Absent numbers rejoin the pool after this many rounds.
                    </p>
                    <input
                      id="absent-cooldown"
                      type="number"
                      min={1}
                      max={20}
                      value={settings.absentCooldownRounds}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(20, Number(e.target.value) || 3));
                        updateSettings({ absentCooldownRounds: val });
                      }}
                      className="w-full h-9 px-3 rounded-[6px] bg-[#08090A] border border-[#23252A] tabular-mono text-[13px] text-[#F7F8F8]"
                    />
                  </div>
                </div>

                {/* Boolean toggles */}
                <div className="divide-y divide-[#23252A] border-t border-[#23252A] pt-1">
                  <ToggleRow
                    label="Allow repeat numbers"
                    description="Let already-answered numbers be drawn again (off by default)."
                    checked={settings.allowRepeats}
                    onChange={(v) => updateSettings({ allowRepeats: v })}
                  />
                  <ToggleRow
                    label="Reduced motion"
                    description="Instant fade on number draw instead of the 2.5 s slot roll."
                    checked={settings.reducedMotion}
                    onChange={(v) => updateSettings({ reducedMotion: v })}
                  />
                  <div>
                    <ToggleRow
                      label="Sound effects (muted default)"
                      description="Soft ticks on number roll, celebratory chime on draw & correct, playful bonk on wrong."
                      checked={settings.sound}
                      onChange={(v) => {
                        updateSettings({ sound: v });
                        if (v) {
                          unlockAudio();
                          playNumberDrawn();
                        }
                      }}
                    />
                    <div className="pb-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#5C616B] mr-1">
                        <Volume2 className="w-3 h-3" />
                        Sound check:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          unlockAudio();
                          playNumberDrawn();
                        }}
                        className="h-7 px-2.5 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[12px] text-[#8A8F98] hover:text-[#F7F8F8] hover:border-[#343740] transition-colors cursor-pointer"
                      >
                        Number Drawn
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          unlockAudio();
                          playCorrectGuess();
                        }}
                        className="h-7 px-2.5 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[12px] text-[#4CC38A] hover:bg-[#4CC38A]/10 hover:border-[#4CC38A]/40 transition-colors cursor-pointer"
                      >
                        Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          unlockAudio();
                          playWrongGuess();
                        }}
                        className="h-7 px-2.5 rounded-[6px] bg-[#08090A] border border-[#23252A] text-[12px] text-[#F2555A] hover:bg-[#F2555A]/10 hover:border-[#F2555A]/40 transition-colors cursor-pointer"
                      >
                        Wrong
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* S7: Backup & Restore */}
            <Card>
              <div className="space-y-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#F7F8F8]">
                    Game State Backup
                  </h2>
                  <p className="text-[12px] text-[#8A8F98] mt-0.5">
                    Save your questions, settings, drawn numbers, and progress as a JSON file — or restore on another laptop.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="secondary" onClick={handleExportBackup}>
                    <Download className="w-3.5 h-3.5" />
                    Export Backup (.json)
                  </Button>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleBackupFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => backupFileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Restore Backup
                  </Button>
                </div>

                {backupError && (
                  <p className="text-[12px] text-[#F2555A] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{backupError}</span>
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Question Deck & JSON/CSV Importer (7 cols) */}
          <div className="lg:col-span-7">
            <Card padding="none" className="overflow-hidden">
              {/* Header + Segmented Tabs */}
              <div className="px-6 py-4 border-b border-[#23252A] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 rounded-[8px] bg-[#08090A] border border-[#23252A]">
                  <button
                    type="button"
                    onClick={() => setDeckTab('deck')}
                    className={`h-8 px-3 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      deckTab === 'deck'
                        ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                        : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                    }`}
                  >
                    Question Deck ({orderedQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeckTab('import')}
                    className={`h-8 px-3 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      deckTab === 'import'
                        ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                        : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                    }`}
                  >
                    Import JSON / CSV
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingQuestion(null);
                      setEditorOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Question
                  </Button>
                  <Button variant="ghost" onClick={loadSampleQuestions}>
                    Restore Samples
                  </Button>
                </div>
              </div>

              {deckTab === 'deck' ? (
                <div className="divide-y divide-[#23252A] max-h-[760px] overflow-y-auto">
                  {orderedQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="px-6 py-4 hover:bg-[#18191C]/50 transition-colors flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-[#8A8F98] mb-1.5">
                          <span className="tabular-mono text-[#5C616B]">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <CategoryTag
                            category={q.category}
                            languageMode={settings.languageMode}
                          />
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">
                            {q.type === 'discussion'
                              ? 'Open discussion'
                              : q.type.replace('-', ' ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-mono text-[11px] text-[#5C616B]">
                            {q.id}
                          </span>
                        </div>
                        <p className="text-[15px] font-medium text-[#F7F8F8] leading-snug">
                          {q.prompt}
                        </p>
                        {q.promptFi && (
                          <p className="text-[13px] text-[#8A8F98] mt-0.5 leading-snug">
                            {q.promptFi}
                          </p>
                        )}
                        {q.notes && (
                          <p className="text-[12px] text-[#5C616B] mt-1.5">
                            Note: {q.notes}
                          </p>
                        )}
                      </div>

                      {/* Row Editor Controls: Up / Down / Edit / Delete */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveQuestion(q.id, 'up')}
                          title="Move up"
                          aria-label={`Move question ${idx + 1} up`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-transparent text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#18191C] hover:border-[#23252A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedQuestions.length - 1}
                          onClick={() => moveQuestion(q.id, 'down')}
                          title="Move down"
                          aria-label={`Move question ${idx + 1} down`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-transparent text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#18191C] hover:border-[#23252A] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setEditorOpen(true);
                          }}
                          title="Edit question"
                          aria-label={`Edit question ${idx + 1}`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-transparent text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-[#18191C] hover:border-[#23252A] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={orderedQuestions.length <= 1}
                          onClick={() => deleteQuestion(q.id)}
                          title="Delete question"
                          aria-label={`Delete question ${idx + 1}`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-transparent text-[#8A8F98] hover:text-[#F2555A] hover:bg-[#F2555A]/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] text-[#8A8F98]">
                      Paste JSON array or CSV (separate CSV options with{' '}
                      <code className="tabular-mono text-[#F7F8F8]">|</code>) or upload a file.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => handleValidateImport(SAMPLE_JSON_SNIPPET)}
                      >
                        JSON Example
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleValidateImport(SAMPLE_CSV_SNIPPET)}
                      >
                        CSV Example
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.csv,application/json,text/csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        Upload File
                      </Button>
                    </div>
                  </div>

                  <textarea
                    value={importText}
                    onChange={(e) => handleValidateImport(e.target.value)}
                    rows={10}
                    spellCheck={false}
                    placeholder="Paste JSON array or CSV rows here..."
                    className="w-full p-3.5 rounded-[8px] bg-[#08090A] border border-[#23252A] font-mono text-[12px] text-[#F7F8F8] placeholder:text-[#5C616B] leading-relaxed focus:border-[#C8F560]"
                  />

                  {/* Validation Summary */}
                  {importPreview && (
                    <div className="rounded-[8px] bg-[#08090A] border border-[#23252A] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[13px] font-medium">
                          {importPreview.errors.length === 0 ? (
                            <CheckCircle2 className="w-4 h-4 text-[#4CC38A]" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-[#F5A524]" />
                          )}
                          <span>
                            Detected {importPreview.format.toUpperCase()} ·{' '}
                            <span className="text-[#4CC38A] tabular-mono">
                              {importPreview.questions.length} valid
                            </span>{' '}
                            of{' '}
                            <span className="tabular-mono">
                              {importPreview.totalRows}
                            </span>{' '}
                            rows
                          </span>
                        </div>
                        {importPreview.errors.length > 0 && (
                          <span className="text-[12px] text-[#F2555A] tabular-mono">
                            {importPreview.errors.length} error
                            {importPreview.errors.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      {importPreview.errors.length > 0 && (
                        <ul className="space-y-1.5 max-h-40 overflow-y-auto border-t border-[#23252A] pt-2.5 text-[12px]">
                          {importPreview.errors.map((err, i) => (
                            <li
                              key={`${err.row}-${i}`}
                              className="flex items-start gap-2 text-[#F2555A]"
                            >
                              <span className="tabular-mono text-[#8A8F98] shrink-0">
                                Row {err.row}
                                {err.field ? ` (${err.field})` : ''}:
                              </span>
                              <span>{err.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setImportText('');
                        setImportPreview(null);
                      }}
                      disabled={!importText}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleCommitImport}
                      disabled={
                        !importPreview || importPreview.questions.length === 0
                      }
                    >
                      Import{' '}
                      {importPreview && importPreview.questions.length > 0
                        ? `${importPreview.questions.length} Questions`
                        : 'Questions'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      <QuestionEditorModal
        open={editorOpen}
        initialQuestion={editingQuestion}
        nextIdSuggestion={`q${String(questions.length + 1).padStart(2, '0')}`}
        onSave={handleSaveQuestion}
        onClose={() => setEditorOpen(false)}
      />

      <Toast
        message={toast?.message ?? null}
        canUndo={toast?.canUndo}
        onUndo={undo}
        onDismiss={dismissToast}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#F7F8F8]">{label}</div>
        <div className="text-[12px] text-[#8A8F98] leading-snug">
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 cursor-pointer ${
          checked
            ? 'bg-[#C8F560] border-[#C8F560]'
            : 'bg-[#08090A] border-[#23252A]'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full transition-transform duration-150 ${
            checked
              ? 'translate-x-[20px] bg-[#08090A]'
              : 'translate-x-[3px] bg-[#8A8F98]'
          }`}
        />
      </button>
    </div>
  );
}
