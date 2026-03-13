require('sucrase/register');

const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const {
  decodeEventDataFromUrlSafe,
  encodeEventDataToUrlSafe,
} = require('../src/utils/shareCodec.ts');

const fixtureDir = path.resolve(__dirname, 'fixtures/share_codec');
const reportDir = path.resolve(__dirname, '../docs/url_share_compression_phase1');
const reportPath = path.resolve(reportDir, 'compression_report.md');

const fixtureFiles = readdirSync(fixtureDir)
  .filter((filename) => filename.endsWith('.json'))
  .sort();

if (fixtureFiles.length === 0) {
  throw new Error('No fixture files found for analysis.');
}

const toBase64UrlLength = (json) => {
  const base64 = Buffer.from(json, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').length;
};

const percent = (value) => `${(value * 100).toFixed(1)}%`;

const run = async () => {
  const rows = [];
  let totalRaw = 0;
  let totalBase64UrlRaw = 0;
  let totalCompressed = 0;

  for (const filename of fixtureFiles) {
    const caseName = filename.replace(/\.json$/u, '');
    const rawJson = readFileSync(path.join(fixtureDir, filename), 'utf-8');
    const parsed = JSON.parse(rawJson);
    const encoded = await encodeEventDataToUrlSafe(parsed);
    const decoded = await decodeEventDataFromUrlSafe(encoded.encoded);

    assert.deepEqual(decoded, parsed, `${caseName}: decode mismatch`);

    const rawLength = rawJson.length;
    const rawBase64UrlLength = toBase64UrlLength(rawJson);
    const compressedLength = encoded.encoded.length;

    totalRaw += rawLength;
    totalBase64UrlRaw += rawBase64UrlLength;
    totalCompressed += compressedLength;

    rows.push(
      `| ${caseName} | ${rawLength} | ${rawBase64UrlLength} | ${compressedLength} | ${percent(
        compressedLength / rawLength,
      )} |`,
    );
  }

  const overallRawRatio = totalCompressed / totalRaw;
  const overallBase64Ratio = totalCompressed / totalBase64UrlRaw;

  const markdown = [
    '# 圧縮テスト分析',
    '',
    '- 対象: `tests/fixtures/share_codec/*.json`',
    '- 圧縮方式: `CompressionStream(gzip)` + Base64URL + `gz.` プレフィックス',
    '',
    '| ケース | Raw JSON長 | Raw Base64URL長 | 圧縮後文字列長 | Raw比 |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    '## 全体サマリ',
    '',
    `- 合計 Raw JSON長: ${totalRaw}`,
    `- 合計 Raw Base64URL長: ${totalBase64UrlRaw}`,
    `- 合計 圧縮後文字列長: ${totalCompressed}`,
    `- 全体圧縮率 (Raw比): ${percent(overallRawRatio)}`,
    `- 全体圧縮率 (Raw Base64URL比): ${percent(overallBase64Ratio)}`,
    '',
  ].join('\n');

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, markdown);
  console.log(markdown);
  console.log(`\nSaved report: ${reportPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
