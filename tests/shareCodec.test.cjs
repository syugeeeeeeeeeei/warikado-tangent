require('sucrase/register');

const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const {
  decodeEventDataFromUrlSafe,
  encodeEventDataToUrlSafe,
} = require('../src/utils/shareCodec.ts');

const fixtureDir = path.resolve(__dirname, 'fixtures/share_codec');

const CASE_LENGTH_THRESHOLDS = {
  case_01_minimal: 60,
  case_02_small: 130,
  case_03_medium: 360,
  case_04_japanese_boundary: 360,
  case_05_large_dense: 750,
  suwa_testdata: 280,
};

const URL_SAFE_REGEX = /^v3\.[A-Za-z0-9_-]+$/u;

const fixtureFiles = readdirSync(fixtureDir)
  .filter((filename) => filename.endsWith('.json'))
  .sort();

if (fixtureFiles.length === 0) {
  throw new Error('No fixture files found.');
}

const toLegacyCompactPayload = (eventData) => {
  const memberIdToIndex = new Map(
    eventData.members.map((member, index) => [member.id, index]),
  );
  return [
    1,
    eventData.name,
    eventData.members.map((member) => member.name),
    eventData.expenses.map((expense) => {
      const payerIndex = memberIdToIndex.get(expense.payerId) ?? 0;
      const fractionBearerIndex =
        memberIdToIndex.get(expense.fractionBearerId) ?? payerIndex;
      return [
        expense.name,
        Math.max(0, Math.trunc(expense.amount)),
        payerIndex,
        expense.isGradientMode ? 1 : 0,
        fractionBearerIndex,
        expense.ratios
          .map((ratio) => {
            const memberIndex = memberIdToIndex.get(ratio.memberId);
            if (memberIndex === undefined || ratio.ratio <= 0) return null;
            return [memberIndex, ratio.ratio];
          })
          .filter(Boolean)
          .sort((a, b) => a[0] - b[0]),
      ];
    }),
  ];
};

const bytesToBase64Url = (bytes) => {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/gu, '');
};

const encodeLegacyGzip = async (value) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    chunks.push(chunk);
    total += chunk.length;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return `gz.${bytesToBase64Url(merged)}`;
};

const run = async () => {
  for (const filename of fixtureFiles) {
    const caseName = filename.replace(/\.json$/u, '');
    const raw = readFileSync(path.join(fixtureDir, filename), 'utf-8');
    const parsed = JSON.parse(raw);

    const encodedResult = await encodeEventDataToUrlSafe(parsed);
    const decoded = await decodeEventDataFromUrlSafe(encodedResult.encoded);

    assert.equal(encodedResult.compression, 'v3', `${caseName}: new URLs must use v3`);
    assert.deepEqual(decoded, parsed, `${caseName}: V3 decoded payload must match original JSON`);
    assert.match(encodedResult.encoded, URL_SAFE_REGEX, `${caseName}: encoded payload must be URL-safe V3`);

    const threshold = CASE_LENGTH_THRESHOLDS[caseName];
    assert.ok(threshold, `${caseName}: missing length threshold`);
    assert.ok(
      encodedResult.encoded.length <= threshold,
      `${caseName}: encoded length ${encodedResult.encoded.length} exceeds threshold ${threshold}`,
    );
    assert.ok(
      encodedResult.encoded.length < raw.length,
      `${caseName}: encoded payload should be shorter than raw JSON`,
    );

    // 従来の gz. compact-v1 URL を引き続き読み込めることを保証する。
    const legacyCompact = await encodeLegacyGzip(toLegacyCompactPayload(parsed));
    const legacyDecoded = await decodeEventDataFromUrlSafe(legacyCompact);
    assert.deepEqual(legacyDecoded, parsed, `${caseName}: legacy compact gzip must remain decodable`);
  }

  // 最初期の EventData 直接 JSON + gzip も読み取り互換を維持する。
  const earliest = JSON.parse(
    readFileSync(path.join(fixtureDir, fixtureFiles[0]), 'utf-8'),
  );
  const earliestEncoded = await encodeLegacyGzip(earliest);
  assert.deepEqual(
    await decodeEventDataFromUrlSafe(earliestEncoded),
    earliest,
    'legacy raw EventData gzip must remain decodable',
  );

  // UUID形式IDは新URL生成時にindex化され、復元時は短縮IDへ正規化される。
  const legacyUuidLike = {
    name: 'legacy',
    members: [
      { id: '9f6ac65f-5c47-4f3d-a7fd-6d0eacb8b6a0', name: 'Aki' },
      { id: '9c44e95b-7cf9-4b8f-8f91-0c57f2ee2f18', name: 'Nao' },
    ],
    expenses: [
      {
        id: '0a0d3ec8-fb10-4ef2-b5f0-c16fbec469c4',
        name: '食事',
        amount: 3000,
        payerId: '9f6ac65f-5c47-4f3d-a7fd-6d0eacb8b6a0',
        ratios: [
          { memberId: '9f6ac65f-5c47-4f3d-a7fd-6d0eacb8b6a0', ratio: 50 },
          { memberId: '9c44e95b-7cf9-4b8f-8f91-0c57f2ee2f18', ratio: 50 },
        ],
        isGradientMode: true,
        fractionBearerId: '9c44e95b-7cf9-4b8f-8f91-0c57f2ee2f18',
      },
    ],
  };
  const encoded = await encodeEventDataToUrlSafe(legacyUuidLike);
  assert.match(encoded.encoded, URL_SAFE_REGEX);
  const decoded = await decodeEventDataFromUrlSafe(encoded.encoded);
  decoded.members.forEach((member) => assert.match(member.id, /^m[0-9a-z]+$/u));
  decoded.expenses.forEach((expense) => assert.match(expense.id, /^e[0-9a-z]+$/u));
};

run().then(
  () => console.log(`shareCodec tests passed (${fixtureFiles.length} cases + legacy compatibility).`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
