import * as React from 'react';

interface PolarLogoProps extends React.ComponentProps<'svg'> {
  className?: string;
}

export function PolarLogo({ className = 'size-5', ...props }: PolarLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="100 98.5 200 200"
      className={`polar-logo shrink-0 ${className}`}
      role="img"
      aria-label="polarpdf logo"
      {...props}
    >
      {/* Eyes */}
      <rect x="122" y="122" width="43" height="29" rx="6" className="polar-feature" />
      <rect x="235" y="122" width="43" height="29" rx="6" className="polar-feature" />

      {/* Nose & mouth */}
      <path
        d="M160 181
           Q160 178 164 178
           H236
           Q240 178 240 181
           Q240 184 238 187
           L208 228
           Q204 233 204 240
           V258
           Q204 263 209 263
           H224
           Q230 263 230 269
           Q230 275 224 275
           H176
           Q170 275 170 269
           Q170 263 176 263
           H191
           Q196 263 196 258
           V240
           Q196 233 192 228
           L162 187
           Q160 184 160 181 Z"
        className="polar-feature"
      />
    </svg>
  );
}
