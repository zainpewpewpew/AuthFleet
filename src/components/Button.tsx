import * as React from 'react';
import clsx from './_clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  iconLeading?: React.ReactNode;
  iconTrailing?: React.ReactNode;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', iconLeading, iconTrailing, loading, className, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        aria-busy={loading ? 'true' : undefined}
        disabled={disabled || loading}
        {...rest}
        className={clsx(
          'af-btn',
          `af-btn--${variant}`,
          `af-btn--${size}`,
          loading && 'af-btn--loading',
          className,
        )}
      >
        {iconLeading ? <span className="af-btn__icon">{iconLeading}</span> : null}
        <span className="af-btn__label">{children}</span>
        {iconTrailing ? <span className="af-btn__icon">{iconTrailing}</span> : null}
        {loading ? <span className="af-btn__spinner" aria-hidden /> : null}
      </button>
    );
  }
);
