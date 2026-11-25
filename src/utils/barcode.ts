// Code 128-B barcode encoder producing standard module width patterns for SVG rendering
const CODE128_PATTERNS: string[] = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export interface BarcodeBar {
  x: number;
  width: number;
}

export interface EncodedBarcode {
  bars: BarcodeBar[];
  totalWidth: number;
}

export function encodeCode128B(rawValue: string): EncodedBarcode {
  const sanitized = (rawValue || '000000')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126 ? ch : '-';
    })
    .join('');

  const values: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < sanitized.length; i++) {
    const val = sanitized.charCodeAt(i) - 32;
    values.push(val);
    checksum += val * (i + 1);
  }

  values.push(checksum % 103);
  values.push(STOP_CODE);

  const quietZone = 8;
  let x = quietZone;
  const bars: BarcodeBar[] = [];

  for (const val of values) {
    const pattern = CODE128_PATTERNS[val] ?? CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = parseInt(pattern[i], 10);
      if (i % 2 === 0) {
        bars.push({ x, width: w });
      }
      x += w;
    }
  }

  return {
    bars,
    totalWidth: x + quietZone,
  };
}

export function generateVariantBarcode(
  baseSku: string,
  color: string,
  size: string
): string {
  const cleanSku = baseSku.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'ITEM';
  const colorCode = color.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3) || 'STD';
  const sizeCode = size.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3) || 'ONE';
  return `${cleanSku}-${colorCode}-${sizeCode}`;
}

export function generateBaseBarcode(sku: string): string {
  const clean = sku.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean || `BC${Date.now().toString().slice(-6)}`;
}
