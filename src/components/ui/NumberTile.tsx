import { Check, Clock, Slash } from 'lucide-react';
import type { NumberState } from '../../types/game';

interface NumberTileProps {
  number: number;
  state: NumberState;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}

export function NumberTile({
  number,
  state,
  selected = false,
  onClick,
  title,
}: NumberTileProps) {
  let stateClass =
    'bg-[#111214] border-[#23252A] text-[#F7F8F8] hover:bg-[#18191C] hover:border-[#3A3D46]';

  if (state === 'drawn') {
    stateClass =
      'bg-[#C8F560] border-[#C8F560] text-[#08090A] font-semibold';
  } else if (state === 'absent') {
    stateClass =
      'bg-[#F5A524]/10 border-dashed border-[#F5A524]/70 text-[#F5A524] hover:bg-[#F5A524]/20';
  } else if (state === 'answered') {
    stateClass =
      'bg-[#18191C] border-[#23252A] text-[#5C616B] hover:border-[#343740]';
  } else if (state === 'excluded') {
    stateClass =
      'bg-[#08090A] border-[#1A1C20] text-[#5C616B]/60 line-through hover:border-[#2C2F36]';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `#${number} (${state})`}
      aria-label={`Guest number ${number}, ${state}`}
      className={`relative aspect-square w-full min-h-[36px] flex items-center justify-center rounded-[6px] border tabular-mono text-[13px] font-medium transition-colors duration-150 cursor-pointer ${stateClass} ${
        selected ? 'ring-2 ring-[#C8F560] ring-offset-1 ring-offset-[#111214]' : ''
      }`}
    >
      <span>{number}</span>
      {state === 'answered' && (
        <Check
          className="w-2.5 h-2.5 text-[#4CC38A] absolute top-1 right-1"
          aria-hidden="true"
        />
      )}
      {state === 'absent' && (
        <Clock
          className="w-2.5 h-2.5 text-[#F5A524] absolute top-1 right-1"
          aria-hidden="true"
        />
      )}
      {state === 'excluded' && (
        <Slash
          className="w-2.5 h-2.5 text-[#5C616B]/60 absolute top-1 right-1"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
