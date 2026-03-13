# 圧縮テスト分析

- 対象: `tests/fixtures/share_codec/*.json`
- 圧縮方式: `CompressionStream(gzip)` + Base64URL + `gz.` プレフィックス

| ケース | Raw JSON長 | Raw Base64URL長 | 圧縮後文字列長 | Raw比 |
| --- | ---: | ---: | ---: | ---: |
| case_01_minimal | 493 | 663 | 122 | 24.7% |
| case_02_small | 3078 | 4136 | 254 | 8.3% |
| case_03_medium | 15606 | 20915 | 734 | 4.7% |
| case_04_japanese_boundary | 9629 | 13132 | 675 | 7.0% |
| case_05_large_dense | 42333 | 56658 | 1493 | 3.5% |
| suwa_testdata | 10009 | 13706 | 663 | 6.6% |

## 全体サマリ

- 合計 Raw JSON長: 81148
- 合計 Raw Base64URL長: 109210
- 合計 圧縮後文字列長: 3941
- 全体圧縮率 (Raw比): 4.9%
- 全体圧縮率 (Raw Base64URL比): 3.6%
