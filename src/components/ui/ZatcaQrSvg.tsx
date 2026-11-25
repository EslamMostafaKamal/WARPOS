import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { encodeZatcaTlvBase64 } from '../../utils/zatca';

interface ZatcaQrSvgProps {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  invoiceTotal: number;
  vatTotal: number;
  size?: number;
  showTlvLabel?: boolean;
}

export const ZatcaQrSvg: React.FC<ZatcaQrSvgProps> = ({
  sellerName,
  vatNumber,
  timestampIso,
  invoiceTotal,
  vatTotal,
  size = 116,
  showTlvLabel = false,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const tlvBase64 = encodeZatcaTlvBase64({
    sellerName,
    vatNumber,
    timestampIso,
    invoiceTotal,
    vatTotal,
  });

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(tlvBase64, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [tlvBase64, size]);

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="ZATCA Phase-1 E-Invoice QR Code"
          width={size}
          height={size}
          className="border border-slate-200 rounded bg-white p-1"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="border border-slate-200 rounded bg-slate-50 flex items-center justify-center text-[10px] text-slate-400"
        >
          QR
        </div>
      )}
      {showTlvLabel && (
        <p className="text-[9px] font-mono text-slate-400 max-w-[200px] truncate" title={tlvBase64}>
          TLV: {tlvBase64}
        </p>
      )}
    </div>
  );
};
