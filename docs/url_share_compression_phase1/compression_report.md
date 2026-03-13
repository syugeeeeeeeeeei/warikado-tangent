# 圧縮テスト分析

- 対象: `tests/fixtures/share_codec/*.json`
- 圧縮方式: `CompressionStream(gzip)` + Base64URL + `gz.` プレフィックス

| ケース | Raw JSON長 | Raw Base64URL長 | 圧縮後文字列長 | Raw比 |
| --- | ---: | ---: | ---: | ---: |
| case_01_minimal | 493 | 663 | 247 | 50.1% |
| case_02_small | 3078 | 4136 | 455 | 14.8% |
| case_03_medium | 15606 | 20915 | 1209 | 7.7% |
| case_04_japanese_boundary | 9629 | 13132 | 1050 | 10.9% |
| case_05_large_dense | 42333 | 56658 | 2442 | 5.8% |

## 全体サマリ

- 合計 Raw JSON長: 71139
- 合計 Raw Base64URL長: 95504
- 合計 圧縮後文字列長: 5403
- 全体圧縮率 (Raw比): 7.6%
- 全体圧縮率 (Raw Base64URL比): 5.7%
