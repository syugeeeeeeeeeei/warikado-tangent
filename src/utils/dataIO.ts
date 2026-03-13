import type { CalculationLog, EventData, ExpenseRatio } from '../types/domain';

const APP_VERSION = 'v1.0.0';

type ShareMode = 'j' | 'd';

type CompactExpenseRatio = [memberIndex: number, ratio: number];
type CompactExpense = [
  name: string,
  amount: number,
  payerIndex: number,
  isGradientMode: 0 | 1,
  fractionBearerIndex: number,
  ratios: CompactExpenseRatio[],
];

interface CompactPayloadV1 {
  v: typeof APP_VERSION;
  n: string;
  m: string[];
  e: CompactExpense[];
}

interface CompressionLikeStream {
  writable: WritableStream<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
}

type CompressionLikeCtor = new (format: string) => CompressionLikeStream;

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
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
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const withPadding = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
  return base64ToBytes(withPadding);
};

const compressBytes = async (input: Uint8Array): Promise<Uint8Array | null> => {
  const CompressionCtor = (globalThis as { CompressionStream?: CompressionLikeCtor })
    .CompressionStream;

  if (!CompressionCtor) return null;

  try {
    const stream = new CompressionCtor('deflate-raw');
    const writer = stream.writable.getWriter();
    await writer.write(input);
    await writer.close();

    const compressed = await new Response(stream.readable).arrayBuffer();
    return new Uint8Array(compressed);
  } catch {
    return null;
  }
};

const decompressBytes = async (input: Uint8Array): Promise<Uint8Array> => {
  const DecompressionCtor = (globalThis as { DecompressionStream?: CompressionLikeCtor })
    .DecompressionStream;

  if (!DecompressionCtor) {
    throw new Error('DECOMPRESSION_NOT_SUPPORTED');
  }

  const stream = new DecompressionCtor('deflate-raw');
  const writer = stream.writable.getWriter();
  await writer.write(input);
  await writer.close();

  const decompressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(decompressed);
};

const encodeCompactPayload = (eventData: EventData): CompactPayloadV1 => {
  const memberIdToIndex = new Map<string, number>();
  const memberNames = eventData.members.map((member, index) => {
    memberIdToIndex.set(member.id, index);
    return member.name;
  });

  const expenses: CompactExpense[] = eventData.expenses.map((expense) => {
    const payerIndex = memberIdToIndex.get(expense.payerId) ?? 0;
    const fractionBearerIndex = memberIdToIndex.get(expense.fractionBearerId) ?? payerIndex;

    const ratios: CompactExpenseRatio[] = expense.ratios
      .filter((ratio) => ratio.ratio > 0)
      .map((ratio) => {
        const memberIndex = memberIdToIndex.get(ratio.memberId);
        if (memberIndex === undefined) return null;
        return [memberIndex, ratio.ratio] as CompactExpenseRatio;
      })
      .filter((ratio): ratio is CompactExpenseRatio => ratio !== null);

    return [
      expense.name,
      expense.amount,
      payerIndex,
      expense.isGradientMode ? 1 : 0,
      fractionBearerIndex,
      ratios,
    ];
  });

  return {
    v: APP_VERSION,
    n: eventData.name,
    m: memberNames,
    e: expenses,
  };
};

const decodeCompactPayload = (payload: CompactPayloadV1): EventData => {
  if (payload.v !== APP_VERSION) {
    throw new Error('UNSUPPORTED_VERSION');
  }

  const members = payload.m.map((name, index) => ({
    id: `m${index}`,
    name,
  }));

  const expenses = payload.e.map((expense, index) => {
    const [name, amount, payerIndex, isGradientMode, fractionBearerIndex, compactRatios] = expense;

    const ratioMap = new Map<number, number>();
    compactRatios.forEach(([memberIndex, ratio]) => {
      if (memberIndex >= 0 && memberIndex < members.length) {
        ratioMap.set(memberIndex, ratio);
      }
    });

    const ratios: ExpenseRatio[] = members.map((member, memberIndex) => ({
      memberId: member.id,
      ratio: ratioMap.get(memberIndex) ?? 0,
    }));

    const payerMember = members[payerIndex] ?? members[0];
    const fractionMember = members[fractionBearerIndex] ?? payerMember;

    return {
      id: `e${index}`,
      name,
      amount,
      payerId: payerMember?.id ?? '',
      ratios,
      isGradientMode: isGradientMode === 1,
      fractionBearerId: fractionMember?.id ?? payerMember?.id ?? '',
    };
  });

  return {
    name: payload.n,
    members,
    expenses,
  };
};

const isCompactPayloadV1 = (value: unknown): value is CompactPayloadV1 => {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  return (
    typeof v.v === 'string' &&
    typeof v.n === 'string' &&
    Array.isArray(v.m) &&
    Array.isArray(v.e)
  );
};

const buildShareToken = async (eventData: EventData): Promise<string> => {
  const payload = encodeCompactPayload(eventData);
  const jsonText = JSON.stringify(payload);
  const rawBytes = new TextEncoder().encode(jsonText);

  const compressed = await compressBytes(rawBytes);
  if (compressed && compressed.length < rawBytes.length) {
    return `d.${toBase64Url(compressed)}`;
  }

  return `j.${toBase64Url(rawBytes)}`;
};

const parseShareToken = async (token: string): Promise<EventData> => {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0) {
    throw new Error('INVALID_TOKEN');
  }

  const mode = token.slice(0, separatorIndex) as ShareMode;
  const encodedBody = token.slice(separatorIndex + 1);

  if (mode !== 'j' && mode !== 'd') {
    throw new Error('INVALID_TOKEN_MODE');
  }

  const bytes = fromBase64Url(encodedBody);
  const decodedBytes = mode === 'd' ? await decompressBytes(bytes) : bytes;
  const text = new TextDecoder().decode(decodedBytes);
  const parsed = JSON.parse(text);

  if (!isCompactPayloadV1(parsed)) {
    throw new Error('INVALID_PAYLOAD');
  }

  return decodeCompactPayload(parsed);
};

export const createShareUrlFromEventData = async (eventData: EventData): Promise<string> => {
  const token = await buildShareToken(eventData);
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}#d=${token}`;
};

export const readEventDataFromUrlHash = async (hash: string): Promise<EventData | null> => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const token = params.get('d');
  if (!token) return null;

  return parseShareToken(token);
};

// Backward-compatible exports for hot reload / stale imports.
// JSON UI is removed from the app, but keeping these avoids runtime import errors.
export const saveEventDataAsJson = (eventData: EventData) => {
  const blob = new Blob([JSON.stringify(eventData, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `popsplit_${eventData.name || 'event'}.json`);
};

export const readEventDataFromJsonFile = (file: File): Promise<EventData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const raw = String(event.target?.result ?? '');
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'members' in parsed &&
          'expenses' in parsed
        ) {
          resolve(parsed as EventData);
          return;
        }
        reject(new Error('Invalid format'));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsText(file);
  });
};

export const exportLogsAsCsv = (
  logs: CalculationLog[],
  getMemberName: (id: string) => string,
  eventName: string,
) => {
  let csv = 'メンバー名,精算項目,計算式,負担額,支払済,差引残高\n';
  logs.forEach((log) => {
    const memberName = getMemberName(log.memberId);
    csv += `"${memberName}","${log.expenseName}","${log.formula}",${log.amountOwed},${log.amountPaid},${log.net}\n`;
  });

  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(blob, `popsplit_details_${eventName || 'event'}.csv`);
};
