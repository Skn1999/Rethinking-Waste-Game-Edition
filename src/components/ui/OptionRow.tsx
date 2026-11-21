import { Check, X } from 'lucide-react';
import {
  formatCategoryLabel,
  isWasteCategory,
  WASTE_CATEGORIES,
  type LanguageMode,
} from '../../types/game';
import { Kbd } from './Kbd';

export type OptionRowState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

interface OptionRowProps {
  index: number;
  label: string;
  labelFi?: string;
  isBinOption?: boolean;
  languageMode?: LanguageMode;
  state?: OptionRowState;
  size?: 'console' | 'stage';
  shortcutKey?: string;
  onClick?: () => void;
  interactive?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function OptionRow({
  index,
  label,
  labelFi,
  isBinOption = false,
  languageMode = 'bilingual',
  state = 'idle',
  size = 'console',
  shortcutKey,
  onClick,
  interactive = false,
}: OptionRowProps) {
  const letter = LETTERS[index] ?? String(index + 1);
  const binCategory =
    isBinOption && isWasteCategory(label.toLowerCase())
      ? WASTE_CATEGORIES[label.toLowerCase() as keyof typeof WASTE_CATEGORIES]
      : null;

  const displayPrimary = binCategory
    ? formatCategoryLabel(binCategory.id, languageMode)
    : languageMode === 'fi' && labelFi
      ? labelFi
      : label;

  const displaySecondary =
    !binCategory && languageMode === 'bilingual' && labelFi ? labelFi : null;

  const isStage = size === 'stage';

  let containerClass =
    'bg-[#111214] border-[#23252A] text-[#F7F8F8]';
  let badgeClass = 'bg-[#18191C] text-[#8A8F98] border-[#23252A]';

  if (state === 'selected') {
    containerClass =
      'bg-[#18191C] border-[#C8F560] text-[#F7F8F8]';
    badgeClass = 'bg-[#C8F560] text-[#08090A] border-transparent font-semibold';
  } else if (state === 'correct') {
    containerClass =
      'bg-[#4CC38A]/18 border-[#4CC38A] text-[#F7F8F8]';
    badgeClass = 'bg-[#4CC38A] text-[#08090A] border-transparent font-semibold';
  } else if (state === 'wrong') {
    containerClass =
      'bg-[#F2555A]/15 border-[#F2555A] text-[#F7F8F8]';
    badgeClass = 'bg-[#F2555A] text-[#08090A] border-transparent font-semibold';
  } else if (state === 'dimmed') {
    containerClass =
      'bg-[#111214] border-[#23252A] text-[#8A8F98] opacity-30';
    badgeClass = 'bg-[#18191C] text-[#5C616B] border-[#23252A]';
  }

  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      className={`w-full flex items-center justify-between text-left border transition-all duration-150 ${
        isStage
          ? 'rounded-[12px] px-[clamp(16px,1.5vw,28px)] py-[clamp(14px,1.25vw,24px)] gap-[clamp(14px,1.2vw,24px)]'
          : 'rounded-[8px] px-3.5 py-2.5 gap-3'
      } ${containerClass} ${
        interactive
          ? 'cursor-pointer hover:bg-[#18191C] hover:border-[#343740]'
          : ''
      }`}
      style={
        binCategory && state === 'idle'
          ? {
              backgroundColor: `${binCategory.hex}1F`,
              borderColor: `${binCategory.hex}44`,
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <span
          className={`inline-flex items-center justify-center font-mono border shrink-0 ${
            isStage
              ? 'w-[clamp(40px,2.8vw,56px)] h-[clamp(40px,2.8vw,56px)] rounded-[8px] text-[clamp(18px,1.4vw,28px)]'
              : 'w-7 h-7 rounded-[6px] text-[13px]'
          } ${badgeClass}`}
        >
          {letter}
        </span>

        {binCategory && (
          <span
            className={`${isStage ? 'w-3.5 h-3.5' : 'w-2 h-2'} rounded-full shrink-0`}
            style={{ backgroundColor: binCategory.hex }}
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          <div
            className={`font-medium leading-tight ${
              isStage
                ? 'text-[clamp(22px,2.08vw,44px)] tracking-display'
                : 'text-[15px]'
            }`}
          >
            {displayPrimary}
          </div>
          {displaySecondary && (
            <div
              className={`text-[#8A8F98] leading-snug mt-0.5 ${
                isStage
                  ? 'text-[clamp(14px,1.15vw,22px)]'
                  : 'text-[12px]'
              }`}
            >
              {displaySecondary}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {state === 'correct' && (
          <span
            className={`inline-flex items-center justify-center rounded-full bg-[#4CC38A] text-[#08090A] ${
              isStage ? 'w-[clamp(32px,2.2vw,44px)] h-[clamp(32px,2.2vw,44px)]' : 'w-6 h-6'
            }`}
            aria-label="Correct answer"
          >
            <Check className={isStage ? 'w-6 h-6 stroke-[2.75]' : 'w-3.5 h-3.5 stroke-[2.75]'} />
          </span>
        )}
        {state === 'wrong' && (
          <span
            className={`inline-flex items-center justify-center rounded-full bg-[#F2555A] text-[#08090A] ${
              isStage ? 'w-[clamp(32px,2.2vw,44px)] h-[clamp(32px,2.2vw,44px)]' : 'w-6 h-6'
            }`}
            aria-label="Wrong answer"
          >
            <X className={isStage ? 'w-6 h-6 stroke-[2.75]' : 'w-3.5 h-3.5 stroke-[2.75]'} />
          </span>
        )}
        {shortcutKey && !isStage && <Kbd>{shortcutKey}</Kbd>}
      </div>
    </Tag>
  );
}
