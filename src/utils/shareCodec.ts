import type { EventData } from '../types/domain';

type SupportedCompressionFormat = 'gzip';

const CURRENT_COMPRESSION_FORMAT: SupportedCompressionFormat = 'gzip';
const ENCODED_PREFIX = 'gz.';

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

export interface EncodedEventDataResult {
  encoded: string;
  compression: SupportedCompressionFormat;
}

const normalizeIdsForShare = (eventData: EventData): EventData => {
  const memberPairs = eventData.members.map((member, index) => {
    const compactId = `m${index.toString(36)}`;
    return {
      oldId: member.id,
      id: compactId,
      name: member.name,
    };
  });
  const memberIdMap = new Map(memberPairs.map((pair) => [pair.oldId, pair.id]));
  const normalizedMembers = memberPairs.map((pair) => ({
    id: pair.id,
    name: pair.name,
  }));

  const firstMemberId = normalizedMembers[0]?.id ?? '';

  const normalizedExpenses = eventData.expenses.map((expense, index) => {
    const compactExpenseId = `e${index.toString(36)}`;
    const ratioMap = new Map(expense.ratios.map((ratio) => [ratio.memberId, ratio.ratio]));
    const normalizedRatios = memberPairs.map((memberPair) => ({
      memberId: memberPair.id,
      ratio: ratioMap.get(memberPair.oldId) ?? 0,
    }));

    return {
      id: compactExpenseId,
      name: expense.name,
      amount: expense.amount,
      payerId: memberIdMap.get(expense.payerId) ?? firstMemberId,
      ratios: normalizedRatios,
      isGradientMode: expense.isGradientMode,
      fractionBearerId: memberIdMap.get(expense.fractionBearerId) ?? firstMemberId,
    };
  });

  return {
    name: eventData.name,
    members: normalizedMembers,
    expenses: normalizedExpenses,
  };
};

// EventData を URL 共有向け文字列に圧縮する。
export const encodeEventDataToUrlSafe = async (
  eventData: EventData,
): Promise<EncodedEventDataResult> => {
  const compacted = normalizeIdsForShare(eventData);
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
  const parsed = JSON.parse(json);

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('members' in parsed) ||
    !('expenses' in parsed)
  ) {
    throw new Error('Invalid event data format.');
  }

  return parsed as EventData;
};
