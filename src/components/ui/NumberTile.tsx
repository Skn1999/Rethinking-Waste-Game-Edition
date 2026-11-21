import { Check, Clock, Slash } from 'lucide-react';
import type { NumberState } from '../../types/game';

interface NumberTileProps {
  number: number;
  state: NumberState;
  checkedIn?: boolean;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
}

export function NumberTile({
  number,
  state,
  checkedIn = false,
  selected = false,
  onClick,
  title,
}: NumberTileProps) {
  let stateClass = checkedIn
    ? 'bg-[#111214] border-[#4CC38A]/60 text-[#F7F8F8] hover:bg-[#18191C] hover:border-[#C8F560]'
    : 'bg-[#0C0D0F] border-[#1D1F24] text-[#5C616B] hover:bg-[#141518] hover:border-[#2C2F36]';

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
      'bg-[#08090A] border-[#1A1C20] text-[#5C616B]/50 line-through hover:border-[#2C2F36]';
  }

  const defaultTitle = `#${number} (${state}${checkedIn ? ' · checked in via QR' : ' · not checked in'})`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? defaultTitle}
      aria-label={`Guest number ${number}, ${state}${checkedIn ? ', checked in' : ', not checked in'}`}
      className={`relative aspect-square w-full min-h-[36px] flex items-center justify-center rounded-[6px] border tabular-mono text-[13px] font-medium transition-colors duration-150 cursor-pointer ${stateClass} ${
        selected ? 'ring-2 ring-[#C8F560] ring-offset-1 ring-offset-[#111214]' : ''
      }`}
    >
      <span>{number}</span>
      {checkedIn && state === 'available' && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#4CC38A] absolute top-1 right-1"
          aria-hidden="true"
        />
      )}
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
