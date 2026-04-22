export type ThemeColor =
  | "ember"
  | "fire"
  | "ultraviolet"
  | "titanium"
  | "ice"
  | "holo"
  | "emerald"
  | "electro";

export type ThemeRadius = "small" | "default" | "large" | "xl";

export type ThemeSettings = {
  color: ThemeColor;
  radius: ThemeRadius;
  mode: "light" | "dark";
  showGrid?: boolean;
};

export const colorOptions: ThemeColor[] = [
  "ember",
  "fire",
  "ultraviolet",
  "titanium",
  "ice",
  "holo",
  "emerald",
  "electro",
];

export const radiusOptions: ThemeRadius[] = ["small", "default", "large", "xl"];

export const radiusValues: Record<ThemeRadius, string> = {
  small: "0.25rem",
  default: "0.5rem",
  large: "1rem",
  xl: "2rem",
};

export function generateCSSCode(settings: ThemeSettings): string {
  return `:root {
  --brand: var(--brand-${settings.color});
  --brand-foreground: var(--brand-${settings.color}-foreground);
  --primary: var(--brand-${settings.color});
  --background: var(--background-${settings.color});
  --muted: var(--background-${settings.color});
  --radius: var(--radius-${settings.radius});
  --line-width: ${settings.showGrid ? "1px" : "0"};
}`;
}
