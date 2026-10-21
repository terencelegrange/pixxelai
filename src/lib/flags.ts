import { prisma } from "./prisma";

export const STANDARDS_FLAG_KEYS: Record<string, string> = {
  security: "standards_security",
  architecture: "standards_architecture",
  privacy: "standards_privacy",
  compliance: "standards_compliance",
  legal: "standards_legal",
  quality: "standards_quality",
};

export const ALL_STANDARD_CATEGORIES = [
  "Security",
  "Architecture",
  "Privacy",
  "Compliance",
  "Legal",
  "Quality",
];

export async function isFlagEnabled(key: string): Promise<boolean> {
  try {
    const rawKey = key.trim().toLowerCase();
    const candidateKeys = [rawKey];
    if (!rawKey.startsWith("standards_")) {
      candidateKeys.push(`standards_${rawKey}`);
    }

    const row = await prisma.featureFlag.findFirst({
      where: { key: { in: candidateKeys } },
      select: { enabled: true },
    });

    if (!row) return true; // default to enabled if unknown
    return row.enabled === 1;
  } catch {
    return true; // fail open
  }
}

/**
 * Check whether a specific standard category is enabled via feature flags.
 * Accepts category names like "Security", "privacy", "Legal", etc.
 */
export async function isStandardEnabled(category: string): Promise<boolean> {
  const norm = category.toLowerCase().trim();
  const flagKey = STANDARDS_FLAG_KEYS[norm] || `standards_${norm}`;
  return isFlagEnabled(flagKey);
}

/**
 * Returns all standard categories that are currently enabled in feature flags.
 */
export async function getEnabledStandards(): Promise<string[]> {
  try {
    const flags = await prisma.featureFlag.findMany({
      where: {
        category: "standards",
      },
      select: { key: true, enabled: true },
    });

    const disabledKeys = new Set(
      flags.filter((f) => f.enabled === 0).map((f) => f.key)
    );

    return ALL_STANDARD_CATEGORIES.filter((cat) => {
      const flagKey = STANDARDS_FLAG_KEYS[cat.toLowerCase()];
      return !flagKey || !disabledKeys.has(flagKey);
    });
  } catch {
    return ALL_STANDARD_CATEGORIES;
  }
}

