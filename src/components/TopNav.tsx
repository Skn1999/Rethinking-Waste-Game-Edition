import { ExternalLink } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/host', label: 'Host Console' },
  { to: '/setup', label: 'Setup' },
  { to: '/stage', label: 'Stage' },
  { to: '/print-cards', label: 'Print Cards' },
  { to: '/kitchen-sink', label: 'Components' },
];

export function TopNav() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#08090A]/95 backdrop-blur-sm border-b border-[#23252A]">
      <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line wordmark */}
        <Link
          to="/host"
          className="text-[15px] font-semibold tracking-tight text-[#F7F8F8] hover:text-[#C8F560] transition-colors whitespace-nowrap shrink-0"
        >
          Who&apos;s Sorting?
        </Link>

        {/* Zone 2: Clean single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-6 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative py-1 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-[#F7F8F8]'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute left-0 right-0 -bottom-[17px] h-[2px] bg-[#C8F560]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action — opens Stage in a new window */}
        <div className="flex items-center shrink-0">
          <a
            href="/stage"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[6px] bg-[#C8F560] text-[#08090A] text-[13px] font-semibold hover:bg-[#d5fa7c] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Stage</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
