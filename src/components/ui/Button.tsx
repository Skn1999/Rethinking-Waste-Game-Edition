import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Kbd } from './Kbd';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'console' | 'lg' | 'touch';
  kbd?: string;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'console',
  kbd,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const sizeClass =
    size === 'touch'
      ? 'h-16 px-6 text-base gap-3'
      : size === 'lg'
        ? 'h-11 px-4 text-sm gap-2.5'
        : 'h-9 px-3.5 text-[13px] gap-2';

  const variantClass =
    variant === 'primary'
      ? 'bg-[#C8F560] text-[#08090A] font-semibold hover:bg-[#d5fa7c] active:bg-[#bce855] border border-transparent'
      : variant === 'danger'
        ? 'bg-[#F2555A]/12 text-[#F2555A] font-medium border border-[#F2555A]/30 hover:bg-[#F2555A]/20'
        : variant === 'ghost'
          ? 'bg-transparent text-[#8A8F98] font-medium border border-transparent hover:bg-[#18191C] hover:text-[#F7F8F8]'
          : 'bg-transparent text-[#F7F8F8] font-medium border border-[#23252A] hover:bg-[#18191C] hover:border-[#343740]';

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[6px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${className}`}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5">{children}</span>
      {kbd && <Kbd inverted={variant === 'primary'}>{kbd}</Kbd>}
    </button>
  );
}
