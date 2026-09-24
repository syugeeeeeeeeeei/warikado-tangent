export type ShareRatioTuple = [number, number];
export type ShareExpenseTuple = [string, number, number, 0 | 1, number, ShareRatioTuple[]];
export type SharePayloadV1 = [1, string, string[], ShareExpenseTuple[]];

export interface ShareCodecModelV1 {
  corpus: string[];
  chars: string[];
  subwords: string[];
}

export interface EncodedV3Payload {
  bits: number[];
  meta: {
    memberMode: number;
    expenseMode: number;
    structureModes: {
      amountMode: number;
      payerMode: number;
      fractionMode: number;
      maskMode: number;
    };
    rawBits: number;
    arithmeticBits: number;
  };
}

export interface ShareCodecV3 {
  encode(payload: SharePayloadV1): EncodedV3Payload;
  decode(bits: number[]): SharePayloadV1;
  toUrl(payload: SharePayloadV1): string;
  fromUrl(url: string): SharePayloadV1;
}

export const PREFIX: 'v3.';
export function createCodec(model: ShareCodecModelV1): ShareCodecV3;
