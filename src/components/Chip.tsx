import * as React from 'react';
import clsx from './_clsx';

type ChipTone = 'neutral' | 'teal' | 'pink' | 'green' | 'amber';

export function Chip({
  tone = 'neutral',
  pulse,
  children,
  className,
}: {
  tone?: ChipTone;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx('af-chip', `af-chip--${tone}`, pulse && 'af-chip--pulse', className)}>
      <span className="af-chip__dot" aria-hidden />
      <span className="af-chip__label">{children}</span>
    </span>
  );
}
