// The codec implementation is intentionally kept as a single TypeScript module.
// The arithmetic coder uses dynamic arrays and BigInt-heavy internals; the public
// API below is strongly typed while the implementation is checked incrementally.
// @ts-nocheck

export type ShareRatioTuple = [number, number];
export type ShareExpenseTuple = [
  string,
  number,
  number,
  0 | 1,
  number,
  ShareRatioTuple[],
];
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

/*
 * Warikado production-candidate codec (experimental V3-best).
 *
 * Principles consolidated from the benchmark work:
 *   - compact schema, no JSON keys/IDs in payload
 *   - one shared arithmetic-coded text stream
 *   - field-specific Japanese token model
 *   - Warikado domain dictionary + frequency-ranked Japanese corpus
 *   - corpus-derived 2..5-char subwords + character fallback + UTF-8 literal
 *   - DP chooses minimum expected-code-length tokenization
 *   - front coding is selected adaptively for member/expense name lists
 *   - amounts choose bit-length / delta / delta-of-delta adaptively
 *   - payer/fraction choose raw vs predictor adaptively
 *   - masks choose same-previous vs payload-local dictionary adaptively
 *   - gradient ratios use exact positive-composition enumerative rank
 *   - truncated-binary integer coding avoids unused code space
 *   - BigInt is used wherever ranks exceed Number's exact range
 *
 * URL: v3.<base64url>
 * Dictionary/model ordering is codec ABI: never reorder for an existing prefix.
 */

const PREFIX = 'v3.';

const DOMAIN = [
  '旅行',
  '旅',
  '食事',
  '飲み物',
  '宿',
  '宿泊',
  '宿代',
  '交通',
  '交通費',
  '電車',
  '新幹線',
  'バス',
  'タクシー',
  'レンタカー',
  'レンタル',
  'カー',
  'ガソリン',
  'ガソリン代',
  '駐車場',
  '高速',
  'ETC',
  'コンビニ',
  'スーパー',
  '入湯税',
  'お土産',
  '朝食',
  '昼食',
  '夕食',
  '飲み会',
  'カフェ',
  '観光',
  'チケット',
  '料金',
  '代',
  '費',
  'パン',
  'ケーキ',
  '酒',
  '日本酒',
  '牛乳',
  'チャイ',
  'ティー',
  'ゴミ',
  '袋',
  '差し入れ',
  '費目',
  'の',
  '、',
];

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();
function utf8Bytes(s) {
  return [...UTF8_ENCODER.encode(s)];
}
function fromUtf8(bytes) {
  return UTF8_DECODER.decode(new Uint8Array(bytes));
}

function starts(words) {
  const map = new Map();
  words.forEach((word, index) => {
    const first = [...word][0];
    if (!first) return;
    if (!map.has(first)) map.set(first, []);
    map.get(first).push({ word, index });
  });
  for (const bucket of map.values()) {
    bucket.sort((a, b) => [...b.word].length - [...a.word].length);
  }
  return map;
}

function normalizeFreq(raw, total = 65535) {
  if (raw.length >= total) throw new Error('alphabet too large');
  const z = raw.reduce((a, b) => a + b, 0);
  const out = raw.map((x) =>
    Math.max(1, Math.floor((x / z) * (total - raw.length) + 1)),
  );
  let sum = out.reduce((a, b) => a + b, 0),
    i = 0;
  while (sum < total) {
    out[i++ % out.length]++;
    sum++;
  }
  i = out.length - 1;
  while (sum > total) {
    if (out[i] > 1) {
      out[i]--;
      sum--;
    }
    i = (i - 1 + out.length) % out.length;
  }
  return out;
}
function zipfFreq(n, alpha) {
  return normalizeFreq(Array.from({ length: n }, (_, r) => 1 / Math.pow(r + 8, alpha)));
}
function cumulative(freq) {
  const c = [0];
  for (const f of freq) c.push(c[c.length - 1] + f);
  return c;
}
function symbolCost(cum, symbol) {
  return Math.log2(cum[cum.length - 1] / (cum[symbol + 1] - cum[symbol]));
}

