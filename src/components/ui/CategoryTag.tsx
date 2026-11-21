import {
  formatCategoryLabel,
  WASTE_CATEGORIES,
  type LanguageMode,
  type WasteCategory,
} from '../../types/game';

interface CategoryTagProps {
  category: WasteCategory;
  languageMode?: LanguageMode;
  variant?: 'inline' | 'chip';
  size?: 'sm' | 'md' | 'stage';
  className?: string;
}

export function CategoryTag({
  category,
  languageMode = 'bilingual',
  variant = 'inline',
  size = 'sm',
  className = '',
}: CategoryTagProps) {
  const meta = WASTE_CATEGORIES[category];
  const label = formatCategoryLabel(category, languageMode);

  const dotSize = size === 'stage' ? 'w-3 h-3' : 'w-1.5 h-1.5';
  const textClass =
    size === 'stage'
      ? 'text-[clamp(14px,1.15vw,22px)] font-medium uppercase tracking-[0.04em]'
      : size === 'md'
        ? 'text-[13px] font-medium'
        : 'text-[12px] font-medium uppercase tracking-[0.04em]';

  if (variant === 'chip') {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-[6px] px-2.5 py-1 whitespace-nowrap shrink-0 ${textClass} ${className}`}
        style={{
          backgroundColor: `${meta.hex}1F`, // 12% tint
          color: '#F7F8F8',
          border: `1px solid ${meta.hex}4D`,
        }}
      >
        <span
          className={`${dotSize} rounded-full shrink-0`}
          style={{ backgroundColor: meta.hex }}
          aria-hidden="true"
        />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 text-[#F7F8F8] whitespace-nowrap shrink-0 ${textClass} ${className}`}
    >
      <span
        className={`${dotSize} rounded-full shrink-0`}
        style={{ backgroundColor: meta.hex }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
