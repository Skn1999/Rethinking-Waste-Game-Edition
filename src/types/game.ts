export type WasteCategory =
  | 'bio'
  | 'paper'
  | 'cardboard'
  | 'plastic'
  | 'glass'
  | 'metal'
  | 'mixed'
  | 'hazard'
  | 'reuse';

export type QuestionType = 'multiple-choice' | 'which-bin' | 'true-false' | 'discussion';

export type NumberState = 'available' | 'drawn' | 'absent' | 'answered' | 'excluded';

export type GamePhase =
  | 'idle'
  | 'question'
  | 'drawing'
  | 'drawn'
  | 'answering'
  | 'revealed'
  | 'finale';

export type LanguageMode = 'bilingual' | 'en' | 'fi';

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface Question {
  id: string;
  type: QuestionType;
  category: WasteCategory;
  prompt: string;
  promptFi?: string;
  image?: string;
  options: string[];
  optionsFi?: string[];
  answer?: number; // index into options; omitted for discussion
  explanation: string;
  explanationFi?: string;
  notes?: string; // reserved for P1 presenter notes; never shown on Stage
}

export interface GameSettings {
  eventName: string;
  eventMeta: string;
  range: {
    min: number;
    max: number;
  };
  excluded: number[];
  timerSeconds: number;
  sound: boolean; // reserved for P1 audio
  reducedMotion: boolean;
  allowRepeats: boolean;
  absentCooldownRounds: number;
  shuffle: boolean;
  languageMode: LanguageMode;
}

export interface RoundRecord {
  questionId: string;
  number: number | null;
  selectedOption: number | null;
  correct: boolean | null;
  timestamp: number;
}

export interface DrawAnimationPayload {
  target: number;
  candidates: number[];
  startedAt: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  canUndo?: boolean;
  createdAt: number;
}

export interface LastPhoneAnswer {
  number: number;
  optionIndex: number;
  correct: boolean | null;
  timestamp: number;
}

export interface GuestQuestionView {
  id: string;
  type: QuestionType;
  category: WasteCategory | null;
  prompt: string;
  promptFi?: string;
  image?: string;
  options: string[];
  optionsFi?: string[];
  answer?: number;
  explanation?: string;
  explanationFi?: string;
}

export interface GuestGameView {
  eventName: string;
  eventMeta: string;
  languageMode: LanguageMode;
  reducedMotion: boolean;
  phase: GamePhase;
  currentIndex: number;
  totalQuestions: number;
  currentNumber: number | null;
  selectedOption: number | null;
  roundOutcomeOverride: boolean | null;
  timerStatus: TimerStatus;
  timerRemainingMs: number;
  timerStartedAt: number | null;
  timerSeconds: number;
  checkedInCount: number;
  currentQuestion: GuestQuestionView | null;
  finaleStats: {
    played: number;
    correct: number;
    scoredCount: number;
    accuracy: number;
  } | null;
  updatedAt: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  currentIndex: number;
  numbers: Record<number, NumberState>;
  absentAtRound: Record<number, number>;
  currentNumber: number | null;
  selectedOption: number | null;
  roundOutcomeOverride: boolean | null;
  rounds: RoundRecord[];
  timerStatus: TimerStatus;
  timerRemainingMs: number;
  timerStartedAt: number | null;
}

export interface WasteCategoryMeta {
  id: WasteCategory;
  hex: string;
  labelEn: string;
  labelFi: string;
  streamEn: string;
  streamFi: string;
}

export const WASTE_CATEGORIES: Record<WasteCategory, WasteCategoryMeta> = {
  bio: {
    id: 'bio',
    hex: '#7BAE45',
    labelEn: 'Biowaste',
    labelFi: 'Biojäte',
    streamEn: 'Biowaste and food scraps',
    streamFi: 'Biojäte ja ruoantähteet',
  },
  paper: {
    id: 'paper',
    hex: '#4C8DF6',
    labelEn: 'Paper',
    labelFi: 'Paperi',
    streamEn: 'Paper',
    streamFi: 'Keräyspaperi',
  },
  cardboard: {
    id: 'cardboard',
    hex: '#C08A4E',
    labelEn: 'Cardboard',
    labelFi: 'Kartonki',
    streamEn: 'Cardboard',
    streamFi: 'Kartonkipakkaukset',
  },
  plastic: {
    id: 'plastic',
    hex: '#F2C230',
    labelEn: 'Plastic',
    labelFi: 'Muovi',
    streamEn: 'Plastic packaging',
    streamFi: 'Muovipakkaukset',
  },
  glass: {
    id: 'glass',
    hex: '#3FB8A8',
    labelEn: 'Glass',
    labelFi: 'Lasi',
    streamEn: 'Glass packaging',
    streamFi: 'Lasipakkaukset',
  },
  metal: {
    id: 'metal',
    hex: '#A3A9B4',
    labelEn: 'Metal',
    labelFi: 'Metalli',
    streamEn: 'Metal',
    streamFi: 'Metalli',
  },
  mixed: {
    id: 'mixed',
    hex: '#6B6F78',
    labelEn: 'Mixed waste',
    labelFi: 'Sekajäte',
    streamEn: 'Mixed waste',
    streamFi: 'Sekajäte',
  },
  hazard: {
    id: 'hazard',
    hex: '#E5484D',
    labelEn: 'Hazardous',
    labelFi: 'Vaarallinen jäte',
    streamEn: 'Hazardous and e-waste',
    streamFi: 'Vaarallinen jäte ja SER',
  },
  reuse: {
    id: 'reuse',
    hex: '#B48CF2',
    labelEn: 'Reuse & Repair',
    labelFi: 'Uudelleenkäyttö',
    streamEn: 'Reuse, repair, reduce',
    streamFi: 'Uudelleenkäyttö ja korjaus',
  },
};

export const WASTE_CATEGORY_LIST: WasteCategory[] = [
  'bio',
  'paper',
  'cardboard',
  'plastic',
  'glass',
  'metal',
  'mixed',
  'hazard',
  'reuse',
];

export function isWasteCategory(value: string): value is WasteCategory {
  return value in WASTE_CATEGORIES;
}

export function formatCategoryLabel(
  category: WasteCategory,
  mode: LanguageMode = 'bilingual'
): string {
  const meta = WASTE_CATEGORIES[category];
  if (mode === 'en') return meta.labelEn;
  if (mode === 'fi') return meta.labelFi;
  return `${meta.labelEn} / ${meta.labelFi}`;
}
