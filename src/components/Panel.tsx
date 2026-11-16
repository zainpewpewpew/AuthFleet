import * as React from 'react';
import clsx from './_clsx';

/**
 * Chrome panel — the Y2K Frutiger Aero glossy plate used for every elevated
 * surface in the app. Specular highlight along the top edge, chrome bevel
 * on every side, soft shadow that sits ON the sky.
 */
type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: 'chrome' | 'ocean' | 'aqua';
  padded?: boolean;
  radius?: 'sm' | 'md' | 'lg';
  shine?: boolean;
};

export function Panel({
  tone = 'chrome',
  padded = true,
  radius = 'md',
  shine = true,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <div
      {...rest}
      className={clsx('af-panel', `af-panel--${tone}`, `af-panel--r-${radius}`,
        padded && 'af-panel--padded', shine && 'af-panel--shine', className)}
    >
      {children}
    </div>
  );
}
