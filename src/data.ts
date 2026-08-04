import Phaser from "phaser";
import type { BattleScene } from "./main";
import {
  DEVOUR_SWALLOW_LEVELS,
  SPECIALIZATION_BASE_STAT_BOOST,
  boostedSpecializationReduction,
  boostedSpecializationStat,
  formatRoundedNumberForDisplay,
  type GameMode,
  type PlayVariantId,
  type ShadowEndingId,
  type SkinId,
  type ShipId,
  type SpecializationId
} from "./game-logic";
import {
  type CampaignBossKind,
  type CampaignMinionMutation,
  type PlayerBossPassiveId,
  type PlayerBossPowerId
} from "./boss-campaign";

export const WORLD_WIDTH = 1080;
export const WORLD_HEIGHT = 1280;
export const ATTACK_BONUS_SCALE = 2 / 3;
export const SAVE_KEY = "starfall_save_v1";
export const PERFORMANCE_MIGRATION_KEY = "starfall_performance_v051";
export const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
// 影步突刺(敏捷流派 G 键)：突进距离固定为当前等级上限，方向由方向键/WASD 决定，固定 550ms 完成
// 距离上限为地图竖直长度的 98%(满级 Lv.4)；范围整体较旧版扩大 40%
export const AGILE_LUNGE_REACHES = [
  WORLD_HEIGHT * 0.56,
  WORLD_HEIGHT * 0.7,
  WORLD_HEIGHT * 0.84,
  WORLD_HEIGHT * 0.98
] as const;
export const AGILE_LUNGE_REACH = AGILE_LUNGE_REACHES[AGILE_LUNGE_REACHES.length - 1];
export const AGILE_LUNGE_DURATION = 550;
export const AGILE_LUNGE_HIT_WIDTH = [78, 95, 112, 129] as const;
export const AGILE_LUNGE_MAX_HEAL_HITS = 5;
// 影分身(敏捷流派):数量上限 4,攻击最高为本体 100%,血量最高为本体 40%
// 血量按本体最大生命的比例成长(Lv.1 即拥有实血,不再 1 点被弹幕一碰即死)
// 伤害:Lv.1 为玩家弹幕的 30%,每级提升,满级 50%
export const AGILE_CLONE_MAX_COUNT = 4;
export const AGILE_CLONE_COUNTS = [1, 2, 3, 4] as const;
export const AGILE_CLONE_DAMAGE_RATIOS = [0.3, 0.37, 0.43, 0.5] as const;
// 基础血量为本体最大生命占比,上限 40%;融合技(万象影袭)每级再额外叠加
export const AGILE_CLONE_HP_RATIOS = [0.12, 0.18, 0.28, 0.4] as const;
// 万象影袭每级额外提升分身血量占比,融合技等级越高分身越抗揍
export const AGILE_CLONE_FUSION_HP_BONUS = 0.05;
// 召唤间隔随等级递减(秒),一次只补充 1 个
export const AGILE_CLONE_INTERVALS = [30, 25, 20, 15] as const;

export type UpgradeKind = "weapon" | "passive" | "support";

export interface UpgradeDefinition {
  id: string;
  name: string;
  icon: string;
  kind: UpgradeKind;
  description: (level: number) => string;
  /** 升级卡片的精简描述(双人分栏卡片用),缺省时回退到 description */
  short?: (level: number) => string;
}

export interface RunResult {
  mode: GameMode;
  victory: boolean;
  score: number;
  seconds: number;
  kills: number;
  level: number;
  reward: number;
  combatTokens: number;
  bosses: number;
  missionLevel: number;
  score2?: number;
  shadowEnding?: ShadowEnding | null;
  /** 击破首领数(历史纪录保留) */
  waves?: number;
}

export const SHIPS: Record<
  ShipId,
  {
    name: string;
    tag: string;
    description: string;
    hp: number;
    speed: number;
    damage: number;
    passive: string;
    asset: string;
  }
> = {
  balanced: {
    name: "默认战机",
    tag: "均衡突击",
    description: "装甲、火力和机动均衡，适合初次进入星渊战场。",
    hp: 100,
    speed: 400,
    damage: 1,
    passive: "火控同步：连续击杀后短暂提升火力",
    asset: "fighter_balanced"
  },
  bomber: {
    name: "爆破战机",
    tag: "重火力攻击",
    description: "牺牲少量机动换取高额火力，擅长快速拆解精英与 Boss。",
    hp: 92,
    speed: 390,
    damage: 1.2,
    passive: "爆燃弹头：导弹和清屏伤害提高 24%",
    asset: "fighter_bomber"
  },
  lightning: {
    name: "闪电战机",
    tag: "高速机动",
    description: "较快移动速度与短技能冷却,适合擦弹和走位。",
    hp: 81,
    speed: 410,
    damage: 0.92,
    passive: "闪电协议：主动技能冷却缩短 18%",
    asset: "fighter_lightning"
  },
  guardian: {
    name: "守护战机",
    tag: "防御生存",
    description: "厚重护甲和更高生命值，适合稳健推进与双人保护。",
    hp: 135,
    speed: 360,
    damage: 0.88,
    passive: "复合装甲：所受伤害降低 20%",
    asset: "fighter_guardian"
  }
};

export const SPECIALIZATIONS: Record<
  SpecializationId,
  {
    name: string;
    code: string;
    icon: string;
    description: string;
    hp: number;
    speed: number;
    damage: number;
    fireRate: number;
    cooldown: number;
    damageTaken: number;
    explosionTaken: number;
    scale: number;
    trait: string;
  }
> = {
  power: {
    name: "力量流派",
    code: "LANCE",
    icon: "▲",
    description: "直线重火力与暴击成长。每次击杀按额外生命上限回复，暴击处决永久提高本局生命上限。",
    hp: 1,
    speed: 0.96,
    damage: 1.18,
    fireRate: 1,
    cooldown: 1,
    damageTaken: 1,
    explosionTaken: 1,
    scale: 1,
    trait: `初始暴击 20% / 效果 200% · 每次击杀回复额外生命上限 1% · 暴击处决 MAX HP +1.5 · G 键龙息喷火(专属)`
  },
  agile: {
    name: "敏捷流派",
    code: "KALEIDOSCOPE",
    icon: "⌁",
    description: "发射分散摆动的花瓣弹幕，并周期性绽放环形弹雨。完全放弃暴击换取伤害与速度。",
    hp: 0.9,
    speed: 1.1,
    damage: 0.84,
    fireRate: 1.08,
    cooldown: 0.8,
    damageTaken: 1,
    explosionTaken: 1,
    scale: 0.94,
    trait: "暴击率 → 攻击力 · 暴击效果 → 移速 · 周期性万花弹环(每颗 +0.1% 敌方最大生命)"
  },
  defender: {
    name: "防御流派",
    code: "AEGIS",
    icon: "⬡",
    description: "体型更大、速度更慢，以重甲和大口径炮火强行推进。",
    hp: 1.2,
    speed: 0.85,
    damage: 1.3,
    fireRate: 0.75,
    cooldown: 1.08,
    damageTaken: 1 / 1.2,
    explosionTaken: 0.5,
    scale: 1.15,
    trait: `爆炸减伤 ${formatRoundedNumberForDisplay(
      (1 - boostedSpecializationReduction(0.5)) * 100
    )}% · 击杀不再回血(搭配荆棘护甲靠反伤回血)`
  },
  vampire: {
    name: "吸血流派",
    code: "BLOOD ECHO",
    icon: "◉",
    description: "基础属性已全面强化，每次命中都会抽取敌方能量修复机体。",
    hp: 0.89,
    speed: 0.89,
    damage: 0.89,
    fireRate: 0.89,
    cooldown: 1.11,
    damageTaken: 1.11,
    explosionTaken: 1,
    scale: 1,
    trait: "每次命中回复 1.2% 已损生命 · 基础减伤同步强化"
  },
  devour: {
    name: "吞噬流派",
    code: "EVOLUTION",
    icon: "∞",
    description: "基础数值已全面强化，并用持续击杀在本局中无限进化舰体。",
    hp: 0.9,
    speed: 0.9,
    damage: 0.9,
    fireRate: 0.9,
    cooldown: 1.08,
    damageTaken: 1,
    explosionTaken: 1,
    scale: 1,
    trait: "成功吞噬：MAX +1.5～6；回复额外生命 1% + 已损生命 2% + 目标最大生命 4% · 后续升级提高体型成长与减伤"
  },
  wheelchair: {
    name: "撞击流派",
    code: "JUGGERNAUT",
    icon: "◉",
    description: "关闭基础机炮，以机体作为主武器。每新增 500 最大生命提升攻击；超过 400 最大生命后，Boss 撞击你时伤害 +25%（至少 8% 最大生命）。",
    hp: 1.12,
    speed: 0.82,
    damage: 1.2,
    fireRate: 0,
    cooldown: 1,
    damageTaken: 0.6,
    explosionTaken: 0.6,
    scale: 1.68,
    trait: `接触 230ms / Boss 325ms · 每新增 500 MAX HP 攻击 +${formatRoundedNumberForDisplay(
      0.2 * (5 / 6) * 100
    )}% · 每 5 秒回复 ${formatRoundedNumberForDisplay(
      10 * SPECIALIZATION_BASE_STAT_BOOST
    )}%`
  }
};

