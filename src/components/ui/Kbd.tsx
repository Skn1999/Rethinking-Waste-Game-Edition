import type { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
  inverted?: boolean;
  className?: string;
}

export function Kbd({ children, inverted = false, className = '' }: KbdProps) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1.5 font-mono text-[11px] font-medium leading-none tracking-tight whitespace-nowrap shrink-0 ${
        inverted
          ? 'bg-[#08090A]/15 text-[#08090A] border border-[#08090A]/25'
          : 'bg-[#18191C] text-[#8A8F98] border border-[#23252A]'
      } ${className}`}
    >
      {children}
    </kbd>
  );
}
