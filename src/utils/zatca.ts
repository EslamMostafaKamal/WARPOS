// Official ZATCA Phase-1 Simplified Tax Invoice TLV (Tag-Length-Value) Base64 Encoder
// Tag 1: Seller's Name (UTF-8)
// Tag 2: VAT Registration Number (15 digits)
// Tag 3: Time Stamp of the Invoice (ISO-8601)
// Tag 4: Invoice Total (with VAT)
// Tag 5: VAT Total

function encodeTlvField(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const result = new Uint8Array(2 + valueBytes.length);
  result[0] = tag;
  result[1] = valueBytes.length;
  result.set(valueBytes, 2);
  return result;
}

export function encodeZatcaTlvBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  invoiceTotal: number;
  vatTotal: number;
}): string {
  const fields = [
    encodeTlvField(1, params.sellerName.trim() || 'Merchant'),
    encodeTlvField(2, params.vatNumber.trim() || '300000000000003'),
    encodeTlvField(3, params.timestampIso),
    encodeTlvField(4, params.invoiceTotal.toFixed(2)),
    encodeTlvField(5, params.vatTotal.toFixed(2)),
  ];

  const totalLength = fields.reduce((sum, f) => sum + f.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const field of fields) {
    combined.set(field, offset);
    offset += field.length;
  }

  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}
