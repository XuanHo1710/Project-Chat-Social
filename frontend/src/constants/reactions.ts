type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const REACTION_COLORS: Record<string, string> = {
  LIKE: "#1877f2",
  LOVE: "#f33e58",
  HAHA: "#f7b125",
  WOW: "#f7b125",
  SAD: "#f7b125",
  ANGRY: "#e9710f",
};

export function getReactionLabel(type: string | number | undefined, t: TranslateFn): string {
  if (typeof type !== "string" || !type) return "";
  return t(`post.${type.toLowerCase()}`, { defaultValue: type });
}
