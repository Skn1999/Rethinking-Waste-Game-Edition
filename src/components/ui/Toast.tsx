import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';
import { Kbd } from './Kbd';

interface ToastProps {
  message: string | null;
  canUndo?: boolean;
  onUndo?: () => void;
  onDismiss?: () => void;
}

export function Toast({ message, canUndo = false, onUndo, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-center gap-3 rounded-[12px] bg-[#18191C] border border-[#23252A] px-4 py-2.5 text-[13px] text-[#F7F8F8]"
          >
            <span className="whitespace-nowrap">{message}</span>
            {canUndo && onUndo && (
              <button
                type="button"
                onClick={onUndo}
                className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#C8F560]/12 border border-[#C8F560]/35 px-2 py-1 text-[12px] font-medium text-[#C8F560] hover:bg-[#C8F560]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
                <Kbd className="bg-[#08090A] border-[#C8F560]/30 text-[#C8F560]">Z</Kbd>
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="text-[#8A8F98] hover:text-[#F7F8F8] transition-colors cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
