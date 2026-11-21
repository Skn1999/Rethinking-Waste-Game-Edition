import type { HTMLAttributes, ReactNode } from 'react';
import { WASTE_CATEGORIES, type WasteCategory } from '../../types/game';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  category?: WasteCategory;
  variant?: 'default' | 'raised' | 'hero';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  category,
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  ...props
}: CardProps) {
  const surface =
    variant === 'raised'
      ? 'bg-[#18191C]'
      : 'bg-[#111214]';
  const radius = variant === 'hero' ? 'rounded-[20px]' : 'rounded-[12px]';
  const categoryHex = category ? WASTE_CATEGORIES[category].hex : undefined;

  return (
    <div
      className={`${surface} ${radius} border border-[#23252A] ${paddingMap[padding]} ${
        categoryHex ? 'border-t-2' : ''
      } ${className}`}
      style={
        categoryHex
          ? { borderTopColor: categoryHex, ...style }
          : style
      }
      {...props}
    >
      {children}
    </div>
  );
}