// ---------------- Arithmetic coder ----------------

const HALF = 0x80000000n,
  Q1 = 0x40000000n,
  Q3 = 0xc0000000n,
  MASK = 0xffffffffn;
class ArithmeticEncoder {
  constructor() {
    this.low = 0n;
    this.high = MASK;
    this.pending = 0;
    this.bits = [];
  }
  emit(bit) {
    this.bits.push(bit);
    while (this.pending) {
      this.bits.push(bit ^ 1);
      this.pending--;
    }
  }
  encode(cum, symbol) {
    const total = BigInt(cum[cum.length - 1]),
      range = this.high - this.low + 1n;
    const nextLow = this.low + (range * BigInt(cum[symbol])) / total;
    const nextHigh = this.low + (range * BigInt(cum[symbol + 1])) / total - 1n;
    this.low = nextLow;
    this.high = nextHigh;
    for (;;) {
      if (this.high < HALF) this.emit(0);
      else if (this.low >= HALF) {
        this.emit(1);
        this.low -= HALF;
        this.high -= HALF;
      } else if (this.low >= Q1 && this.high < Q3) {
        this.pending++;
        this.low -= Q1;
        this.high -= Q1;
      } else break;
      this.low = (this.low << 1n) & MASK;
      this.high = ((this.high << 1n) | 1n) & MASK;
    }
  }
  finish() {
    this.pending++;
    this.emit(this.low < Q1 ? 0 : 1);
    return this.bits;
  }
}
class ArithmeticDecoder {
  constructor(bits) {
    this.bits = bits;
    this.pos = 0;
    this.low = 0n;
    this.high = MASK;
    this.code = 0n;
    for (let i = 0; i < 32; i++) this.code = (this.code << 1n) | BigInt(this.readBit());
  }
  readBit() {
    return this.pos < this.bits.length ? this.bits[this.pos++] : 0;
  }
  decode(cum) {
    const total = BigInt(cum[cum.length - 1]),
      range = this.high - this.low + 1n;
    const value = ((this.code - this.low + 1n) * total - 1n) / range;
    let lo = 0,
      hi = cum.length - 2;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (BigInt(cum[m + 1]) <= value) lo = m + 1;
      else hi = m;
    }
    const symbol = lo;
    this.high = this.low + (range * BigInt(cum[symbol + 1])) / total - 1n;
    this.low = this.low + (range * BigInt(cum[symbol])) / total;
    for (;;) {
      if (this.high < HALF) {
      } else if (this.low >= HALF) {
        this.low -= HALF;
        this.high -= HALF;
        this.code -= HALF;
      } else if (this.low >= Q1 && this.high < Q3) {
        this.low -= Q1;
        this.high -= Q1;
        this.code -= Q1;
      } else break;
      this.low = (this.low << 1n) & MASK;
      this.high = ((this.high << 1n) | 1n) & MASK;
      this.code = ((this.code << 1n) & MASK) | BigInt(this.readBit());
    }
    return symbol;
  }
}

