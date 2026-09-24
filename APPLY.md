# Warikado V3 share codec integration

GitHub connector was read-only in this session, so this directory contains the exact repository replacements/additions.

## Apply

Copy files preserving paths into the repository root, then run:

```bash
yarn generate:share-codec-model
yarn test:share-codec
yarn build
yarn analyze:share-codec
```

The generator is pinned to corpus commit:
`8590ae556bfdb69fdb967941cc4bf43f7f4c2902`.

Generated file:
`src/utils/shareCodecModelV1.js`

Commit the generated file. Once `v3.` URLs exist in the wild, never modify its ordering/content under the same prefix. Any dictionary/model change must use a new codec prefix.

## Behavior

- New URLs: `v3.<base64url>` only.
- Decoder: supports `v3.` and legacy `gz.`.
- Legacy `gz.` includes both compact-v1 JSON and the earliest direct `EventData` JSON.
- IDs are still normalized to short `m*` / `e*` IDs after decoding.
