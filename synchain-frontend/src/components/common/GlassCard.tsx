import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  headerAction?: React.ReactNode;
  glowOnHover?: boolean;
  intensity?: 'subtle' | 'medium' | 'high';
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  title,
  subtitle,
  badge,
  action,
  headerAction,
  glowOnHover = true,
  intensity = 'medium',
  className = '',
  children,
  ...props
}) => {
  const finalAction = action || headerAction;
  const intensityClasses = {
    subtle: 'bg-slate-900/40 backdrop-blur-md border border-white/5 shadow-lg',
    medium: 'glass-panel border border-white/10 shadow-2xl',
    high: 'glass-card border border-white/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]',
  }[intensity];

  return (
    <motion.div
      whileHover={glowOnHover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={`rounded-2xl p-5 md:p-6 transition-all duration-300 ${intensityClasses} ${
        glowOnHover ? 'hover:border-blue-500/30 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]' : ''
      } ${className}`}
      {...props}
    >
      {(title || subtitle || badge || finalAction) && (
        <div className="flex items-start justify-between gap-4 mb-4 border-b border-white/5 pb-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              {typeof title === 'string' ? (
                <h3 className="text-base font-semibold text-slate-100 tracking-tight font-display">
                  {title}
                </h3>
              ) : (
                title
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-400 font-sans tracking-wide">
                {subtitle}
              </p>
            )}
          </div>
          {finalAction && <div className="shrink-0">{finalAction}</div>}
        </div>
      )}
      <div>{children}</div>
    </motion.div>
  );
};
