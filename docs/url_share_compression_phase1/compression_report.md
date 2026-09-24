# 圧縮テスト分析

- 対象: `tests/fixtures/share_codec/*.json`
- 新規URL方式: `v3.` adaptive binary/arithmetic codec + Base64URL
- 後方互換: 既存 `gz.` URL は decoder のみ維持

| ケース | Raw JSON長 | Raw Base64URL長 | V3 URL payload長 | Raw比 |
| --- | ---: | ---: | ---: | ---: |
| case_01_minimal | 525 | 706 | 37 | 7.0% |
| case_02_small | 3256 | 4374 | 93 | 2.9% |
| case_03_medium | 16484 | 22086 | 283 | 1.7% |
| case_04_japanese_boundary | 10169 | 13852 | 285 | 2.8% |
| case_05_large_dense | 44707 | 59823 | 598 | 1.3% |
| suwa_testdata | 10575 | 14460 | 226 | 2.1% |

## 全体サマリ

- 合計 Raw JSON長: 85716
- 合計 Raw Base64URL長: 115301
- 合計 V3 URL payload長: 1522
- 全体圧縮率 (Raw比): 1.8%
- 全体圧縮率 (Raw Base64URL比): 1.3%
