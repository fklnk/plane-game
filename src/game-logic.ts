export type GameMode = "campaign" | "boss" | "endless";
export type ShipId = "balanced" | "bomber" | "lightning" | "guardian";
export type SpecializationId =
  | "power"
  | "agile"
  | "defender"
  | "vampire"
  | "devour"
  | "wheelchair";
export type SkinId = "standard" | "aurora" | "inferno" | "void";

export interface SaveData {
  version: 1;
  starCores: number;
  unlockedShips: ShipId[];
  selectedShip: ShipId;
  selectedSpecialization: SpecializationId;
  unlockedSkins: SkinId[];
  equippedSkin: SkinId;
  permanentUpgrades: Record<string, number>;
  settings: {
    musicVolume: number;
    sfxVolume: number;
    screenShake: boolean;
    damageNumbers: boolean;
    quality: "low" | "high";
  };
  records: {
    campaignWins: number;
    highestUnlockedLevel: number;
    endlessBestSeconds: number;
    endlessBestScore: number;
    bossRushBestMs: number | null;
  };
  achievements: Record<string, string>;
  seenTutorial: boolean;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  starCores: 0,
  unlockedShips: ["balanced", "bomber", "lightning", "guardian"],
  selectedShip: "balanced",
  selectedSpecialization: "power",
  unlockedSkins: ["standard"],
  equippedSkin: "standard",
  permanentUpgrades: {
    hull: 0,
    firepower: 0,
    engine: 0,
    armor: 0,
    recovery: 0,
    emergency: 0,
    reroll: 0
  },
  settings: {
    musicVolume: 0.45,
    sfxVolume: 0.65,
    screenShake: true,
    damageNumbers: true,
    quality: "high"
  },
  records: {
    campaignWins: 0,
    highestUnlockedLevel: 1,
    endlessBestSeconds: 0,
    endlessBestScore: 0,
    bossRushBestMs: null
  },
  achievements: {},
  seenTutorial: false
};

export function xpToNextLevel(level: number): number {
  return Math.floor(30 + level * 18 + Math.pow(level, 1.35) * 4);
}

export function loadSave(raw: string | null): SaveData {
  if (!raw) return structuredClone(DEFAULT_SAVE);
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return structuredClone(DEFAULT_SAVE);
    const validShips: ShipId[] = ["balanced", "bomber", "lightning", "guardian"];
    const validSpecializations: SpecializationId[] = [
      "power",
      "agile",
      "defender",
      "vampire",
      "devour",
      "wheelchair"
    ];
    const validSkins: SkinId[] = ["standard", "aurora", "inferno", "void"];
    const selectedShip = validShips.includes(parsed.selectedShip as ShipId)
      ? (parsed.selectedShip as ShipId)
      : "balanced";
    const rawSpecialization = (parsed as { selectedSpecialization?: string }).selectedSpecialization;
    const legacySpecialization = rawSpecialization === "assault" ? "power" : rawSpecialization;
    const selectedSpecialization = validSpecializations.includes(
      legacySpecialization as SpecializationId
    )
      ? (legacySpecialization as SpecializationId)
      : "power";
    const unlockedSkins = validSkins.filter((skin) =>
      (parsed.unlockedSkins ?? ["standard"]).includes(skin)
    );
    if (!unlockedSkins.includes("standard")) unlockedSkins.unshift("standard");
    const equippedSkin =
      validSkins.includes(parsed.equippedSkin as SkinId) &&
      unlockedSkins.includes(parsed.equippedSkin as SkinId)
        ? (parsed.equippedSkin as SkinId)
        : "standard";
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings ?? {}) },
      records: { ...DEFAULT_SAVE.records, ...(parsed.records ?? {}) },
      permanentUpgrades: {
        ...DEFAULT_SAVE.permanentUpgrades,
        ...(parsed.permanentUpgrades ?? {})
      },
      selectedShip,
      selectedSpecialization,
      unlockedSkins,
      equippedSkin,
      unlockedShips: validShips,
      achievements: { ...(parsed.achievements ?? {}) }
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60).toString().padStart(2, "0")}:${(whole % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function chooseUnique<T extends { id: string }>(
  pool: T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const copy = [...pool];
  const result: T[] = [];
  while (copy.length && result.length < count) {
    result.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return result;
}

export function rewardForRun(mode: GameMode, score: number, victory: boolean): number {
  const base = mode === "boss" ? 30 : mode === "endless" ? 18 : 24;
  return Math.floor(base + score / 2500 + (victory ? 35 : 0));
}
