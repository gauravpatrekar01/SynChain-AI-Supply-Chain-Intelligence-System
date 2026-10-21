import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info } from 'lucide-react';

interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  icon?: 'help' | 'info';
  iconSize?: number;
  iconClassName?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  icon = 'help',
  iconSize = 14,
  iconClassName = 'text-slate-400 hover:text-slate-200 transition-colors',
  position = 'top',
  maxWidth = 'max-w-xs',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const idRef = useRef(`tooltip-${Math.random().toString(36).substring(2, 9)}`);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 120);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsVisible(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <span
      className="relative inline-flex items-center align-middle"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-describedby={isVisible ? idRef.current : undefined}
    >
      {children ? (
        children
      ) : (
        <span className="cursor-help inline-flex p-0.5" aria-hidden="true">
          {icon === 'help' ? (
            <HelpCircle size={iconSize} className={iconClassName} />
          ) : (
            <Info size={iconSize} className={iconClassName} />
          )}
        </span>
      )}

      {isVisible && (
        <div
          id={idRef.current}
          role="tooltip"
          className={`absolute ${positionClasses} z-50 ${maxWidth} w-max rounded-xl bg-slate-900/98 backdrop-blur-xl border border-white/20 px-3.5 py-2.5 text-xs sm:text-[13px] font-normal normal-case leading-relaxed text-slate-100 shadow-2xl pointer-events-none transition-all duration-150 animate-in fade-in-0 zoom-in-95`}
          style={{ minWidth: '190px' }}
        >
          {content}
          {/* Arrow pointers */}
          {position === 'top' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
          )}
          {position === 'bottom' && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-slate-900" />
          )}
        </div>
      )}
    </span>
  );
};
