/** Design tokens as TS constants (for charts and any non-CSS consumers). Keep in sync with theme.css. */
export const colors = {
  background: "#F4F5F3",
  surface: "#FFFFFF",
  surfaceSecondary: "#F8F8F6",
  foreground: "#171717",
  mutedForeground: "#666C70",
  border: "#E5E7E5",
  primary: "#7201FF",
  primarySoft: "#F1E8FF",
  success: "#8FFE01",
  successText: "#2F6B00",
  warning: "#E8A23B",
  warningText: "#8A5200",
  danger: "#E5484D",
  dangerText: "#B42328",
  neutralDark: "#202124",
} as const;

/** Categorical chart palette: restrained, distinguishable, no gradients. */
export const chartPalette = [
  colors.primary,
  colors.neutralDark,
  colors.success,
  colors.warning,
  "#9AA0A6",
  colors.danger,
] as const;

export type ColorToken = keyof typeof colors;
