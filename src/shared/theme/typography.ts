export const typography = {
  title: { fontSize: 30, fontWeight: '800' as const },
  h1: { fontSize: 30, fontWeight: '800' as const },
  h2: { fontSize: 21, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '500' as const },
  bodySmall: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '700' as const },
};

export type Typography = typeof typography;