for (const specialization of Object.values(SPECIALIZATIONS)) {
  specialization.hp = boostedSpecializationStat(specialization.hp);
  specialization.speed = boostedSpecializationStat(specialization.speed);
  specialization.damage = boostedSpecializationStat(specialization.damage);
  specialization.fireRate = boostedSpecializationStat(specialization.fireRate);
  specialization.damageTaken = boostedSpecializationReduction(
    specialization.damageTaken
  );
  specialization.explosionTaken = boostedSpecializationReduction(
    specialization.explosionTaken
  );
}

// 龙息长度:504/672/840/1008 → 450/600/750/900
export const POWER_FLAME_LENGTHS = [450, 600, 750, 900] as const;
// 龙息末端宽度:338/468/624/754 → 280/390/500/620
export const POWER_FLAME_WIDTHS = [280, 390, 500, 620] as const;
// 龙息持续时间:在原值基础上累计延长 30%(910/1040/1170 → 1183/1352/1521),Lv.4 续延 +169。
export const POWER_FLAME_DURATIONS = [1183, 1352, 1521, 1690] as const;
// 各档伤害:29 / 40 / 52 / 65 → 18 / 28 / 38 / 48(下调约 26%,缓解喷火对 Boss 的每帧秒杀)
export const POWER_FLAME_DAMAGE = [18, 28, 38, 48] as const;
// 冷却统一 17s(原 17/16/15/14)
export const POWER_FLAME_COOLDOWNS = [17, 17, 17, 17] as const;

export type SkinRarity = "rare" | "epic" | "mythic" | "legendary";
export type AchievementSkinEffect =
  | "heartbeat"
  | "ember"
  | "gravity"
  | "seal"
  | "vessel"
  | "trophy"
  | "legendary";

export type SkinDefinition = {
  name: string;
  code: string;
  description: string;
  unlock: string;
  accent: string;
  colors: readonly [number, number];
  rarity?: SkinRarity;
  asset?: string;
  bulletAsset?: string;
  effect?: AchievementSkinEffect;
};

export const SKIN_RARITY_LABELS: Record<SkinRarity, string> = {
  rare: "稀有",
  epic: "史诗",
  mythic: "神话",
  legendary: "传说"
};

// 付费换色皮肤已删除；成就皮肤全部使用独立完整模型，不再依赖基础战机换色。
export const SKINS: Record<SkinId, SkinDefinition> = {
  standard: {
    name: "基础机体",
    code: "ORIGIN",
    description: "使用当前选择的基础战机。",
    unlock: "默认可用",
    accent: "#2df4ff",
    colors: [0x2df4ff, 0xffffff]
  },
  after_storm_skin: {
    name: "愿意的宿主",
    code: "WILLING HOST",
    description: "猩红心核寄生茧体，装甲与活体组织已经无法分离。",
    unlock: "达成结局「愿意的宿主」",
    accent: "#ff3d67",
    colors: [0xff3d67, 0xffa0b8],
    rarity: "mythic",
    asset: "assets/skins/achievement/after_storm_skin.png",
    bulletAsset: "assets/projectiles/achievement/after_storm_skin_bullet.png",
    effect: "heartbeat"
  },
  fell_short_skin: {
    name: "碎裂容器",
    code: "SHATTERED VESSEL",
    description: "破损圣骸仍靠裂缝中的最后一炉余火维持飞行。",
    unlock: "达成结局「碎裂容器」",
    accent: "#ff9b3d",
    colors: [0xff9b3d, 0xffe6a1],
    rarity: "rare",
    asset: "assets/skins/achievement/fell_short_skin.png",
    bulletAsset: "assets/projectiles/achievement/fell_short_skin_bullet.png",
    effect: "ember"
  },
  total_eclipse_skin: {
    name: "全然日蚀",
    code: "TOTAL ECLIPSE",
    description: "武装黑日以实体装甲包裹微型引力核心。",
    unlock: "达成结局「全然日蚀」",
    accent: "#8a43ff",
    colors: [0x8a43ff, 0xe3cfff],
    rarity: "epic",
    asset: "assets/skins/achievement/total_eclipse_skin.png",
    bulletAsset: "assets/projectiles/achievement/total_eclipse_skin_bullet.png",
    effect: "gravity"
  },
  hollow_custody_skin: {
    name: "空洞看守",
    code: "HOLLOW CUSTODY",
    description: "无人棺卫继续执行已经失去意义的封印协议。",
    unlock: "达成结局「空洞看守」",
    accent: "#8edcff",
    colors: [0x8edcff, 0xe8fbff],
    rarity: "rare",
    asset: "assets/skins/achievement/hollow_custody_skin.png",
    bulletAsset: "assets/projectiles/achievement/hollow_custody_skin_bullet.png",
    effect: "seal"
  },
  perfect_vessel_skin: {
    name: "完美躯壳",
    code: "PERFECT VESSEL",
    description: "黑曜石神像将驾驶者与深渊意志熔成同一副躯壳。",
    unlock: "达成结局「完美躯壳」",
    accent: "#ff39c8",
    colors: [0xff39c8, 0xffffff],
    rarity: "epic",
    asset: "assets/skins/achievement/perfect_vessel_skin.png",
    bulletAsset: "assets/projectiles/achievement/perfect_vessel_skin_bullet.png",
    effect: "vessel"
  },
  boss_slayer_skin: {
    name: "首领终结",
    code: "BOSS SLAYER",
    description: "将三类首领核心直接铸入猎杀装甲的战利品兽。",
    unlock: "获得成就「泰坦终结者」",
    accent: "#bb63ff",
    colors: [0xff8a35, 0x61ddff],
    rarity: "epic",
    asset: "assets/skins/achievement/boss_slayer_skin.png",
    bulletAsset: "assets/projectiles/achievement/boss_slayer_skin_bullet.png",
    effect: "trophy"
  },
  campaign_ace_skin: {
    name: "九渊弑神",
    code: "ABYSS LEGEND",
    description: "黑曜、鎏金与珍珠白共同铸成的传说神机，胸甲刻有帝龙徽记。",
    unlock: "通关九渊试炼专属模式",
    accent: "#ffd66b",
    colors: [0xffd66b, 0xffffff],
    rarity: "legendary",
    asset: "assets/skins/achievement/campaign_ace_skin.png",
    bulletAsset: "assets/projectiles/achievement/campaign_ace_skin_bullet.png",
    effect: "legendary"
  }
};

export const ACHIEVEMENT_SKIN_IDS: SkinId[] = [
  "after_storm_skin",
  "fell_short_skin",
  "total_eclipse_skin",
  "hollow_custody_skin",
  "perfect_vessel_skin",
  "boss_slayer_skin",
  "campaign_ace_skin"
];

export function achievementSkinTextureKey(id: SkinId): string {
  return `achievementSkin_${id}`;
}

export function achievementSkinBulletTextureKey(id: SkinId): string {
  return `achievementSkinBullet_${id}`;
}

