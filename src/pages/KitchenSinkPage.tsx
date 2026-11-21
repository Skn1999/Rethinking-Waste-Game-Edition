import { useState } from 'react';
import { TopNav } from '../components/TopNav';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CategoryTag } from '../components/ui/CategoryTag';
import { Kbd } from '../components/ui/Kbd';
import { NumberTile } from '../components/ui/NumberTile';
import { OptionRow } from '../components/ui/OptionRow';
import { TimerRing } from '../components/ui/TimerRing';
import { Toast } from '../components/ui/Toast';
import { WASTE_CATEGORIES, WASTE_CATEGORY_LIST } from '../types/game';

const CORE_TOKENS = [
  { name: 'bg/canvas', hex: '#08090A' },
  { name: 'bg/card', hex: '#111214' },
  { name: 'bg/card-raised', hex: '#18191C' },
  { name: 'border/hairline', hex: '#23252A' },
  { name: 'text/primary', hex: '#F7F8F8' },
  { name: 'text/secondary', hex: '#8A8F98' },
  { name: 'text/tertiary', hex: '#5C616B' },
  { name: 'accent/compost', hex: '#C8F560' },
  { name: 'state/correct', hex: '#4CC38A' },
  { name: 'state/wrong', hex: '#F2555A' },
  { name: 'state/warning', hex: '#F5A524' },
];

export function KitchenSinkPage() {
  const [demoToast, setDemoToast] = useState<string | null>(null);
  const [demoSeconds, setDemoSeconds] = useState(18);

  return (
    <div className="min-h-screen bg-[#08090A] text-[#F7F8F8] flex flex-col">
      <TopNav />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-display">
            Design System &amp; Component Kit
          </h1>
          <p className="text-[14px] text-[#8A8F98] mt-1">
            Linear-style dark bento tokens, waste-stream colors, and base modules powering Host Console and Stage.
          </p>
        </div>

        {/* Color Tokens */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-6 space-y-4">
            <h2 className="text-[15px] font-semibold">Core Dark Theme Tokens</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CORE_TOKENS.map((t) => (
                <div
                  key={t.name}
                  className="rounded-[8px] bg-[#08090A] border border-[#23252A] p-2.5 flex items-center gap-2.5"
                >
                  <span
                    className="w-6 h-6 rounded-[6px] border border-[#23252A] shrink-0"
                    style={{ backgroundColor: t.hex }}
                  />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium truncate">
                      {t.name}
                    </div>
                    <div className="tabular-mono text-[11px] text-[#8A8F98]">
                      {t.hex}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-6 space-y-4">
            <h2 className="text-[15px] font-semibold">
              Waste Category Streams (EN + FI)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WASTE_CATEGORY_LIST.map((cat) => {
                const meta = WASTE_CATEGORIES[cat];
                return (
                  <div
                    key={cat}
                    className="rounded-[8px] bg-[#08090A] border border-[#23252A] px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <CategoryTag category={cat} variant="chip" />
                    <span className="tabular-mono text-[11px] text-[#8A8F98]">
                      {meta.hex}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Base Components Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Buttons & Kbd */}
          <Card category="bio" className="lg:col-span-6 space-y-4">
            <h2 className="text-[15px] font-semibold">
              Buttons, Kbd Chips &amp; Toast
            </h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="primary" kbd="Space">
                Draw a number
              </Button>
              <Button variant="secondary" kbd="R">
                Reveal the bin
              </Button>
              <Button variant="danger" kbd="A">
                Mark Absent
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setDemoToast('Number 23 marked absent · Drawing #41')
                }
              >
                Trigger Toast
              </Button>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[#23252A] text-[12px] text-[#8A8F98]">
              <span>Shortcuts:</span>
              <Kbd>Space</Kbd>
              <Kbd>R</Kbd>
              <Kbd>N</Kbd>
              <Kbd>A</Kbd>
              <Kbd>T</Kbd>
              <Kbd>1–4</Kbd>
              <Kbd>Z</Kbd>
              <Kbd>F</Kbd>
            </div>
          </Card>

          {/* TimerRing & NumberTiles */}
          <Card category="glass" className="lg:col-span-6 space-y-4">
            <h2 className="text-[15px] font-semibold">
              TimerRing &amp; NumberTile States
            </h2>
            <div className="flex flex-wrap items-center gap-6">
              <TimerRing totalSeconds={30} remainingMs={demoSeconds * 1000} size={68} />
              <TimerRing totalSeconds={30} remainingMs={4000} size={68} />
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#8A8F98]">
                  Preview remaining seconds ({demoSeconds}s)
                </span>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={demoSeconds}
                  onChange={(e) => setDemoSeconds(Number(e.target.value))}
                  className="w-40 accent-[#C8F560]"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 max-w-[280px] pt-2">
              <NumberTile number={7} state="available" />
              <NumberTile number={14} state="drawn" />
              <NumberTile number={23} state="absent" />
              <NumberTile number={31} state="answered" />
              <NumberTile number={58} state="excluded" />
            </div>
          </Card>

          {/* OptionRow States */}
          <Card category="cardboard" className="lg:col-span-12 space-y-3">
            <h2 className="text-[15px] font-semibold">
              OptionRow States (Idle, Selected, Correct, Wrong, Dimmed)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <OptionRow
                index={0}
                label="cardboard"
                isBinOption
                state="idle"
                shortcutKey="1"
              />
              <OptionRow
                index={1}
                label="bio"
                isBinOption
                state="correct"
                shortcutKey="2"
              />
              <OptionRow
                index={2}
                label="mixed"
                isBinOption
                state="wrong"
                shortcutKey="3"
              />
              <OptionRow
                index={3}
                label="paper"
                isBinOption
                state="dimmed"
                shortcutKey="4"
              />
            </div>
          </Card>
        </div>
      </main>

      <Toast
        message={demoToast}
        canUndo
        onUndo={() => setDemoToast(null)}
        onDismiss={() => setDemoToast(null)}
      />
    </div>
  );
}
