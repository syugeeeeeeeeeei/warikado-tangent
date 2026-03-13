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
  case_01_minimal: 350,
  case_02_small: 700,
  case_03_medium: 1800,
  case_04_japanese_boundary: 1500,
  case_05_large_dense: 3400,
};

const URL_SAFE_REGEX = /^gz\.[A-Za-z0-9_-]+$/;

const fixtureFiles = readdirSync(fixtureDir)
  .filter((filename) => filename.endsWith('.json'))
  .sort();

if (fixtureFiles.length === 0) {
  throw new Error('No fixture files found.');
}

const run = async () => {
  for (const filename of fixtureFiles) {
    const caseName = filename.replace(/\.json$/u, '');
    const raw = readFileSync(path.join(fixtureDir, filename), 'utf-8');
    const parsed = JSON.parse(raw);

    const encodedResult = await encodeEventDataToUrlSafe(parsed);
    const decoded = await decodeEventDataFromUrlSafe(encodedResult.encoded);

    assert.deepEqual(
      decoded,
      parsed,
      `${caseName}: decoded payload must match original JSON`,
    );
    assert.match(
      encodedResult.encoded,
      URL_SAFE_REGEX,
      `${caseName}: encoded payload must be URL-safe`,
    );

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
  }

  // 旧データ(UUID形式ID)が入力されても共有時に短縮IDへ正規化されることを確認。
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
  const legacyEncoded = await encodeEventDataToUrlSafe(legacyUuidLike);
  const legacyDecoded = await decodeEventDataFromUrlSafe(legacyEncoded.encoded);
  legacyDecoded.members.forEach((member) => {
    assert.match(member.id, /^m[0-9a-z]+$/u, 'legacy member ID should be short');
  });
  legacyDecoded.expenses.forEach((expense) => {
    assert.match(expense.id, /^e[0-9a-z]+$/u, 'legacy expense ID should be short');
  });
};

run().then(
  () => {
    console.log(`shareCodec tests passed (${fixtureFiles.length} cases).`);
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