export function achievementSkinBulletDisplaySize(id: SkinId): { width: number; height: number } {
  const rarity = SKINS[id]?.rarity;
  // 尺寸在上一版基础上 -20%,配合更强的图片提亮保证对敌弹可见(无发光)
  if (rarity === "legendary") return { width: 33, height: 69 };
  if (rarity === "mythic") return { width: 30, height: 63 };
  if (rarity === "epic") return { width: 27, height: 58 };
  return { width: 24, height: 52 };
}

export function specializationStats(shipId: ShipId, specializationId: SpecializationId): {
  hp: number;
  speed: number;
  damage: number;
} {
  const ship = SHIPS[shipId];
  const specialization = SPECIALIZATIONS[specializationId];
  return {
    hp: Math.round(ship.hp * specialization.hp),
    speed: Math.round(ship.speed * specialization.speed),
    damage: Math.round(ship.damage * specialization.damage * 100)
  };
}


// 点到线段的距离(用于链子"扫到"敌人判定)
export function distancePointToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

// inGameTextField helper lives inside setupInput as a closure, not exposed globally.

export type PlayVariant = PlayVariantId;
export type BossKind = CampaignBossKind;
export type BossPowerId = PlayerBossPowerId;
export type BossPassiveId = PlayerBossPassiveId;
export type EnemyMutation = CampaignMinionMutation;
export type EnemyDamageSource = "minion" | "boss";
export type TemporarySkill =
  | "overdrive"
  | "prism"
  | "singularity"
  | "rapidfire"
  | "ironclad";

export const MINION_MUTATION_COLORS: Record<EnemyMutation, number> = {
  homing: 0xb05cff,
  mine_burst: 0xff3d8f,
  armor: 0x65d8ff,
  dash: 0xffbd3e,
  suppress: 0xff6b5d
};

// === 终局五种黑影结局:全部保留为失败结算 ===
export type ShadowEnding = ShadowEndingId;

export const SHADOW_ENDINGS: Record<
  ShadowEnding,
  { code: string; title: string; detail: string }
> = {
  destroyed_fallen: {
    code: "ENDING · SHATTERED VESSEL",
    title: "你已成为黑影",
    detail: "核心碎了，碎片找到了新的容器。残骸撕开你的舱门时，你没能撑住。"
  },
  destroyed_consumed: {
    code: "ENDING · TOTAL ECLIPSE",
    title: "你已成为黑影",
    detail: "侵蚀爬满了全身。你还握着操纵杆，但手不再听你的了。"
  },
  destroyed_embraced: {
    code: "ENDING · WILLING HOST",
    title: "你已成为黑影",
    detail: "残党清完了，你还活着。代价是它已经住进来，而你没有赶它走。"
  },
  kept_fallen: {
    code: "ENDING · HOLLOW CUSTODY",
    title: "你已成为黑影",
    detail: "你把核心锁进货舱，以为看管就够了。它在你倒下时接住了你。"
  },
  kept_possessed: {
    code: "ENDING · PERFECT VESSEL",
    title: "你已成为黑影",
    detail: "航线净空。货舱里的核心不再损坏——它修好了自己，然后换了驾驶者。"
  }
};

export const SHADOW_ENDING_ACHIEVEMENTS: Record<ShadowEnding, string> = {
  destroyed_fallen: "ending_shattered_vessel",
  destroyed_consumed: "ending_total_eclipse",
  destroyed_embraced: "ending_willing_host",
  kept_fallen: "ending_hollow_custody",
  kept_possessed: "ending_perfect_vessel"
};
// 终局黑暗核心:摧毁后的侵蚀节奏与残党强化
// 侵蚀满 100% 需 25 段 × 2.6s ≈ 65s;残党 8 波(每波间隔 2.4s)最快约 20s 出完,
// 所以手速够快能在侵蚀满之前清完 → 走 destroyed_embraced,否则被吞没。
export const DARK_CORRUPTION_TICK_MS = 2600;      // 每 2.6s 侵蚀 +1 段
export const DARK_CORRUPTION_PER_TICK = 4;        // 每段 +4 点(0-100)
export const DARK_CORRUPTION_HP_DRAIN = 0.008;    // 每段额外扣 0.8% 最大生命
export const DARK_SWARM_HP_SCALE = 1.55;          // 摧毁后残党血量倍率
export const DARK_SWARM_DAMAGE_SCALE = 1.4;       // 摧毁后残党伤害倍率

export type AgileTrajectory = "fan" | "arc" | "helix" | "scatter" | "cross" | "circle" | "twin";
export type AirSupportSkillId =
  | "piercing_bombardment"
  | "stasis_wake"
  | "phase_escort"
  | "repair_convoy"
  | "hunter_sweep";
export type EnemyType =
  | "scout"
  | "interceptor"
  | "striker"
  | "suppressor"
  | "mine_layer"
  | "gunship"
  | "bomber"
  | "courier";

export const BOSS_NAMES: Record<BossKind, string> & Record<"pulsar" | "gravity" | "photon", string> = {
  titan: "裂渊泰坦",
  mirror: "镜像猎手",
  usurper: "技能篡夺者",
  shadow: "力量掠夺者 · 黑影",
  dark_deity: "黑暗魔神飞机",
  pulsar: "脉冲星要塞",
  gravity: "虚空坍缩体",
  photon: "星河观测站"
};

