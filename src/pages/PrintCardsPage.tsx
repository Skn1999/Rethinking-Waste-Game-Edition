import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useGameStore } from '../store/gameStore';
import { WASTE_CATEGORIES, WASTE_CATEGORY_LIST } from '../types/game';

const CARDS_PER_PAGE = 12;

export function PrintCardsPage() {
  const settings = useGameStore((s) => s.settings);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [printTheme, setPrintTheme] = useState<'event-dark' | 'ink-saver'>(
    'event-dark'
  );

  const numbers = useMemo(() => {
    const excludedSet = new Set(settings.excluded);
    const list: number[] = [];
    for (let n = settings.range.min; n <= settings.range.max; n++) {
      if (!includeExcluded && excludedSet.has(n)) continue;
      list.push(n);
    }
    return list;
  }, [settings.range.min, settings.range.max, settings.excluded, includeExcluded]);

  const pages = useMemo(() => {
    const chunks: number[][] = [];
    for (let i = 0; i < numbers.length; i += CARDS_PER_PAGE) {
      chunks.push(numbers.slice(i, i + CARDS_PER_PAGE));
    }
    return chunks;
  }, [numbers]);

  const isDark = printTheme === 'event-dark';
  const lang = settings.languageMode;

  return (
    <div className="min-h-screen bg-[#08090A] text-[#F7F8F8] print:bg-white">
      {/* Screen-only toolbar */}
      <header className="no-print sticky top-0 z-30 bg-[#08090A]/95 backdrop-blur-sm border-b border-[#23252A]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/setup"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#8A8F98] hover:text-[#F7F8F8] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Setup
            </Link>
            <span className="text-[#23252A]" aria-hidden="true">
              |
            </span>
            <div className="text-[13px] text-[#8A8F98] tabular-mono">
              {numbers.length} cards · {pages.length} A4{' '}
              {pages.length === 1 ? 'sheet' : 'sheets'} (12 / page)
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Theme toggle */}
            <div className="flex items-center gap-1 p-1 rounded-[8px] bg-[#111214] border border-[#23252A]">
              <button
                type="button"
                onClick={() => setPrintTheme('event-dark')}
                className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isDark
                    ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }`}
              >
                Event Dark
              </button>
              <button
                type="button"
                onClick={() => setPrintTheme('ink-saver')}
                className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  !isDark
                    ? 'bg-[#18191C] text-[#F7F8F8] border border-[#23252A]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }`}
              >
                Ink-Saver Light
              </button>
            </div>

            {settings.excluded.length > 0 && (
              <label className="inline-flex items-center gap-2 text-[12px] text-[#8A8F98] cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={includeExcluded}
                  onChange={(e) => setIncludeExcluded(e.target.checked)}
                  className="accent-[#C8F560]"
                />
                Include excluded ({settings.excluded.length})
              </label>
            )}

            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Printable A4 Sheets */}
      <main className="py-8 px-4 flex flex-col items-center gap-8 print:p-0 print:gap-0">
        {pages.map((sheetNumbers, pageIdx) => (
          <section
            key={pageIdx}
            className="print-sheet w-full max-w-[210mm] aspect-[210/297] bg-white p-[8mm] rounded-[8px] print:rounded-none print:p-0 flex flex-col justify-between"
          >
            {/* 3 columns x 4 rows = 12 door cards per A4 page */}
            <div className="grid grid-cols-3 grid-rows-4 gap-[4mm] flex-1">
              {sheetNumbers.map((num) => {
                const accentCat =
                  WASTE_CATEGORY_LIST[(num - 1) % WASTE_CATEGORY_LIST.length];
                const accentHex = WASTE_CATEGORIES[accentCat].hex;

                return (
                  <article
                    key={num}
                    className={`relative rounded-[8px] border border-dashed flex flex-col justify-between p-4 overflow-hidden ${
                      isDark
                        ? 'bg-[#08090A] border-[#343740] text-[#F7F8F8]'
                        : 'bg-white border-[#CBD5E1] text-[#08090A]'
                    }`}
                    style={{
                      borderTopWidth: '3px',
                      borderTopStyle: 'solid',
                      borderTopColor: accentHex,
                    }}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className={`text-[9px] font-semibold uppercase tracking-[0.06em] truncate ${
                            isDark ? 'text-[#8A8F98]' : 'text-[#475569]'
                          }`}
                        >
                          {settings.eventName}
                        </div>
                        <div
                          className={`text-[10px] font-medium mt-0.5 ${
                            isDark ? 'text-[#C8F560]' : 'text-[#0F172A]'
                          }`}
                        >
                          {lang === 'fi'
                            ? 'Kuka lajittelee?'
                            : lang === 'en'
                              ? "Who's sorting?"
                              : "Who's sorting? · Kuka lajittelee?"}
                        </div>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: accentHex }}
                      />
                    </div>

                    {/* Giant Door Number */}
                    <div className="flex-1 flex items-center justify-center my-1">
                      <span className="tabular-mono text-[56px] font-semibold leading-none tracking-display">
                        {num}
                      </span>
                    </div>

                    {/* Card Footer */}
                    <div
                      className={`pt-2 border-t flex items-center justify-between text-[9px] ${
                        isDark
                          ? 'border-[#23252A] text-[#8A8F98]'
                          : 'border-[#E2E8F0] text-[#64748B]'
                      }`}
                    >
                      <span>
                        {lang === 'fi'
                          ? 'Pidä kortti tallessa'
                          : 'Keep this ticket'}
                      </span>
                      <span className="tabular-mono">
                        #{String(num).padStart(2, '0')} · p.{pageIdx + 1}
                      </span>
                    </div>
                  </article>
                );
              })}

              {/* Empty filler cells on final partial page to keep exact 3x4 geometry */}
              {Array.from({
                length: Math.max(0, CARDS_PER_PAGE - sheetNumbers.length),
              }).map((_, i) => (
                <div key={`empty-${i}`} aria-hidden="true" />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
