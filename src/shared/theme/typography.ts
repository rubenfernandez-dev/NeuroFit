export const typography = {
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  h1: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  h3: { fontSize: 19, lineHeight: 25, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '500' as const },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const, letterSpacing: 0.2 },
};

export type Typography = typeof typography;