// === BOSS 专属被动强化：可在一局内累计，但每次黑影掉落只能选择一项 ===
export type BossPassiveDefinition = {
  id: BossPassiveId;
  kind: BossKind | "pulsar" | "gravity" | "photon";
  icon: string;
  name: string;
  code: string;
  description: string;
  apply: (scene: BattleScene) => void;
};
export const BOSS_PASSIVE_OPTIONS: BossPassiveDefinition[] = [
  {
    id: "titan_bulwark",
    kind: "titan",
    icon: "⬡",
    name: "泰坦壁垒",
    code: "TITAN BULWARK",
    description: "本局最大生命永久提高 15%，并立即回复等量生命。",
    apply: (scene) => {
      const gain = Math.round(scene.stats.maxHp * 0.15);
      scene.stats.maxHp += gain;
      scene.stats.hp += gain;
      scene.recordAgileMaxHpGain(gain);
    }
  },
  {
    id: "titan_meteor_forge",
    kind: "titan",
    icon: "☄",
    name: "陨星熔炉",
    code: "METEOR FORGE",
    description: "所有 V 键主动权柄伤害提高 9%，有效范围提高 6%。",
    apply: (scene) => {
      scene.bossPowerDamageMultiplier *= 1.09;
      scene.bossPowerAreaMultiplier *= 1.06;
    }
  },
  {
    id: "titan_gravity_shell",
    kind: "titan",
    icon: "◉",
    name: "重力壳层",
    code: "GRAVITY SHELL",
    description: "受到 Boss 造成的伤害降低 12%。",
    apply: (scene) => {
      scene.bossPassiveBossDamageTakenMultiplier *= 0.88;
    }
  },
  {
    id: "mirror_echo",
    kind: "mirror",
    icon: "◫",
    name: "镜像残响",
    code: "MIRROR ECHO",
    description: "生命低于 30% 时召唤一个无敌镜像残影，每局触发一次。",
    apply: (scene) => {
      scene.mirrorEchoArmed = true;
    }
  },
  {
    id: "mirror_legion",
    kind: "mirror",
    icon: "♢",
    name: "镜海军团",
    code: "MIRROR LEGION",
    description: "万象镜像权柄额外生成一架僚机，权柄伤害提高 4%。",
    apply: (scene) => {
      scene.bossPowerCloneBonus += 1;
      scene.bossPowerDamageMultiplier *= 1.04;
    }
  },
  {
    id: "mirror_refraction",
    kind: "mirror",
    icon: "◇",
    name: "折光回路",
    code: "REFRACTION LOOP",
    description: "V 键主动权柄冷却缩短 16%。",
    apply: (scene) => {
      scene.bossPowerCooldownMultiplier *= 0.84;
    }
  },
  {
    id: "usurper_blight",
    kind: "usurper",
    icon: "⌁",
    name: "权柄污染",
    code: "USURPER BLIGHT",
    description: "本局对所有 Boss 造成的伤害提高 10%。",
    apply: (scene) => {
      scene.usurperBlight = true;
    }
  },
  {
    id: "usurper_override",
    kind: "usurper",
    icon: "▦",
    name: "越权协议",
    code: "ROOT OVERRIDE",
    description: "主动权柄持续时间提高 25%，冻结与封锁时间同步延长。",
    apply: (scene) => {
      scene.bossPowerDurationMultiplier *= 1.25;
    }
  },
  {
    id: "usurper_recycle",
    kind: "usurper",
    icon: "↻",
    name: "权限回收",
    code: "AUTHORITY RECYCLE",
    description: "每次成功启动 V 键权柄，立即回复 10% 最大生命。",
    apply: (scene) => {
      scene.bossPowerHealRatio += 0.1;
    }
  },
  {
    id: "shadow_echo",
    kind: "shadow",
    icon: "✦",
    name: "力量残响",
    code: "SHADOW ECHO",
    description: "本局暴击率提高 8%。",
    apply: (scene) => {
      scene.stats.critChance += 0.08;
    }
  },
  {
    id: "shadow_edge",
    kind: "shadow",
    icon: "╱",
    name: "裂隙增殖",
    code: "RIFT PROLIFERATION",
    description: "裂隙爪刀每轮额外生成一道交错暗刃。",
    apply: (scene) => {
      scene.shadowRiftBladeBonus += 1;
    }
  },
  {
    id: "shadow_phase",
    kind: "shadow",
    icon: "◈",
    name: "黑影相位",
    code: "SHADOW PHASE",
    description: "每次启动 V 键权柄额外获得 1.5 秒无敌。",
    apply: (scene) => {
      scene.bossPowerInvulnMs += 1500;
    }
  },
  {
    id: "deity_pact",
    kind: "dark_deity",
    icon: "☩",
    name: "魔神契约",
    code: "DEITY PACT",
    description: "死亡时有 25% 概率以 50% 生命复活，每局最多一次。",
    apply: (scene) => {
      scene.deityPactArmed = true;
    }
  },
  {
    id: "deity_hunger",
    kind: "dark_deity",
    icon: "◉",
    name: "深渊饥渴",
    code: "ABYSSAL HUNGER",
    description: "启动 V 键权柄时额外回复 12% 已损生命。",
    apply: (scene) => {
      scene.bossPowerMissingHealRatio += 0.12;
    }
  },
  {
    id: "deity_abyss",
    kind: "dark_deity",
    icon: "◆",
    name: "魔神升格",
    code: "DEITY ASCENSION",
    description: "主动权柄伤害提高 12.5%，有效范围提高 5%。",
    apply: (scene) => {
      scene.bossPowerDamageMultiplier *= 1.125;
      scene.bossPowerAreaMultiplier *= 1.05;
    }
  },
  {
    id: "pulsar_overcharge",
    kind: "pulsar",
    icon: "✸",
    name: "脉冲星过载",
    code: "PULSAR OVERCHARGE",
    description: "V 键权柄命中时 25% 概率触发过载，额外造成 15% 伤害。",
    apply: (scene) => {
      scene.bossPowerOverchargeChance = (scene.bossPowerOverchargeChance ?? 0) + 0.25;
      scene.bossPowerOverchargeDamage = (scene.bossPowerOverchargeDamage ?? 0) + 0.15;
    }
  },
  {
    id: "gravity_resonance",
    kind: "gravity",
    icon: "◍",
    name: "引力共振",
    code: "GRAVITY RESONANCE",
    description: "V 键权柄命中累积 4 次后，下一次权柄伤害提高 50%。",
    apply: (scene) => {
      scene.bossPowerResonanceThreshold = (scene.bossPowerResonanceThreshold ?? 4) - 1;
      scene.bossPowerResonanceDamage = (scene.bossPowerResonanceDamage ?? 1.5) + 0.05;
    }
  },
  {
    id: "photon_spectrum",
    kind: "photon",
    icon: "✺",
    name: "光子频谱",
    code: "PHOTON SPECTRUM",
    description: "V 键权柄射速提高 20%，且每发 8% 概率附加暴击。",
    apply: (scene) => {
      scene.bossPowerRateMultiplier *= 1.2;
      scene.bossPowerCritChance = (scene.bossPowerCritChance ?? 0) + 0.08;
    }
  }
];

export const SHADOW_EVOLUTION_TEXTURES = [
  "bossShadow",
  "bossShadowStage1",
  "bossShadowStage2",
  "bossShadowStage3"
] as const;

export const CAMPAIGN_MYSTERY_THRESHOLDS = [0.18, 0.42, 0.68, 0.9] as const;
export const CAMPAIGN_MYSTERY_MESSAGES = [
  [
    "雷达边缘掠过一道陌生回波",
    "星图出现无法识别的短促脉冲",
    "敌军频道里传来半秒杂音"
  ],
  [
    "航道残骸中亮起未知星核",
    "远方爆发一次无来源闪光",
    "一枚异常能源体穿过干扰层"
  ],
  [
    "战术残片正在回应你的火力",
    "某种未知武装开始同步射击节奏",
    "深空中传来第二组引擎回声"
  ],
  [
    "所有敌军通讯突然中断",
    "星空安静得不正常",
    "前方航道出现短暂真空"
  ]
] as const;

export function shadowTextureForAbsorbedPowers(absorbedPowers: number): string {
  return SHADOW_EVOLUTION_TEXTURES[
    Phaser.Math.Clamp(Math.floor(absorbedPowers), 0, 3)
  ];
}

export const BOSS_POWER_OPTIONS: Array<{
  id: BossPowerId;
  icon: string;
  name: string;
  source: string;
  description: string;
  asset: string;
}> = [
  {
    id: "titan_meteor",
    icon: "☄",
    name: "裂渊陨星权柄",
    source: "裂渊泰坦",
    description: "V 键召唤持续 7 秒的逆向陨星轰炸，玩家版伤害为 Boss 原版 21%，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_titan.png"
  },
  {
    id: "mirror_copy",
    icon: "◫",
    name: "万象镜像权柄",
    source: "镜像猎手",
    description: "V 键生成两架镜像僚机并复制当前支援 7 秒，玩家版伤害为 Boss 原版 21%，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_mirror.png"
  },
  {
    id: "usurper_lock",
    icon: "⌁",
    name: "权限篡夺权柄",
    source: "技能篡夺者",
    description: "V 键封锁全部敌机与 Boss 行动 7 秒，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_usurper.png"
  },
  {
    id: "shadow_rift_blade",
    icon: "✦",
    name: "裂隙黑暗爪刀",
    source: "力量掠夺者 · 黑影",
    description: "V 键释放 5 道暗影爪刀横向切割全场，玩家版伤害为 Boss 原版 21%，持续 4 秒，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_shadow.png"
  },
  {
    id: "dark_deity_pact",
    icon: "☩",
    name: "黑暗魔神契约",
    source: "黑暗魔神飞机",
    description: "V 键 3 秒内免疫所有伤害并释放追踪暗影弹幕，玩家版伤害为 Boss 原版 21%，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_dark_deity.png"
  },
  {
    id: "absolute_freeze",
    icon: "❄",
    name: "绝对零度权柄",
    source: "寒渊核心",
    description: "V 键冻结全部小兵、Boss 与敌方弹幕 5 秒，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_freeze.png"
  },
  {
    id: "pulsar_railgun",
    icon: "✸",
    name: "脉冲星轨道炮",
    source: "脉冲星要塞",
    description: "V 键释放 1.4 秒穿透激光贯穿全场，每帧约 10 伤害并减速穿过的敌机 0.6 秒，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_pulsar.png"
  },
  {
    id: "gravity_well",
    icon: "◍",
    name: "引力井风暴",
    source: "虚空坍缩体",
    description: "V 键在玩家位置生成 5 秒引力井，把全场敌机往中心拉并持续喷出 12 颗小爆弹，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_gravity.png"
  },
  {
    id: "photon_barrage",
    icon: "✺",
    name: "光子弹幕阵",
    source: "星河观测站",
    description: "V 键在 3.5 秒内 360° 高速射出 24 发穿透光弹，每发约 3 伤害，冷却 44 秒。",
    asset: "assets/effects/generated/boss_power_photon.png"
  }
];

