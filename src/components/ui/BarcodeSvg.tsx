import React, { useMemo } from 'react';
import { encodeCode128B } from '../../utils/barcode';

interface BarcodeSvgProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  height = 34,
  showText = true,
  className = '',
}) => {
  const encoded = useMemo(() => encodeCode128B(value), [value]);

  return (
    <div className={`inline-flex flex-col items-center max-w-full ${className}`}>
      <svg
        viewBox={`0 0 ${encoded.totalWidth} ${height}`}
        className="w-full max-w-[240px] h-auto"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Barcode ${value}`}
      >
        <rect x={0} y={0} width={encoded.totalWidth} height={height} fill="#ffffff" />
        {encoded.bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#0f172a"
          />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-[10px] tracking-wider text-slate-700 mt-0.5 select-all">
          {value}
        </span>
      )}
    </div>
  );
};
