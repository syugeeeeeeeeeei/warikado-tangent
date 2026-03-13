import type { EventData, Expense, ExpenseRatio, Member } from '../types/domain';

type SupportedCompressionFormat = 'gzip';

const CURRENT_COMPRESSION_FORMAT: SupportedCompressionFormat = 'gzip';
const ENCODED_PREFIX = 'gz.';

// v1: [version, eventName, memberNames, expenses]
// expense: [name, amount, payerIndex, gradientMode(0|1), fractionBearerIndex, sparseRatios]
// sparseRatio: [memberIndex, ratio]
type ShareRatioTuple = [number, number];
type ShareExpenseTuple = [
  string,
  number,
  number,
  0 | 1,
  number,
  ShareRatioTuple[],
];
type SharePayloadV1 = [1, string, string[], ShareExpenseTuple[]];

const toArrayBuffer = (bytes: Uint8Array) => {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};

// ReadableStream を Uint8Array に集約する。
const readAll = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    totalLength += value.length;
  }

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });

  return merged;
};

const compressBytes = async (
  input: Uint8Array,
  format: SupportedCompressionFormat,
) => {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream is not supported in this environment.');
  }

  const stream = new Blob([toArrayBuffer(input)])
    .stream()
    .pipeThrough(new CompressionStream(format));
  return readAll(stream);
};

const decompressBytes = async (
  input: Uint8Array,
  format: SupportedCompressionFormat,
) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not supported in this environment.');
  }

  const stream = new Blob([toArrayBuffer(input)])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  return readAll(stream);
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const toBase64Url = (bytes: Uint8Array) => {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const fromBase64Url = (base64Url: string) => {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return base64ToBytes(padded);
};

const toSafeInteger = (value: unknown, fallback = 0) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
};

const toSharePayloadV1 = (eventData: EventData): SharePayloadV1 => {
  const members = eventData.members.map((member) => member.name);
  const memberIdToIndex = new Map(
    eventData.members.map((member, index) => [member.id, index]),
  );

  const expenses: ShareExpenseTuple[] = eventData.expenses.map((expense) => {
    const payerIndex = memberIdToIndex.get(expense.payerId) ?? 0;
    const fractionBearerIndex =
      memberIdToIndex.get(expense.fractionBearerId) ?? payerIndex;

    const sparseRatios: ShareRatioTuple[] = expense.ratios
      .map((ratio) => {
        const memberIndex = memberIdToIndex.get(ratio.memberId);
        if (memberIndex === undefined || ratio.ratio <= 0) return null;
        return [memberIndex, ratio.ratio] as ShareRatioTuple;
      })
      .filter((pair): pair is ShareRatioTuple => Boolean(pair))
      .sort((a, b) => a[0] - b[0]);

    return [
      expense.name,
      toSafeInteger(expense.amount),
      payerIndex,
      expense.isGradientMode ? 1 : 0,
      fractionBearerIndex,
      sparseRatios,
    ];
  });

  return [1, eventData.name, members, expenses];
};

const isValidIndex = (index: number, length: number) => {
  return Number.isInteger(index) && index >= 0 && index < length;
};

const fromSharePayloadV1 = (payload: SharePayloadV1): EventData => {
  const [, name, memberNames, expenseTuples] = payload;
  const members: Member[] = Array.isArray(memberNames)
    ? memberNames.map((memberName, index) => ({
        id: `m${index.toString(36)}`,
        name: typeof memberName === 'string' ? memberName : '',
      }))
    : [];

  const defaultMemberId = members[0]?.id ?? '';

  const expenses: Expense[] = Array.isArray(expenseTuples)
    ? expenseTuples.map((tuple, expenseIndex) => {
        const [
          expenseName,
          amount,
          payerIndex,
          gradientMode,
          fractionBearerIndex,
          sparseRatios,
        ] = tuple;

        const ratioMap = new Map<number, number>();
        if (Array.isArray(sparseRatios)) {
          sparseRatios.forEach((pair) => {
            if (!Array.isArray(pair) || pair.length !== 2) return;
            const [memberIndex, ratioValue] = pair;
            if (!isValidIndex(memberIndex, members.length)) return;
            if (typeof ratioValue !== 'number' || !Number.isFinite(ratioValue)) return;
            if (ratioValue <= 0) return;
            ratioMap.set(memberIndex, ratioValue);
          });
        }

        const ratios: ExpenseRatio[] = members.map((member, memberIndex) => ({
          memberId: member.id,
          ratio: ratioMap.get(memberIndex) ?? 0,
        }));

        return {
          id: `e${expenseIndex.toString(36)}`,
          name: typeof expenseName === 'string' ? expenseName : '',
          amount: toSafeInteger(amount),
          payerId: isValidIndex(payerIndex, members.length)
            ? members[payerIndex].id
            : defaultMemberId,
          ratios,
          isGradientMode: gradientMode === 1,
          fractionBearerId: isValidIndex(fractionBearerIndex, members.length)
            ? members[fractionBearerIndex].id
            : defaultMemberId,
        };
      })
    : [];

  return { name: typeof name === 'string' ? name : '', members, expenses };
};

const isEventDataLike = (parsed: unknown): parsed is EventData => {
  if (!parsed || typeof parsed !== 'object') return false;
  return 'members' in parsed && 'expenses' in parsed;
};

const isSharePayloadV1 = (parsed: unknown): parsed is SharePayloadV1 => {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length !== 4) return false;
  return parsed[0] === 1;
};

export interface EncodedEventDataResult {
  encoded: string;
  compression: SupportedCompressionFormat;
}

// EventData を URL 共有向け文字列に圧縮する。
export const encodeEventDataToUrlSafe = async (
  eventData: EventData,
): Promise<EncodedEventDataResult> => {
  const compacted = toSharePayloadV1(eventData);
  const rawJson = JSON.stringify(compacted);
  const rawBytes = new TextEncoder().encode(rawJson);
  const compressed = await compressBytes(rawBytes, CURRENT_COMPRESSION_FORMAT);

  return {
    encoded: `${ENCODED_PREFIX}${toBase64Url(compressed)}`,
    compression: CURRENT_COMPRESSION_FORMAT,
  };
};

// URL 共有文字列を EventData に復元する。
export const decodeEventDataFromUrlSafe = async (
  encoded: string,
): Promise<EventData> => {
  if (!encoded.startsWith(ENCODED_PREFIX)) {
    throw new Error('Unsupported payload prefix.');
  }

  const payload = encoded.slice(ENCODED_PREFIX.length);
  if (!payload) {
    throw new Error('Payload is empty.');
  }

  const compressedBytes = fromBase64Url(payload);
  const decompressed = await decompressBytes(
    compressedBytes,
    CURRENT_COMPRESSION_FORMAT,
  );
  const json = new TextDecoder().decode(decompressed);
  const parsed = JSON.parse(json) as unknown;

  // 互換: 旧フォーマット（EventData直接JSON）も読み込めるようにしておく。
  if (isEventDataLike(parsed)) {
    return parsed;
  }

  if (isSharePayloadV1(parsed)) {
    return fromSharePayloadV1(parsed);
  }

  throw new Error('Invalid event data format.');
};