export const BOSS_POWER_FX_KEYS: Record<BossPowerId, string> = {
  titan_meteor: "bossPowerFx_titan",
  mirror_copy: "bossPowerFx_mirror",
  usurper_lock: "bossPowerFx_usurper",
  shadow_rift_blade: "bossPowerFx_shadow",
  dark_deity_pact: "bossPowerFx_dark_deity",
  absolute_freeze: "bossPowerFx_freeze",
  pulsar_railgun: "bossPowerFx_pulsar",
  gravity_well: "bossPowerFx_gravity",
  photon_barrage: "bossPowerFx_photon"
};

export const BOSS_SKILL_FX: Record<string, { texture: string; row: number }> = {
  "titan:meteor": { texture: "bossSkillFx_titan", row: 0 },
  "titan:lane": { texture: "bossSkillFx_titan", row: 1 },
  "titan:fan": { texture: "bossSkillFx_titan", row: 2 },
  "titan:gravity": { texture: "bossSkillFx_titan", row: 3 },
  "titan:spiral": { texture: "bossSkillFx_titan", row: 4 },
  "titan:rage": { texture: "bossSkillFx_titan", row: 5 },
  "mirror:petal": { texture: "bossSkillFx_mirror", row: 0 },
  "mirror:lance": { texture: "bossSkillFx_mirror", row: 1 },
  "mirror:homing": { texture: "bossSkillFx_mirror", row: 2 },
  "mirror:copy_g": { texture: "bossSkillFx_mirror", row: 0 },
  "mirror:copy_1": { texture: "bossSkillFx_mirror", row: 1 },
  "mirror:copy_2": { texture: "bossSkillFx_mirror", row: 2 },
  "mirror:copy_3": { texture: "bossSkillFx_mirror", row: 0 },
  "usurper:grid": { texture: "bossSkillFx_usurper", row: 0 },
  "usurper:emp": { texture: "bossSkillFx_usurper", row: 1 },
  "usurper:lattice": { texture: "bossSkillFx_usurper", row: 2 },
  "usurper:drain": { texture: "bossSkillFx_usurper", row: 3 },
  "usurper:steal": { texture: "bossSkillFx_usurper", row: 4 },
  "shadow:claw": { texture: "bossSkillFx_shadow", row: 0 },
  "shadow:barrage": { texture: "bossSkillFx_shadow", row: 0 },
  "shadow:delayed": { texture: "bossSkillFx_shadow", row: 1 },
  "shadow:drain": { texture: "bossSkillFx_shadow", row: 2 },
  "shadow:portal": { texture: "bossSkillFx_shadow", row: 3 },
  "shadow:charge": { texture: "bossSkillFx_shadow", row: 4 },
  "shadow:cage": { texture: "bossSkillFx_shadow", row: 5 },
  "shadow:maw": { texture: "bossSkillFx_dark_deity", row: 5 },
  "dark_deity:barrage": { texture: "bossSkillFx_dark_deity", row: 0 },
  "dark_deity:storm": { texture: "bossSkillFx_dark_deity", row: 1 },
  "dark_deity:charge": { texture: "bossSkillFx_dark_deity", row: 2 },
  "dark_deity:drain": { texture: "bossSkillFx_dark_deity", row: 3 },
  "dark_deity:cage": { texture: "bossSkillFx_dark_deity", row: 4 },
  "dark_deity:maw": { texture: "bossSkillFx_dark_deity", row: 5 },
  "dark_deity:delayed": { texture: "bossSkillFx_shadow", row: 1 },
  "dark_deity:portal": { texture: "bossSkillFx_shadow", row: 3 },
  "dark_aircraft:firework": { texture: "bossSkillFx_dark_aircraft", row: 0 },
  "dark_aircraft:clone": { texture: "bossSkillFx_dark_aircraft", row: 1 },
  "dark_aircraft:missile": { texture: "bossSkillFx_dark_aircraft", row: 2 },
  "dark_aircraft:stealth": { texture: "bossSkillFx_dark_aircraft", row: 3 }
};

export const BOSS_POWER_COOLDOWN_MS = 44000;
// 原有玩家版权柄为 Boss 伤害的 50%；再次削弱 30% 后(0.5×0.7=35%)又整体下调为 21%。
export const BOSS_POWER_DAMAGE_SCALE = 0.21;
export const BOSS_POWER_FREEZE_MS = 5000;

// 每种 Boss 击破后授予的首领权柄(V 键释放,一直保留到本局结束)
export const BOSS_KIND_TO_POWER: Record<BossKind, BossPowerId> = {
  titan: "titan_meteor",
  mirror: "mirror_copy",
  usurper: "usurper_lock",
  shadow: "shadow_rift_blade",
  dark_deity: "dark_deity_pact"
};


export const DOCTRINE_EVOLUTIONS = [
  {
    id: "echo_clone",
    school: "通用",
    icon: "◫",
    name: "镜像僚机",
    description: (level: number) =>
      level === 0
        ? "复制当前战机作为僚机，体积、伤害、射速与机动均为本体 50%。"
        : `镜像僚机同步率提升，伤害与射速额外 +${(level + 1) * 4}%。`
  },
  {
    id: "lance_mastery",
    school: "力量",
    icon: "▲",
    name: "贯星长枪",
    description: (level: number) => `直线弹伤害 +${(level + 1) * 12}%，并获得额外贯穿。`
  },
  {
    id: "bloom_mastery",
    school: "敏捷",
    icon: "✺",
    name: "万花弹幕",
    description: (level: number) => `每轮花瓣弹额外 +${level + 2} 枚，并强化摆动幅度。`
  },
  {
    id: "aegis_mastery",
    school: "防御",
    icon: "⬡",
    name: "不灭壁垒",
    description: (level: number) => `最大生命 +${(level + 1) * 12}%，受击减伤继续提升。`
  },
  {
    id: "blood_mastery",
    school: "吸血",
    icon: "◉",
    name: "血潮回响",
    description: (level: number) => `累计命中后释放血潮冲击，等级 ${level + 1} 提高触发频率。`
  },
  {
    id: "devour_mastery",
    school: "吞噬",
    icon: "∞",
    name: "适者进化",
    description: (level: number) =>
      `每 12 次击杀获得 +${formatRoundedNumberForDisplay((level + 1) * 4 / 3)}% 本局伤害，总加成最高 45%。`
  }
];

// 支援协议削弱系数:并入通用强化池后,强度只比普通通用强化高一点点,
// 满级(Lv.5)时大致与流派专属强化持平。约为原数值的 0.62 倍。
export const AIR_SUPPORT_NERF = 0.62;

// 支援协议的分级数值:描述文本与实战效果共用同一份计算,避免两边写死后走偏
export const AIR_SUPPORT_VALUES = {
  // 贯穿轰炸:弹数与单枚伤害
  bombardmentCount: (level: number) => 2 + level,
  bombardmentDamage: (level: number) => (82 + level * 34 * ATTACK_BONUS_SCALE) * AIR_SUPPORT_NERF,
  // 引力航迹:持续毫秒与减速百分比
  stasisDuration: (level: number) => (5000 + level * 500) * AIR_SUPPORT_NERF,
  stasisSlowPercent: (level: number) => Math.round((65 + level * 3) * AIR_SUPPORT_NERF),
  // 相位护航:无敌毫秒
  escortDuration: (level: number) => (2400 + level * 300) * AIR_SUPPORT_NERF,
  // 维修纵队:回复最大生命占比
  repairRatio: (level: number) => (0.1 + level * 0.03) * AIR_SUPPORT_NERF,
  // 猎杀编队:小兵伤害与 Boss 核心伤害
  sweepDamage: (level: number) => (72 + level * 32 * ATTACK_BONUS_SCALE) * AIR_SUPPORT_NERF,
  sweepBossDamage: (level: number) => (260 + level * 110 * ATTACK_BONUS_SCALE) * AIR_SUPPORT_NERF
} as const;

