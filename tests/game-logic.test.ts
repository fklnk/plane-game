import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAVE,
  chooseUnique,
  formatTime,
  loadSave,
  rewardForRun,
  xpToNextLevel
} from "../src/game-logic";

describe("progression", () => {
  it("experience requirements increase monotonically", () => {
    for (let level = 1; level < 40; level += 1) {
      expect(xpToNextLevel(level + 1)).toBeGreaterThan(xpToNextLevel(level));
    }
  });

  it("draws unique options", () => {
    const pool = ["a", "b", "c", "d"].map((id) => ({ id }));
    const result = chooseUnique(pool, 3, () => 0);
    expect(new Set(result.map((item) => item.id)).size).toBe(3);
  });

  it("recovers from corrupt saves", () => {
    expect(loadSave("{broken")).toEqual(DEFAULT_SAVE);
  });

  it("migrates legacy fighter selections and achievement data", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedShip: "dawn",
        unlockedShips: ["dawn"],
        achievements: { first_blood: "2026-07-27T00:00:00.000Z" }
      })
    );
    expect(migrated.selectedShip).toBe("balanced");
    expect(migrated.unlockedShips).toHaveLength(4);
    expect(migrated.achievements.first_blood).toBe("2026-07-27T00:00:00.000Z");
  });

  it("repairs invalid specialization and skin ownership", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedSpecialization: "sniper",
        unlockedSkins: ["inferno"],
        equippedSkin: "void"
      })
    );
    expect(migrated.selectedSpecialization).toBe("power");
    expect(migrated.unlockedSkins).toEqual(["standard", "inferno"]);
    expect(migrated.equippedSkin).toBe("standard");
  });

  it("migrates the legacy assault doctrine to power", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedSpecialization: "assault"
      })
    );
    expect(migrated.selectedSpecialization).toBe("power");
  });

  it("accepts the wheelchair collision doctrine", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        selectedSpecialization: "wheelchair"
      })
    );
    expect(migrated.selectedSpecialization).toBe("wheelchair");
  });

  it("formats time and rewards wins", () => {
    expect(formatTime(125)).toBe("02:05");
    expect(rewardForRun("campaign", 5000, true)).toBeGreaterThan(
      rewardForRun("campaign", 5000, false)
    );
  });
});
