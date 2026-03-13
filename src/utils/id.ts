// 既存ID集合と衝突しない最短の連番ID（base36）を生成する。
export const createShortSequentialId = (
  prefix: string,
  existingIds: Iterable<string>,
) => {
  const used = new Set(existingIds);
  let counter = 0;

  while (true) {
    const candidate = `${prefix}${counter.toString(36)}`;
    if (!used.has(candidate)) return candidate;
    counter += 1;
  }
};