export const AIR_SUPPORT_SKILLS: Array<{
  id: AirSupportSkillId;
  code: string;
  icon: string;
  name: string;
  color: string;
  colorHex: number;
  cooldown: number;
  description: (level: number) => string;
}> = [
  {
    id: "piercing_bombardment",
    code: "BOTTOM-UP / PENETRATE",
    icon: "⇈",
    name: "逆航贯穿轰炸",
    color: "#ffbd3e",
    colorHex: 0xffbd3e,
    cooldown: 10800,
    description: (level) =>
      `支援轰炸机自下而上穿越战场，投射 ${AIR_SUPPORT_VALUES.bombardmentCount(
        level
      )} 枚无限贯穿弹，单枚伤害 ${Math.round(AIR_SUPPORT_VALUES.bombardmentDamage(level))}。`
  },
  {
    id: "stasis_wake",
    code: "BOTTOM-UP / INTERDICTION",
    icon: "≋",
    name: "引力滞空航迹",
    color: "#9b7dff",
    colorHex: 0x9b7dff,
    cooldown: 16200,
    description: (level) =>
      `阻断机留下 ${formatRoundedNumberForDisplay(AIR_SUPPORT_VALUES.stasisDuration(level) / 1000)} 秒引力航迹，敌机推进速度降低 ${AIR_SUPPORT_VALUES.stasisSlowPercent(level)}%。`
  },
  {
    id: "phase_escort",
    code: "BOTTOM-UP / AEGIS",
    icon: "⬡",
    name: "相位无敌护航",
    color: "#43ff9a",
    colorHex: 0x43ff9a,
    cooldown: 20800,
    description: (level) =>
      `护航机掠过后获得 ${formatRoundedNumberForDisplay(AIR_SUPPORT_VALUES.escortDuration(level) / 1000)} 秒完全无敌，并清除近身敌弹。`
  },
  {
    id: "repair_convoy",
    code: "BOTTOM-UP / RECOVERY",
    icon: "✚",
    name: "纳米维修纵队",
    color: "#8dffb8",
    colorHex: 0x8dffb8,
    cooldown: 22600,
    description: (level) => `维修纵队恢复 ${Math.round(AIR_SUPPORT_VALUES.repairRatio(level) * 100)}% 最大生命，并释放一圈排斥脉冲。`
  },
  {
    id: "hunter_sweep",
    code: "BOTTOM-UP / EXECUTION",
    icon: "⌁",
    name: "猎杀编队逆袭",
    color: "#ff5a8a",
    colorHex: 0xff5a8a,
    cooldown: 14800,
    description: (level) =>
      `三机编队由下向上扫过，所有敌机受到 ${Math.round(
        AIR_SUPPORT_VALUES.sweepDamage(level)
      )} 伤害，Boss 核心受到 ${Math.round(AIR_SUPPORT_VALUES.sweepBossDamage(level))} 伤害。`
  }
];

export interface LevelConfig {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  duration: number;
  scoreTarget: number;
  danger: number;
  boss: boolean;
  accent: string;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    code: "L-01",
    name: "星港边境",
    subtitle: "适应巡航与基础拦截",
    duration: 54,
    scoreTarget: 3200,
    danger: 1,
    boss: false,
    accent: "#2df4ff"
  },
  {
    id: 2,
    code: "L-02",
    name: "离子风暴",
    subtitle: "高速敌群与瞄准炮艇",
    duration: 72,
    scoreTarget: 6500,
    danger: 2,
    boss: false,
    accent: "#57a6ff"
  },
  {
    id: 3,
    code: "L-03",
    name: "残骸迷阵",
    subtitle: "精英编队与密集火网",
    duration: 90,
    scoreTarget: 10500,
    danger: 3,
    boss: false,
    accent: "#9b5cff"
  },
  {
    id: 4,
    code: "L-04",
    name: "核心防线",
    subtitle: "高压混合波与泰坦前哨",
    duration: 108,
    scoreTarget: 16000,
    danger: 4,
    boss: true,
    accent: "#ff8b4d"
  },
  {
    id: 5,
    code: "L-05",
    name: "裂渊王座",
    subtitle: "最终决战 · 裂渊泰坦",
    duration: 48,
    scoreTarget: 22000,
    danger: 5,
    boss: true,
    accent: "#ff3dbb"
  }
];

