import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAVE,
  SPECIALIZATION_BASE_REDUCTION,
  SPECIALIZATION_BASE_STAT_BOOST,
  agileCritEffectSpeedMultiplier,
  agileCritRateAttackBonus,
  boostedSpecializationReduction,
  boostedSpecializationStat,
  chooseUnique,
  collisionBossDamageScale,
  collisionHullAttackMultiplier,
  dailyLoginOffer,
  formatRoundedNumber,
  formatTime,
  loadSave,
  minionHealthDamageMultiplier,
  minionPercentDamageFloor,
  roundHealth,
  rewardForRun,
  xpToNextLevel
} from "../src/game-logic";
import {
  BOSS_CAMPAIGN_ENCOUNTERS,
  campaignDifficultyForLevel,
  campaignEnemyRoster,
  chaseRemainingHpRatio,
  remainingStoreUnlockCost,
  rollCampaignElite,
  rollCampaignMutation
} from "../src/boss-campaign";

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
    expect(roundHealth(74.49, 100)).toBe(74);
    expect(roundHealth(74.5, 100)).toBe(75);
    expect(roundHealth(101.4, 100)).toBe(100);
    expect(rewardForRun("campaign", 5000, true)).toBeGreaterThan(
      rewardForRun("campaign", 5000, false)
    );
  });

  it("rounds visible values to an integer or one decimal place", () => {
    expect(formatRoundedNumber(2.4000000000000004)).toBe("2.4");
    expect(formatRoundedNumber(2.44)).toBe("2.4");
    expect(formatRoundedNumber(2.45)).toBe("2.5");
    expect(formatRoundedNumber(3)).toBe("3");
  });

  it("raises specialization base stats by one sixth without changing size", () => {
    expect(SPECIALIZATION_BASE_STAT_BOOST).toBeCloseTo(7 / 6);
    expect(SPECIALIZATION_BASE_REDUCTION).toBeCloseTo(5 / 6);
    expect(boostedSpecializationStat(6)).toBeCloseTo(7);
    expect(boostedSpecializationReduction(1)).toBeCloseTo(5 / 6);
  });

  it("scales collision attack by 20% for every 500 gained max health", () => {
    expect(collisionHullAttackMultiplier(0)).toBe(1);
    expect(collisionHullAttackMultiplier(499)).toBe(1);
    expect(collisionHullAttackMultiplier(500)).toBe(1.2);
    expect(collisionHullAttackMultiplier(1000)).toBe(1.4);
    expect(collisionHullAttackMultiplier(-500)).toBe(1);
  });

  it("uses the strengthened agile crit conversions", () => {
    expect(agileCritRateAttackBonus(0.01)).toBeCloseTo(0.02);
    expect(agileCritRateAttackBonus(0.1)).toBeCloseTo(0.2);
    expect(agileCritEffectSpeedMultiplier(0.01)).toBeCloseTo(1.01);
    expect(agileCritEffectSpeedMultiplier(1.2)).toBeCloseTo(2.2);
  });

  it("reduces boss damage by one quarter for high-health collision builds", () => {
    expect(collisionBossDamageScale(1000, true)).toBe(1);
    expect(collisionBossDamageScale(1001, true)).toBe(0.75);
    expect(collisionBossDamageScale(5000, true)).toBe(0.75);
    expect(collisionBossDamageScale(5000, false)).toBe(1);
  });

  it("scales minion damage every 1000 max health with a 5% health floor", () => {
    expect(minionHealthDamageMultiplier(999)).toBe(1);
    expect(minionHealthDamageMultiplier(1000)).toBe(1.2);
    expect(minionHealthDamageMultiplier(2000)).toBe(1.4);
    expect(minionPercentDamageFloor(1000)).toBe(50);
    expect(minionPercentDamageFloor(2500)).toBe(125);
  });

  it("keeps the last selected mode, difficulty and multiplayer variant", () => {
    const migrated = loadSave(
      JSON.stringify({
        ...DEFAULT_SAVE,
        lastMode: "boss",
        lastLevel: 5,
        lastVariant: "coop",
        lastShip2: "lightning"
      })
    );
    expect(migrated.lastMode).toBe("boss");
    expect(migrated.lastLevel).toBe(5);
    expect(migrated.lastVariant).toBe("coop");
    expect(migrated.lastShip2).toBe("lightning");
  });

  it("calculates daily login streaks, resets missed days and prevents duplicate claims", () => {
    expect(
      dailyLoginOffer({ lastClaimDay: null, streak: 0, totalClaims: 0 }, 100)
    ).toEqual({ available: true, streak: 1, reward: 80 });
    expect(
      dailyLoginOffer({ lastClaimDay: 99, streak: 3, totalClaims: 3 }, 100)
    ).toEqual({ available: true, streak: 4, reward: 170 });
    expect(
      dailyLoginOffer({ lastClaimDay: 98, streak: 6, totalClaims: 6 }, 100)
    ).toEqual({ available: true, streak: 1, reward: 80 });
    expect(
      dailyLoginOffer({ lastClaimDay: 100, streak: 4, totalClaims: 4 }, 100)
    ).toEqual({ available: false, streak: 4, reward: 0 });
  });
});

describe("nine battle boss campaign", () => {
  it("contains the requested nine encounters in order", () => {
    expect(BOSS_CAMPAIGN_ENCOUNTERS).toHaveLength(9);
    expect(BOSS_CAMPAIGN_ENCOUNTERS.map((encounter) => encounter.kind)).toEqual([
      "boss",
      "chase",
      "boss",
      "chase",
      "boss",
      "chase",
      "trinity",
      "shadow_final",
      "dark_deity"
    ]);
    expect([1, 3, 5].map(chaseRemainingHpRatio)).toEqual([0.5, 0.25, 0.125]);
  });

  it("maps normal, hard and nightmare elite/mutation rules", () => {
    expect(campaignDifficultyForLevel(3).id).toBe("normal");
    expect(campaignDifficultyForLevel(4).id).toBe("hard");
    expect(campaignDifficultyForLevel(5).id).toBe("nightmare");
    expect(rollCampaignElite(3, () => 0)).toBe(false);
    expect(rollCampaignElite(4, () => 0.49)).toBe(true);
    expect(rollCampaignElite(4, () => 0.5)).toBe(false);
    expect(rollCampaignElite(5, () => 0.99)).toBe(true);
    expect(rollCampaignMutation(5, () => 0.24)).toBe(true);
    expect(rollCampaignMutation(5, () => 0.25)).toBe(false);
  });

  it("unlocks more minion types after each original boss", () => {
    expect(campaignEnemyRoster(0)).toEqual(["scout", "interceptor"]);
    expect(campaignEnemyRoster(1)).toContain("striker");
    expect(campaignEnemyRoster(2)).toContain("mine_layer");
    expect(campaignEnemyRoster(3)).toEqual([
      "scout",
      "interceptor",
      "striker",
      "suppressor",
      "mine_layer",
      "courier",
      "gunship",
      "bomber"
    ]);
  });

  it("final reward can cover every remaining shop purchase", () => {
    expect(
      remainingStoreUnlockCost(
        { hull: 0, firepower: 0, engine: 0, armor: 0, recovery: 0, emergency: 0, reroll: 0 },
        ["standard"]
      )
    ).toBeGreaterThan(10000);
    expect(
      remainingStoreUnlockCost(
        { hull: 12, firepower: 12, engine: 10, armor: 10, recovery: 8, emergency: 5, reroll: 3 },
        ["standard", "aurora", "inferno", "void"]
      )
    ).toBe(0);
  });
});