// ---------------- Raw bit IO ----------------
class BitWriter {
  constructor() {
    this.bits = [];
  }
  bit(x) {
    this.bits.push(x ? 1 : 0);
  }
  uint(v, n) {
    v = BigInt(v);
    for (let i = n - 1; i >= 0; i--) this.bit(Number((v >> BigInt(i)) & 1n));
  }
  gamma(v) {
    const s = BigInt(v).toString(2);
    for (let i = 1; i < s.length; i++) this.bit(0);
    for (const c of s) this.bit(c === '1');
  }
}
class BitReader {
  constructor(bits) {
    this.bits = bits;
    this.pos = 0;
  }
  bit() {
    if (this.pos >= this.bits.length) throw new Error('unexpected EOF');
    return this.bits[this.pos++];
  }
  uintBig(n) {
    let v = 0n;
    for (let i = 0; i < n; i++) v = (v << 1n) | BigInt(this.bit());
    return v;
  }
  uint(n) {
    return Number(this.uintBig(n));
  }
  gamma() {
    let z = 0;
    while (this.bit() === 0) z++;
    let v = 1n;
    for (let i = 0; i < z; i++) v = (v << 1n) | BigInt(this.bit());
    return Number(v);
  }
}
function bitsToBytes(bits) {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7));
  return out;
}
function bytesToBits(bytes) {
  const bits = [];
  for (let i = 0; i < bytes.length * 8; i++)
    bits.push((bytes[i >> 3] >> (7 - (i & 7))) & 1);
  return bits;
}
function b64u(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function unb64u(s) {
  const x = s.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(x + '='.repeat((4 - (x.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const FAIR = [0, 32767, 65535];
function gammaBitLength(v) {
  return 2 * BigInt(v).toString(2).length - 1;
}
function writeGammaArithmetic(enc, v) {
  const s = v.toString(2);
  for (let i = 1; i < s.length; i++) enc.encode(FAIR, 0);
  for (const c of s) enc.encode(FAIR, c === '1' ? 1 : 0);
}
function readGammaArithmetic(dec) {
  let z = 0;
  while (dec.decode(FAIR) === 0) z++;
  let v = 1;
  for (let i = 0; i < z; i++) v = (v << 1) | dec.decode(FAIR);
  return v;
}

// ---------------- Combinatorial coding ----------------
function choose(n, k) {
  n = BigInt(n);
  k = BigInt(k);
  if (k < 0n || k > n) return 0n;
  if (k > n - k) k = n - k;
  let r = 1n;
  for (let i = 1n; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
function floorLog2Big(n) {
  let x = BigInt(n),
    b = -1;
  while (x) {
    x >>= 1n;
    b++;
  }
  return b;
}
function writeTruncated(w, N, x) {
  N = BigInt(N);
  x = BigInt(x);
  if (N <= 1n) return;
  const b = floorLog2Big(N),
    cut = (1n << BigInt(b + 1)) - N;
  if (x < cut) w.uint(x, b);
  else w.uint(x + cut, b + 1);
}
function readTruncated(r, N) {
  N = BigInt(N);
  if (N <= 1n) return 0n;
  const b = floorLog2Big(N),
    cut = (1n << BigInt(b + 1)) - N,
    v = r.uintBig(b);
  return v < cut ? v : ((v << 1n) | BigInt(r.bit())) - cut;
}

function rankPositiveComposition(values) {
  if (values.length <= 1) return 0n;
  const bars = [];
  let sum = 0;
  for (let i = 0; i < values.length - 1; i++) {
    sum += values[i];
    bars.push(sum - 1);
  }
  let rank = 0n,
    prev = -1,
    N = 9999,
    K = values.length - 1;
  for (let pos = 0; pos < K; pos++) {
    for (let x = prev + 1; x < bars[pos]; x++) rank += choose(N - x - 1, K - pos - 1);
    prev = bars[pos];
  }
  return rank;
}
function unrankPositiveComposition(rank, k) {
  if (k <= 1) return [10000];
  let rr = BigInt(rank),
    prev = -1;
  const bars = [],
    N = 9999,
    K = k - 1;
  for (let pos = 0; pos < K; pos++) {
    for (let x = prev + 1; x < N; x++) {
      const count = choose(N - x - 1, K - pos - 1);
      if (rr < count) {
        bars.push(x);
        prev = x;
        break;
      }
      rr -= count;
    }
  }
  const values = [];
  let b = -1;
  for (const x of bars) {
    values.push(x - b);
    b = x;
  }
  values.push(9999 - b);
  return values;
}

function zig(n) {
  return n >= 0 ? 2 * n : -2 * n - 1;
}
function unzig(z) {
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}
function writeSignedGamma(w, n) {
  w.gamma(zig(n) + 1);
}
function readSignedGamma(r) {
  return unzig(r.gamma() - 1);
}

// ---------------- Text model ----------------
function createTextModel(model) {
  const { corpus, chars, subwords: subs } = model;
  const corpusStarts = starts(corpus),
    domainStarts = starts(DOMAIN);
  const charMap = new Map(chars.map((x, i) => [x, i])),
    subStarts = starts(subs);

  const freq = {
    corpus: zipfFreq(corpus.length, 0.6),
    domain: zipfFreq(DOMAIN.length, 0.55),
    sub: zipfFreq(subs.length, 0.7),
    char: zipfFreq(chars.length, 0.72),
  };
  const byteRaw = Array(256).fill(1);
  for (let rank = 0; rank < Math.min(corpus.length, 20000); rank++) {
    const weight = 1 / Math.pow(rank + 10, 0.35);
    for (const b of utf8Bytes(corpus[rank])) byteRaw[b] += weight;
  }
  freq.byte = normalizeFreq(byteRaw);
  const C = Object.fromEntries(
    Object.entries(freq).map(([k, v]) => [k, cumulative(v)]),
  );
  const typeFreq = {
    event: [9000, 31000, 5000, 7000, 6000, 7535],
    member: [1500, 23000, 3500, 12000, 16000, 9535],
    expense: [9000, 25000, 8000, 7000, 9000, 7535],
  };
  const TC = Object.fromEntries(
    Object.entries(typeFreq).map(([k, v]) => [k, cumulative(v)]),
  );
  const costs = {
    corpus: freq.corpus.map((f) => Math.log2(65535 / f)),
    domain: freq.domain.map((f) => Math.log2(65535 / f)),
    sub: freq.sub.map((f) => Math.log2(65535 / f)),
    char: freq.char.map((f) => Math.log2(65535 / f)),
    byte: freq.byte.map((f) => Math.log2(65535 / f)),
  };

  function tokenize(text, field) {
    const a = [...text],
      n = a.length,
      dp = Array(n + 1);
    dp[n] = { cost: symbolCost(TC[field], 5), tokens: [['END']] };
    for (let i = n - 1; i >= 0; i--) {
      let best = { cost: Infinity, tokens: null };
      const use = (extra, j, token) => {
        const cost = extra + dp[j].cost;
        if (cost < best.cost) best = { cost, tokens: [token, ...dp[j].tokens] };
      };
      for (const { word, index } of domainStarts.get(a[i]) || []) {
        const z = [...word],
          j = i + z.length;
        if (j <= n && a.slice(i, j).join('') === word)
          use(symbolCost(TC[field], 0) + costs.domain[index], j, ['DOMAIN', index]);
      }
      for (const { word, index } of corpusStarts.get(a[i]) || []) {
        const z = [...word],
          j = i + z.length;
        if (j <= n && a.slice(i, j).join('') === word)
          use(symbolCost(TC[field], 1) + costs.corpus[index], j, ['CORPUS', index]);
      }
      for (const { word, index } of subStarts.get(a[i]) || []) {
        const z = [...word],
          j = i + z.length;
        if (j <= n && a.slice(i, j).join('') === word)
          use(symbolCost(TC[field], 2) + costs.sub[index], j, ['SUB', index]);
      }
      const ci = charMap.get(a[i]);
      if (ci !== undefined)
        use(symbolCost(TC[field], 3) + costs.char[ci], i + 1, ['CHAR', ci]);
      for (let j = i + 1; j <= n; j++) {
        const bytes = utf8Bytes(a.slice(i, j).join(''));
        use(
          symbolCost(TC[field], 4) +
            gammaBitLength(bytes.length + 1) +
            bytes.reduce((s, b) => s + costs.byte[b], 0),
          j,
          ['LITERAL', bytes],
        );
      }
      dp[i] = best;
    }
    return dp[0].tokens;
  }

  function emit(enc, field, t) {
    const type = { DOMAIN: 0, CORPUS: 1, SUB: 2, CHAR: 3, LITERAL: 4, END: 5 }[t[0]];
    enc.encode(TC[field], type);
    if (t[0] === 'DOMAIN') enc.encode(C.domain, t[1]);
    else if (t[0] === 'CORPUS') enc.encode(C.corpus, t[1]);
    else if (t[0] === 'SUB') enc.encode(C.sub, t[1]);
    else if (t[0] === 'CHAR') enc.encode(C.char, t[1]);
    else if (t[0] === 'LITERAL') {
      writeGammaArithmetic(enc, t[1].length + 1);
      for (const b of t[1]) enc.encode(C.byte, b);
    }
  }
  function decodeField(dec, field) {
    let out = '';
    for (;;) {
      const type = dec.decode(TC[field]);
      if (type === 5) return out;
      if (type === 0) out += DOMAIN[dec.decode(C.domain)];
      else if (type === 1) out += corpus[dec.decode(C.corpus)];
      else if (type === 2) out += subs[dec.decode(C.sub)];
      else if (type === 3) out += chars[dec.decode(C.char)];
      else {
        const len = readGammaArithmetic(dec) - 1,
          bytes = [];
        for (let i = 0; i < len; i++) bytes.push(dec.decode(C.byte));
        out += fromUtf8(bytes);
      }
    }
  }
  function modelBits(values, field) {
    const enc = new ArithmeticEncoder();
    for (const value of values)
      for (const t of tokenize(value, field)) emit(enc, field, t);
    return enc.finish();
  }
  return { tokenize, emit, decodeField, modelBits };
}

function frontCode(values) {
  const w = new BitWriter();
  let prev = '';
  for (const value of values) {
    const a = [...prev],
      b = [...value];
    let common = 0;
    while (common < a.length && common < b.length && a[common] === b[common]) common++;
    const suffix = utf8Bytes(b.slice(common).join(''));
    w.gamma(common + 1);
    w.gamma(suffix.length + 1);
    for (const byte of suffix) w.uint(byte, 8);
    prev = value;
  }
  return w.bits;
}
function frontDecode(r, count) {
  const out = [];
  let prev = '';
  for (let z = 0; z < count; z++) {
    const common = r.gamma() - 1,
      len = r.gamma() - 1,
      bytes = [];
    for (let i = 0; i < len; i++) bytes.push(r.uint(8));
    const value = [...prev].slice(0, common).join('') + fromUtf8(bytes);
    out.push(value);
    prev = value;
  }
  return out;
}

// ---------------- Structure ----------------
function amountEncodings(values) {
  const modes = [];
  let w = new BitWriter();
  for (const v of values) {
    if (v === 0) {
      w.uint(0, 3);
      continue;
    }
    const bits = Math.floor(Math.log2(v)) + 1;
    if (bits >= 9 && bits <= 14) {
      w.uint(bits - 8, 3);
      w.uint(v - 2 ** (bits - 1), bits - 1);
    } else {
      w.uint(7, 3);
      w.uint(bits - 1, 6);
      w.uint(v - 2 ** (bits - 1), bits - 1);
    }
  }
  modes.push(w.bits);
  w = new BitWriter();
  let prev = 0;
  for (const v of values) {
    writeSignedGamma(w, v - prev);
    prev = v;
  }
  modes.push(w.bits);
  w = new BitWriter();
  prev = 0;
  let prevDelta = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - prev,
      dd = i < 2 ? d : d - prevDelta;
    writeSignedGamma(w, dd);
    prev = values[i];
    prevDelta = d;
  }
  modes.push(w.bits);
  return modes;
}
function decodeAmounts(r, mode, count) {
  const out = [];
  if (mode === 0) {
    for (let i = 0; i < count; i++) {
      const code = r.uint(3);
      if (code === 0) {
        out.push(0);
        continue;
      }
      const bits = code < 7 ? 8 + code : r.uint(6) + 1;
      out.push(2 ** (bits - 1) + r.uint(bits - 1));
    }
  } else if (mode === 1) {
    let prev = 0;
    for (let i = 0; i < count; i++) {
      prev += readSignedGamma(r);
      out.push(prev);
    }
  } else {
    let prev = 0,
      prevDelta = 0;
    for (let i = 0; i < count; i++) {
      const dd = readSignedGamma(r),
        d = i < 2 ? dd : prevDelta + dd,
        cur = prev + d;
      out.push(cur);
      prev = cur;
      prevDelta = d;
    }
  }
  return out;
}

function encodeStructure(payload, w) {
  const [, event, members, expenses] = payload,
    n = members.length,
    m = expenses.length;
  w.gamma(n);
  w.gamma(m + 1);

  const amountModes = amountEncodings(expenses.map((e) => Math.trunc(e[1])));
  let amountMode = 0;
  for (let i = 1; i < amountModes.length; i++)
    if (amountModes[i].length < amountModes[amountMode].length) amountMode = i;
  w.uint(amountMode, 2);
  const memberBits = Math.max(1, Math.ceil(Math.log2(n)));

  let raw = m * memberBits,
    pred = 0,
    prev = 0;
  for (let i = 0; i < m; i++) {
    const p = expenses[i][2];
    pred +=
      i > 0 && p === prev ? 1 : i > 0 && p === (prev + 1) % n ? 2 : 2 + memberBits;
    prev = p;
  }
  const payerMode = pred < raw ? 1 : 0;
  w.bit(payerMode);

  raw = m * memberBits;
  pred = 0;
  prev = 0;
  for (let i = 0; i < m; i++) {
    const p = expenses[i][2],
      f = expenses[i][4];
    pred += f === p ? 1 : i > 0 && f === prev ? 2 : 2 + memberBits;
    prev = f;
  }
  const fractionMode = pred < raw ? 1 : 0;
  w.bit(fractionMode);

  const masks = expenses.map((e) => {
    let mask = 0;
    for (const [id, ratio] of e[5]) if (ratio > 0) mask |= 1 << id;
    return mask;
  });
  const unique = [...new Set(masks)];
  let samePrevBits = 0,
    last = -1;
  for (let i = 0; i < m; i++) {
    samePrevBits += i > 0 && masks[i] === last ? 1 : 1 + n;
    last = masks[i];
  }
  let dictBits = gammaBitLength(unique.length + 1) + unique.length * n;
  for (const mask of masks) {
    const N = unique.length,
      idx = unique.indexOf(mask);
    if (N > 1) {
      const b = floorLog2Big(N),
        cut = 2 ** (b + 1) - N;
      dictBits += idx < cut ? b : b + 1;
    }
  }
  const maskMode = dictBits < samePrevBits ? 1 : 0;
  w.bit(maskMode);

  w.bits.push(...amountModes[amountMode]);
  prev = 0;
  for (let i = 0; i < m; i++) {
    const p = expenses[i][2];
    if (!payerMode) w.uint(p, memberBits);
    else if (i > 0 && p === prev) w.bit(0);
    else if (i > 0 && p === (prev + 1) % n) {
      w.bit(1);
      w.bit(0);
    } else {
      w.bit(1);
      w.bit(1);
      w.uint(p, memberBits);
    }
    prev = p;
  }
  prev = 0;
  for (let i = 0; i < m; i++) {
    const p = expenses[i][2],
      f = expenses[i][4];
    if (!fractionMode) w.uint(f, memberBits);
    else if (f === p) w.bit(0);
    else if (i > 0 && f === prev) {
      w.bit(1);
      w.bit(0);
    } else {
      w.bit(1);
      w.bit(1);
      w.uint(f, memberBits);
    }
    prev = f;
  }
  if (!maskMode) {
    last = -1;
    for (let i = 0; i < m; i++) {
      if (i > 0 && masks[i] === last) w.bit(0);
      else {
        w.bit(1);
        w.uint(masks[i], n);
      }
      last = masks[i];
    }
  } else {
    w.gamma(unique.length + 1);
    for (const mask of unique) w.uint(mask, n);
    for (const mask of masks) writeTruncated(w, unique.length, unique.indexOf(mask));
  }

  const anyGradient = expenses.some((e) => !!e[3]);
  w.bit(anyGradient);
  if (anyGradient) {
    for (const e of expenses) w.bit(!!e[3]);
    for (const e of expenses)
      if (e[3]) {
        const values = e[5]
          .filter(([, ratio]) => ratio > 0)
          .map(([, ratio]) => Math.round(ratio * 100));
        writeTruncated(
          w,
          choose(9999, values.length - 1),
          rankPositiveComposition(values),
        );
      }
  }
  return { amountMode, payerMode, fractionMode, maskMode };
}

function decodeStructure(r) {
  const n = r.gamma(),
    m = r.gamma() - 1,
    amountMode = r.uint(2),
    payerMode = r.bit(),
    fractionMode = r.bit(),
    maskMode = r.bit();
  const memberBits = Math.max(1, Math.ceil(Math.log2(n)));
  const amounts = decodeAmounts(r, amountMode, m);
  const payers = [];
  let prev = 0;
  for (let i = 0; i < m; i++) {
    let p;
    if (!payerMode) p = r.uint(memberBits);
    else if (!r.bit()) p = prev;
    else if (!r.bit()) p = (prev + 1) % n;
    else p = r.uint(memberBits);
    payers.push(p);
    prev = p;
  }
  const fractions = [];
  prev = 0;
  for (let i = 0; i < m; i++) {
    let f;
    if (!fractionMode) f = r.uint(memberBits);
    else if (!r.bit()) f = payers[i];
    else if (!r.bit()) f = prev;
    else f = r.uint(memberBits);
    fractions.push(f);
    prev = f;
  }
  const masks = [];
  if (!maskMode) {
    let last = 0;
    for (let i = 0; i < m; i++) {
      const mask = r.bit() ? r.uint(n) : last;
      masks.push(mask);
      last = mask;
    }
  } else {
    const count = r.gamma() - 1,
      dict = [];
    for (let i = 0; i < count; i++) dict.push(r.uint(n));
    for (let i = 0; i < m; i++) masks.push(dict[Number(readTruncated(r, count))]);
  }
  const modes = Array(m).fill(false),
    ratios = Array.from({ length: m }, () => null),
    anyGradient = !!r.bit();
  if (anyGradient) {
    for (let i = 0; i < m; i++) modes[i] = !!r.bit();
    for (let i = 0; i < m; i++)
      if (modes[i]) {
        const ids = [];
        for (let j = 0; j < n; j++) if (masks[i] & (1 << j)) ids.push(j);
        const values = unrankPositiveComposition(
          readTruncated(r, choose(9999, ids.length - 1)),
          ids.length,
        );
        ratios[i] = ids.map((id, j) => [id, values[j] / 100]);
      }
  }
  return {
    n,
    m,
    amounts,
    payers,
    fractions,
    masks,
    modes,
    ratios,
    amountMode,
    payerMode,
    fractionMode,
    maskMode,
  };
}

// ---------------- Full codec ----------------
function createCodec(model) {
  const textModel = createTextModel(model);

  function encode(payload) {
    if (payload[0] !== 1) throw new Error('compact v1 input required');
    const [, event, members, expenses] = payload;
    const memberModel = textModel.modelBits(members, 'member'),
      memberFront = frontCode(members);
    const expenseNames = expenses.map((e) => e[0]),
      expenseModel = textModel.modelBits(expenseNames, 'expense'),
      expenseFront = frontCode(expenseNames);
    const memberMode = memberFront.length < memberModel.length ? 1 : 0,
      expenseMode = expenseFront.length < expenseModel.length ? 1 : 0;

    const raw = new BitWriter();
    raw.uint(1, 3);
    raw.bit(memberMode);
    raw.bit(expenseMode);
    const structureModes = encodeStructure(payload, raw);
    if (memberMode) raw.bits.push(...memberFront);
    if (expenseMode) raw.bits.push(...expenseFront);

    const arithmetic = new ArithmeticEncoder();
    for (const t of textModel.tokenize(event, 'event'))
      textModel.emit(arithmetic, 'event', t);
    if (!memberMode)
      for (const value of members)
        for (const t of textModel.tokenize(value, 'member'))
          textModel.emit(arithmetic, 'member', t);
    if (!expenseMode)
      for (const value of expenseNames)
        for (const t of textModel.tokenize(value, 'expense'))
          textModel.emit(arithmetic, 'expense', t);
    const arithmeticBits = arithmetic.finish();

    return {
      bits: raw.bits.concat(arithmeticBits),
      meta: {
        memberMode,
        expenseMode,
        structureModes,
        rawBits: raw.bits.length,
        arithmeticBits: arithmeticBits.length,
      },
    };
  }

  function decode(bits) {
    const r = new BitReader(bits),
      version = r.uint(3);
    if (version !== 1) throw new Error('unsupported v3 payload version');
    const memberMode = r.bit(),
      expenseMode = r.bit(),
      structure = decodeStructure(r);
    let members, expenseNames;
    if (memberMode) members = frontDecode(r, structure.n);
    if (expenseMode) expenseNames = frontDecode(r, structure.m);

    const arithmetic = new ArithmeticDecoder(bits.slice(r.pos));
    const event = textModel.decodeField(arithmetic, 'event');
    if (!memberMode)
      members = Array.from({ length: structure.n }, () =>
        textModel.decodeField(arithmetic, 'member'),
      );
    if (!expenseMode)
      expenseNames = Array.from({ length: structure.m }, () =>
        textModel.decodeField(arithmetic, 'expense'),
      );

    const expenses = [];
    for (let i = 0; i < structure.m; i++) {
      const ratioList = structure.modes[i]
        ? structure.ratios[i]
        : Array.from({ length: structure.n }, (_, j) => [
            j,
            structure.masks[i] & (1 << j) ? 1 : 0,
          ]).filter(([, v]) => v > 0);
      expenses.push([
        expenseNames[i],
        structure.amounts[i],
        structure.payers[i],
        structure.modes[i] ? 1 : 0,
        structure.fractions[i],
        ratioList,
      ]);
    }
    return [1, event, members, expenses];
  }

  function toUrl(payload) {
    return PREFIX + b64u(bitsToBytes(encode(payload).bits));
  }
  function fromUrl(url) {
    if (!url.startsWith(PREFIX)) throw new Error('bad prefix');
    return decode(bytesToBits(unb64u(url.slice(PREFIX.length))));
  }
  return { encode, decode, toUrl, fromUrl };
}

function normalizePayload(p) {
  return [
    p[0],
    p[1],
    p[2],
    p[3].map((e) => [
      e[0],
      e[1],
      e[2],
      e[3] ? 1 : 0,
      e[4],
      e[5]
        .filter(([, v]) => v > 0)
        .map(([i, v]) => [i, Math.round(v * 100) / 100])
        .sort((a, b) => a[0] - b[0]),
    ]),
  ];
}
function equalPayload(a, b) {
  return JSON.stringify(normalizePayload(a)) === JSON.stringify(normalizePayload(b));
}

export {
  PREFIX,
  DOMAIN,
  createCodec,
  equalPayload,
  rankPositiveComposition,
  unrankPositiveComposition,
};