export const ACHIEVEMENTS = [
  { id: "first_blood", icon: "✦", name: "初次击坠", detail: "首次击落敌机", category: "战斗" },
  { id: "score_10k", icon: "◇", name: "王牌飞行员", detail: "单局积分达到 10,000", category: "得分" },
  { id: "emp_master", icon: "◎", name: "寂静空域", detail: "使用 EMP 一次清除 20 枚敌弹", category: "技能" },
  { id: "boss_slayer", icon: "⬡", name: "泰坦终结者", detail: "首次击败裂渊泰坦", category: "战斗" },
  { id: "level_five", icon: "▲", name: "深入星渊", detail: "进入第五关", category: "探索" },
  { id: "coop_wing", icon: "∞", name: "双翼同盟", detail: "完成一局双人合作", category: "协作" },
  { id: "fell_short", icon: "✗", name: "残党反噬", detail: "终局残党阶段被小兵击毁", category: "终局" },
  { id: "after_storm", icon: "✺", name: "净化航线", detail: "击破终局残党 96 只，净化整条航线", category: "终局" },
  { id: "ending_shattered_vessel", icon: "⌁", name: "碎裂容器", detail: "摧毁核心后在残党围攻中阵亡", category: "结局" },
  { id: "ending_total_eclipse", icon: "●", name: "全然日蚀", detail: "摧毁核心后被侵蚀彻底吞没", category: "结局" },
  { id: "ending_willing_host", icon: "◉", name: "愿意的宿主", detail: "摧毁核心、清空残党并主动接纳黑暗", category: "结局" },
  { id: "ending_hollow_custody", icon: "□", name: "空洞看守", detail: "保留核心后在残党围攻中阵亡", category: "结局" },
  { id: "ending_perfect_vessel", icon: "◆", name: "完美躯壳", detail: "保留核心并清空残党，最终被核心占据", category: "结局" },
  { id: "boss_campaign_legend", icon: "♛", name: "九渊弑神", detail: "在九渊试炼模式完成全部九战序列", category: "传说" }
];

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "cannon",
    name: "脉冲机炮",
    icon: "⌁",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁双联脉冲机炮" : `火力同步提升，射速与伤害增强 · Lv.${level + 1}`,
    short: (level) => `主炮强化 · 伤害/射速 + · Lv.${level + 1}`
  },
  {
    id: "laser",
    name: "极光贯穿",
    icon: "↟",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁贯穿敌阵的极光光束" : `极光宽度与贯穿伤害提升 · Lv.${level + 1}`,
    short: (level) => `自动极光 · 贯穿伤害 + · Lv.${level + 1}`
  },
  {
    id: "missile",
    name: "追踪导弹",
    icon: "◈",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁自动锁定高威胁目标的导弹" : `导弹数量与爆炸伤害提升 · Lv.${level + 1}`,
    short: (level) => `自动导弹 · 数量/爆炸 + · Lv.${level + 1}`
  },
  {
    id: "drone",
    name: "护航无人机",
    icon: "◇",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "部署伴飞射击无人机" : `无人机数量与同步射速提升 · Lv.${level + 1}`,
    short: (level) => `伴飞无人机 · 数量/射速 + · Lv.${level + 1}`
  },
  {
    id: "arc",
    name: "电弧链",
    icon: "ϟ",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "自动释放可跳跃的电弧" : `电弧伤害、范围与跳跃数提升 · Lv.${level + 1}`,
    short: (level) => `自动电弧 · 跳跃/范围 + · Lv.${level + 1}`
  },
  {
    id: "blade",
    name: "旋刃力场",
    icon: "✣",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "生成环绕战机的近防旋刃" : `旋刃数量与近防伤害提升 · Lv.${level + 1}`,
    short: (level) => `环绕旋刃 · 近防伤害 + · Lv.${level + 1}`
  },
  {
    id: "ram_mass",
    name: "磁轨破城撞角",
    icon: "◆",
    kind: "weapon",
    description: (level) => `撞击与破阵冲刺伤害 +${(level + 1) * 18}%`,
    short: (level) => `撞击伤害 +${(level + 1) * 18}%`
  },
  {
    id: "ram_drive",
    name: "矢量冲锋引擎",
    icon: "»",
    kind: "passive",
    description: (level) => `移动速度 +${(level + 1) * 6}%，破阵冲刺冷却缩短 ${(level + 1) * 6}%`,
    short: (level) => `移速 +${(level + 1) * 6}% · 冲刺冷却 -${(level + 1) * 6}%`
  },
  {
    id: "ram_armor",
    name: "动能偏转装甲",
    icon: "⬢",
    kind: "passive",
    description: (level) => `最大生命 +10%，受到伤害额外降低 ${Math.min(25, (level + 1) * 5)}%`,
    short: (level) => `生命 +10% · 减伤 ${Math.min(25, (level + 1) * 5)}%`
  },
  {
    id: "ram_regen",
    name: "撞击再生核心",
    icon: "✚",
    kind: "passive",
    description: (level) =>
      `每 5 秒额外恢复 ${formatRoundedNumberForDisplay((level + 1) * 1.6)}% 最大生命`,
    short: (level) => `每 5 秒回复 ${formatRoundedNumberForDisplay((level + 1) * 1.6)}% 生命`
  },
  {
    id: "ram_salvage",
    name: "残骸吞噬器",
    icon: "∞",
    kind: "passive",
    description: (level) =>
      `撞毁小兵时最大生命 +2，残骸吞噬器当前额外 +${level}；撞杀回复 1.96% 额外生命值 + 2.49% 已损生命值`,
    short: () => `撞毁 +2 最大生命 · 撞杀回血`
  },
  {
    id: "ram_shockwave",
    name: "动能震荡波",
    icon: "◎",
    kind: "weapon",
    description: (level) =>
      `撞击时释放半径 ${145 + level * 18} 的冲击波，最多波及 ${2 + Math.min(3, level)} 个目标`,
    short: (level) => `撞击冲击波 · 半径 ${145 + level * 18}`
  },
  {
    id: "ram_magnet",
    name: "战场回收磁场",
    icon: "◎",
    kind: "passive",
    description: (level) => `代币、经验与临时能力拾取半径 +${(level + 1) * 22}%`,
    short: (level) => `拾取半径 +${(level + 1) * 22}%`
  },
  {
    id: "damage",
    name: "火控核心",
    icon: "△",
    kind: "passive",
    description: (level) =>
      `全部武器伤害 +${formatRoundedNumberForDisplay((level + 1) * 16 / 3)}%`,
    short: (level) => `全武器伤害 +${formatRoundedNumberForDisplay((level + 1) * 16 / 3)}%`
  },
  {
    id: "haste",
    name: "超频引擎",
    icon: "»",
    kind: "passive",
    description: (level) =>
      `全部武器射速 +${formatRoundedNumberForDisplay((level + 1) * 14 / 3)}%`,
    short: (level) => `全武器射速 +${formatRoundedNumberForDisplay((level + 1) * 14 / 3)}%`
  },
  {
    id: "speed",
    name: "相位推进器",
    icon: "⌃",
    kind: "passive",
    description: (level) => `移动速度 +${(level + 1) * 6}%`,
    short: (level) => `移速 +${(level + 1) * 6}%`
  },
  {
    id: "magnet",
    name: "能量磁环",
    icon: "◎",
    kind: "passive",
    description: (level) => `拾取半径 +${(level + 1) * 25}%`,
    short: (level) => `拾取半径 +${(level + 1) * 25}%`
  },
  {
    id: "armor",
    name: "纳米装甲",
    icon: "⬡",
    kind: "passive",
    description: (level) => `最大生命 +${(level + 1) * 12}% 并立即修复`,
    short: (level) => `最大生命 +${(level + 1) * 12}% 并修复`
  },
  {
    id: "luck",
    name: "幸运协议",
    icon: "✦",
    kind: "passive",
    description: (level) =>
      // 力量专精走 0.05×ATTACK_BONUS_SCALE 的暴击公式(约 3.33%/级),与 power 专精实际一致
      `暴击率 +${formatRoundedNumberForDisplay((level + 1) * 10 / 3)}%`,
    short: (level) => `暴击率 +${formatRoundedNumberForDisplay((level + 1) * 10 / 3)}%`
  },
  // === 通用强化(所有流派都能出) ===
  {
    id: "endurance",
    name: "耐久训练",
    icon: "⬡",
    kind: "passive",
    description: (level) =>
      `最大生命 +${(level + 1) * 8}%，受到伤害额外 -${(level + 1) * 2}%`,
    short: (level) => `生命 +${(level + 1) * 8}% · 减伤 -${(level + 1) * 2}%`
  },
  {
    id: "velocity",
    name: "战机超频",
    icon: "»",
    kind: "passive",
    description: (level) =>
      `移速 +${(level + 1) * 4}%，射速 +${(level + 1) * 4}%`,
    short: (level) => `移速 +${(level + 1) * 4}% · 射速 +${(level + 1) * 4}%`
  },
  {
    id: "overcharge",
    name: "过载电池",
    icon: "△",
    kind: "passive",
    description: (level) =>
      `全部伤害 +${formatRoundedNumberForDisplay((level + 1) * 6)}%，暴击 +${formatRoundedNumberForDisplay((level + 1) * 2)}%`,
    short: (level) => `伤害 +${formatRoundedNumberForDisplay((level + 1) * 6)}% · 暴击 +${formatRoundedNumberForDisplay((level + 1) * 2)}%`
  },
  {
    id: "magnetism",
    name: "磁吸增益",
    icon: "◎",
    kind: "passive",
    description: (level) =>
      `拾取半径 +${(level + 1) * 12}%，经验获取 +${(level + 1) * 6}%`,
    short: (level) => `拾取半径 +${(level + 1) * 12}% · 经验 +${(level + 1) * 6}%`
  },
  // === 力量流派专属 ===
  {
    id: "power_flamethrower",
    name: "龙息喷火",
    icon: "△",
    kind: "weapon",
    description: (level) => {
      const tier = Math.min(level, POWER_FLAME_LENGTHS.length - 1);
      return `G 键巨型龙息 · 长 ${POWER_FLAME_LENGTHS[tier]} × 末端宽 ${POWER_FLAME_WIDTHS[tier]} · 持续 ${POWER_FLAME_DURATIONS[tier]}ms · ${POWER_FLAME_DAMAGE[tier]} 伤害/帧 · 冷却 ${POWER_FLAME_COOLDOWNS[tier]}s · 火焰范围内焚毁敌方弹幕`;
    },
    short: (level) => `G 键龙息喷火 · 冷却 ${POWER_FLAME_COOLDOWNS[Math.min(level, POWER_FLAME_COOLDOWNS.length - 1)]}s · 焚毁弹幕`
  },
  // === 敏捷流派专属 ===
  {
    id: "agile_lunge",
    name: "影步突刺",
    icon: "»",
    kind: "weapon",
    description: (level) =>
      `G 键沿方向键指向突进 · 固定位移 ${Math.round(AGILE_LUNGE_REACHES[level] ?? AGILE_LUNGE_REACH)} · 耗时 ${AGILE_LUNGE_DURATION}ms · 扫掠宽度 ${AGILE_LUNGE_HIT_WIDTH[level] ?? AGILE_LUNGE_HIT_WIDTH[2]} · 途经敌人全部受击 · 移动期间无敌 · 每命中回复 2% 最大生命(最多 10%) · 冷却 ${[15, 12.5, 10][level] || 10}s · 技能击杀 +1 最大生命 + 回复 1%`,
    short: (level) => `G 键突刺 · 无敌位移 · 冷却 ${[15, 12.5, 10][level] || 10}s`
  },
  {
    id: "agile_shadow_clone",
    name: "影分身",
    icon: "∞",
    kind: "passive",
    description: (level) => {
      const tier = Math.min(level, AGILE_CLONE_MAX_COUNT - 1);
      const count = AGILE_CLONE_COUNTS[tier] ?? AGILE_CLONE_MAX_COUNT;
      const hpRatio = AGILE_CLONE_HP_RATIOS[tier] ?? 0.4;
      const damage = Math.round((AGILE_CLONE_DAMAGE_RATIOS[tier] ?? 1) * 100);
      const hpText = `本体最大生命 ${Math.round(hpRatio * 100)}%(动态跟随 · 万象影袭每级再 +${Math.round(
        AGILE_CLONE_FUSION_HP_BONUS * 100
      )}%)`;
      const bonusPct = ((0.001 + tier * (0.004 / (AGILE_CLONE_MAX_COUNT - 1))) * 2.1 * 100).toFixed(2);
      return `与本体同水平线并列作战 · ${count} 个分身(上限 ${AGILE_CLONE_MAX_COUNT} · 万象影袭等级同步提升) · ${hpText} · 继承本体 ${damage}% 攻击 · 与玩家同向射击(正上方) · 额外造成目标最大生命 ${bonusPct}% 伤害 · 每 ${
        AGILE_CLONE_INTERVALS[tier] ?? AGILE_CLONE_INTERVALS[AGILE_CLONE_MAX_COUNT - 1]
      }s 补充 1 个 · 技能击杀最大生命 +3(在场分身≥2 时 +2) · 回复 1.5% 最大 + 3% 已损生命`;
    },
    short: (level) => {
      const tier = Math.min(level, AGILE_CLONE_MAX_COUNT - 1);
      return `${AGILE_CLONE_COUNTS[tier] ?? AGILE_CLONE_MAX_COUNT} 个分身 · 与本体同向射击`;
    }
  },
  {
    id: "agile_shadow_lunge",
    name: "万象影袭",
    icon: "✦",
    kind: "weapon",
    description: (level) => {
      const nextLevel = level === 0 ? 2 : level + 1;
      return `影分身与影步突刺融合升级 · 自动补齐缺失的一半(Lv.1) · 首抽即 Lv.2 · 每级影分身数量 +1(上限 4) · 万象影袭等级同步提升影分身攻击/血量档位 · 释放期间本体与影分身全部无敌且为实体(只挡弹幕不受伤害,影分身至少扛 3 发) · 突刺路径清除敌方弹幕 · 本体扫掠与联动影分身命中各附加目标最大生命 5.6% 额外伤害(普通影分身不参与) · G 键突刺固定释放 4 个影分身同步突进(伤害×4),结束后消失并爆炸 · 范围与伤害随等级提升(联动伤害 +${Math.round(
        nextLevel * 220
      )}% · 范围满级为基础 1.9 倍) · 突刺冷却 -${formatRoundedNumberForDisplay(
        nextLevel * 0.75
      )}s · 技能击杀 +1 最大生命 + 回复 1%`;
    },
    short: (level) => `融合技 · 突刺+分身无敌 · 联动伤害 +${Math.round((level === 0 ? 2 : level + 1) * 220)}%`
  },
  // === 吞噬流派专属 ===
  {
    id: "devour_swallow",
    name: "深渊吞噬",
    icon: "▼",
    kind: "passive",
    description: (level) => {
      const tier = DEVOUR_SWALLOW_LEVELS[Math.min(level, DEVOUR_SWALLOW_LEVELS.length - 1)];
      return `碰撞吞噬阈值 ${tier.sizeThreshold} 倍 · 每只体型 +${formatRoundedNumberForDisplay(
        tier.sizeGain * 100
      )}%（本级体型上限为初始机体 ${formatRoundedNumberForDisplay(
        tier.maxSizeMultiplier * 100
      )}%）· 最大生命 +${tier.maxHealthGain} · 减伤 ${formatRoundedNumberForDisplay(
        (1 - tier.damageTakenMultiplier) * 100
      )}% · 回复额外生命 1% + 已损生命 2% + 目标最大生命 4% · 越级吞噬仍会引爆并折损 50% 额外生命`;
    },
    short: (level) => {
      const tier = DEVOUR_SWALLOW_LEVELS[Math.min(level, DEVOUR_SWALLOW_LEVELS.length - 1)];
      return `吞噬减伤 ${formatRoundedNumberForDisplay((1 - tier.damageTakenMultiplier) * 100)}% · 生命 +${tier.maxHealthGain} · 回血`;
    }
  },
  // === 防御流派专属 ===
  {
    id: "defender_thorns",
    name: "荆棘护甲",
    icon: "◈",
    kind: "passive",
    description: () =>
      `反伤:敌人受到玩家实收伤害 3 倍 + 敌人自身最大生命 1.5% · 玩家回复本次反伤的 50% · 累计反伤到 1000 点触发荆棘共鸣`,
    short: () => `荆棘反伤 · 3 倍返还 + 回血`
  },
  // === 吸血流派专属 ===
  {
    id: "vampire_siphon",
    name: "虹吸链",
    icon: "⌇",
    kind: "passive",
    description: () =>
      `子弹命中生成暗红虹吸链(最多 8 条,每个单位最多 1 条) · 链子持续 8s 并可连接 Boss · 每 0.3s 回复 1.2% 已损生命 · 满级额外造成目标自身最大生命 1% 伤害`,
    short: () => `命中生成虹吸链 · 持续吸血`
  },
  // === 融合技(全模式通用:主能力 4 级 + 搭配能力 2 级出池,改变攻击形态) ===
  {
    id: "power_fusion",
    name: "金龙炼狱",
    icon: "龍",
    kind: "weapon",
    description: (level) =>
      `龙息喷火进化为金色炼狱 · 龙息可暴击且伤害 +${35 + level * 15}% · 喷口每 0.22s 射出金龙火弹(自动追踪,命中爆炸并吃暴击) · 焚毁敌方弹幕范围扩大 · 冷却 -${level}s`,
    short: (level) => `金龙龙息可暴击 · 金龙火弹追踪 +${35 + level * 15}%`
  },
  {
    id: "defender_fusion",
    name: "荆棘星垒",
    icon: "✦",
    kind: "passive",
    description: (level) =>
      `荆棘护甲进化为星垒 · 反伤提高 ${50 + level * 15}% · 每累计 400 点反伤触发星垒 2.5s:荆棘旋刃环绕,期间受击反伤 AOE(周围 220px 敌人每帧受最大生命 ${2 + level * 0.5}% 伤害) · 荆棘共鸣阈值减半`,
    short: (level) => `荆棘星垒 AOE · 反伤 +${50 + level * 15}%`
  },
  {
    id: "vampire_fusion",
    name: "血星网络",
    icon: "✱",
    kind: "passive",
    description: (level) =>
      `虹吸链进化为血星网络 · 链子吸血提高 50% · 每 0.5s 链头向最近 2 个敌人分支电弧(每支造成目标最大生命 ${1.5 + level * 0.5}% 伤害并吸血 50%) · 最多 8 条链共享网络`,
    short: () => `血星网络电弧分支 · 吸血 +50%`
  },
  {
    id: "devour_fusion",
    name: "星渊巨口",
    icon: "◉",
    kind: "passive",
    description: (level) =>
      `深渊吞噬进化为星渊巨口 · 吞噬触发星渊巨口 2.5s:黑洞吸附 320px 内敌人并每帧造成最大生命 ${1.5 + level * 0.5}% 伤害 · 吸入的小兵直接吞噬(体型+回血) · 吞噬范围 +25%`,
    short: (level) => `星渊巨口黑洞吸附 · 每帧 ${1.5 + level * 0.5}% 最大生命`
  },
  {
    id: "wheelchair_fusion",
    name: "天体碰撞",
    icon: "☄",
    kind: "weapon",
    description: (level) =>
      `震击波融合堡垒姿态进化 · 3 键「堡垒姿态」变为「天体碰撞」:1.4s 蓄力后全屏天体坠落,所有敌人受最大生命 ${45 + level * 8}% + ${400 + level * 200} 伤害,玩家 2s 无敌 · 每 ${18 - level}s 一次`,
    short: (level) => `天体碰撞全屏震击 · 蓄力后 ${45 + level * 8}% 最大生命`
  },
  // === 逆航支援协议(原 Boss 击破掉落的强化,削弱后并入通用池,全流派可选) ===
  ...AIR_SUPPORT_SKILLS.map((skill) => ({
    id: skill.id,
    name: skill.name,
    icon: skill.icon,
    kind: "support" as const,
    description: (level: number) =>
      `${skill.description(level)} 冷却 ${formatRoundedNumberForDisplay(
        skill.cooldown / 1000
      )}s，自动释放。`,
    short: () => `${skill.name} · 自动释放 · 冷却 ${formatRoundedNumberForDisplay(skill.cooldown / 1000)}s`
  }))
];
