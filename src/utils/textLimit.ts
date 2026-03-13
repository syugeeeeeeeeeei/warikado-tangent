export interface LimitedTextResult {
  value: string;
  wasTrimmed: boolean;
}

// サロゲートペアを壊さないよう code point 単位で文字数制限する。
export const limitByCodePoints = (
  input: string,
  maxLength: number,
): LimitedTextResult => {
  const chars = Array.from(input);
  if (chars.length <= maxLength) {
    return { value: input, wasTrimmed: false };
  }

  return {
    value: chars.slice(0, maxLength).join(''),
    wasTrimmed: true,
  };
};
