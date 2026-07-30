import Phaser from "phaser";
import "./styles.css";
import {
  DEFAULT_SAVE,
  dailyLoginOffer,
  type GameMode,
  localDayIndex,
  type PlayVariantId,
  type SaveData,
  type SkinId,
  type ShipId,
  type SpecializationId,
  SPECIALIZATION_BASE_STAT_BOOST,
  boostedSpecializationReduction,
  boostedSpecializationStat,
  chooseUnique,
  collisionBossDamageScale,
  collisionHullAttackMultiplier,
  agileCritEffectSpeedMultiplier,
  agileCritRateAttackBonus,
  formatRoundedNumber,
  formatTime,
  loadSave,
  minionHealthDamageMultiplier,
  minionPercentDamageFloor,
  roundHealth,
  rewardForRun,
  xpToNextLevel
} from "./game-logic";
import {
  BOSS_CAMPAIGN_ENCOUNTERS,
  campaignDifficultyForLevel,
  campaignEnemyRoster,
  chaseRemainingHpRatio,
  remainingStoreUnlockCost,
  rollCampaignElite,
  rollCampaignMutation,
  type CampaignBossKind
} from "./boss-campaign";

const WORLD_WIDTH = 1080;
const WORLD_HEIGHT = 1280;
const ATTACK_BONUS_SCALE = 2 / 3;
const SAVE_KEY = "starfall_save_v1";
const PERFORMANCE_MIGRATION_KEY = "starfall_performance_v051";
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";

type UpgradeKind = "weapon" | "passive";

interface UpgradeDefinition {
  id: string;
  name: string;
  icon: string;
  kind: UpgradeKind;
  description: (level: number) => string;
}

interface RunResult {
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
}

const SHIPS: Record<
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
    speed: 420,
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
    damage: 1.28,
    passive: "爆燃弹头：导弹和清屏伤害提高 30%",
    asset: "fighter_bomber"
  },
  lightning: {
    name: "闪电战机",
    tag: "高速机动",
    description: "极高移动速度与短技能冷却，适合擦弹和极限走位。",
    hp: 78,
    speed: 520,
    damage: 0.92,
    passive: "闪电协议：主动技能冷却缩短 18%",
    asset: "fighter_lightning"
  },
  guardian: {
    name: "守护战机",
    tag: "防御生存",
    description: "厚重护甲和更高生命值，适合稳健推进与双人保护。",
    hp: 155,
    speed: 360,
    damage: 0.88,
    passive: "复合装甲：所受伤害降低 20%",
    asset: "fighter_guardian"
  }
};

const SPECIALIZATIONS: Record<
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
    description: "直线重火力与暴击成长。暴击处决可恢复舰体，并永久提高本局生命上限。",
    hp: 1,
    speed: 0.96,
    damage: 1.18,
    fireRate: 1,
    cooldown: 1,
    damageTaken: 1,
    explosionTaken: 1,
    scale: 1,
    trait: `初始暴击 ${formatRoundedNumber(
      10 * SPECIALIZATION_BASE_STAT_BOOST
    )}% / 效果 ${formatRoundedNumber(
      120 * SPECIALIZATION_BASE_STAT_BOOST
    )}% · 暴击击杀回血 ${formatRoundedNumber(
      5 * SPECIALIZATION_BASE_STAT_BOOST
    )}%`
  },
  agile: {
    name: "敏捷流派",
    code: "KALEIDOSCOPE",
    icon: "⌁",
    description: "发射分散摆动的花瓣弹幕，并周期性绽放环形弹雨。完全放弃暴击换取伤害与速度。",
    hp: 0.9,
    speed: 1.2,
    damage: 0.72,
    fireRate: 1.08,
    cooldown: 0.82,
    damageTaken: 1,
    explosionTaken: 1,
    scale: 0.94,
    trait: "暴击率 → 攻击力 · 暴击效果 → 移速 · 周期性万花弹环"
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
    trait: `击杀回复 ${formatRoundedNumber(
      2 * SPECIALIZATION_BASE_STAT_BOOST
    )}% 最大生命 · 爆炸减伤 ${formatRoundedNumber(
      (1 - boostedSpecializationReduction(0.5)) * 100
    )}%`
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
    trait: `每次命中回复 ${formatRoundedNumber(
      3 * SPECIALIZATION_BASE_STAT_BOOST
    )}% 已损生命 · 基础减伤同步强化`
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
    trait: `每次击杀：生命上限 +2% · 回复最大生命 ${formatRoundedNumber(
      1 * SPECIALIZATION_BASE_STAT_BOOST
    )}%`
  },
  wheelchair: {
    name: "撞击流派",
    code: "JUGGERNAUT",
    icon: "◉",
    description: "关闭基础机炮，以机体作为主武器。每新增 500 最大生命提升攻击；超过 1000 最大生命后，受到的 Boss 伤害降低四分之一。",
    hp: 1.12,
    speed: 0.82,
    damage: 1.2,
    fireRate: 0,
    cooldown: 1,
    damageTaken: 0.45,
    explosionTaken: 0.45,
    scale: 1.12,
    trait: `接触 300ms / Boss 325ms · 每新增 500 MAX HP 攻击 +20% · 每 5 秒回复 ${formatRoundedNumber(
      5 * SPECIALIZATION_BASE_STAT_BOOST
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

const SKINS: Record<
  SkinId,
  {
    name: string;
    code: string;
    description: string;
    cost: number;
    tint: number;
    cssFilter: string;
    accent: string;
  }
> = {
  standard: {
    name: "原型涂装",
    code: "ORIGIN",
    description: "机库标准出厂涂层。",
    cost: 0,
    tint: 0xffffff,
    cssFilter: "none",
    accent: "#2df4ff"
  },
  aurora: {
    name: "极光脉冲",
    code: "AURORA",
    description: "冰蓝离子镀层，在深空中留下极光尾迹。",
    cost: 180,
    tint: 0x6ffcff,
    cssFilter: "hue-rotate(8deg) saturate(1.35) brightness(1.12)",
    accent: "#63fff2"
  },
  inferno: {
    name: "熔核天火",
    code: "INFERNO",
    description: "高温橙红陶瓷装甲，像一枚撕裂夜空的火种。",
    cost: 300,
    tint: 0xff8a4f,
    cssFilter: "sepia(.5) saturate(2.2) hue-rotate(330deg) brightness(1.08)",
    accent: "#ff7a45"
  },
  void: {
    name: "虚空皇权",
    code: "VOID CROWN",
    description: "紫黑暗物质涂层，仅向真正的王牌开放。",
    cost: 520,
    tint: 0xb56cff,
    cssFilter: "hue-rotate(58deg) saturate(1.7) contrast(1.08)",
    accent: "#bd72ff"
  }
};

function specializationStats(shipId: ShipId, specializationId: SpecializationId): {
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

function totalPermanentLevels(): number {
  return Object.values(save.permanentUpgrades).reduce((sum, level) => sum + Math.max(0, level), 0);
}

function enemyUpgradeScale(): number {
  const playerUpgradeRatio =
    (save.permanentUpgrades.hull ?? 0) * 0.04 +
    (save.permanentUpgrades.firepower ?? 0) * 0.03 +
    (save.permanentUpgrades.engine ?? 0) * 0.025 +
    (save.permanentUpgrades.armor ?? 0) * 0.015;
  return 1 + playerUpgradeRatio * 0.2;
}

type PlayVariant = PlayVariantId;
type BossKind = CampaignBossKind;
type BossPowerId = "titan_meteor" | "mirror_copy" | "usurper_lock";
type EnemyMutation = "homing" | "mine_burst" | "armor" | "dash" | "suppress";
type EnemyDamageSource = "minion" | "boss";
type TemporarySkill = "overdrive" | "prism" | "singularity";
type AgileTrajectory = "fan" | "arc" | "helix" | "scatter" | "cross" | "circle";
type AirSupportSkillId =
  | "piercing_bombardment"
  | "stasis_wake"
  | "absolute_freeze"
  | "phase_escort"
  | "repair_convoy"
  | "hunter_sweep";
type EnemyType =
  | "scout"
  | "interceptor"
  | "striker"
  | "suppressor"
  | "mine_layer"
  | "gunship"
  | "bomber"
  | "courier";

const BOSS_NAMES: Record<BossKind, string> = {
  titan: "裂渊泰坦",
  mirror: "镜像猎手",
  usurper: "技能篡夺者",
  shadow: "力量掠夺者 · 黑影",
  dark_deity: "黑暗魔神飞机"
};

const BOSS_POWER_OPTIONS: Array<{
  id: BossPowerId;
  icon: string;
  name: string;
  source: string;
  description: string;
}> = [
  {
    id: "titan_meteor",
    icon: "☄",
    name: "裂渊陨星权柄",
    source: "裂渊泰坦",
    description: "G 键召唤持续 7 秒的逆向陨星轰炸，冷却 40 秒。"
  },
  {
    id: "mirror_copy",
    icon: "◫",
    name: "万象镜像权柄",
    source: "镜像猎手",
    description: "G 键复制当前支援与临时强化 7 秒，并生成两架镜像僚机，冷却 40 秒。"
  },
  {
    id: "usurper_lock",
    icon: "⌁",
    name: "权限篡夺权柄",
    source: "技能篡夺者",
    description: "G 键封锁全部敌机与 Boss 行动 7 秒，冷却 40 秒。"
  }
];

const DOCTRINE_EVOLUTIONS = [
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
      `每 12 次击杀获得 +${formatRoundedNumber((level + 1) * 4 / 3)}% 本局伤害，总加成最高 45%。`
  }
];

const AIR_SUPPORT_SKILLS: Array<{
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
      `支援轰炸机自下而上穿越战场，投射 ${3 + level} 枚无限贯穿弹，单枚伤害 ${
        Math.round(82 + level * 34 * ATTACK_BONUS_SCALE)
      }。`
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
      `阻断机留下 ${5 + level * 0.5} 秒引力航迹，敌机推进速度降低 ${65 + level * 3}%。`
  },
  {
    id: "absolute_freeze",
    code: "BOTTOM-UP / CRYO",
    icon: "❄",
    name: "绝对零度封锁",
    color: "#79f4ff",
    colorHex: 0x79f4ff,
    cooldown: 19800,
    description: (level) =>
      `低温支援机冻结全部敌机、Boss 与敌弹 ${formatRoundedNumber(3.2 + level * 0.35)} 秒。`
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
      `护航机掠过后获得 ${formatRoundedNumber(2.4 + level * 0.3)} 秒完全无敌，并清除近身敌弹。`
  },
  {
    id: "repair_convoy",
    code: "BOTTOM-UP / RECOVERY",
    icon: "✚",
    name: "纳米维修纵队",
    color: "#8dffb8",
    colorHex: 0x8dffb8,
    cooldown: 22600,
    description: (level) => `维修纵队恢复 ${10 + level * 3}% 最大生命，并释放一圈排斥脉冲。`
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
      `三机编队由下向上扫过，所有敌机受到 ${Math.round(72 + level * 32 * ATTACK_BONUS_SCALE)} 伤害，Boss 核心受到 ${
        Math.round(260 + level * 110 * ATTACK_BONUS_SCALE)
      } 伤害。`
  }
];

interface LevelConfig {
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

const LEVELS: LevelConfig[] = [
  {
    id: 1,
    code: "L-01",
    name: "星港边境",
    subtitle: "适应巡航与基础拦截",
    duration: 45,
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
    duration: 60,
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
    duration: 75,
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
    duration: 90,
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
    duration: 40,
    scoreTarget: 22000,
    danger: 5,
    boss: true,
    accent: "#ff3dbb"
  }
];

const ACHIEVEMENTS = [
  { id: "first_blood", icon: "✦", name: "初次击坠", detail: "首次击落敌机", category: "战斗" },
  { id: "score_10k", icon: "◇", name: "王牌飞行员", detail: "单局积分达到 10,000", category: "得分" },
  { id: "emp_master", icon: "◎", name: "寂静空域", detail: "使用 EMP 一次清除 20 枚敌弹", category: "技能" },
  { id: "boss_slayer", icon: "⬡", name: "泰坦终结者", detail: "首次击败裂渊泰坦", category: "战斗" },
  { id: "level_five", icon: "▲", name: "深入星渊", detail: "进入第五关", category: "探索" },
  { id: "coop_wing", icon: "∞", name: "双翼同盟", detail: "完成一局双人合作", category: "协作" }
];

const UPGRADES: UpgradeDefinition[] = [
  {
    id: "cannon",
    name: "脉冲机炮",
    icon: "⌁",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁双联脉冲机炮" : `火力同步提升，射速与伤害增强 · Lv.${level + 1}`
  },
  {
    id: "laser",
    name: "极光贯穿",
    icon: "↟",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁贯穿敌阵的极光光束" : `极光宽度与贯穿伤害提升 · Lv.${level + 1}`
  },
  {
    id: "missile",
    name: "追踪导弹",
    icon: "◈",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁自动锁定高威胁目标的导弹" : `导弹数量与爆炸伤害提升 · Lv.${level + 1}`
  },
  {
    id: "drone",
    name: "护航无人机",
    icon: "◇",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "部署伴飞射击无人机" : `无人机数量与同步射速提升 · Lv.${level + 1}`
  },
  {
    id: "arc",
    name: "电弧链",
    icon: "ϟ",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "自动释放可跳跃的电弧" : `电弧伤害、范围与跳跃数提升 · Lv.${level + 1}`
  },
  {
    id: "blade",
    name: "旋刃力场",
    icon: "✣",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "生成环绕战机的近防旋刃" : `旋刃数量与近防伤害提升 · Lv.${level + 1}`
  },
  {
    id: "ram_mass",
    name: "磁轨破城撞角",
    icon: "◆",
    kind: "weapon",
    description: (level) => `撞击与破阵冲刺伤害 +${(level + 1) * 18}%`
  },
  {
    id: "ram_drive",
    name: "矢量冲锋引擎",
    icon: "»",
    kind: "passive",
    description: (level) => `移动速度 +${(level + 1) * 6}%，破阵冲刺冷却缩短 ${(level + 1) * 6}%`
  },
  {
    id: "ram_armor",
    name: "动能偏转装甲",
    icon: "⬢",
    kind: "passive",
    description: (level) => `最大生命 +10%，受到伤害额外降低 ${Math.min(25, (level + 1) * 5)}%`
  },
  {
    id: "ram_regen",
    name: "撞击再生核心",
    icon: "✚",
    kind: "passive",
    description: (level) =>
      `每 5 秒额外恢复 ${formatRoundedNumber((level + 1) * 0.8)}% 最大生命`
  },
  {
    id: "ram_salvage",
    name: "残骸吞噬器",
    icon: "∞",
    kind: "passive",
    description: (level) =>
      `撞毁小兵时，额外回收其最大生命的 ${formatRoundedNumber((level + 1) * 0.75)}%`
  },
  {
    id: "ram_shockwave",
    name: "动能震荡波",
    icon: "◎",
    kind: "weapon",
    description: (level) =>
      `撞击时释放半径 ${145 + level * 18} 的冲击波，最多波及 ${2 + Math.min(3, level)} 个目标`
  },
  {
    id: "ram_magnet",
    name: "战场回收磁场",
    icon: "◎",
    kind: "passive",
    description: (level) => `代币、经验与临时能力拾取半径 +${(level + 1) * 22}%`
  },
  {
    id: "damage",
    name: "火控核心",
    icon: "△",
    kind: "passive",
    description: (level) =>
      `全部武器伤害 +${formatRoundedNumber((level + 1) * 16 / 3)}%`
  },
  {
    id: "haste",
    name: "超频引擎",
    icon: "»",
    kind: "passive",
    description: (level) =>
      `全部武器射速 +${formatRoundedNumber((level + 1) * 14 / 3)}%`
  },
  {
    id: "speed",
    name: "相位推进器",
    icon: "⌃",
    kind: "passive",
    description: (level) => `移动速度 +${(level + 1) * 6}%`
  },
  {
    id: "magnet",
    name: "能量磁环",
    icon: "◎",
    kind: "passive",
    description: (level) => `拾取半径 +${(level + 1) * 25}%`
  },
  {
    id: "armor",
    name: "纳米装甲",
    icon: "⬡",
    kind: "passive",
    description: (level) => `最大生命 +${(level + 1) * 12}% 并立即修复`
  },
  {
    id: "luck",
    name: "幸运协议",
    icon: "✦",
    kind: "passive",
    description: (level) =>
      `暴击率 +${formatRoundedNumber((level + 1) * 8 / 3)}%`
  }
];

let save: SaveData = loadSave(localStorage.getItem(SAVE_KEY));
if (localStorage.getItem(PERFORMANCE_MIGRATION_KEY) !== "1") {
  save.settings.quality = "low";
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  localStorage.setItem(PERFORMANCE_MIGRATION_KEY, "1");
}
let selectedMode: GameMode = save.lastMode;
let selectedLevel = save.lastLevel;
let playVariant: PlayVariant = save.lastVariant;
let selectedShip2: ShipId = save.lastShip2;
let game: Phaser.Game | null = null;
let activeScene: BattleScene | null = null;
let audioContext: AudioContext | null = null;
let toastTimer = 0;
let musicTimer = 0;
let musicStage = -1;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="app-shell">
    <div class="space-backdrop"></div>
    <header class="topbar">
      <div class="brand-mini">
        <div class="brand-mark"></div>
        <span>STARFALL // COMMAND</span>
      </div>
      <div class="resource-chip">
        <i class="resource-core"></i>
        <span id="core-count">0000</span>
      </div>
    </header>
    <section class="page-stage">
      <aside class="side-rail left">
        <div class="rail-label">Pilot profile</div>
        <div class="tech-card">
          <div class="stat-kicker">SELECTED FRAME</div>
          <div class="stat-value" id="rail-ship">曙光-7</div>
          <div class="stat-sub" id="rail-passive">连续作战：击杀后短暂提升火力</div>
        </div>
        <div class="tech-card">
          <div class="stat-kicker">CAMPAIGN RECORD</div>
          <div class="stat-value" id="rail-wins">00 WINS</div>
          <div class="stat-sub">裂隙防线处于最高级别战备状态。</div>
        </div>
      </aside>
      <section class="command-center">
        <div id="game-root"></div>
        <div id="ui-root"></div>
        <div id="overlay-root"></div>
        <div class="toast" id="toast"></div>
        ${DEBUG ? '<div class="debug-panel" id="debug-panel">DEBUG READY</div>' : ""}
      </section>
      <aside class="side-rail right">
        <div class="rail-label">Combat systems</div>
        <div class="tech-card feature-list">
          <div class="feature-row">
            <span class="feature-index">01</span>
            <div><div class="feature-name">Roguelite 构筑</div><div class="feature-copy">局内三选一 · 六大武器</div></div>
          </div>
          <div class="feature-row">
            <span class="feature-index">02</span>
            <div><div class="feature-name">三阶段巨型 Boss</div><div class="feature-copy">部位破坏 · 弹幕预警</div></div>
          </div>
          <div class="feature-row">
            <span class="feature-index">03</span>
            <div><div class="feature-name">无限作战协议</div><div class="feature-copy">深空航线 · 泰坦炼狱</div></div>
          </div>
        </div>
        <div class="tech-card">
          <div class="stat-kicker">ENDLESS RECORD</div>
          <div class="stat-value" id="rail-endless">00:00</div>
          <div class="stat-sub" id="rail-score">最高分 000000</div>
        </div>
      </aside>
    </section>
  </main>
`;

const uiRoot = document.querySelector<HTMLDivElement>("#ui-root")!;
const overlayRoot = document.querySelector<HTMLDivElement>("#overlay-root")!;

function persist(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  refreshRails();
}

function claimDailyLogin(): void {
  const today = localDayIndex();
  const offer = dailyLoginOffer(save.dailyLogin, today);
  if (!offer.available) {
    showToast("今日登录奖励已经领取");
    return;
  }
  save.dailyLogin.lastClaimDay = today;
  save.dailyLogin.streak = offer.streak;
  save.dailyLogin.totalClaims += 1;
  save.starCores += offer.reward;
  persist();
  sfx("upgrade");
  showMenu();
  showToast(`每日登录 · 第 ${offer.streak} 天 · ◆ +${offer.reward}`);
}

function refreshRails(): void {
  document.querySelector("#core-count")!.textContent = save.starCores.toString().padStart(4, "0");
  document.querySelector("#rail-ship")!.textContent = SHIPS[save.selectedShip].name;
  document.querySelector("#rail-passive")!.textContent = `${SPECIALIZATIONS[save.selectedSpecialization].name} · ${
    SHIPS[save.selectedShip].passive
  }`;
  document.querySelector("#rail-wins")!.textContent = `${save.records.campaignWins
    .toString()
    .padStart(2, "0")} WINS`;
  document.querySelector("#rail-endless")!.textContent = formatTime(save.records.endlessBestSeconds);
  document.querySelector("#rail-score")!.textContent = `最高分 ${save.records.endlessBestScore
    .toString()
    .padStart(6, "0")}`;
}

function showToast(message: string): void {
  const element = document.querySelector<HTMLDivElement>("#toast")!;
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove("show"), 1800);
}

function ensureAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
}

function sfx(kind: "click" | "shoot" | "hit" | "upgrade" | "hurt" | "boss" | "victory"): void {
  if (save.settings.sfxVolume <= 0) return;
  ensureAudio();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const frequencies = {
    click: [560, 720],
    shoot: [280, 180],
    hit: [150, 90],
    upgrade: [420, 980],
    hurt: [130, 55],
    boss: [80, 45],
    victory: [440, 880]
  } as const;
  oscillator.type = kind === "hurt" || kind === "boss" ? "sawtooth" : "square";
  oscillator.frequency.setValueAtTime(frequencies[kind][0], now);
  oscillator.frequency.exponentialRampToValueAtTime(frequencies[kind][1], now + 0.09);
  gain.gain.setValueAtTime(save.settings.sfxVolume * (kind === "shoot" ? 0.025 : 0.07), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "boss" ? 0.32 : 0.12));
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + (kind === "boss" ? 0.34 : 0.13));
}

function stopAdaptiveMusic(): void {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  musicStage = -1;
}

function setAdaptiveMusic(stage: number): void {
  if (stage === musicStage || save.settings.musicVolume <= 0) return;
  stopAdaptiveMusic();
  ensureAudio();
  musicStage = stage;
  const patterns = [
    [110, 164.8, 220],
    [123.5, 185, 246.9, 185],
    [146.8, 220, 293.7, 329.6],
    [82.4, 123.5, 164.8, 246.9, 329.6]
  ];
  let step = 0;
  const playNote = (): void => {
    if (!audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = stage >= 2 ? "sawtooth" : "triangle";
    oscillator.frequency.value = patterns[stage][step++ % patterns[stage].length];
    gain.gain.setValueAtTime(save.settings.musicVolume * 0.028, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (stage >= 2 ? 0.19 : 0.34));
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.38);
  };
  playNote();
  musicTimer = window.setInterval(playNote, [720, 560, 410, 260][stage]);
}

function shipMarkup(): string {
  return `
    <div class="css-ship" aria-hidden="true">
      <span class="wing left"></span><span class="wing right"></span>
      <span class="fuselage"></span><span class="core"></span>
      <span class="thruster one"></span><span class="thruster two"></span>
    </div>
  `;
}

function fighterPreview(shipId: ShipId, className = ""): string {
  const ship = SHIPS[shipId];
  const skin = SKINS[save.equippedSkin];
  return `
    <div class="fighter-preview ${className}" style="--skin-accent:${skin.accent}">
      <img src="/assets/fighters/${ship.asset}.png" alt="${ship.name}" style="filter:${skin.cssFilter}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
      <div class="fighter-fallback" style="display:none">${shipMarkup()}</div>
    </div>
  `;
}

function showMenu(): void {
  destroyGame();
  const dailyOffer = dailyLoginOffer(save.dailyLogin);
  document.querySelector(".app-shell")?.classList.remove("playing");
  overlayRoot.innerHTML = "";
  uiRoot.innerHTML = `
    <section class="screen home-screen" aria-label="主菜单">
      <div class="home-hero">
        <div class="menu-logo">
          <div class="eyebrow">STARGUARD // HIGH PERFORMANCE</div>
          <h1>星际守护者</h1>
          <span class="en">NEON ABYSS · READY</span>
        </div>
        <div class="ship-showcase">${fighterPreview(save.selectedShip, "hero-fighter")}</div>
      </div>
      <button class="primary-button home-start-button" id="start-button">开始游戏</button>
      <section class="daily-login-card ${dailyOffer.available ? "available" : "claimed"}">
        <div>
          <span>每日补给</span>
          <strong>${dailyOffer.available ? `第 ${dailyOffer.streak} 天 · ◆ ${dailyOffer.reward}` : "今日已领取"}</strong>
        </div>
        <button class="buy-button" id="daily-login-claim" ${
          dailyOffer.available ? "" : "disabled"
        }>${dailyOffer.available ? "领取" : "明日再来"}</button>
      </section>
      <div class="secondary-actions menu-actions">
        <button class="secondary-button" id="hangar-button">机库商店</button>
        <button class="secondary-button" id="medals-button">勋章展馆</button>
        <button class="secondary-button" id="settings-button">设置</button>
        <button class="secondary-button" id="about-button">关于</button>
      </div>
      <div class="menu-status">
        <span>无限纪录 ${save.records.endlessBestScore}</span>
        <span>已获勋章 ${Object.keys(save.achievements).length}/${ACHIEVEMENTS.length}</span>
        <span>星核币 ${save.starCores}</span>
      </div>
      <div class="version">SYSTEM ONLINE // v0.5.1 · PERFORMANCE BUILD</div>
    </section>
  `;
  document.querySelector("#start-button")!.addEventListener("click", () => {
    sfx("click");
    showPilotSelect();
  });
  document.querySelector("#daily-login-claim")?.addEventListener("click", claimDailyLogin);
  document.querySelector("#hangar-button")!.addEventListener("click", () => {
    sfx("click");
    showHangar();
  });
  document.querySelector("#settings-button")!.addEventListener("click", () => {
    sfx("click");
    showSettings();
  });
  document.querySelector("#medals-button")!.addEventListener("click", showMedalGallery);
  document.querySelector("#about-button")!.addEventListener("click", showAbout);
  refreshRails();
}

function screenHeader(kicker: string, title: string): string {
  return `
    <header class="screen-header">
      <div class="screen-title"><div class="eyebrow">${kicker}</div><h2>${title}</h2></div>
      <button class="icon-button back-button" aria-label="返回">←</button>
    </header>
  `;
}

function showPilotSelect(): void {
  const selectedStats = specializationStats(save.selectedShip, save.selectedSpecialization);
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("STEP 01 / FRAME & ROLE", "选择战机与专精")}
      <div class="pilot-flow-hint">先选择机体，再装载一种战斗流派。五种流派拥有完全不同的弹道、成长和生存机制。</div>
      <div class="pilot-select-grid">
        ${Object.entries(SHIPS)
          .map(
            ([id, ship]) => `
              <button class="pilot-card ${save.selectedShip === id ? "selected" : ""}" data-pilot="${id}">
                ${fighterPreview(id as ShipId)}
                <div class="pilot-copy">
                  <span class="mode-tag">${ship.tag}</span>
                  <h3>${ship.name}</h3>
                  <p>${ship.description}</p>
                  <div class="ship-stats">
                    <span>HP ${ship.hp}</span><span>SPD ${ship.speed}</span><span>ATK ${Math.round(
                      ship.damage * 100
                    )}</span>
                  </div>
                </div>
              </button>
            `
          )
          .join("")}
      </div>
      <div class="specialization-heading">
        <div><span>COMBAT DOCTRINE</span><strong>选择战斗流派</strong></div>
        <small>当前最终面板：HP ${selectedStats.hp} · SPD ${selectedStats.speed} · ATK ${selectedStats.damage}</small>
      </div>
      <div class="specialization-grid">
        ${Object.entries(SPECIALIZATIONS)
          .map(([id, specialization]) => {
            const stats = specializationStats(save.selectedShip, id as SpecializationId);
            return `
              <button class="specialization-card ${
                save.selectedSpecialization === id ? "selected" : ""
              }" data-specialization="${id}">
                <i>${specialization.icon}</i>
                <span>${specialization.code}</span>
                <h3>${specialization.name}</h3>
                <p>${specialization.description}</p>
                <em>${specialization.trait}</em>
                <div><b>HP ${stats.hp}</b><b>SPD ${stats.speed}</b><b>ATK ${stats.damage}</b></div>
              </button>
            `;
          })
          .join("")}
      </div>
      <button class="primary-button flow-next" id="pilot-next">确认战机 · 下一步</button>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
  document.querySelectorAll<HTMLButtonElement>("[data-pilot]").forEach((button) => {
    button.addEventListener("click", () => {
      save.selectedShip = button.dataset.pilot as ShipId;
      persist();
      showPilotSelect();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-specialization]").forEach((button) => {
    button.addEventListener("click", () => {
      save.selectedSpecialization = button.dataset.specialization as SpecializationId;
      persist();
      sfx("upgrade");
      showPilotSelect();
    });
  });
  document.querySelector("#pilot-next")!.addEventListener("click", showLevelSelect);
}

function showLevelSelect(): void {
  if (![3, 4, 5].includes(selectedLevel)) selectedLevel = 3;
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("STEP 02 / COMBAT PROTOCOL", "选择游戏模式")}
      <div class="variant-tabs">
        <button class="${playVariant === "single" ? "active" : ""}" data-variant="single">单人飞行</button>
        <button class="${playVariant === "coop" ? "active" : ""}" data-variant="coop">双人合作</button>
        <button class="${playVariant === "score_duel" ? "active" : ""}" data-variant="score_duel">双人竞分</button>
      </div>
      ${
        playVariant === "single"
          ? ""
          : `<div class="dual-config">P1 ${SHIPS[save.selectedShip].name} · WASD / Space / Q E　｜　P2
             <select id="ship-two">${Object.entries(SHIPS)
               .map(
                 ([id, ship]) =>
                   `<option value="${id}" ${selectedShip2 === id ? "selected" : ""}>${ship.name}</option>`
               )
               .join("")}</select> · 方向键 / Enter / J K L · 友军爆破开启</div>`
      }
      <div class="protocol-grid">
        <button class="protocol-card ${selectedMode === "campaign" ? "selected" : ""}" data-protocol="campaign">
          <span>PROTOCOL 01</span><i>◆</i>
          <h3>普通战役</h3>
          <p>清理敌群、击破两名阶段 Boss，最后挑战黑暗魔神。最终 Boss 被摧毁后本局结束。</p>
          <div><b>小怪推进</b><b>阶段首领</b><b>最终结算</b></div>
        </button>
        <button class="protocol-card ${selectedMode === "endless" ? "selected" : ""}" data-protocol="endless">
          <span>PROTOCOL 02</span><i>∞</i>
          <h3>深空无尽模式</h3>
          <p>小怪与 Boss 无限循环。每次击败 Boss 立即把本段代币存入仓库，并延长下一轮清兵时间。</p>
          <div><b>即时存币</b><b>清兵期递增</b><b>无限构筑</b></div>
        </button>
        <button class="protocol-card danger ${selectedMode === "boss" ? "selected" : ""}" data-protocol="boss">
          <span>PROTOCOL 03</span><i>⚠</i>
          <h3>无限 Boss 模式</h3>
          <p>没有小怪、没有清兵间隔。Boss 被击破后完成强化选择，下一名 Boss 立即跃迁。</p>
          <div><b>全是 BOSS</b><b>连续跃迁</b><b>强度递增</b></div>
        </button>
      </div>
      <div class="danger-select">
        <div><span>STARTING THREAT</span><strong>选择初始威胁等级</strong></div>
        ${[
          { id: 3, name: "普通", copy: "所有敌方单位均为普通形态" },
          { id: 4, name: "困难", copy: "约 50% 敌军与 Boss 变为精英" },
          { id: 5, name: "噩梦", copy: "全员精英，25% 概率追加突变能力" }
        ]
          .map(
            (item) => `
              <button class="${selectedLevel === item.id ? "selected" : ""}" data-level="${item.id}">
                <b>${"◆".repeat(item.id - 1)}</b><strong>${item.name}</strong><small>${item.copy}</small>
              </button>
            `
          )
          .join("")}
      </div>
      <div class="infinite-brief">
        <span>当前配置</span>
        <strong>${SPECIALIZATIONS[save.selectedSpecialization].name} · ${
          selectedMode === "campaign"
            ? "普通战役 · 三段首领航线"
            : selectedMode === "endless"
              ? "深空无尽模式 · 分段存币"
              : "无限 Boss 模式 · 纯首领"
        }</strong>
        <small>${
          selectedMode === "campaign"
            ? "打完最终 Boss 自动胜利结算。"
            : selectedMode === "endless"
              ? "每次 Boss 击破立即保存本段代币，死亡或退出也会保护尚未入库的代币。"
              : "本次飞行没有小怪，Boss 会无限重生并强化。"
        }</small>
      </div>
      <button class="primary-button flow-next" id="launch-level">${
        selectedMode === "campaign"
          ? "点火 · 开始普通战役"
          : selectedMode === "endless"
            ? "点火 · 进入无尽空域"
            : "点火 · 进入无限 Boss"
      }</button>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showPilotSelect);
  document.querySelectorAll<HTMLButtonElement>("[data-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      playVariant = button.dataset.variant as PlayVariant;
      save.lastVariant = playVariant;
      persist();
      showLevelSelect();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-protocol]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.protocol as GameMode;
      save.lastMode = selectedMode;
      persist();
      showLevelSelect();
    });
  });
  document.querySelector<HTMLSelectElement>("#ship-two")?.addEventListener("change", (event) => {
    selectedShip2 = (event.target as HTMLSelectElement).value as ShipId;
    save.lastShip2 = selectedShip2;
    persist();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLevel = Number(button.dataset.level);
      save.lastLevel = selectedLevel;
      persist();
      showLevelSelect();
    });
  });
  document.querySelector("#launch-level")!.addEventListener("click", () => {
    sfx("click");
    startRun();
  });
}

function showAbout(): void {
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("ABOUT / FLIGHT MANUAL", "关于与操作")}
      <div class="about-panel">
        <div class="about-logo">星际守护者 <small>v0.5.1</small></div>
        <p>三类空域协议：普通战役最终通关、无尽模式分段存币、无限 Boss 连续首领。</p>
        <div class="key-table">
          <div><kbd>WASD / 方向键</kbd><span>移动战机</span></div>
          <div><kbd>SPACE</kbd><span>按住持续开火</span></div>
          <div><kbd>1 / 2 / 3</kbd><span>激光、导弹、无人机技能（撞击流派禁用）</span></div>
          <div><kbd>Q</kbd><span>EMP 一键清屏</span></div>
          <div><kbd>E</kbd><span>星核超载；撞击流派为破阵冲刺</span></div>
          <div><kbd>G</kbd><span>撞击流派全速推进；获得权柄时释放首领能力</span></div>
          <div><kbd>F</kbd><span>相位闪避：位移并短暂无敌</span></div>
          <div><kbd>R</kbd><span>纳米修复：恢复 18% 最大生命</span></div>
          <div><kbd>X</kbd><span>一键自动投降</span></div>
          <div><kbd>ESC</kbd><span>暂停</span></div>
          <div><kbd>双人模式</kbd><span>双方子弹、导弹与 EMP 爆炸均可造成友军伤害</span></div>
        </div>
        <p class="asset-note">战机图片规范目录：<code>public/assets/fighters/</code>。PNG 缺失时自动使用矢量占位机体。</p>
      </div>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
}

function showMedalGallery(): void {
  const unlocked = ACHIEVEMENTS.filter((achievement) => save.achievements[achievement.id]);
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("ACHIEVEMENT ARCHIVE", "勋章展馆")}
      <div class="medal-summary"><strong>${unlocked.length}</strong><span>已获得 / ${ACHIEVEMENTS.length} 枚</span></div>
      <div class="medal-grid">
        ${ACHIEVEMENTS.map((achievement) => {
          const obtainedAt = save.achievements[achievement.id];
          return `
            <article class="medal-card ${obtainedAt ? "earned" : "locked"}">
              <div class="medal-icon">${achievement.icon}</div>
              <div><span>${achievement.category}</span><h3>${achievement.name}</h3><p>${achievement.detail}</p>
              <time>${obtainedAt ? new Date(obtainedAt).toLocaleString("zh-CN") : "尚未获得"}</time></div>
            </article>
          `;
        }).join("")}
      </div>
      <div class="timeline-title">荣誉时间轴</div>
      <div class="medal-timeline">
        ${
          unlocked.length
            ? unlocked
                .sort(
                  (a, b) =>
                    new Date(save.achievements[b.id]).getTime() -
                    new Date(save.achievements[a.id]).getTime()
                )
                .map(
                  (achievement) =>
                    `<div><time>${new Date(save.achievements[achievement.id]).toLocaleString(
                      "zh-CN"
                    )}</time><strong>${achievement.name}</strong></div>`
                )
                .join("")
            : "<p>完成战斗目标后，勋章会在这里留下获得时间。</p>"
        }
      </div>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
}

function showHangar(restoredScrollTop = 0): void {
  const permanentDefinitions = [
    { id: "hull", icon: "⬡", name: "舰体强化", effect: "初始最大生命 +4%/级", max: 12 },
    { id: "firepower", icon: "▲", name: "火力校准", effect: "全部武器伤害 +2%/级", max: 12 },
    { id: "engine", icon: "⌁", name: "引擎超频", effect: "基础移动速度 +2.5%/级", max: 10 },
    { id: "armor", icon: "◈", name: "相位装甲", effect: "受到伤害 -1.5%/级", max: 10 },
    { id: "recovery", icon: "◆", name: "代币回收", effect: "每局星核币收益 +4%/级", max: 8 },
    { id: "emergency", name: "紧急修复", effect: "首次濒危时自动修复", max: 5 },
    { id: "reroll", icon: "↻", name: "战术重构", effect: "每级额外获得 1 次重抽", max: 3 }
  ];
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("ARSENAL & COSMETICS", "机库商店")}
      <div class="store-balance">
        <div><span>AVAILABLE CURRENCY</span><strong>◆ ${save.starCores}</strong><small>击落敌机和 Boss 获得，难度越高奖励越多</small></div>
        <div><span>SYNC PRESSURE</span><strong>${Math.round((enemyUpgradeScale() - 1) * 100)}%</strong><small>敌人与 Boss 将继承永久加点收益的 20%</small></div>
        <div><span>UPGRADE POINTS</span><strong>${totalPermanentLevels()}</strong><small>所有能力均有等级上限，不会无限膨胀</small></div>
      </div>
      <div class="hangar-grid">
        ${Object.entries(SHIPS)
          .map(([id, ship]) => {
            return `
              <button class="ship-card ${save.selectedShip === id ? "selected" : ""}" data-ship="${id}">
                ${fighterPreview(id as ShipId, "hangar-fighter")}
                <span class="mode-tag">${ship.tag.toUpperCase()}</span>
                <h3>${ship.name}</h3>
                <p>${ship.description}</p>
                <div class="ship-stats"><span>HP ${ship.hp}</span><span>SPD ${ship.speed}</span><span>ATK ${Math.round(
                  ship.damage * 100
                )}</span></div>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="upgrade-shop">
        <div class="shop-title">初级战机 · 永久能力加点 <span>STAR COIN ${save.starCores}</span></div>
        ${permanentDefinitions
          .map((item) => {
            const level = save.permanentUpgrades[item.id] ?? 0;
            const cost = 40 + level * 28;
            const maxed = level >= item.max;
            return `
              <div class="shop-item">
                <i>${item.icon ?? "✦"}</i>
                <div><strong>${item.name} · Lv.${level}/${item.max}</strong><small>${item.effect}</small>
                  <span class="level-pips">${Array.from({ length: item.max }, (_, index) => `<b class="${index < level ? "on" : ""}"></b>`).join("")}</span>
                </div>
                <button class="buy-button" data-permanent="${item.id}" data-max="${item.max}" ${
                  maxed || save.starCores < cost ? "disabled" : ""
                }>${maxed ? "MAX" : `◆ ${cost}`}</button>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="skin-shop">
        <div class="shop-title">涂装市场 <span>已拥有 ${save.unlockedSkins.length}/${Object.keys(SKINS).length}</span></div>
        <div class="skin-grid">
          ${Object.entries(SKINS)
            .map(([id, skin]) => {
              const owned = save.unlockedSkins.includes(id as SkinId);
              const equipped = save.equippedSkin === id;
              return `
                <article class="skin-card ${equipped ? "equipped" : ""}" style="--skin-color:${skin.accent}">
                  <div class="skin-preview">
                    <img src="/assets/fighters/${SHIPS[save.selectedShip].asset}.png" alt="${skin.name}" style="filter:${skin.cssFilter}" />
                    <span>${skin.code}</span>
                  </div>
                  <h3>${skin.name}</h3>
                  <p>${skin.description}</p>
                  <button class="buy-button" data-skin="${id}" ${
                    !owned && save.starCores < skin.cost ? "disabled" : ""
                  }>${equipped ? "已装备" : owned ? "装备" : `◆ ${skin.cost}`}</button>
                </article>
              `;
            })
            .join("")}
        </div>
      </div>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
  document.querySelectorAll<HTMLButtonElement>("[data-ship]").forEach((button) => {
    button.addEventListener("click", () => {
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      const id = button.dataset.ship as ShipId;
      save.selectedShip = id;
      persist();
      sfx("upgrade");
      showToast(`已选择 ${SHIPS[id].name}`);
      showHangar(scrollTop);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-permanent]").forEach((button) => {
    button.addEventListener("click", () => {
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      const id = button.dataset.permanent!;
      const max = Number(button.dataset.max);
      const level = save.permanentUpgrades[id] ?? 0;
      const cost = 40 + level * 28;
      if (level >= max || save.starCores < cost) return;
      save.starCores -= cost;
      save.permanentUpgrades[id] = level + 1;
      persist();
      sfx("upgrade");
      showToast(`升级完成 · 敌方同步强化系数 ${Math.round((enemyUpgradeScale() - 1) * 100)}%`);
      showHangar(scrollTop);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-skin]").forEach((button) => {
    button.addEventListener("click", () => {
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      const id = button.dataset.skin as SkinId;
      const skin = SKINS[id];
      if (!save.unlockedSkins.includes(id)) {
        if (save.starCores < skin.cost) return;
        save.starCores -= skin.cost;
        save.unlockedSkins.push(id);
        showToast(`已购买涂装 · ${skin.name}`);
      } else {
        showToast(`已装备 · ${skin.name}`);
      }
      save.equippedSkin = id;
      persist();
      sfx("upgrade");
      showHangar(scrollTop);
    });
  });
  if (restoredScrollTop > 0) {
    requestAnimationFrame(() => {
      const screen = document.querySelector<HTMLElement>(".screen");
      if (screen) screen.scrollTop = restoredScrollTop;
    });
  }
}

function showSettings(): void {
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("SYSTEM PREFERENCES", "系统设置")}
      <div class="settings-list">
        <div class="setting-row">
          <label><span>音乐音量</span><span id="music-value">${Math.round(
            save.settings.musicVolume * 100
          )}%</span></label>
          <input id="music-volume" type="range" min="0" max="1" step="0.05" value="${
            save.settings.musicVolume
          }" />
        </div>
        <div class="setting-row">
          <label><span>音效音量</span><span id="sfx-value">${Math.round(
            save.settings.sfxVolume * 100
          )}%</span></label>
          <input id="sfx-volume" type="range" min="0" max="1" step="0.05" value="${
            save.settings.sfxVolume
          }" />
        </div>
        <div class="setting-row">
          <label><span>屏幕震动</span><input id="screen-shake" class="switch" type="checkbox" ${
            save.settings.screenShake ? "checked" : ""
          } /></label>
        </div>
        <div class="setting-row">
          <label><span>伤害数字</span><input id="damage-numbers" class="switch" type="checkbox" ${
            save.settings.damageNumbers ? "checked" : ""
          } /></label>
        </div>
        <div class="setting-row">
          <label><span>高性能模式</span><input id="quality" class="switch" type="checkbox" ${
            save.settings.quality === "low" ? "checked" : ""
          } /></label>
        </div>
        <button class="secondary-button" id="reset-save">重置本地进度</button>
      </div>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
  const music = document.querySelector<HTMLInputElement>("#music-volume")!;
  const effects = document.querySelector<HTMLInputElement>("#sfx-volume")!;
  music.addEventListener("input", () => {
    save.settings.musicVolume = Number(music.value);
    document.querySelector("#music-value")!.textContent = `${Math.round(Number(music.value) * 100)}%`;
    persist();
  });
  effects.addEventListener("input", () => {
    save.settings.sfxVolume = Number(effects.value);
    document.querySelector("#sfx-value")!.textContent = `${Math.round(Number(effects.value) * 100)}%`;
    persist();
  });
  document.querySelector<HTMLInputElement>("#screen-shake")!.addEventListener("change", (event) => {
    save.settings.screenShake = (event.target as HTMLInputElement).checked;
    persist();
  });
  document.querySelector<HTMLInputElement>("#damage-numbers")!.addEventListener("change", (event) => {
    save.settings.damageNumbers = (event.target as HTMLInputElement).checked;
    persist();
  });
  document.querySelector<HTMLInputElement>("#quality")!.addEventListener("change", (event) => {
    save.settings.quality = (event.target as HTMLInputElement).checked ? "low" : "high";
    persist();
  });
  document.querySelector("#reset-save")!.addEventListener("click", () => {
    if (confirm("确认重置全部解锁、纪录和设置？此操作无法撤销。")) {
      save = structuredClone(DEFAULT_SAVE);
      persist();
      showMenu();
      showToast("本地进度已重置");
    }
  });
}

function destroyGame(): void {
  activeScene?.archivePendingRun();
  activeScene = null;
  stopAdaptiveMusic();
  if (game) {
    game.destroy(true);
    game = null;
  }
  document.querySelector("#game-root")!.innerHTML = "";
}

function startRun(): void {
  ensureAudio();
  setAdaptiveMusic(0);
  save.lastMode = selectedMode;
  save.lastLevel = selectedLevel;
  save.lastVariant = playVariant;
  persist();
  document.querySelector(".app-shell")?.classList.add("playing");
  uiRoot.innerHTML = "";
  overlayRoot.innerHTML = "";
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    transparent: false,
    backgroundColor: "#030712",
    physics: {
      default: "arcade",
      arcade: { debug: false }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BattleScene],
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
      powerPreference: "high-performance"
    }
  };
  game = new Phaser.Game(config);
}

function showUpgrade(scene: BattleScene): void {
  scene.isModal = true;
  scene.physics.world.pause();
  const collisionUpgradeIds = new Set([
    "ram_mass",
    "ram_drive",
    "ram_armor",
    "ram_regen",
    "ram_salvage",
    "ram_shockwave",
    "ram_magnet",
    "laser",
    "missile",
    "arc",
    "blade"
  ]);
  const available = UPGRADES.filter(
    (upgrade) =>
      (scene.upgradeLevels[upgrade.id] ?? 0) < 5 &&
      (save.selectedSpecialization === "wheelchair"
        ? collisionUpgradeIds.has(upgrade.id)
        : !upgrade.id.startsWith("ram_"))
  );
  const draw = (): void => {
    const options = chooseUnique(available, 3);
    overlayRoot.innerHTML = `
      <div class="overlay">
        <div class="overlay-panel">
          <div class="eyebrow">TACTICAL UPLINK</div>
          <h2>选择战术升级</h2>
          <p>${
            save.selectedSpecialization === "wheelchair"
              ? `撞击专属强化与特殊武装 · 无机炮、无无人机子弹 · 当前等级 ${scene.level}`
              : `战斗已暂时冻结 · 当前等级 ${scene.level}`
          }</p>
          <div class="upgrade-grid">
            ${options
              .map((upgrade, index) => {
                const level = scene.upgradeLevels[upgrade.id] ?? 0;
                return `
                  <button class="upgrade-card" data-upgrade="${upgrade.id}">
                    <span class="upgrade-icon"><span>${upgrade.icon}</span></span>
                    <span class="upgrade-level">${level === 0 ? "NEW" : `LV.${level} → ${level + 1}`} · ${index + 1}</span>
                    <h3>${upgrade.name}</h3>
                    <p>${upgrade.description(level)}</p>
                  </button>
                `;
              })
              .join("")}
          </div>
          <div class="overlay-actions">
            <button class="secondary-button" id="reroll-upgrade" ${
              scene.rerolls <= 0 ? "disabled" : ""
            }>重抽 ×${scene.rerolls}</button>
            <button class="secondary-button" id="pause-build">查看构筑</button>
          </div>
        </div>
      </div>
    `;
    document.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach((button) => {
      button.addEventListener("click", () => {
        scene.applyUpgrade(button.dataset.upgrade!);
        overlayRoot.innerHTML = "";
        scene.isModal = false;
        scene.physics.world.resume();
        sfx("upgrade");
      });
    });
    document.querySelector("#reroll-upgrade")?.addEventListener("click", () => {
      if (scene.rerolls <= 0) return;
      scene.rerolls -= 1;
      sfx("click");
      draw();
    });
    document.querySelector("#pause-build")?.addEventListener("click", () => {
      showToast(scene.buildSummary());
    });
  };
  draw();
}

function showDoctrineEvolution(scene: BattleScene, onComplete: () => void): void {
  scene.isModal = true;
  scene.physics.world.pause();
  const available = DOCTRINE_EVOLUTIONS.filter(
    (evolution) =>
      (scene.doctrineLevels[evolution.id] ?? 0) < 5 &&
      (save.selectedSpecialization !== "wheelchair" ||
        !["echo_clone", "bloom_mastery"].includes(evolution.id))
  );
  if (available.length === 0) {
    scene.isModal = false;
    scene.physics.world.resume();
    scene.showBanner("所有流派能力均已达到 LV.5", 1100);
    onComplete();
    return;
  }
  const options = chooseUnique(available, Math.min(3, available.length));
  overlayRoot.innerHTML = `
    <div class="overlay doctrine-overlay">
      <div class="overlay-panel">
        <div class="eyebrow">CROSS-DOCTRINE EVOLUTION</div>
        <h2>首领核心已解析</h2>
        <p>任选一种流派能力。没有职业限制，每次首领战后都能进化。</p>
        <div class="upgrade-grid">
          ${options
            .map((evolution, index) => {
              const level = scene.doctrineLevels[evolution.id] ?? 0;
              return `
                <button class="upgrade-card doctrine-card" data-evolution="${evolution.id}">
                  <span class="upgrade-icon"><span>${evolution.icon}</span></span>
                  <span class="doctrine-school">${evolution.school}流派</span>
                  <span class="upgrade-level">${level === 0 ? "NEW" : `LV.${level} → ${level + 1}`} · ${index + 1}</span>
                  <h3>${evolution.name}</h3>
                  <p>${evolution.description(level)}</p>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="evolution-note">击破下一位首领后可再次选择，最高 LV.5</div>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>("[data-evolution]").forEach((button) => {
    button.addEventListener("click", () => {
      scene.applyDoctrineEvolution(button.dataset.evolution!);
      overlayRoot.innerHTML = "";
      scene.isModal = false;
      scene.physics.world.resume();
      sfx("upgrade");
      onComplete();
    });
  });
}

function showAirSupportSelection(scene: BattleScene, onComplete: () => void): void {
  scene.isModal = true;
  scene.physics.world.pause();
  const available = AIR_SUPPORT_SKILLS.filter(
    (skill) => (scene.airSupportLevels[skill.id] ?? 0) < 5
  );
  if (available.length === 0) {
    scene.isModal = false;
    scene.physics.world.resume();
    scene.showBanner("逆航支援协议已全部满级", 1100);
    onComplete();
    return;
  }
  const options = chooseUnique(available, Math.min(3, available.length));
  overlayRoot.innerHTML = `
    <div class="overlay air-support-overlay">
      <div class="overlay-panel air-support-panel">
        <div class="eyebrow">BOTTOM-UP AIR SUPPORT</div>
        <h2>逆航支援编队抵达</h2>
        <p>选择一种由屏幕下方向上掠过的俯视支援技能。获得后会在战斗中自动循环发动。</p>
        <div class="air-support-grid">
          ${options
            .map((skill, index) => {
              const level = scene.airSupportLevels[skill.id] ?? 0;
              return `
                <button
                  class="air-support-card"
                  data-air-support="${skill.id}"
                  style="--support-color:${skill.color}"
                >
                  <span class="support-code">${skill.code}</span>
                  <div class="support-flight-lane">
                    <i>${skill.icon}</i>
                    <span></span>
                  </div>
                  <span class="upgrade-level">${
                    level === 0 ? "NEW" : `LV.${level} → ${level + 1}`
                  } · ${index + 1}</span>
                  <h3>${skill.name}</h3>
                  <p>${skill.description(level)}</p>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="evolution-note">支援机始终从座舱后方进入战场 · 每项最高 LV.5</div>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>("[data-air-support]").forEach((button) => {
    button.addEventListener("click", () => {
      scene.applyAirSupportUpgrade(button.dataset.airSupport as AirSupportSkillId);
      overlayRoot.innerHTML = "";
      scene.isModal = false;
      scene.physics.world.resume();
      sfx("upgrade");
      onComplete();
    });
  });
}

function showDoctrineSequence(scene: BattleScene, count: number, onComplete: () => void): void {
  if (count <= 0) {
    onComplete();
    return;
  }
  showDoctrineEvolution(scene, () => {
    scene.showBanner(`连续强化 · 还可选择 ${count - 1} 次`, 760);
    showDoctrineSequence(scene, count - 1, onComplete);
  });
}

function showBossPowerSelection(scene: BattleScene, onComplete: () => void): void {
  scene.isModal = true;
  scene.physics.world.pause();
  overlayRoot.innerHTML = `
    <div class="overlay doctrine-overlay boss-power-overlay">
      <div class="overlay-panel">
        <div class="eyebrow">STOLEN AUTHORITY RECOVERED</div>
        <h2>选择一项首领权柄</h2>
        <p>三神共斗的核心已被解析。能力装备在 G 键，持续 7 秒，冷却 40 秒。</p>
        <div class="upgrade-grid">
          ${BOSS_POWER_OPTIONS.map(
            (power, index) => `
              <button class="upgrade-card doctrine-card boss-power-card" data-boss-power="${power.id}">
                <span class="upgrade-icon"><span>${power.icon}</span></span>
                <span class="doctrine-school">${power.source}</span>
                <span class="upgrade-level">G · ${index + 1}</span>
                <h3>${power.name}</h3>
                <p>${power.description}</p>
              </button>
            `
          ).join("")}
        </div>
        <div class="evolution-note">本局只能携带一种权柄 · 撞击流派同样可以使用</div>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>("[data-boss-power]").forEach((button) => {
    button.addEventListener("click", () => {
      scene.setBossPower(button.dataset.bossPower as BossPowerId);
      overlayRoot.innerHTML = "";
      scene.isModal = false;
      scene.physics.world.resume();
      sfx("upgrade");
      onComplete();
    });
  });
}

function showCampaignStory(
  scene: BattleScene,
  eyebrow: string,
  title: string,
  copy: string,
  action: string,
  onComplete: () => void
): void {
  scene.isModal = true;
  scene.physics.world.pause();
  overlayRoot.innerHTML = `
    <div class="overlay campaign-story-overlay">
      <div class="overlay-panel campaign-story-panel">
        <div class="eyebrow">${eyebrow}</div>
        <div class="campaign-story-sigil">◈</div>
        <h2>${title}</h2>
        <p>${copy}</p>
        <div class="campaign-progress-strip">
          ${BOSS_CAMPAIGN_ENCOUNTERS.map(
            (encounter, index) =>
              `<i class="${index < scene.campaignEncounterIndex ? "done" : index === scene.campaignEncounterIndex ? "active" : ""}" title="${encounter.title}">${index + 1}</i>`
          ).join("")}
        </div>
        <button class="primary-button" id="campaign-story-next">${action}</button>
      </div>
    </div>
  `;
  document.querySelector("#campaign-story-next")!.addEventListener("click", () => {
    overlayRoot.innerHTML = "";
    scene.isModal = false;
    scene.physics.world.resume();
    onComplete();
  });
}

function showPause(scene: BattleScene): void {
  if (scene.isModal || scene.ended) return;
  scene.isModal = true;
  scene.physics.world.pause();
  scene.scene.pause();
  overlayRoot.innerHTML = `
    <div class="overlay">
      <div class="overlay-panel">
        <div class="eyebrow">SYSTEM HOLD</div>
        <h2>作战暂停</h2>
        <p>${scene.buildSummary()}</p>
        <button class="primary-button" id="resume-run">继续作战</button>
        <div class="overlay-actions">
          <button class="secondary-button" id="restart-run">重新开始</button>
          <button class="secondary-button" id="quit-run">返回主菜单</button>
        </div>
      </div>
    </div>
  `;
  document.querySelector("#resume-run")!.addEventListener("click", () => {
    overlayRoot.innerHTML = "";
    scene.isModal = false;
    scene.scene.resume();
    scene.physics.world.resume();
    sfx("click");
  });
  document.querySelector("#restart-run")!.addEventListener("click", () => {
    destroyGame();
    startRun();
  });
  document.querySelector("#quit-run")!.addEventListener("click", showMenu);
}

function finishRun(result: RunResult): void {
  if (result.mode === "campaign" && result.victory) {
    save.records.campaignWins += 1;
    save.records.highestUnlockedLevel = Math.max(
      save.records.highestUnlockedLevel,
      Math.min(5, result.missionLevel + 1)
    );
  }
  if (result.mode === "endless") {
    save.records.endlessBestSeconds = Math.max(save.records.endlessBestSeconds, result.seconds);
    save.records.endlessBestScore = Math.max(save.records.endlessBestScore, result.score);
  }
  if (result.mode === "boss" && result.victory) {
    const milliseconds = Math.round(result.seconds * 1000);
    save.records.bossRushBestMs =
      save.records.bossRushBestMs === null
        ? milliseconds
        : Math.min(save.records.bossRushBestMs, milliseconds);
  }
  save.starCores += result.reward;
  if (playVariant === "coop" && result.victory) {
    if (!save.achievements.coop_wing) save.achievements.coop_wing = new Date().toISOString();
  }
  persist();
  sfx(result.victory ? "victory" : "hurt");
  overlayRoot.innerHTML = `
    <div class="overlay">
      <div class="overlay-panel">
        <div class="eyebrow">${
          result.victory
            ? result.mode === "campaign"
              ? "CAMPAIGN COMPLETE"
              : result.mode === "boss"
                ? "BOSS SEQUENCE ARCHIVED"
                : "MISSION COMPLETE"
            : "INFINITE FLIGHT ARCHIVED"
        }</div>
        <h2>${
          playVariant === "score_duel"
            ? result.score >= (result.score2 ?? 0)
              ? "P1 赢得空域"
              : "P2 赢得空域"
            : result.victory
              ? result.mode === "campaign"
                ? "普通战役完成"
                : result.mode === "boss"
                  ? "无限 Boss 序列已归档"
                  : `关卡 ${result.missionLevel} 完成`
              : "本次无限航迹已封存"
        }</h2>
        <p>${
          result.victory
            ? result.mode === "campaign"
              ? "阶段首领与最终黑暗魔神均已击破，本局获得的数据已经永久保存。"
              : result.mode === "boss"
                ? "本轮纯 Boss 战斗数据已回收到机库。"
                : "泰坦核心已被摧毁，航道暂时安全。"
            : "星核数据已回收，调整构筑后再次出击。"
        }</p>
        <div class="result-stats">
          <div class="result-stat"><span>SCORE</span><strong>${result.score}</strong></div>
          <div class="result-stat"><span>TIME</span><strong>${formatTime(result.seconds)}</strong></div>
          <div class="result-stat"><span>KILLS</span><strong>${result.kills}</strong></div>
          <div class="result-stat"><span>LEVEL</span><strong>LV.${result.level}</strong></div>
          <div class="result-stat"><span>游戏代币</span><strong>◆ +${result.reward}</strong></div>
          <div class="result-stat"><span>战斗掉落</span><strong>${result.combatTokens}</strong></div>
          <div class="result-stat"><span>击破泰坦</span><strong>${result.bosses}</strong></div>
          <div class="result-stat"><span>MODE</span><strong>${result.mode.toUpperCase()}</strong></div>
          ${
            playVariant === "single"
              ? ""
              : `<div class="result-stat"><span>P1 SCORE</span><strong>${result.score}</strong></div>
                 <div class="result-stat"><span>P2 SCORE</span><strong>${result.score2 ?? 0}</strong></div>`
          }
        </div>
        <button class="primary-button" id="again-run">${
          result.mode === "campaign" && result.victory && result.missionLevel < 5
            ? "提高威胁等级"
            : "再次出击"
        }</button>
        <div class="overlay-actions">
          <button class="secondary-button" id="result-hangar">机库</button>
          <button class="secondary-button" id="result-menu">主菜单</button>
        </div>
      </div>
    </div>
  `;
  document.querySelector("#again-run")!.addEventListener("click", () => {
    if (result.mode === "campaign" && result.victory && result.missionLevel < 5) {
      selectedLevel = result.missionLevel + 1;
      save.lastLevel = selectedLevel;
      persist();
    }
    destroyGame();
    startRun();
  });
  document.querySelector("#result-hangar")!.addEventListener("click", () => {
    destroyGame();
    overlayRoot.innerHTML = "";
    showHangar();
  });
  document.querySelector("#result-menu")!.addEventListener("click", showMenu);
}

class BattleScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Image;
  player2?: Phaser.Physics.Arcade.Image;
  enemies!: Phaser.Physics.Arcade.Group;
  playerBullets!: Phaser.Physics.Arcade.Group;
  enemyBullets!: Phaser.Physics.Arcade.Group;
  pickups!: Phaser.Physics.Arcade.Group;
  bossParts!: Phaser.Physics.Arcade.Group;
  engineTrails!: Phaser.GameObjects.Group;
  drones: Phaser.GameObjects.Image[] = [];
  blades: Phaser.GameObjects.Image[] = [];
  stars: Phaser.GameObjects.Image[] = [];
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  actionKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  upgradeLevels: Record<string, number> = { cannon: 1 };
  stats = {
    maxHp: 100,
    hp: 100,
    speed: 420,
    damageMultiplier: 1,
    cooldownMultiplier: 1,
    damageTakenMultiplier: 1,
    explosionTakenMultiplier: 1,
    fireRateMultiplier: 1,
    pickupRadius: 90 * SPECIALIZATION_BASE_STAT_BOOST,
    critChance: 0.05
  };
  elapsedSeconds = 0;
  level = 1;
  xp = 0;
  xpNeeded = xpToNextLevel(1);
  score = 0;
  score2 = 0;
  runTokens = 0;
  player2Hp = 100;
  player2MaxHp = 100;
  kills = 0;
  combo = 0;
  comboTimer = 0;
  ultimate = 0;
  ultimateActive = 0;
  invulnerableUntil = 0;
  player2FriendlyInvulnerableUntil = 0;
  shieldReadyAt = 0;
  emergencyUsed = false;
  rerolls = 1;
  isModal = false;
  ended = false;
  bossActive = false;
  bossHp = 0;
  bossMaxHp = 18000;
  bossPhase = 0;
  bossTier = 0;
  bossKind: BossKind = "titan";
  bossElite = false;
  bossMutated = false;
  bossMutationKind: BossKind | null = null;
  bossEliteAura?: Phaser.GameObjects.Arc;
  bossAttackIndex = -1;
  skillsConfiscated = false;
  skillsConfiscatedUntil = 0;
  nextBossAttack = 0;
  nextBossScore = 5000;
  nextSpawn = 0;
  nextFlightToken = 0;
  nextSkillPickup = 0;
  nextShot = 0;
  nextLaser = 0;
  nextMissile = 0;
  nextDroneShot = 0;
  nextArc = 0;
  nextBladeDamage = 0;
  nextTaunt = 2600;
  nextTrail = 0;
  levelCompleteTriggered = false;
  playerWasHit = false;
  skillReadyAt: Record<string, number> = { laser: 0, missile: 0, drone: 0, emp: 0 };
  campaignBossAt = 360;
  lastEndlessBoss = 0;
  dragActive = false;
  targetX = WORLD_WIDTH / 2;
  targetY = WORLD_HEIGHT - 180;
  agileBulletAccumulator = 0;
  agileMaxHpGainAccumulator = 0;
  nextAgileBloom = 0;
  agileVolleyIndex = 0;
  wheelchairInitialMaxHp = 0;
  nextWheelchairHeal = 0;
  wheelchairOverdriveUntil = 0;
  nextRamShockwave = 0;
  bossPower: BossPowerId | null = null;
  bossPowerActiveUntil = 0;
  bossPowerReadyAt = 0;
  bossPowerClones: Phaser.GameObjects.Image[] = [];
  nextBossPowerPulse = 0;
  campaignEncounterIndex = 0;
  campaignBossesDefeated = 0;
  campaignInterludeActive = false;
  campaignInterludeKills = 0;
  campaignInterludeTarget = 0;
  trinityAlive = 0;
  trinityDefeatedKinds: BossKind[] = [];
  nextTrinityAttack = 0;
  nextUsurperDisableAt = 0;
  darkHealLockUntil = 0;
  darkHealingScale = 1;
  darkDotRemaining = 0;
  darkDotPerSecond = 0;
  darkDotUntil = 0;
  nextDarkDotTick = 0;
  darkStormUntil = 0;
  nextDarkStormTick = 0;
  strippedAbilities: string[] = [];
  finalBossBorrowedPower: string | null = null;
  shadowRuptureTriggered = false;
  bossKilledByCollision = false;
  wideArenaBackdrop?: Phaser.GameObjects.Rectangle;
  lastBossHazardDamageAt = -10000;
  temporarySkill: TemporarySkill | null = null;
  temporarySkillUntil = 0;
  nextTemporaryPattern = 0;
  doctrineLevels: Record<string, number> = {};
  airSupportLevels: Partial<Record<AirSupportSkillId, number>> = {};
  nextAirSupportAt: Partial<Record<AirSupportSkillId, number>> = {};
  enemySlowUntil = 0;
  enemyFreezeUntil = 0;
  wingClones: Phaser.Physics.Arcade.Image[] = [];
  nextCloneShot = 0;
  bloodHitCounter = 0;
  collisionReadyAt = 0;
  player2CollisionReadyAt = 0;
  targetReticle?: Phaser.GameObjects.Container;
  horizonGlow?: Phaser.GameObjects.Graphics;
  hud!: {
    graphics: Phaser.GameObjects.Graphics;
    hp: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
    time: Phaser.GameObjects.Text;
    level: Phaser.GameObjects.Text;
    combo: Phaser.GameObjects.Text;
    bossName: Phaser.GameObjects.Text;
  };

  constructor() {
    super("battle");
  }

  preload(): void {
    Object.values(SHIPS).forEach((ship) => {
      this.load.image(ship.asset, `/assets/fighters/${ship.asset}.png`);
    });
    this.load.image("bossTitan", "/assets/enemies/boss_titan.png");
    this.load.image("bossUsurper", "/assets/enemies/boss_usurper.png");
    this.load.image("bossShadow", "/assets/enemies/boss_shadow.png");
    this.load.image("bossDarkDeity", "/assets/enemies/boss_dark_deity.png");
    this.load.image("enemyScoutArt", "/assets/enemies/enemy_scout.png");
    this.load.image("enemyInterceptorArt", "/assets/enemies/enemy_interceptor.png");
    this.load.image("enemyStrikerArt", "/assets/enemies/enemy_striker.png");
    this.load.image("enemySuppressorArt", "/assets/enemies/enemy_suppressor.png");
    this.load.image("enemyMineLayerArt", "/assets/enemies/enemy_mine_layer.png");
    this.load.image("enemyGunshipArt", "/assets/enemies/enemy_gunship.png");
    this.load.image("enemyEliteArt", "/assets/enemies/enemy_elite_gunship.png");
    this.load.image("enemyBomberArt", "/assets/enemies/enemy_bomber.png");
    this.load.image("enemyCourierArt", "/assets/enemies/enemy_courier.png");
    this.load.image("enemyEliteScoutArt", "/assets/enemies/enemy_elite_scout.png");
    this.load.image("enemyEliteInterceptorArt", "/assets/enemies/enemy_elite_interceptor.png");
    this.load.image("enemyEliteStrikerArt", "/assets/enemies/enemy_elite_striker.png");
    this.load.image("enemyEliteSuppressorArt", "/assets/enemies/enemy_elite_suppressor.png");
    this.load.image("enemyEliteMineLayerArt", "/assets/enemies/enemy_elite_mine_layer.png");
    this.load.image("enemyEliteBomberArt", "/assets/enemies/enemy_elite_bomber.png");
    this.load.image("enemyEliteCourierArt", "/assets/enemies/enemy_elite_courier.png");
    this.load.image("starCoreTokenArt", "/assets/pickups/star_core_token.png");
  }

  create(): void {
    activeScene = this;
    this.createTextures();
    this.createBackdrop();
    this.enemies = this.physics.add.group();
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.bossParts = this.physics.add.group();
    this.engineTrails = this.add.group({
      classType: Phaser.GameObjects.Image,
      maxSize: 32
    });
    this.createPlayer();
    this.createHud();
    this.setupCollisions();
    this.setupInput();
    this.cameras.main.fadeIn(450, 3, 7, 18);
    if (DEBUG) {
      (
        window as unknown as {
          __starfallDebug: {
            snapshot: () => Record<string, unknown>;
            ramEnemy: (type: string) => void;
            spawnEnemyType: (type: string) => void;
            forceBoss: () => void;
            forceBossKind: (kind: BossKind) => void;
            forceCampaignFinal: () => void;
            grantEvolution: (id: string) => void;
            setMaxHp: (value: number) => void;
            setHp: (value: number) => void;
            gainMaxHp: (value: number) => void;
            hitPlayer: (amount: number, source?: EnemyDamageSource) => void;
            defeatBoss: () => void;
            primeRamKill: () => void;
            ramKillEnemyWithMaxHp: (maxHp: number) => void;
            criticalExecute: () => void;
            eliteExecute: () => void;
            grantTemporarySkill: (skill: TemporarySkill) => void;
            clearTemporarySkill: () => void;
            grantUpgrade: (id: string) => void;
            ramBoss: () => void;
            grantAirSupport: (skill: AirSupportSkillId) => void;
            triggerAirSupport: (skill: AirSupportSkillId) => void;
            forceWheelchairRecovery: () => void;
            setCampaignEncounter: (index: number) => void;
            damageBossRatio: (ratio: number) => void;
            collisionFinishBoss: () => void;
            grantBossPower: (power: BossPowerId) => void;
            completeInterlude: () => void;
            setRunTokens: (value: number) => void;
            bankTokens: () => number;
            spawnFlightToken: () => void;
            spawnExperiencePickup: () => void;
            triggerSkill: (kind: "laser" | "missile" | "drone", owner: 1 | 2) => void;
            friendlyExplode: (target: 1 | 2, amount: number) => void;
          };
        }
      ).__starfallDebug = {
        snapshot: () => ({
          bullets: this.playerBullets.countActive(true),
          enemyBullets: this.enemyBullets.countActive(true),
          enemies: this.enemies.countActive(true),
          score: this.score,
          score2: this.score2,
          level: selectedLevel,
          variant: playVariant,
          mode: selectedMode,
          bossActive: this.bossActive,
          bossTier: this.bossTier,
          bossKind: this.bossKind,
          bossElite: this.bossElite,
          bossMutated: this.bossMutated,
          bossMutationKind: this.bossMutationKind,
          bossHp: this.bossHp,
          bossMaxHp: this.bossMaxHp,
          skillsConfiscated: this.skillsConfiscated,
          skillsConfiscatedRemaining: Math.max(0, this.skillsConfiscatedUntil - this.time.now),
          campaignEncounterIndex: this.campaignEncounterIndex,
          campaignEncounterKind:
            BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]?.kind ?? "endless",
          campaignBossesDefeated: this.campaignBossesDefeated,
          campaignInterludeActive: this.campaignInterludeActive,
          campaignInterludeKills: this.campaignInterludeKills,
          campaignInterludeTarget: this.campaignInterludeTarget,
          trinityAlive: this.trinityAlive,
          bossPower: this.bossPower,
          bossPowerActiveRemaining: Math.max(0, this.bossPowerActiveUntil - this.time.now),
          bossPowerCooldownRemaining: Math.max(0, this.bossPowerReadyAt - this.time.now),
          darkHealLockRemaining: Math.max(0, this.darkHealLockUntil - this.time.now),
          darkHealingScale: this.darkHealingScale,
          darkDotRemaining: this.darkDotRemaining,
          strippedAbilities: [...this.strippedAbilities],
          finalBossBorrowedPower: this.finalBossBorrowedPower,
          worldWidth: WORLD_WIDTH,
          doctrineLevels: { ...this.doctrineLevels },
          airSupportLevels: { ...this.airSupportLevels },
          enemySlowRemaining: Math.max(0, this.enemySlowUntil - this.time.now),
          enemyFreezeRemaining: Math.max(0, this.enemyFreezeUntil - this.time.now),
          invulnerableRemaining: Math.max(0, this.invulnerableUntil - this.time.now),
          cloneCount: this.wingClones.filter((clone) => clone.active).length,
          playerWeapons: (this.playerBullets.getChildren() as Phaser.Physics.Arcade.Image[])
            .filter((bullet) => bullet.active)
            .map((bullet) => bullet.getData("weapon")),
          playerWeaponStates: (
            this.playerBullets.getChildren() as Phaser.Physics.Arcade.Image[]
          )
            .filter((bullet) => bullet.active)
            .map((bullet) => ({
              weapon: bullet.getData("weapon"),
              damage: bullet.getData("damage"),
              owner: bullet.getData("owner")
            })),
          nextBossScore: this.nextBossScore,
          player2: Boolean(this.player2?.active),
          player2Hp: this.player2Hp,
          player2MaxHp: this.player2MaxHp,
          playerHp: this.stats.hp,
          playerMaxHp: this.stats.maxHp,
          playerX: this.player.x,
          playerY: this.player.y,
          playerDamageMultiplier: this.stats.damageMultiplier,
          playerSpeed: this.stats.speed,
          playerFireRateMultiplier: this.stats.fireRateMultiplier,
          playerCooldownMultiplier: this.stats.cooldownMultiplier,
          playerPickupRadius: this.stats.pickupRadius,
          playerDamageTakenMultiplier: this.stats.damageTakenMultiplier,
          playerExplosionTakenMultiplier: this.stats.explosionTakenMultiplier,
          playerScale: this.player.displayWidth / 98,
          specialization: save.selectedSpecialization,
          critChance: this.actualCritChance(),
          critEffect: this.actualCritMultiplier(),
          agileDamageMultiplier:
            save.selectedSpecialization === "agile"
              ? agileCritRateAttackBonus(this.virtualDoctrineCritChance())
              : 0,
          agileSpeedMultiplier:
            save.selectedSpecialization === "agile" ? this.agileSpeedMultiplier() : 1,
          agileMaxHpGainAccumulator: this.agileMaxHpGainAccumulator,
          wheelchairRamDamage:
            save.selectedSpecialization === "wheelchair" ? this.wheelchairRamDamage() : 0,
          wheelchairHullAttackMultiplier:
            save.selectedSpecialization === "wheelchair"
              ? this.wheelchairHullAttackMultiplier()
              : 1,
          wheelchairHullAttackTiers:
            save.selectedSpecialization === "wheelchair"
              ? Math.floor(
                  Math.max(0, this.stats.maxHp - this.wheelchairInitialMaxHp) / 500
                )
              : 0,
          wheelchairBossDamageScale: collisionBossDamageScale(
            this.stats.maxHp,
            save.selectedSpecialization === "wheelchair"
          ),
          minionHealthDamageMultiplier: minionHealthDamageMultiplier(this.stats.maxHp),
          minionPercentDamageFloor: minionPercentDamageFloor(this.stats.maxHp),
          wheelchairOverdriveActive: this.time.now < this.wheelchairOverdriveUntil,
          wheelchairOverdriveRemaining: Math.max(0, this.wheelchairOverdriveUntil - this.time.now),
          collisionReadyRemaining: Math.max(0, this.collisionReadyAt - this.time.now),
          temporarySkill: this.temporarySkill,
          temporarySkillRemaining: Math.max(0, this.temporarySkillUntil - this.time.now),
          upgrades: { ...this.upgradeLevels },
          enemyStates: (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[])
            .filter((enemy) => enemy.active)
            .map((enemy) => ({
              type: enemy.getData("type"),
              hp: enemy.getData("hp"),
              maxHp: enemy.getData("maxHp"),
              elite: Boolean(enemy.getData("elite")),
              heavy: Boolean(enemy.getData("heavy")),
              eliteVariant: Boolean(enemy.getData("eliteVariant")),
              mutated: Boolean(enemy.getData("mutated")),
              mutation: enemy.getData("mutation") ?? null,
              texture: enemy.texture.key,
              ramInjected: Boolean(enemy.getData("ramInjected")),
              debugInjected: Boolean(enemy.getData("debugInjected"))
            })),
          pickupStates: (this.pickups.getChildren() as Phaser.Physics.Arcade.Image[])
            .filter((pickup) => pickup.active)
            .map((pickup) => ({
              kind: pickup.getData("kind"),
              texture: pickup.texture.key,
              displayWidth: pickup.displayWidth
            })),
          runTokens: this.runTokens,
          warehouseTokens: save.starCores,
          ended: this.ended
        }),
        ramEnemy: (type: string) => {
          this.playerBullets.clear(true, true);
          this.nextCloneShot = this.time.now + 500;
          const enemy = this.spawnEnemy(this.time.now, type);
          enemy
            .setPosition(this.player.x, this.player.y)
            .setVelocity(0)
            .setData("originX", this.player.x)
            .setData("born", this.time.now)
            .setData("ramInjected", true)
            .setData("debugInjected", true);
          this.collisionReadyAt = 0;
          this.collidePlayerWithEnemy(enemy, 1);
        },
        spawnEnemyType: (type: string) => {
          const debugCount = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
            (enemy) => enemy.active && enemy.getData("debugInjected")
          ).length;
          const enemy = this.spawnEnemy(this.time.now, type);
          enemy
            .setPosition(90 + (debugCount % 8) * 128, 260 + Math.floor(debugCount / 8) * 175)
            .setVelocity(0)
            .setData("originX", 90 + (debugCount % 8) * 128)
            .setData("born", this.time.now)
            .setData("nextFire", this.time.now + 60000)
            .setData("debugInjected", true);
        },
        forceBoss: () => {
          if (!this.bossActive) this.spawnBoss();
        },
        forceBossKind: (kind: BossKind) => {
          if (this.bossActive) {
            this.bossParts.clear(true, true);
            this.bossEliteAura?.destroy();
            this.bossEliteAura = undefined;
            this.bossActive = false;
          }
          this.bossTier = Math.max(0, ["titan", "mirror", "usurper"].indexOf(kind));
          this.spawnBoss();
        },
        forceCampaignFinal: () => {
          this.clearBossEntities();
          this.bossTier = 2;
          this.spawnBoss("dark_deity");
        },
        grantEvolution: (id: string) => this.applyDoctrineEvolution(id),
        setMaxHp: (value: number) => {
          this.stats.maxHp = Math.max(1, Math.round(value));
          this.stats.hp = this.stats.maxHp;
        },
        setHp: (value: number) => {
          this.stats.hp = roundHealth(value, this.stats.maxHp);
        },
        gainMaxHp: (value: number) => {
          const gained = Math.max(0, Math.round(value));
          this.stats.maxHp = Math.round(this.stats.maxHp + gained);
          this.recordAgileMaxHpGain(gained);
        },
        hitPlayer: (amount: number, source?: EnemyDamageSource) => {
          this.invulnerableUntil = 0;
          this.damagePlayer(amount, "projectile", source);
        },
        defeatBoss: () => {
          if (!this.bossActive) return;
          this.bossHp = 0;
          this.defeatBoss();
        },
        primeRamKill: () => {
          const enemy = this.spawnEnemy(this.time.now, "scout");
          enemy
            .setData("hp", Math.max(1, this.wheelchairRamDamage() * 0.5))
            .setPosition(this.player.x, this.player.y)
            .setVelocity(0);
          this.collisionReadyAt = 0;
          this.collidePlayerWithEnemy(enemy, 1);
        },
        ramKillEnemyWithMaxHp: (maxHp: number) => {
          const enemy = this.spawnEnemy(this.time.now, "scout");
          enemy
            .setData("maxHp", Math.max(1, maxHp))
            .setData("hp", 1)
            .setPosition(this.player.x, this.player.y)
            .setVelocity(0);
          this.collisionReadyAt = 0;
          this.collidePlayerWithEnemy(enemy, 1);
        },
        criticalExecute: () => {
          const enemy = this.spawnEnemy(this.time.now, "scout");
          enemy.setData("lastHitCritical", true).setData("lastOwner", 1);
          this.destroyEnemy(enemy, true);
        },
        eliteExecute: () => {
          const enemy = this.spawnEnemy(this.time.now, "elite_gunship");
          enemy.setData("lastOwner", 1);
          this.destroyEnemy(enemy, true);
        },
        grantTemporarySkill: (skill: TemporarySkill) => this.activateTemporarySkill(skill),
        clearTemporarySkill: () => {
          this.temporarySkill = null;
          this.temporarySkillUntil = 0;
        },
        grantUpgrade: (id: string) => this.applyUpgrade(id),
        ramBoss: () => {
          this.playerBullets.clear(true, true);
          this.nextCloneShot = this.time.now + 1000;
          const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
            (part) => part.active && part.getData("part") === "core"
          );
          if (core) {
            this.tweens.killTweensOf(core);
            core.setPosition(this.player.x, this.player.y);
          }
        },
        grantAirSupport: (skill: AirSupportSkillId) => this.applyAirSupportUpgrade(skill),
        triggerAirSupport: (skill: AirSupportSkillId) => this.triggerAirSupport(skill, true),
        forceWheelchairRecovery: () => {
          this.nextWheelchairHeal = 0;
          this.updateWheelchairRecovery(this.time.now);
        },
        setCampaignEncounter: (index: number) => {
          this.clearBossEntities();
          this.campaignEncounterIndex = Phaser.Math.Clamp(Math.floor(index), 0, 8);
          this.campaignBossesDefeated = Math.min(
            3,
            Math.floor((this.campaignEncounterIndex + 1) / 2)
          );
          this.startCampaignEncounter(this.campaignEncounterIndex, true);
        },
        damageBossRatio: (ratio: number) => {
          const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
            (part) => part.active && ["core", "raid-core"].includes(part.getData("part"))
          );
          if (core) this.damageBossPart(core, this.bossMaxHp * Math.max(0, ratio));
        },
        collisionFinishBoss: () => {
          const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
            (part) => part.active && part.getData("part") === "core"
          );
          if (!core) return;
          this.bossHp = 1;
          core.setData("collisionFinisher", true);
          this.damageBossPart(core, this.bossMaxHp * 2);
        },
        grantBossPower: (power: BossPowerId) => this.setBossPower(power),
        completeInterlude: () => {
          this.campaignInterludeKills = this.campaignInterludeTarget;
          this.completeCampaignInterlude();
        },
        setRunTokens: (value: number) => {
          this.runTokens = Math.max(0, Math.floor(value));
        },
        bankTokens: () => this.bankPendingTokens(false),
        spawnFlightToken: () => this.spawnFlightToken(),
        spawnExperiencePickup: () =>
          this.spawnExperiencePickup(WORLD_WIDTH / 2, 220, 5),
        triggerSkill: (kind: "laser" | "missile" | "drone", owner: 1 | 2) =>
          this.activateSkill(kind, owner),
        friendlyExplode: (target: 1 | 2, amount: number) => {
          if (target === 1) this.damagePlayerFriendly(amount, true);
          else this.damagePlayer2Friendly(amount, true);
        }
      };
    }
    const levelConfig = LEVELS[selectedLevel - 1];
    this.campaignBossAt = levelConfig.duration;
    this.nextBossScore =
      selectedMode === "campaign"
        ? 18000 + selectedLevel * 2600
        : selectedMode === "endless"
          ? 26000 + selectedLevel * 3200
          : 0;
    this.nextFlightToken = this.time.now + 4500;
    this.nextSkillPickup = this.time.now + Phaser.Math.Between(11000, 16000);
    this.showBanner(
      selectedMode === "campaign"
        ? `普通战役 · ${levelConfig.name} · 最终目标黑暗魔神`
        : selectedMode === "endless"
          ? `深空无尽 · ${levelConfig.name} · 首轮阈值 ${this.nextBossScore}`
          : `无限 Boss · ${campaignDifficultyForLevel(selectedLevel).name} · TIER 1`
    );
    if (selectedLevel === 5) this.unlockAchievement("level_five");
    if (selectedMode === "boss") {
      this.time.delayedCall(700, () => {
        this.playBossArrivalCG();
      });
    }
    this.time.delayedCall(900, () => {
      if (!save.seenTutorial) {
        this.showBanner(
          save.selectedSpecialization === "wheelchair"
            ? "撞击协议 · E 破阵冲刺 · 1/2/3 禁用 · 后续武装自动释放"
            : "驾驶战机 · SPACE 开火 · F 相位闪避 · R 纳米修复",
          2100
        );
        save.seenTutorial = true;
        persist();
      }
    });
  }

  createTextures(): void {
    if (this.textures.exists("player")) return;
    const g = this.add.graphics();
    g.fillStyle(0x2df4ff, 0.2);
    g.fillTriangle(48, 4, 3, 86, 93, 86);
    g.fillStyle(0x163a57, 1);
    g.fillTriangle(48, 7, 10, 80, 86, 80);
    g.fillStyle(0xdffcff, 1);
    g.fillTriangle(48, 4, 32, 91, 64, 91);
    g.fillStyle(0x3478ff, 1);
    g.fillTriangle(48, 20, 39, 73, 57, 73);
    g.lineStyle(3, 0x2df4ff, 0.9);
    g.strokeTriangle(48, 4, 10, 80, 86, 80);
    g.generateTexture("player", 96, 98);
    g.clear();

    g.fillStyle(0x2df4ff, 1);
    g.fillRoundedRect(2, 0, 8, 32, 4);
    g.generateTexture("playerBullet", 12, 32);
    g.clear();

    g.fillStyle(0x67fbff, 0.22);
    g.fillCircle(11, 11, 10);
    g.fillStyle(0xd9ffff, 1);
    g.fillCircle(11, 11, 5);
    g.lineStyle(2, 0x9b5cff, 0.9);
    g.strokeCircle(11, 11, 8);
    g.generateTexture("agileOrb", 22, 22);
    g.clear();

    g.fillStyle(0x9efcff, 1);
    g.fillRoundedRect(2, 0, 20, 70, 8);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRoundedRect(2, 0, 20, 70, 8);
    g.generateTexture("laserBullet", 24, 72);
    g.clear();

    g.fillStyle(0xffbd3e, 1);
    g.fillTriangle(12, 0, 2, 28, 22, 28);
    g.fillStyle(0xff3dbb, 1);
    g.fillRect(7, 22, 10, 14);
    g.generateTexture("missile", 24, 38);
    g.clear();

    g.fillStyle(0xff715b, 1);
    g.fillCircle(10, 10, 8);
    g.lineStyle(2, 0xffe0a6, 1);
    g.strokeCircle(10, 10, 8);
    g.generateTexture("enemyBullet", 20, 20);
    g.clear();

    g.fillStyle(0x8a2e5d, 1);
    g.fillTriangle(42, 70, 4, 15, 80, 15);
    g.fillStyle(0xff4d6d, 1);
    g.fillTriangle(42, 66, 25, 8, 59, 8);
    g.lineStyle(2, 0xff8ab7, 0.8);
    g.strokeTriangle(42, 70, 4, 15, 80, 15);
    g.generateTexture("enemyScout", 84, 74);
    g.clear();

    g.fillStyle(0x3f285f, 1);
    g.fillRoundedRect(5, 6, 88, 52, 8);
    g.fillStyle(0x9b5cff, 1);
    g.fillTriangle(49, 66, 27, 9, 71, 9);
    g.lineStyle(2, 0xf084ff, 0.7);
    g.strokeRoundedRect(5, 6, 88, 52, 8);
    g.generateTexture("enemyGunship", 98, 72);
    g.clear();

    g.fillStyle(0x203d73, 1);
    g.fillTriangle(38, 70, 2, 18, 74, 18);
    g.fillStyle(0x49b8ff, 1);
    g.fillTriangle(38, 64, 27, 4, 49, 4);
    g.lineStyle(2, 0xa7e7ff, 0.8);
    g.strokeTriangle(38, 70, 2, 18, 74, 18);
    g.generateTexture("enemyInterceptor", 76, 72);
    g.clear();

    g.fillStyle(0x4f2318, 1);
    g.fillRoundedRect(5, 14, 104, 52, 12);
    g.fillStyle(0xff8a3d, 1);
    g.fillTriangle(57, 2, 32, 72, 82, 72);
    g.fillCircle(57, 40, 11);
    g.lineStyle(3, 0xffcf70, 0.8);
    g.strokeRoundedRect(5, 14, 104, 52, 12);
    g.generateTexture("enemyBomber", 114, 76);
    g.clear();

    g.fillStyle(0x234637, 1);
    g.fillRoundedRect(4, 10, 86, 48, 18);
    g.fillStyle(0x43ff9a, 1);
    g.fillTriangle(47, 2, 25, 66, 69, 66);
    g.lineStyle(3, 0xb9ffdc, 0.9);
    g.strokeRoundedRect(4, 10, 86, 48, 18);
    g.generateTexture("enemyCourier", 94, 70);
    g.clear();

    g.fillStyle(0x19344d, 1);
    g.fillTriangle(24, 0, 1, 35, 47, 35);
    g.lineStyle(2, 0x2df4ff, 0.8);
    g.strokeTriangle(24, 0, 1, 35, 47, 35);
    g.generateTexture("drone", 48, 38);
    g.clear();

    g.fillStyle(0x2df4ff, 0.18);
    g.fillCircle(18, 18, 17);
    g.lineStyle(3, 0x2df4ff, 0.95);
    g.strokeTriangle(18, 1, 3, 29, 33, 29);
    g.generateTexture("blade", 36, 36);
    g.clear();

    g.fillStyle(0x43ff9a, 1);
    g.fillRect(7, 0, 6, 20);
    g.fillRect(0, 7, 20, 6);
    g.generateTexture("pickup", 20, 20);
    g.clear();

    g.fillStyle(0xffd95e, 0.22);
    g.fillCircle(18, 18, 17);
    g.fillStyle(0xffdc64, 1);
    g.fillCircle(18, 18, 10);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(18, 18, 13);
    g.generateTexture("flightCoin", 36, 36);
    g.clear();

    g.fillStyle(0x9b5cff, 0.18);
    g.fillCircle(24, 24, 23);
    g.fillStyle(0x071827, 1);
    g.fillCircle(24, 24, 15);
    g.lineStyle(4, 0xff7de3, 0.95);
    g.strokeCircle(24, 24, 20);
    g.lineStyle(3, 0x2df4ff, 1);
    g.strokeTriangle(24, 7, 9, 34, 39, 34);
    g.fillStyle(0xffd95e, 1);
    g.fillCircle(24, 24, 5);
    g.generateTexture("skillPickup", 48, 48);
    g.clear();

    g.fillStyle(0x9ffcff, 1);
    g.fillRoundedRect(1, 0, 2, 42, 2);
    g.generateTexture("speedStreak", 4, 42);
    g.clear();

    g.fillStyle(0x2df4ff, 1);
    g.fillCircle(5, 5, 5);
    g.generateTexture("engineSpark", 10, 10);
    g.clear();

    g.fillStyle(0x6f1c50, 1);
    g.fillRoundedRect(0, 20, 360, 170, 28);
    g.fillStyle(0x240c2d, 1);
    g.fillTriangle(180, 0, 70, 190, 290, 190);
    g.fillStyle(0xff3dbb, 1);
    g.fillCircle(180, 108, 40);
    g.lineStyle(5, 0xff6cc8, 0.75);
    g.strokeRoundedRect(0, 20, 360, 170, 28);
    g.generateTexture("bossCore", 360, 200);
    g.clear();

    g.fillStyle(0x381238, 1);
    g.fillRoundedRect(2, 4, 116, 92, 16);
    g.fillStyle(0xff4d6d, 1);
    g.fillCircle(60, 56, 17);
    g.lineStyle(3, 0xff78ca, 0.8);
    g.strokeRoundedRect(2, 4, 116, 92, 16);
    g.generateTexture("bossTurret", 120, 100);
    g.clear();

    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture("star", 6, 6);
    g.destroy();
  }

  createBackdrop(): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0x02040c, 0x061936, 0x071329, 0x010207, 1);
    background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    background.fillStyle(0x0c4d68, 0.08);
    background.fillCircle(110, 330, 250);
    background.fillStyle(0x60136d, 0.075);
    background.fillCircle(650, 620, 330);
    background.fillStyle(0x123868, 0.08);
    background.fillCircle(340, 1010, 400);
    background.lineStyle(1, 0x2df4ff, 0.11);
    for (let y = 780; y < WORLD_HEIGHT; y += 54) {
      const width = Phaser.Math.Linear(120, WORLD_WIDTH + 140, (y - 780) / 500);
      background.lineBetween(WORLD_WIDTH / 2 - width / 2, y, WORLD_WIDTH / 2 + width / 2, y);
    }
    for (let x = -160; x <= WORLD_WIDTH + 160; x += 92) {
      background.lineBetween(WORLD_WIDTH / 2, 730, x, WORLD_HEIGHT);
    }
    this.horizonGlow = this.add.graphics().setDepth(1);
    this.horizonGlow.lineStyle(3, 0x2df4ff, 0.18);
    this.horizonGlow.lineBetween(0, 744, WORLD_WIDTH, 744);
    for (let i = 0; i < (save.settings.quality === "high" ? 90 : 45); i += 1) {
      const star = this.add
        .image(Phaser.Math.Between(0, WORLD_WIDTH), Phaser.Math.Between(0, WORLD_HEIGHT), "star")
        .setAlpha(Phaser.Math.FloatBetween(0.15, 0.78))
        .setScale(Phaser.Math.FloatBetween(0.35, 1.2));
      star.setData("speed", Phaser.Math.Between(65, 210));
      this.stars.push(star);
    }
    for (let i = 0; i < (save.settings.quality === "high" ? 24 : 12); i += 1) {
      const side = i % 2 === 0 ? Phaser.Math.Between(0, 155) : Phaser.Math.Between(WORLD_WIDTH - 155, WORLD_WIDTH);
      const streak = this.add
        .image(side, Phaser.Math.Between(0, WORLD_HEIGHT), "speedStreak")
        .setAlpha(Phaser.Math.FloatBetween(0.1, 0.45))
        .setScale(Phaser.Math.FloatBetween(0.5, 1.4), Phaser.Math.FloatBetween(0.8, 2.2))
        .setDepth(2);
      streak.setData("speed", Phaser.Math.Between(430, 820));
      this.stars.push(streak);
    }
  }

  createPlayer(): void {
    const ship = SHIPS[save.selectedShip];
    const specialization = SPECIALIZATIONS[save.selectedSpecialization];
    const hpBoost = 1 + (save.permanentUpgrades.hull ?? 0) * 0.04;
    const damageBoost =
      1 + (save.permanentUpgrades.firepower ?? 0) * 0.03 * ATTACK_BONUS_SCALE;
    const speedBoost = 1 + (save.permanentUpgrades.engine ?? 0) * 0.025;
    const armorBoost = 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
    this.stats.maxHp = Math.round(ship.hp * specialization.hp * hpBoost);
    this.stats.hp = this.stats.maxHp;
    this.wheelchairInitialMaxHp = this.stats.maxHp;
    this.stats.speed = ship.speed * specialization.speed * speedBoost;
    this.stats.damageMultiplier = damageBoost * ship.damage * specialization.damage;
    this.stats.cooldownMultiplier = specialization.cooldown;
    this.stats.damageTakenMultiplier = specialization.damageTaken * armorBoost;
    this.stats.explosionTakenMultiplier = specialization.explosionTaken;
    this.stats.fireRateMultiplier = specialization.fireRate;
    this.stats.critChance =
      (save.selectedSpecialization === "power" ? 0.1 : 0.05) *
      SPECIALIZATION_BASE_STAT_BOOST;
    this.nextWheelchairHeal = this.time.now + 5000;
    this.nextAgileBloom = this.time.now + 1350;
    this.rerolls = 1 + save.permanentUpgrades.reroll;
    const playerTexture = this.textures.exists(ship.asset) ? ship.asset : "player";
    this.player = this.physics.add.image(
      playVariant === "single" ? WORLD_WIDTH / 2 : WORLD_WIDTH * 0.37,
      WORLD_HEIGHT - 180,
      playerTexture
    );
    this.player
      .setDisplaySize(98 * specialization.scale, 98 * specialization.scale)
      .setDepth(10)
      .setCollideWorldBounds(true)
      .setData("owner", 1)
      .setTint(SKINS[save.equippedSkin].tint);
    this.configurePlayerBody(this.player);
    this.targetX = this.player.x;
    this.targetY = this.player.y;
    if (playVariant !== "single") {
      const ship2 = SHIPS[selectedShip2];
      const texture2 = this.textures.exists(ship2.asset) ? ship2.asset : "player";
      this.player2 = this.physics.add.image(WORLD_WIDTH * 0.63, WORLD_HEIGHT - 180, texture2);
      this.player2
        .setDisplaySize(98 * specialization.scale, 98 * specialization.scale)
        .setDepth(10)
        .setCollideWorldBounds(true)
        .setData("owner", 2);
      this.configurePlayerBody(this.player2);
      this.player2.setTint(SKINS[save.equippedSkin].tint);
      this.player2MaxHp = Math.round(ship2.hp * specialization.hp * hpBoost);
      this.player2Hp = this.player2MaxHp;
    }
  }

  configurePlayerBody(player: Phaser.Physics.Arcade.Image): void {
    const scale = player.displayWidth / player.width;
    const bodySourceSize = 28 / scale;
    player.body!.setSize(bodySourceSize, bodySourceSize);
    player.body!.setOffset((player.width - bodySourceSize) / 2, (player.height - bodySourceSize) / 2);
  }

  createHud(): void {
    const cockpit = this.add.graphics().setDepth(48);
    cockpit.fillStyle(0x020713, 0.94);
    cockpit.fillTriangle(0, 0, 58, 0, 0, WORLD_HEIGHT);
    cockpit.fillTriangle(WORLD_WIDTH, 0, WORLD_WIDTH - 58, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cockpit.fillTriangle(0, WORLD_HEIGHT, 170, WORLD_HEIGHT, 0, WORLD_HEIGHT - 210);
    cockpit.fillTriangle(WORLD_WIDTH, WORLD_HEIGHT, WORLD_WIDTH - 170, WORLD_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT - 210);
    cockpit.lineStyle(4, 0x183f5c, 0.95);
    cockpit.lineBetween(0, WORLD_HEIGHT - 210, 170, WORLD_HEIGHT);
    cockpit.lineBetween(WORLD_WIDTH, WORLD_HEIGHT - 210, WORLD_WIDTH - 170, WORLD_HEIGHT);
    cockpit.lineStyle(1, 0x2df4ff, 0.4);
    cockpit.lineBetween(12, 0, 12, WORLD_HEIGHT - 180);
    cockpit.lineBetween(WORLD_WIDTH - 12, 0, WORLD_WIDTH - 12, WORLD_HEIGHT - 180);
    cockpit.strokeCircle(92, WORLD_HEIGHT - 92, 66);
    cockpit.strokeCircle(WORLD_WIDTH - 92, WORLD_HEIGHT - 92, 66);
    cockpit.lineStyle(2, 0x2df4ff, 0.16);
    cockpit.beginPath();
    cockpit.arc(WORLD_WIDTH / 2, WORLD_HEIGHT + 120, 410, Math.PI * 1.15, Math.PI * 1.85);
    cockpit.strokePath();
    const reticleGraphics = this.add.graphics();
    reticleGraphics.lineStyle(2, 0x7ffcff, 0.88);
    reticleGraphics.strokeCircle(0, 0, 28);
    reticleGraphics.lineBetween(-42, 0, -18, 0);
    reticleGraphics.lineBetween(18, 0, 42, 0);
    reticleGraphics.lineBetween(0, -42, 0, -18);
    reticleGraphics.lineBetween(0, 18, 0, 42);
    this.targetReticle = this.add.container(WORLD_WIDTH / 2, 220, [reticleGraphics]).setDepth(47).setAlpha(0);
    const graphics = this.add.graphics().setDepth(50);
    const font = { fontFamily: "Consolas, monospace", color: "#eaffff" };
    this.hud = {
      graphics,
      hp: this.add.text(28, 38, "", { ...font, fontSize: "22px", fontStyle: "bold" }).setDepth(51),
      score: this.add
        .text(WORLD_WIDTH - 28, 38, "", { ...font, fontSize: "18px" })
        .setOrigin(1, 0)
        .setDepth(51),
      time: this.add
        .text(WORLD_WIDTH / 2, 38, "", { ...font, fontSize: "18px" })
        .setOrigin(0.5, 0)
        .setDepth(51),
      level: this.add
        .text(WORLD_WIDTH / 2, 73, "", { ...font, fontSize: "14px", color: "#2df4ff" })
        .setOrigin(0.5, 0)
        .setDepth(51),
      combo: this.add.text(28, 116, "", { ...font, fontSize: "20px", color: "#ffbd3e" }).setDepth(51),
      bossName: this.add
        .text(WORLD_WIDTH / 2, 105, "", {
          ...font,
          fontSize: "13px",
          color: "#ff8ac9",
          letterSpacing: 2
        })
        .setOrigin(0.5)
        .setDepth(51)
    };
    const pause = this.add
      .text(WORLD_WIDTH - 38, WORLD_HEIGHT - 55, "Ⅱ", {
        ...font,
        fontSize: "28px",
        color: "#8fb5c6",
        backgroundColor: "#071827"
      })
      .setPadding(14)
      .setOrigin(1)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });
    pause.on("pointerdown", () => showPause(this));
    this.add
      .text(
        24,
        WORLD_HEIGHT - 40,
        playVariant === "single"
          ? save.selectedSpecialization === "wheelchair"
            ? "撞击歼敌  [E]破阵冲刺  [Q]EMP  [G]首领权柄/全速推进  [1/2/3]禁用  后续武装自动释放"
            : "SPACE 开火  [1]激光 [2]导弹 [3]无人机  [Q]清屏 [E]超载  [F]相位闪避 [R]纳米修复"
          : "P1 WASD/SPACE/1-3/Q/E  ·  P2 方向键/ENTER/J/K/L  ·  友军爆破开启",
        { ...font, fontSize: "11px", color: "#6fa0b4", backgroundColor: "#04111fcc" }
      )
      .setPadding(7)
      .setDepth(60);
  }

  setupCollisions(): void {
    this.physics.add.overlap(
      this.playerBullets,
      this.enemies,
      (bullet, enemy) => this.hitEnemy(bullet as Phaser.Physics.Arcade.Image, enemy as Phaser.Physics.Arcade.Image)
    );
    this.physics.add.overlap(
      this.playerBullets,
      this.bossParts,
      (bullet, part) => this.hitBossPart(bullet as Phaser.Physics.Arcade.Image, part as Phaser.Physics.Arcade.Image)
    );
    this.physics.add.overlap(
      this.player,
      this.enemyBullets,
      (_player, bullet) => {
        const projectile = bullet as Phaser.Physics.Arcade.Image;
        this.hitPlayerWithEnemyProjectile(projectile);
        projectile.disableBody(true, true);
      }
    );
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      this.collidePlayerWithEnemy(enemy as Phaser.Physics.Arcade.Image, 1);
    });
    this.physics.add.overlap(this.player, this.bossParts, (_player, part) => {
      this.collidePlayerWithBoss(part as Phaser.Physics.Arcade.Image, 1);
    });
    this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => {
      const item = pickup as Phaser.Physics.Arcade.Image;
      this.collectPickup(item, this.player);
    });
    if (this.player2) {
      this.physics.add.overlap(this.player2, this.enemyBullets, (_player, bullet) => {
        const projectile = bullet as Phaser.Physics.Arcade.Image;
        this.damagePlayer2(
          projectile.getData("damage") ?? 12,
          projectile.getData("damageType") ?? "projectile",
          projectile.getData("damageSource") ?? "minion"
        );
        projectile.disableBody(true, true);
      });
      this.physics.add.overlap(this.player2, this.enemies, (_player, enemy) => {
        this.collidePlayerWithEnemy(enemy as Phaser.Physics.Arcade.Image, 2);
      });
      this.physics.add.overlap(this.player2, this.bossParts, (_player, part) => {
        this.collidePlayerWithBoss(part as Phaser.Physics.Arcade.Image, 2);
      });
      this.physics.add.overlap(this.player2, this.pickups, (_player, pickup) => {
        const item = pickup as Phaser.Physics.Arcade.Image;
        this.collectPickup(item, this.player2!);
      });
    }
  }

  hitPlayerWithEnemyProjectile(projectile: Phaser.Physics.Arcade.Image): void {
    const darkFlat = projectile.getData("darkFlat");
    const darkDotRatio = projectile.getData("darkDotRatio");
    if (darkFlat !== undefined || darkDotRatio !== undefined) {
      this.damagePlayerDark(darkFlat ?? 0, 0, "魔神穿刺");
      if ((darkDotRatio ?? 0) > 0) {
        this.applyDarkDot(this.stats.maxHp * darkDotRatio, 5.5, "黑暗能量");
      }
      return;
    }
    this.damagePlayer(
      projectile.getData("damage") ?? 12,
      projectile.getData("damageType") ?? "projectile",
      projectile.getData("damageSource") ?? "minion"
    );
  }

  collectPickup(
    item: Phaser.Physics.Arcade.Image,
    collector: Phaser.Physics.Arcade.Image
  ): void {
    if (!item.active) return;
    const kind = item.getData("kind") ?? "xp";
    const value = item.getData("value") ?? 1;
    if (kind === "token") {
      this.runTokens += value;
      this.floatText(collector.x, collector.y - 54, `飞行代币 ◆ +${value}`, true);
      this.pickupEffect(collector.x, collector.y, true);
    } else if (kind === "skill") {
      this.activateTemporarySkill(value as TemporarySkill);
      this.pickupEffect(collector.x, collector.y, true);
    } else {
      this.collectXp(value);
      this.pickupEffect(collector.x, collector.y, false);
    }
    item.disableBody(true, true);
  }

  collidePlayerWithEnemy(enemy: Phaser.Physics.Arcade.Image, owner: 1 | 2): void {
    if (!enemy.active) return;
    const now = this.time.now;
    const readyAt = owner === 1 ? this.collisionReadyAt : this.player2CollisionReadyAt;
    if (now < readyAt) return;
    if (owner === 1) this.collisionReadyAt = now + 720;
    else this.player2CollisionReadyAt = now + 720;
    const type = enemy.getData("type");
    const maxHp = enemy.getData("maxHp") ?? enemy.getData("hp") ?? 30;
    if (owner === 1 && save.selectedSpecialization === "wheelchair") {
      const overdriveActive = now < this.wheelchairOverdriveUntil;
      this.collisionReadyAt = now + (overdriveActive ? 163 : 300);
      const isElite = Boolean(enemy.getData("elite"));
      const baseRamDamage = this.wheelchairRamDamage() * (isElite ? 1.25 : 1);
      const ramDamage =
        type === "scout" && !isElite
          ? Math.max(baseRamDamage, enemy.getData("hp") ?? maxHp)
          : baseRamDamage;
      const remainingHp = (enemy.getData("hp") ?? maxHp) - ramDamage;
      enemy.setData("hp", remainingHp);
      this.damagePlayer(
        isElite || type === "gunship" || type === "bomber"
          ? 24
          : type === "striker" || type === "suppressor" || type === "mine_layer"
            ? 18
            : 14,
        "collision",
        "minion"
      );
      if (remainingHp <= 0) {
        enemy.setData("lastOwner", 1);
        enemy.setData("wheelchairRamKill", true);
        this.destroyEnemy(enemy, true);
      } else {
        enemy.setVelocityY(-220);
        this.floatText(enemy.x, enemy.y, `碾压 ${Math.round(ramDamage)}`, true);
      }
      this.impactBurst(enemy.x, enemy.y, 0xffbd3e);
      this.triggerRamShockwave(enemy.x, enemy.y, enemy);
      return;
    }
    if (type === "gunship" || type === "bomber") {
      const collisionDamage = maxHp * 0.25;
      enemy.setData("hp", Math.max(1, (enemy.getData("hp") ?? maxHp) - collisionDamage));
      if (owner === 1) this.damagePlayer(24, "collision", "minion");
      else this.damagePlayer2(24, "collision", "minion");
      this.floatText(enemy.x, enemy.y, `撞击 -25%`, true);
      enemy.setVelocityY(-180);
    } else {
      const collisionDamage = Math.max(1, Math.ceil(enemy.getData("hp") ?? maxHp));
      if (owner === 1) this.damagePlayer(collisionDamage, "collision", "minion");
      else this.damagePlayer2(collisionDamage, "collision", "minion");
      enemy.setData("lastOwner", owner);
      this.destroyEnemy(enemy, true);
    }
    this.impactBurst(enemy.x, enemy.y, 0xffffff);
  }

  collidePlayerWithBoss(part: Phaser.Physics.Arcade.Image, owner: 1 | 2): void {
    if (!part.active || !this.bossActive) return;
    const now = this.time.now;
    const readyAt = owner === 1 ? this.collisionReadyAt : this.player2CollisionReadyAt;
    if (now < readyAt) return;
    const wheelchairRam = owner === 1 && save.selectedSpecialization === "wheelchair";
    if (owner === 1) {
      this.collisionReadyAt = now + (wheelchairRam ? 325 : 950);
      this.damagePlayer(38, "collision", "boss");
    } else {
      this.player2CollisionReadyAt = now + 950;
      this.damagePlayer2(38, "collision", "boss");
    }
    const hullAttackMultiplier = wheelchairRam ? this.wheelchairHullAttackMultiplier() : 1;
    const bossRamDamage = wheelchairRam
      ? this.bossMaxHp * 0.02 * hullAttackMultiplier
      : 75;
    if (part.getData("part") === "raid-core") {
      const raidDamage = wheelchairRam
        ? (part.getData("maxHp") ?? this.bossMaxHp / 3) *
          0.02 *
          hullAttackMultiplier
        : 75;
      part.setData("collisionFinisher", wheelchairRam);
      this.damageBossPart(part, raidDamage);
    } else {
      part.setData("collisionFinisher", wheelchairRam);
      const phaseMultiplier = this.bossPhase === 1 ? 0.65 : 1.25;
      this.damageBossPart(part, bossRamDamage / phaseMultiplier);
    }
    this.checkBossPhase();
    if (this.bossHp <= 0 && this.trinityAlive <= 0) this.defeatBoss();
    this.floatText(part.x, part.y + 35, `冲撞 ${Math.round(bossRamDamage)}`, true);
    this.impactBurst(part.x, part.y, 0xffbd3e);
  }

  wheelchairRamDamage(): number {
    const cannonLevel = this.upgradeLevels.cannon ?? 1;
    const ramMassLevel = this.upgradeLevels.ram_mass ?? 0;
    const lanceLevel = this.doctrineLevels.lance_mastery ?? 0;
    const openingOneHitDamage = 39.5 * 1.7;
    return (
      Math.max(openingOneHitDamage, 12 + cannonLevel * 4) *
      (1 + ramMassLevel * 0.18) *
      (1 + lanceLevel * 0.18 * ATTACK_BONUS_SCALE) *
      this.currentDamageMultiplier()
    );
  }

  wheelchairHullAttackMultiplier(): number {
    if (save.selectedSpecialization !== "wheelchair") return 1;
    return collisionHullAttackMultiplier(this.stats.maxHp - this.wheelchairInitialMaxHp);
  }

  triggerRamShockwave(
    x: number,
    y: number,
    primaryTarget?: Phaser.Physics.Arcade.Image
  ): void {
    const level = this.upgradeLevels.ram_shockwave ?? 0;
    if (level <= 0 || this.time.now < this.nextRamShockwave) return;
    this.nextRamShockwave = this.time.now + Math.max(520, 1100 - level * 90);
    const radius = 145 + (level - 1) * 18;
    const damage = this.wheelchairRamDamage() * (0.24 + level * 0.06);
    const targets = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter(
        (enemy) =>
          enemy.active &&
          enemy !== primaryTarget &&
          Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius
      )
      .slice(0, 1 + Math.min(4, level));
    for (const target of targets) {
      target.setData("lastOwner", 1);
      this.dealDirectDamage(target, damage, target.x, target.y);
    }
    const wave = this.add
      .circle(x, y, 24, 0xffbd3e, 0.05)
      .setStrokeStyle(7, 0xffe5a3, 0.9)
      .setDepth(25);
    this.tweens.add({
      targets: wave,
      radius,
      alpha: 0,
      duration: 340,
      onComplete: () => wave.destroy()
    });
  }

  grantCollisionBossKillGrowth(allowAdditionalBoss = false): void {
    if (
      save.selectedSpecialization !== "wheelchair" ||
      (!allowAdditionalBoss && this.bossKilledByCollision)
    ) {
      return;
    }
    this.bossKilledByCollision = true;
    this.stats.maxHp += 300;
    this.floatText(this.player.x, this.player.y - 66, "撞毁首领 · MAX HP +300", true);
    this.showBanner(`撞击核心吞噬 · 最大生命 ${Math.round(this.stats.maxHp)}`, 1000);
  }

  setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.actionKeys = this.input.keyboard!.addKeys(
      "SPACE,ENTER,ONE,TWO,THREE,Q,E,F,G,R,J,K,L,X"
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (playVariant !== "single") return;
      if (pointer.x > WORLD_WIDTH - 170 && pointer.y > WORLD_HEIGHT - 250) return;
      this.dragActive = true;
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragActive) return;
      this.targetX = Phaser.Math.Clamp(pointer.x, 42, WORLD_WIDTH - 42);
      this.targetY = Phaser.Math.Clamp(pointer.y, 105, WORLD_HEIGHT - 70);
    });
    this.input.on("pointerup", () => {
      this.dragActive = false;
    });
    this.input.keyboard!.on("keydown-ONE", () => this.activateSkill("laser", 1));
    this.input.keyboard!.on("keydown-TWO", () => this.activateSkill("missile", 1));
    this.input.keyboard!.on("keydown-THREE", () => this.activateSkill("drone", 1));
    this.input.keyboard!.on("keydown-Q", () => this.activateEMP(1));
    this.input.keyboard!.on("keydown-E", () => {
      if (save.selectedSpecialization === "wheelchair") this.activateWheelchairDash();
      else this.activateUltimate();
    });
    this.input.keyboard!.on("keydown-F", () => this.activatePhaseDash());
    this.input.keyboard!.on("keydown-G", () => {
      if (this.bossPower) this.activateBossPower();
      else this.activateWheelchairOverdrive();
    });
    this.input.keyboard!.on("keydown-R", () => this.activateNanoRepair());
    this.input.keyboard!.on("keydown-J", () => {
      if (playVariant !== "single") this.activateEMP(2);
    });
    this.input.keyboard!.on("keydown-K", () => {
      if (playVariant !== "single") this.activateUltimate();
    });
    this.input.keyboard!.on("keydown-L", () => {
      if (playVariant !== "single") this.activateSkill("laser", 2);
      else if (DEBUG) this.levelUp();
    });
    this.input.keyboard!.on("keydown-X", () => this.surrender());
    this.input.keyboard!.on("keydown-ESC", () => showPause(this));
    this.input.keyboard!.on("keydown-B", () => {
      if (DEBUG && !this.bossActive) this.spawnBoss();
    });
    window.addEventListener(
      "blur",
      () => {
        if (activeScene === this && !this.isModal && !this.ended) showPause(this);
      },
      { once: true }
    );
  }

  update(time: number, delta: number): void {
    if (this.ended || this.isModal) return;
    const dt = delta / 1000;
    this.elapsedSeconds += dt;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    this.updateStars(dt);
    this.updatePlayer(time, dt);
    this.updateWheelchairRecovery(time);
    this.updateFlightExperience(time);
    this.updateTemporarySkill(time);
    this.updateAirSupport(time);
    this.updateBossPower(time);
    this.updateDarkEffects(time);
    this.updateTemporaryConfiscation(time);
    this.updateWeapons(time);
    this.updateProjectiles(time);
    this.updateEnemies(time, dt);
    this.updatePickups();
    this.updateBoss(time, dt);
    this.updateHud();
    this.updateDebug();
    if (!this.bossActive && time >= this.nextFlightToken) {
      this.spawnFlightToken();
      this.nextFlightToken = time + Phaser.Math.Between(6500, 10500);
    }
    if (!this.bossActive && time >= this.nextSkillPickup) {
      this.spawnSkillPickup();
      this.nextSkillPickup = time + Phaser.Math.Between(17000, 28000);
    }
    const scoreProgress = (this.score + this.score2) / Math.max(1, this.nextBossScore);
    const intensityStage = this.bossActive
      ? 3
      : scoreProgress >= 0.72
        ? 2
        : scoreProgress >= 0.3
          ? 1
          : 0;
    setAdaptiveMusic(intensityStage);
    if (
      selectedMode !== "boss" &&
      !this.bossActive &&
      !this.levelCompleteTriggered &&
      this.score + this.score2 >= this.nextBossScore
    ) {
      this.levelCompleteTriggered = true;
      this.playBossArrivalCG();
    }
  }

  updateStars(dt: number): void {
    for (const star of this.stars) {
      star.y += star.getData("speed") * dt * (this.bossPhase === 3 ? 1.7 : 1);
      if (star.y > WORLD_HEIGHT + 8) {
        star.y = -8;
        star.x = Phaser.Math.Between(0, WORLD_WIDTH);
      }
    }
  }

  updateFlightExperience(time: number): void {
    const velocityX = (this.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.player.angle = Phaser.Math.Linear(this.player.angle, Phaser.Math.Clamp(velocityX * 0.035, -13, 13), 0.12);
    if (this.horizonGlow) {
      this.horizonGlow.alpha = 0.45 + Math.sin(time * 0.002) * 0.12;
    }
    const target = this.nearestTarget(this.player.x, this.player.y);
    if (this.targetReticle) {
      if (target?.active) {
        this.targetReticle.setAlpha(Phaser.Math.Linear(this.targetReticle.alpha, 0.82, 0.12));
        this.targetReticle.x = Phaser.Math.Linear(this.targetReticle.x, target.x, 0.18);
        this.targetReticle.y = Phaser.Math.Linear(this.targetReticle.y, target.y, 0.18);
        this.targetReticle.rotation += 0.018;
      } else {
        this.targetReticle.setAlpha(Phaser.Math.Linear(this.targetReticle.alpha, 0, 0.1));
      }
    }
    if (time >= this.nextTrail) {
      this.nextTrail = time + (save.settings.quality === "high" ? 32 : 60);
      for (const offset of [-18, 18]) {
        const spark = this.engineTrails.get(
          this.player.x + offset,
          this.player.y + this.player.displayHeight * 0.35,
          "engineSpark"
        ) as Phaser.GameObjects.Image | null;
        if (!spark) continue;
        this.tweens.killTweensOf(spark);
        spark
          .setActive(true)
          .setVisible(true)
          .setPosition(this.player.x + offset, this.player.y + this.player.displayHeight * 0.35)
          .setTexture("engineSpark")
          .setTint(SKINS[save.equippedSkin].tint)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(6)
          .setAlpha(1)
          .setScale(Phaser.Math.FloatBetween(0.5, 1.1));
        this.tweens.add({
          targets: spark,
          y: spark.y + Phaser.Math.Between(55, 105),
          alpha: 0,
          scale: 0.1,
          duration: Phaser.Math.Between(220, 420),
          onComplete: () => spark.setActive(false).setVisible(false)
        });
      }
    }
  }

  spawnFlightToken(): void {
    const value = 2 + selectedLevel + this.bossTier;
    const token = this.pickups.get(
      Phaser.Math.Between(80, WORLD_WIDTH - 80),
      -50,
      "starCoreTokenArt"
    ) as Phaser.Physics.Arcade.Image;
    token.enableBody(true, token.x, -50, true, true);
    token
      .setTexture("starCoreTokenArt")
      .setDisplaySize(46, 46)
      .setDepth(7)
      .setData({ kind: "token", value })
      .setVelocity(Phaser.Math.Between(-42, 42), Phaser.Math.Between(115, 165))
      .setAngularVelocity(120);
  }

  spawnExperiencePickup(x: number, y: number, value: number): void {
    const pickup = this.pickups.get(x, y, "starCoreTokenArt") as Phaser.Physics.Arcade.Image;
    pickup.enableBody(true, x, y, true, true);
    pickup
      .setTexture("starCoreTokenArt")
      .setDisplaySize(34, 34)
      .setDepth(6)
      .setData({ kind: "xp", value })
      .setAngularVelocity(90)
      .setVelocity(Phaser.Math.Between(-35, 35), 55);
  }

  spawnSkillPickup(x = Phaser.Math.Between(90, WORLD_WIDTH - 90), y = -60): void {
    const skills: TemporarySkill[] = ["overdrive", "prism", "singularity"];
    const skill = Phaser.Utils.Array.GetRandom(skills);
    const pickup = this.pickups.get(x, y, "skillPickup") as Phaser.Physics.Arcade.Image;
    pickup.enableBody(true, x, y, true, true);
    pickup
      .setTexture("skillPickup")
      .setDisplaySize(54, 54)
      .setDepth(8)
      .setData({ kind: "skill", value: skill })
      .setVelocity(Phaser.Math.Between(-55, 55), Phaser.Math.Between(105, 145))
      .setAngularVelocity(150);
  }

  activateTemporarySkill(skill: TemporarySkill): void {
    const names: Record<TemporarySkill, string> = {
      overdrive: "歼灭超频",
      prism: "棱镜散射",
      singularity: "奇点花火"
    };
    this.temporarySkill = skill;
    this.temporarySkillUntil = this.time.now + 12000;
    this.nextTemporaryPattern = this.time.now + 260;
    this.showBanner(`${names[skill]} · 12 秒临时强化`, 1050);
    this.burst(this.player.x, this.player.y, skill === "overdrive" ? 0xffbd3e : 0x9b5cff, 2);
  }

  updateTemporarySkill(time: number): void {
    if (!this.temporarySkill) return;
    if (time >= this.temporarySkillUntil) {
      this.showBanner("临时技能能源耗尽", 650);
      this.temporarySkill = null;
      return;
    }
    if (
      time < this.nextTemporaryPattern || this.skillsConfiscated
    ) {
      return;
    }
    if (save.selectedSpecialization === "wheelchair") {
      if (this.temporarySkill === "prism") {
        this.fireLaser(Math.max(1, this.upgradeLevels.laser ?? 1));
        this.nextTemporaryPattern = time + 980;
      } else if (this.temporarySkill === "singularity") {
        this.fireMissiles(Math.max(1, this.upgradeLevels.missile ?? 1));
        this.nextTemporaryPattern = time + 1250;
      } else {
        this.nextTemporaryPattern = time + 800;
      }
    } else if (this.temporarySkill === "prism") {
      for (let i = -3; i <= 3; i += 1) {
        const bullet = this.spawnPlayerBullet(
          this.player.x,
          this.player.y - 36,
          "agileOrb",
          13,
          -820,
          "temporary-prism"
        );
        bullet.setVelocity(i * 135, -790 + Math.abs(i) * 28).setTint(i % 2 ? 0xff7de3 : 0x2df4ff);
      }
      this.nextTemporaryPattern = time + 720;
    } else if (this.temporarySkill === "singularity") {
      const count = 16;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + time * 0.001;
        const bullet = this.spawnPlayerBullet(
          this.player.x,
          this.player.y - 22,
          "agileOrb",
          10,
          0,
          "agile-bloom"
        );
        bullet
          .setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480)
          .setTint(i % 2 ? 0x9b5cff : 0xffbd3e)
          .setData("born", time);
      }
      this.nextTemporaryPattern = time + 1280;
    } else {
      this.nextTemporaryPattern = time + 800;
    }
  }

  updatePlayer(time: number, dt: number): void {
    const left = this.wasd.A.isDown || (playVariant === "single" && this.cursors.left.isDown);
    const right = this.wasd.D.isDown || (playVariant === "single" && this.cursors.right.isDown);
    const up = this.wasd.W.isDown || (playVariant === "single" && this.cursors.up.isDown);
    const down = this.wasd.S.isDown || (playVariant === "single" && this.cursors.down.isDown);
    const speed =
      this.stats.speed *
      (1 +
        (save.selectedSpecialization === "wheelchair"
          ? (this.upgradeLevels.ram_drive ?? 0) * 0.06
          : (this.upgradeLevels.speed ?? 0) * 0.06)) *
      (save.selectedSpecialization === "agile" ? this.agileSpeedMultiplier() : 1) *
      (save.selectedSpecialization === "wheelchair" && time < this.wheelchairOverdriveUntil
        ? 1.9
        : 1);
    if (left || right || up || down) {
      const direction = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up))
        .normalize()
        .scale(speed);
      this.player.setVelocity(direction.x, direction.y);
      this.targetX = this.player.x;
      this.targetY = this.player.y;
    } else if (this.dragActive) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetX, this.targetY);
      if (distance > 4) {
        const maxStep = speed * 1.35 * dt;
        const t = Math.min(1, maxStep / distance);
        this.player.setPosition(
          Phaser.Math.Linear(this.player.x, this.targetX, t),
          Phaser.Math.Linear(this.player.y, this.targetY, t)
        );
      }
      this.player.setVelocity(0);
    } else {
      this.player.setVelocity(0);
    }
    if (
      save.selectedSpecialization === "wheelchair" &&
      time < this.wheelchairOverdriveUntil &&
      time >= this.nextTrail
    ) {
      const trail = this.add
        .circle(this.player.x + Phaser.Math.Between(-18, 18), this.player.y + 42, 7, 0xffbd3e, 0.82)
        .setDepth(8);
      this.tweens.add({
        targets: trail,
        y: trail.y + 90,
        scale: 0.25,
        alpha: 0,
        duration: 300,
        onComplete: () => trail.destroy()
      });
      this.nextTrail = time + 45;
    }
    this.player.setAlpha(time < this.invulnerableUntil && Math.floor(time / 80) % 2 === 0 ? 0.28 : 1);
    if (this.ultimateActive > 0) {
      this.ultimateActive -= dt;
      this.player.setTint(0x9ffcff);
      if (this.ultimateActive <= 0) this.player.setTint(SKINS[save.equippedSkin].tint);
    }
    if (this.player2) {
      const ship2Speed = SHIPS[selectedShip2].speed;
      const direction2 = new Phaser.Math.Vector2(
        Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
        Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown)
      );
      if (direction2.lengthSq() > 0) {
        direction2.normalize().scale(ship2Speed);
        this.player2.setVelocity(direction2.x, direction2.y);
      } else {
        this.player2.setVelocity(0);
      }
    }
  }

  updateWeapons(time: number): void {
    this.updateWingClones(time);
    if (save.selectedSpecialization === "wheelchair") {
      this.updateCollisionAcquiredWeapons(time);
      return;
    }
    const haste =
      this.stats.fireRateMultiplier *
      (1 + (this.upgradeLevels.haste ?? 0) * 0.07 * ATTACK_BONUS_SCALE);
    const ultimateHaste = this.ultimateActive > 0 ? 1.6 : 1;
    if ((this.actionKeys.SPACE.isDown || (this.sys.game.device.input.touch && this.dragActive)) && time >= this.nextShot) {
      const level = this.upgradeLevels.cannon ?? 1;
      this.fireCannon(level);
      this.nextShot = time + 190 / haste / ultimateHaste;
    }
    if (this.player2 && this.actionKeys.ENTER.isDown && time >= (this.player2.getData("nextShot") ?? 0)) {
      this.fireCannon(this.upgradeLevels.cannon ?? 1, this.player2, 2);
      this.player2.setData("nextShot", time + 210 / ultimateHaste);
    }
    if (this.skillsConfiscated) return;
    if ((this.upgradeLevels.laser ?? 0) > 0 && time >= this.nextLaser) {
      this.fireLaser(this.upgradeLevels.laser);
      this.nextLaser = time + 920 / haste / ultimateHaste;
    }
    if ((this.upgradeLevels.missile ?? 0) > 0 && time >= this.nextMissile) {
      this.fireMissiles(this.upgradeLevels.missile);
      this.nextMissile = time + 1250 / haste / ultimateHaste;
    }
    if ((this.upgradeLevels.drone ?? 0) > 0) {
      this.updateDrones(time);
      if (time >= this.nextDroneShot) {
        for (const drone of this.drones) {
          this.spawnPlayerBullet(drone.x, drone.y - 10, "playerBullet", 7, -920, "drone");
        }
        this.nextDroneShot = time + 620 / haste / ultimateHaste;
      }
    }
    if ((this.upgradeLevels.arc ?? 0) > 0 && time >= this.nextArc) {
      this.fireArc(this.upgradeLevels.arc);
      this.nextArc = time + 1450 / haste / ultimateHaste;
    }
    if ((this.upgradeLevels.blade ?? 0) > 0) this.updateBlades(time);
  }

  updateCollisionAcquiredWeapons(time: number): void {
    if (this.skillsConfiscated) return;
    const haste = Math.max(0.65, this.stats.fireRateMultiplier);
    const laserLevel = this.upgradeLevels.laser ?? 0;
    const missileLevel =
      (this.upgradeLevels.missile ?? 0) +
      (this.temporarySkill === "overdrive" && time < this.temporarySkillUntil ? 1 : 0);
    if (laserLevel > 0 && time >= this.nextLaser) {
      this.fireLaser(laserLevel);
      this.nextLaser = time + 1280 / haste;
    }
    if (missileLevel > 0 && time >= this.nextMissile) {
      this.fireMissiles(missileLevel);
      this.nextMissile = time + 1600 / haste;
    }
    if ((this.upgradeLevels.arc ?? 0) > 0 && time >= this.nextArc) {
      this.fireArc(this.upgradeLevels.arc);
      this.nextArc = time + 1750 / haste;
    }
    if ((this.upgradeLevels.blade ?? 0) > 0) this.updateBlades(time);
  }

  fireCannon(
    level: number,
    shooter: Phaser.Physics.Arcade.Image = this.player,
    owner = 1
  ): void {
    const spread = Math.min(3, Math.floor((level + 1) / 2));
    const powerCount = level >= 4 ? 3 : 2;
    if (owner === 1 && save.selectedSpecialization === "agile") {
      const projectileRatio =
        1.14 + Math.min(100, this.level) * 0.01 * ATTACK_BONUS_SCALE;
      this.agileBulletAccumulator += powerCount * projectileRatio;
      const bloomLevel = this.doctrineLevels.bloom_mastery ?? 0;
      const baseCount = Math.max(2, Math.floor(this.agileBulletAccumulator));
      this.agileBulletAccumulator -= baseCount;
      const count =
        baseCount +
        (bloomLevel > 0
          ? Math.max(1, Math.round((bloomLevel + 1) * ATTACK_BONUS_SCALE))
          : 0);
      this.agileVolleyIndex += 1;
      const patterns: AgileTrajectory[] = ["fan", "arc", "helix", "scatter", "cross", "circle"];
      let pattern = Phaser.Utils.Array.GetRandom(patterns);
      if (pattern === "circle" && this.time.now >= this.nextAgileBloom) {
        this.fireAgileBloom(level, shooter, owner);
        this.nextAgileBloom = this.time.now + Math.max(980, 1850 - this.level * 7);
        return;
      }
      if (pattern === "circle") pattern = "fan";
      for (let i = 0; i < count; i += 1) {
        const normalized = count === 1 ? 0 : i / (count - 1) - 0.5;
        let angle = -Math.PI / 2 + normalized * (1.18 + bloomLevel * 0.08);
        if (pattern === "arc") angle = -Math.PI / 2 + normalized * 0.5;
        if (pattern === "helix") angle = -Math.PI / 2 + normalized * 0.72;
        if (pattern === "scatter") angle = -Math.PI / 2 + Phaser.Math.FloatBetween(-0.82, 0.82);
        if (pattern === "cross") {
          angle = -Math.PI / 2 + (i % 2 === 0 ? -1 : 1) * (0.16 + Math.floor(i / 2) * 0.16);
        }
        const bullet = this.spawnPlayerBullet(
          shooter.x + normalized * 58,
          shooter.y - 38 + Math.sin(i * 2.3 + this.agileVolleyIndex * 0.7) * 12,
          "agileOrb",
          8 + level * 2.8 * ATTACK_BONUS_SCALE,
          0,
          "agile-orb",
          owner
        );
        bullet.setVelocity(Math.cos(angle) * 820, Math.sin(angle) * 820);
        bullet.setData(
          "curvePhase",
          (Math.PI * 2 * i) / count + this.agileVolleyIndex * 0.46
        );
        bullet.setData("curveAmount", 3.1 + Math.min(5, level * 0.17) + bloomLevel * 0.62);
        bullet.setData("born", this.time.now);
        bullet.setData("trajectory", pattern);
        bullet.setData("arcDirection", i % 2 === 0 ? -1 : 1);
        bullet.setTint(i % 3 === 0 ? 0xff7de3 : i % 2 ? 0x9b5cff : 0x2df4ff);
        (bullet.body as Phaser.Physics.Arcade.Body).setCircle(4, 7, 7);
      }
      if (this.time.now >= this.nextAgileBloom) {
        this.fireAgileBloom(level, shooter, owner);
        this.nextAgileBloom = this.time.now + Math.max(980, 1850 - this.level * 7);
      }
      if (Math.random() < 0.24) sfx("shoot");
      return;
    }
    const count = powerCount;
    const lanceLevel = owner === 1 ? this.doctrineLevels.lance_mastery ?? 0 : 0;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * 22;
      const bullet = this.spawnPlayerBullet(
        shooter.x + offset,
        shooter.y - 42,
        "playerBullet",
        (12 + level * 4 * ATTACK_BONUS_SCALE) *
          (1 + lanceLevel * 0.18 * ATTACK_BONUS_SCALE),
        -1050,
        "cannon",
        owner
      );
      bullet.setVelocityX(offset * spread * 0.6);
      bullet.setData("pierce", (level >= 5 ? 1 : 0) + lanceLevel);
    }
    if (Math.random() < 0.18) sfx("shoot");
  }

  fireAgileBloom(
    level: number,
    shooter: Phaser.Physics.Arcade.Image,
    owner: number
  ): void {
    const bloomLevel = this.doctrineLevels.bloom_mastery ?? 0;
    const count = Math.min(
      38,
      20 +
        Math.floor(this.level / 6) +
        Math.round(bloomLevel * 3 * ATTACK_BONUS_SCALE)
    );
    const phase = this.agileVolleyIndex * 0.24;
    const ring = this.add
      .circle(shooter.x, shooter.y - 16, 18, 0x2df4ff, 0.05)
      .setStrokeStyle(5, 0xff7de3, 0.9)
      .setDepth(18);
    this.tweens.add({
      targets: ring,
      radius: 118,
      alpha: 0,
      rotation: Math.PI,
      duration: 440,
      onComplete: () => ring.destroy()
    });
    for (let i = 0; i < count; i += 1) {
      const angle = phase + (Math.PI * 2 * i) / count;
      const bullet = this.spawnPlayerBullet(
        shooter.x + Math.cos(angle) * 25,
        shooter.y - 18 + Math.sin(angle) * 25,
        "agileOrb",
        5 + level * 1.25 * ATTACK_BONUS_SCALE,
        0,
        "agile-bloom",
        owner
      );
      bullet
        .setVelocity(Math.cos(angle) * 545, Math.sin(angle) * 545)
        .setTint(i % 3 === 0 ? 0xff7de3 : i % 2 ? 0x9b5cff : 0x2df4ff)
        .setData("born", this.time.now)
        .setData("curvePhase", angle);
      (bullet.body as Phaser.Physics.Arcade.Body).setCircle(4, 7, 7);
    }
    this.burst(shooter.x, shooter.y - 18, 0x9b5cff, 1.35);
  }

  fireLaser(level: number): void {
    const bullet = this.spawnPlayerBullet(
      this.player.x,
      this.player.y - 52,
      "laserBullet",
      28 + level * 12 * ATTACK_BONUS_SCALE,
      -1250,
      "laser"
    );
    bullet.setScale(1 + level * 0.13, 1);
    bullet.setData("pierce", 4 + level);
  }

  fireMissiles(level: number): void {
    const count = level >= 4 ? 3 : level >= 2 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const missile = this.spawnPlayerBullet(
        this.player.x + (i - (count - 1) / 2) * 32,
        this.player.y - 20,
        "missile",
        36 + level * 13 * ATTACK_BONUS_SCALE,
        -500,
        "missile"
      );
      missile.setData("target", this.nearestTarget(missile.x, missile.y));
    }
  }

  updateDrones(_time: number): void {
    const desired = Math.min(3, Math.ceil((this.upgradeLevels.drone ?? 0) / 2));
    while (this.drones.length < desired) {
      this.drones.push(this.add.image(this.player.x, this.player.y, "drone").setDepth(9));
    }
    this.drones.forEach((drone, index) => {
      const offset = (index - (this.drones.length - 1) / 2) * 88;
      drone.x = Phaser.Math.Linear(drone.x, this.player.x + offset, 0.18);
      drone.y = Phaser.Math.Linear(drone.y, this.player.y + 28 + Math.abs(offset) * 0.08, 0.18);
    });
  }

  fireArc(level: number): void {
    const targets = this.closestTargets(this.player.x, this.player.y, 1 + Math.floor(level / 2));
    if (!targets.length) return;
    const graphics = this.add.graphics().setDepth(20);
    graphics.lineStyle(5 + level, 0x8efcff, 0.95);
    let fromX = this.player.x;
    let fromY = this.player.y - 30;
    for (const target of targets) {
      graphics.lineBetween(fromX, fromY, target.x, target.y);
      this.dealDirectDamage(
        target,
        32 + level * 18 * ATTACK_BONUS_SCALE,
        target.x,
        target.y
      );
      fromX = target.x;
      fromY = target.y;
    }
    this.tweens.add({ targets: graphics, alpha: 0, duration: 150, onComplete: () => graphics.destroy() });
  }

  updateBlades(time: number): void {
    const desired = Math.min(5, 1 + (this.upgradeLevels.blade ?? 0));
    while (this.blades.length < desired) {
      this.blades.push(this.add.image(this.player.x, this.player.y, "blade").setDepth(12));
    }
    this.blades.forEach((blade, index) => {
      const angle = time * 0.0022 + (Math.PI * 2 * index) / this.blades.length;
      const radius = 80 + (this.upgradeLevels.blade ?? 0) * 5;
      blade.setPosition(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius);
      blade.rotation = angle * 2;
    });
    if (time >= this.nextBladeDamage) {
      const targets = [...this.enemies.getChildren(), ...this.bossParts.getChildren()] as Phaser.Physics.Arcade.Image[];
      for (const target of targets) {
        if (!target.active) continue;
        if (this.blades.some((blade) => Phaser.Math.Distance.Between(blade.x, blade.y, target.x, target.y) < 54)) {
          this.dealDirectDamage(
            target,
            18 + (this.upgradeLevels.blade ?? 0) * 11 * ATTACK_BONUS_SCALE,
            target.x,
            target.y
          );
        }
      }
      this.nextBladeDamage = time + 270;
    }
  }

  spawnPlayerBullet(
    x: number,
    y: number,
    texture: string,
    damage: number,
    velocityY: number,
    weapon: string,
    owner = 1
  ): Phaser.Physics.Arcade.Image {
    const bullet = this.playerBullets.get(x, y, texture) as Phaser.Physics.Arcade.Image;
    bullet.enableBody(true, x, y, true, true);
    bullet
      .setTexture(texture)
      .setActive(true)
      .setVisible(true)
      .setDepth(8)
      .setScale(1)
      .setAngle(0)
      .clearTint();
    (bullet.body as Phaser.Physics.Arcade.Body).setSize(bullet.width, bullet.height, true);
    bullet.setData("damage", damage * this.currentDamageMultiplier());
    bullet.setData("weapon", weapon);
    bullet.setData("owner", owner);
    bullet.setData("pierce", 0);
    bullet.setVelocity(0, velocityY);
    return bullet;
  }

  currentDamageMultiplier(): number {
    const passive =
      1 + (this.upgradeLevels.damage ?? 0) * 0.08 * ATTACK_BONUS_SCALE;
    const balanced =
      save.selectedShip === "balanced" && this.combo > 20
        ? 1 + 0.12 * ATTACK_BONUS_SCALE
        : 1;
    const devourLevel = this.doctrineLevels.devour_mastery ?? 0;
    const adaptiveDamage =
      1 +
      Math.min(
        0.45,
        Math.floor(this.kills / 12) * devourLevel * 0.02 * ATTACK_BONUS_SCALE
      );
    const agileCritConversion =
      save.selectedSpecialization === "agile"
        ? 1 +
          agileCritRateAttackBonus(this.virtualDoctrineCritChance()) *
            ATTACK_BONUS_SCALE
        : 1;
    const wheelchairHullAttack =
      save.selectedSpecialization === "wheelchair"
        ? this.wheelchairHullAttackMultiplier()
        : 1;
    const temporaryDamage =
      this.temporarySkill === "overdrive"
        ? 1 + 0.65 * ATTACK_BONUS_SCALE
        : this.temporarySkill === "prism"
          ? 1 + 0.25 * ATTACK_BONUS_SCALE
          : this.temporarySkill === "singularity"
            ? 1 + 0.35 * ATTACK_BONUS_SCALE
            : 1;
    return (
      this.stats.damageMultiplier *
      passive *
      balanced *
      adaptiveDamage *
      agileCritConversion *
      wheelchairHullAttack *
      temporaryDamage
    );
  }

  virtualDoctrineCritChance(): number {
    return Phaser.Math.Clamp(
      0.1 * SPECIALIZATION_BASE_STAT_BOOST +
        Math.max(0, this.level - 1) * 0.05 * ATTACK_BONUS_SCALE +
        (this.upgradeLevels.luck ?? 0) * 0.05 * ATTACK_BONUS_SCALE,
      0,
      0.75
    );
  }

  doctrineCritEffect(): number {
    return Math.min(
      3.5,
      1.2 * SPECIALIZATION_BASE_STAT_BOOST +
        Math.max(0, this.level - 1) * 0.05 * ATTACK_BONUS_SCALE +
        (this.upgradeLevels.luck ?? 0) * 0.05 * ATTACK_BONUS_SCALE
    );
  }

  actualCritChance(): number {
    if (save.selectedSpecialization === "agile" || save.selectedSpecialization === "wheelchair") {
      return 0;
    }
    if (save.selectedSpecialization === "power") return this.virtualDoctrineCritChance();
    return Phaser.Math.Clamp(
      this.stats.critChance +
        (this.upgradeLevels.luck ?? 0) * 0.04 * ATTACK_BONUS_SCALE,
      0,
      0.75
    );
  }

  actualCritMultiplier(): number {
    return save.selectedSpecialization === "power"
      ? this.doctrineCritEffect()
      : 1.75 * SPECIALIZATION_BASE_STAT_BOOST;
  }

  agileSpeedMultiplier(): number {
    return agileCritEffectSpeedMultiplier(this.doctrineCritEffect());
  }

  updateProjectiles(time: number): void {
    this.playerBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return true;
      if (String(bullet.getData("weapon") ?? "").includes("missile")) {
        let target = bullet.getData("target") as Phaser.Physics.Arcade.Image | null;
        if (!target?.active) {
          target = this.nearestTarget(bullet.x, bullet.y);
          bullet.setData("target", target);
        }
        if (target) {
          this.physics.moveToObject(bullet, target, 650);
          bullet.rotation = Phaser.Math.Angle.Between(bullet.x, bullet.y, target.x, target.y) + Math.PI / 2;
        }
      }
      if (bullet.getData("weapon") === "agile-orb") {
        const age = time - (bullet.getData("born") ?? time);
        const trajectory = bullet.getData("trajectory") ?? "helix";
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (trajectory === "arc") {
          body.velocity.x = Phaser.Math.Clamp(
            body.velocity.x + (bullet.getData("arcDirection") ?? 1) * 7,
            -470,
            470
          );
        } else if (trajectory === "helix") {
          bullet.x +=
            Math.sin(age * 0.019 + (bullet.getData("curvePhase") ?? 0)) *
            (bullet.getData("curveAmount") ?? 2.4) *
            1.35;
        } else if (trajectory === "fan") {
          bullet.x +=
            Math.sin(age * 0.011 + (bullet.getData("curvePhase") ?? 0)) *
            (bullet.getData("curveAmount") ?? 2.4);
        } else if (trajectory === "cross" && age > 220) {
          body.velocity.x = Phaser.Math.Linear(body.velocity.x, -body.velocity.x * 0.85, 0.045);
        }
        bullet.rotation += 0.18;
      }
      if (bullet.getData("weapon") === "agile-bloom") {
        const age = time - (bullet.getData("born") ?? time);
        bullet.rotation += 0.24;
        if (age > 310) {
          const body = bullet.body as Phaser.Physics.Arcade.Body;
          bullet.setVelocity(
            Phaser.Math.Linear(body.velocity.x, 0, 0.045),
            Phaser.Math.Linear(body.velocity.y, -780, 0.075)
          );
        }
      }
      if (playVariant !== "single" && this.player2?.active) {
        const owner = bullet.getData("owner") ?? 1;
        const opponent = owner === 1 ? this.player2 : this.player;
        const weapon = String(bullet.getData("weapon") ?? "");
        const explosive =
          weapon.includes("missile") ||
          weapon.includes("bombardment") ||
          weapon.includes("singularity");
        const hitRadius = explosive ? 92 : 30;
        if (
          opponent.active &&
          Phaser.Math.Distance.Between(bullet.x, bullet.y, opponent.x, opponent.y) < hitRadius
        ) {
          const bulletDamage = Math.max(1, Number(bullet.getData("damage") ?? 10));
          const friendlyDamage = Phaser.Math.Clamp(
            bulletDamage * (explosive ? 0.5 : 0.3),
            explosive ? 10 : 4,
            explosive ? 90 : 55
          );
          if (owner === 1) {
            this.damagePlayer2Friendly(friendlyDamage, explosive);
            if (playVariant === "score_duel") this.score += 75;
          } else {
            this.damagePlayerFriendly(friendlyDamage, explosive);
            if (playVariant === "score_duel") this.score2 += 75;
          }
          this.impactBurst(
            opponent.x,
            opponent.y,
            explosive ? 0xff8a3d : owner === 1 ? 0x2df4ff : 0x9b5cff
          );
          bullet.disableBody(true, true);
          return true;
        }
      }
      if (bullet.y < -100 || bullet.y > WORLD_HEIGHT + 100 || bullet.x < -100 || bullet.x > WORLD_WIDTH + 100) {
        bullet.disableBody(true, true);
      }
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return true;
      if (time < this.enemyFreezeUntil) {
        if (!bullet.getData("supportControlled")) {
          const body = bullet.body as Phaser.Physics.Arcade.Body;
          bullet
            .setData("supportStoredVelocityX", body.velocity.x)
            .setData("supportStoredVelocityY", body.velocity.y)
            .setData("supportControlled", true);
        }
        bullet.setVelocity(0, 0);
        return true;
      }
      if (bullet.getData("supportControlled")) {
        bullet
          .setVelocity(
            bullet.getData("supportStoredVelocityX") ?? 0,
            bullet.getData("supportStoredVelocityY") ?? 0
          )
          .setData("supportControlled", false);
      }
      if (time < (bullet.getData("homingUntil") ?? 0) && this.player.active) {
        this.physics.moveToObject(bullet, this.player, bullet.getData("homingSpeed") ?? 250);
        bullet.rotation =
          Phaser.Math.Angle.Between(bullet.x, bullet.y, this.player.x, this.player.y) + Math.PI / 2;
      }
      if (bullet.y > WORLD_HEIGHT + 60 || bullet.y < -100 || bullet.x < -80 || bullet.x > WORLD_WIDTH + 80) {
        bullet.disableBody(true, true);
      }
      return true;
    });
  }

  spawnEnemy(time: number, forcedType?: string): Phaser.Physics.Arcade.Image {
    const levelConfig = LEVELS[selectedLevel - 1];
    const scorePressure = Math.min(3.2, (this.score + this.score2) / Math.max(3200, this.nextBossScore));
    const intensity =
      0.78 +
      levelConfig.danger * 0.08 +
      this.elapsedSeconds / 240 +
      scorePressure * 0.32 +
      this.bossTier * 0.09;
    const roll = Math.random();
    let rolledType: EnemyType =
      roll > 0.94
        ? "courier"
        : roll > 0.88 && this.elapsedSeconds > 55
          ? "bomber"
          : roll > 0.8 && this.elapsedSeconds > 38
            ? "gunship"
            : roll > 0.68 && this.elapsedSeconds > 28
              ? "mine_layer"
              : roll > 0.52 && this.elapsedSeconds > 18
                ? "suppressor"
                : roll > 0.34 && this.elapsedSeconds > 10
                  ? "striker"
                  : roll > 0.17
                    ? "interceptor"
                    : "scout";
    if (selectedMode === "boss" && !forcedType) {
      rolledType = Phaser.Utils.Array.GetRandom(
        campaignEnemyRoster(this.campaignBossesDefeated)
      ) as EnemyType;
    }
    const forcedElite = forcedType?.startsWith("elite_") ?? false;
    const rawType = (forcedType?.replace(/^elite_/, "") ?? rolledType) as EnemyType;
    const validTypes: EnemyType[] = [
      "scout",
      "interceptor",
      "striker",
      "suppressor",
      "mine_layer",
      "gunship",
      "bomber",
      "courier"
    ];
    const type: EnemyType = validTypes.includes(rawType) ? rawType : "scout";
    const eliteChance = Phaser.Math.Clamp(
      0.06 + levelConfig.danger * 0.014 + this.bossTier * 0.025 + this.elapsedSeconds / 1500,
      0.07,
      0.34
    );
    const eliteVariant =
      forcedElite ||
      (!forcedType &&
        (selectedMode === "boss" ? rollCampaignElite(selectedLevel) : Math.random() < eliteChance));
    const mutated =
      !forcedType && selectedMode === "boss" && rollCampaignMutation(selectedLevel);
    const mutation: EnemyMutation | null = mutated
      ? Phaser.Utils.Array.GetRandom(["homing", "mine_burst", "armor", "dash", "suppress"] as EnemyMutation[])
      : null;
    const eliteClass = eliteVariant || type === "gunship" || type === "bomber";
    const textures: Record<EnemyType, string> = {
      scout: "enemyScoutArt",
      interceptor: "enemyInterceptorArt",
      striker: "enemyStrikerArt",
      suppressor: "enemySuppressorArt",
      mine_layer: "enemyMineLayerArt",
      gunship: "enemyGunshipArt",
      bomber: "enemyBomberArt",
      courier: "enemyCourierArt"
    };
    const eliteTextures: Record<EnemyType, string> = {
      scout: "enemyEliteScoutArt",
      interceptor: "enemyEliteInterceptorArt",
      striker: "enemyEliteStrikerArt",
      suppressor: "enemyEliteSuppressorArt",
      mine_layer: "enemyEliteMineLayerArt",
      gunship: "enemyEliteArt",
      bomber: "enemyEliteBomberArt",
      courier: "enemyEliteCourierArt"
    };
    const texture = eliteVariant ? eliteTextures[type] : textures[type];
    const enemy = this.enemies.get(Phaser.Math.Between(70, WORLD_WIDTH - 70), -80, texture) as Phaser.Physics.Arcade.Image;
    enemy.enableBody(true, enemy.x, -80, true, true);
    enemy
      .setTexture(texture)
      .setDepth(eliteVariant ? 9 : 7)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .clearTint()
      .setAngle(
        (!eliteVariant && type === "interceptor") || (eliteVariant && type === "gunship")
          ? 180
          : 0
      );
    const displaySizes: Record<EnemyType, { width: number; height: number }> = {
      scout: { width: 68, height: 76 },
      interceptor: { width: 78, height: 88 },
      striker: { width: 92, height: 104 },
      suppressor: { width: 112, height: 116 },
      mine_layer: { width: 126, height: 132 },
      gunship: { width: 142, height: 154 },
      bomber: { width: 166, height: 174 },
      courier: { width: 86, height: 94 }
    };
    const displaySize = displaySizes[type];
    enemy.setDisplaySize(
      displaySize.width * (eliteVariant ? 1.12 : 1),
      displaySize.height * (eliteVariant ? 1.12 : 1)
    );
    (enemy.body as Phaser.Physics.Arcade.Body).setSize(
      enemy.width * (eliteClass ? 0.66 : 0.58),
      enemy.height * 0.72,
      true
    );
    const baseHp = (
      {
        scout: 36,
        interceptor: 32,
        striker: 60,
        suppressor: 82,
        mine_layer: 115,
        gunship: 185,
        bomber: 270,
        courier: 52
      } as Record<EnemyType, number>
    )[type];
    const hp =
      baseHp *
      (1 + this.elapsedSeconds * 0.0035 + scorePressure * 0.24 + levelConfig.danger * 0.06) *
      enemyUpgradeScale() *
      (eliteVariant ? 2.15 : 1) *
      (mutation === "armor" ? 1.55 : mutated ? 1.18 : 1);
    const scoreValue = (
      {
        scout: 90,
        interceptor: 110,
        striker: 170,
        suppressor: 220,
        mine_layer: 300,
        gunship: 420,
        bomber: 600,
        courier: 160
      } as Record<EnemyType, number>
    )[type] * (eliteVariant ? 1.65 : 1);
    const xpValue = (
      {
        scout: 5,
        interceptor: 6,
        striker: 10,
        suppressor: 13,
        mine_layer: 18,
        gunship: 24,
        bomber: 32,
        courier: 9
      } as Record<EnemyType, number>
    )[type] * (eliteVariant ? 1.65 : 1);
    enemy.setData({
      type,
      hp,
      maxHp: hp,
      score: Math.round(scoreValue),
      xp: Math.round(xpValue),
      born: time,
      originX: enemy.x,
      elite: eliteVariant,
      heavy: type === "gunship" || type === "bomber",
      eliteVariant,
      mutated,
      mutation,
      damageScale: (eliteVariant ? 1.45 : 1) * (mutated ? 1.28 : 1),
      aiPattern: Phaser.Math.Between(0, 2),
      debugInjected: false,
      ramInjected: false,
      nextFire: time + Phaser.Math.Between(900, 1800)
    });
    const baseSpeed = (
      {
        scout: 150,
        interceptor: 210,
        striker: 155,
        suppressor: 125,
        mine_layer: 95,
        gunship: 105,
        bomber: 82,
        courier: 185
      } as Record<EnemyType, number>
    )[type];
    const cruiseVelocityX = type === "courier" ? Phaser.Math.Between(-55, 55) : 0;
    const cruiseVelocityY =
      baseSpeed *
      Math.min(1.45, intensity) *
      0.72 *
      (eliteVariant ? 0.92 : 1) *
      (mutation === "dash" ? 1.38 : 1);
    enemy
      .setVelocity(cruiseVelocityX, cruiseVelocityY)
      .setData("cruiseVelocityX", cruiseVelocityX)
      .setData("cruiseVelocityY", cruiseVelocityY)
      .setData("supportControlled", false);
    if (eliteVariant) {
      this.floatText(enemy.x, 48, "ELITE", true);
    }
    if (mutated) {
      enemy.setScale(enemy.scaleX * 1.06, enemy.scaleY * 1.06);
      this.floatText(enemy.x, 76, `MUTATION // ${mutation?.toUpperCase()}`, true);
    }
    return enemy;
  }

  updateEnemies(time: number, _dt: number): void {
    if (selectedMode !== "boss" && !this.bossActive && time >= this.nextSpawn) {
      this.spawnEnemy(time);
      const scorePressure = (this.score + this.score2) / 5000;
      const interval = Phaser.Math.Clamp(
        760 - this.elapsedSeconds * 2.2 - scorePressure * 85 - selectedLevel * 28,
        190,
        760
      );
      this.nextSpawn = time + interval;
    }
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (!enemy.active) return true;
      const type = enemy.getData("type") as EnemyType;
      const age = time - enemy.getData("born");
      const frozenBySupport = time < this.enemyFreezeUntil;
      const slowedBySupport = !frozenBySupport && time < this.enemySlowUntil;
      if (frozenBySupport || slowedBySupport) {
        if (!enemy.getData("supportControlled")) {
          const body = enemy.body as Phaser.Physics.Arcade.Body;
          enemy
            .setData("supportStoredVelocityX", body.velocity.x)
            .setData("supportStoredVelocityY", body.velocity.y)
            .setData("supportControlled", true);
        }
        const slowLevel = this.airSupportLevels.stasis_wake ?? 1;
        const slowFactor = frozenBySupport ? 0 : Math.max(0.2, 0.35 - slowLevel * 0.03);
        enemy.setVelocity(
          (enemy.getData("supportStoredVelocityX") ?? 0) * slowFactor,
          (enemy.getData("supportStoredVelocityY") ?? enemy.getData("cruiseVelocityY") ?? 0) *
            slowFactor
        );
      } else if (enemy.getData("supportControlled")) {
        enemy
          .setVelocity(
            enemy.getData("supportStoredVelocityX") ?? enemy.getData("cruiseVelocityX") ?? 0,
            enemy.getData("supportStoredVelocityY") ?? enemy.getData("cruiseVelocityY") ?? 0
          )
          .setData("supportControlled", false);
      }
      if (enemy.getData("eliteVariant")) {
        enemy.setAlpha(0.88 + Math.sin(time * 0.008 + enemy.getData("aiPattern")) * 0.12);
      }
      if (!frozenBySupport) {
        if (type === "scout") {
          enemy.x = enemy.getData("originX") + Math.sin(age * 0.003) * 48;
        } else if (type === "interceptor") {
          enemy.x = enemy.getData("originX") + Math.sin(age * 0.006) * 105;
        } else if (type === "striker") {
          enemy.x =
            enemy.getData("originX") +
            Math.sin(age * 0.0048 + enemy.getData("aiPattern")) * 125;
        } else if (type === "suppressor") {
          enemy.x =
            enemy.getData("originX") +
            Math.sin(age * 0.0026 + enemy.getData("aiPattern")) * 165;
        } else if (type === "mine_layer") {
          enemy.x =
            enemy.getData("originX") +
            Math.sin(age * 0.0017 + enemy.getData("aiPattern")) * 120;
        } else if (type === "gunship") {
          enemy.x = Phaser.Math.Clamp(
            enemy.getData("originX") +
              Math.sin(age * 0.0018 + enemy.getData("aiPattern")) * 175,
            90,
            WORLD_WIDTH - 90
          );
        } else if (type === "bomber") {
          enemy.x = Phaser.Math.Clamp(
            enemy.getData("originX") +
              Math.sin(age * 0.00125 + enemy.getData("aiPattern")) * 130,
            100,
            WORLD_WIDTH - 100
          );
        }
      }
      if (
        type !== "courier" &&
        !frozenBySupport &&
        time > enemy.getData("nextFire") &&
        enemy.y > 90 &&
        enemy.y < WORLD_HEIGHT * 0.7
      ) {
        if (type === "bomber" || type === "gunship") {
          this.fireElitePattern(enemy, type);
        } else if (type === "striker" || type === "suppressor" || type === "mine_layer") {
          this.fireMidTierPattern(enemy, type);
        } else {
          this.fireEnemyAtPlayer(
            enemy.x,
            enemy.y + 24,
            (type === "interceptor" ? 11 : 10) * (enemy.getData("damageScale") ?? 1),
            type === "interceptor" ? 350 : 260
          );
        }
        if (enemy.getData("mutated")) {
          this.fireMutationPattern(enemy, enemy.getData("mutation") as EnemyMutation);
        }
        enemy.setData(
          "nextFire",
          time +
            (type === "bomber" || type === "gunship"
              ? Phaser.Math.Between(1150, 1950)
              : type === "mine_layer"
                ? Phaser.Math.Between(1750, 2250)
                : type === "suppressor"
                  ? Phaser.Math.Between(1300, 1750)
                  : type === "striker"
                    ? Phaser.Math.Between(1150, 1500)
              : type === "interceptor"
                ? 1450
                : 1800) * (enemy.getData("eliteVariant") ? 0.8 : 1)
        );
      }
      if (enemy.y > WORLD_HEIGHT + 100) {
        if (type === "courier") {
          this.destroyEnemy(enemy, true);
          this.showBanner("补给机自毁 · 代币已回收", 650);
        } else {
          enemy.disableBody(true, true);
        }
      }
      return true;
    });
    if (time >= this.nextTaunt && !this.bossActive) {
      const speaker = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (enemy) => enemy.active && enemy.y > 110 && enemy.y < WORLD_HEIGHT * 0.55
      );
      if (speaker) {
        this.showTaunt(speaker);
        this.nextTaunt = time + Phaser.Math.Between(3600, 6500);
      }
    }
  }

  fireMutationPattern(enemy: Phaser.Physics.Arcade.Image, mutation: EnemyMutation): void {
    const damage = 14 * (enemy.getData("damageScale") ?? 1);
    if (mutation === "homing") {
      for (let index = -1; index <= 1; index += 1) {
        this.fireEnemyAngle(enemy.x + index * 20, enemy.y + 28, Math.PI / 2, 205, damage)
          .setTint(0x9b5cff)
          .setData("homingUntil", this.time.now + 1450)
          .setData("homingSpeed", 300);
      }
    } else if (mutation === "mine_burst") {
      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        this.fireEnemyAngle(enemy.x, enemy.y, angle, 165, damage, "explosion").setTint(0xff3dbb);
      }
    } else if (mutation === "dash") {
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      enemy.setVelocity(Math.cos(angle) * 330, Math.sin(angle) * 330);
      this.fireEnemyAngle(enemy.x, enemy.y, angle, 410, damage).setTint(0xffbd3e);
    } else if (mutation === "suppress") {
      const safeGap = Phaser.Math.Between(-2, 2);
      for (let index = -5; index <= 5; index += 1) {
        if (Math.abs(index - safeGap) <= 1) continue;
        this.fireEnemyAngle(
          enemy.x,
          enemy.y + 26,
          Math.PI / 2 + index * 0.13,
          235,
          damage
        ).setTint(0x9b5cff);
      }
    } else {
      const shield = this.add
        .circle(enemy.x, enemy.y, enemy.displayWidth * 0.55, 0xffbd3e, 0.04)
        .setStrokeStyle(4, 0xffbd3e, 0.72)
        .setDepth(13);
      this.tweens.add({ targets: shield, scale: 1.25, alpha: 0, duration: 520, onComplete: () => shield.destroy() });
    }
  }

  fireMidTierPattern(
    enemy: Phaser.Physics.Arcade.Image,
    type: "striker" | "suppressor" | "mine_layer"
  ): void {
    const damageScale = enemy.getData("damageScale") ?? 1;
    const pulseColor =
      type === "striker" ? 0xff8a3d : type === "suppressor" ? 0x9b5cff : 0xff3dbb;
    const charge = this.add
      .circle(enemy.x, enemy.y + 22, 12, pulseColor, 0.12)
      .setStrokeStyle(3, pulseColor, 0.85)
      .setDepth(14);
    this.tweens.add({
      targets: charge,
      radius: type === "mine_layer" ? 48 : 34,
      alpha: 0,
      duration: 270,
      onComplete: () => charge.destroy()
    });
    if (type === "striker") {
      for (let i = -1; i <= 1; i += 1) {
        this.fireEnemyAngle(
          enemy.x,
          enemy.y + 28,
          Math.PI / 2 + i * 0.19,
          330,
          13 * damageScale
        ).setTint(0xff9a4d);
      }
      return;
    }
    if (type === "suppressor") {
      if (Math.random() < 0.5) {
        for (let i = -2; i <= 2; i += 1) {
          if (i === 0) continue;
          this.fireEnemyAngle(
            enemy.x + i * 20,
            enemy.y + 30,
            Math.PI / 2 + i * 0.1,
            275,
            15 * damageScale
          ).setTint(i % 2 ? 0x2df4ff : 0x9b5cff);
        }
      } else {
        const bullet = this.fireEnemyAngle(
          enemy.x,
          enemy.y + 30,
          Math.PI / 2,
          230,
          16 * damageScale
        );
        bullet
          .setTint(0x9b5cff)
          .setScale(1.2)
          .setData("homingUntil", this.time.now + 850)
          .setData("homingSpeed", 270);
      }
      return;
    }
    const count = 10;
    const safeGap = Phaser.Math.Between(2, count - 3);
    for (let i = 0; i < count; i += 1) {
      if (Math.abs(i - safeGap) <= 1) continue;
      const angle = 0.18 + ((Math.PI - 0.36) * i) / (count - 1);
      this.fireEnemyAngle(
        enemy.x,
        enemy.y + 32,
        angle,
        190,
        18 * damageScale,
        "explosion"
      )
        .setTint(i % 2 ? 0xff3dbb : 0xffbd3e)
        .setScale(1.25);
    }
  }

  fireElitePattern(enemy: Phaser.Physics.Arcade.Image, type: string): void {
    const pattern = Phaser.Math.Between(0, 2);
    const isBomber = type === "bomber";
    const damageScale = enemy.getData("damageScale") ?? 1;
    const glow = this.add
      .circle(enemy.x, enemy.y + 18, 18, isBomber ? 0xff5a3d : 0x9b5cff, 0.06)
      .setStrokeStyle(4, isBomber ? 0xffbd3e : 0xff7de3, 0.78)
      .setDepth(15);
    this.tweens.add({ targets: glow, radius: 62, alpha: 0, duration: 340, onComplete: () => glow.destroy() });
    if (pattern === 0) {
      const count = isBomber ? 5 : 4;
      for (let i = -count; i <= count; i += 1) {
        if (!isBomber && Math.abs(i) === 1) continue;
        this.fireEnemyAngle(
          enemy.x,
          enemy.y + 34,
          Math.PI / 2 + i * (isBomber ? 0.14 : 0.17),
          isBomber ? 275 : 315,
          (isBomber ? 28 : 22) * damageScale,
          isBomber ? "explosion" : "projectile"
        );
      }
    } else if (pattern === 1) {
      const count = isBomber ? 7 : 4;
      for (let i = 0; i < count; i += 1) {
        const bullet = this.fireEnemyAngle(
          enemy.x + (i - (count - 1) / 2) * 20,
          enemy.y + 30,
          Math.PI / 2 + Phaser.Math.FloatBetween(-0.34, 0.34),
          isBomber ? 210 : 245,
          (isBomber ? 26 : 20) * damageScale,
          isBomber ? "explosion" : "projectile"
        );
        bullet
          .setTint(isBomber ? 0xffbd3e : 0xff7de3)
          .setData("homingUntil", this.time.now + (isBomber ? 700 : 1150))
          .setData("homingSpeed", isBomber ? 235 : 285);
      }
    } else {
      const count = isBomber ? 16 : 12;
      const safeGap = Phaser.Math.Between(2, count - 3);
      for (let i = 0; i < count; i += 1) {
        if (Math.abs(i - safeGap) <= 1) continue;
        const angle = 0.12 + ((Math.PI - 0.24) * i) / (count - 1);
        this.fireEnemyAngle(
          enemy.x,
          enemy.y + 28,
          angle,
          isBomber ? 245 : 280,
          (isBomber ? 25 : 21) * damageScale,
          isBomber ? "explosion" : "projectile"
        ).setTint(i % 2 ? 0xff3dbb : 0x9b5cff);
      }
    }
  }

  fireEnemyAtPlayer(x: number, y: number, damage: number, speed: number): void {
    const effectiveDamage = damage * (this.bossActive ? (this.bossElite ? 1.58 : 1.18) : 1);
    const bullet = this.enemyBullets.get(x, y, "enemyBullet") as Phaser.Physics.Arcade.Image;
    bullet.enableBody(true, x, y, true, true);
    bullet.setTexture("enemyBullet").setTint(effectiveDamage >= 20 ? 0xff3dbb : 0xffffff).setDepth(8);
    bullet.setData("damage", effectiveDamage);
    bullet.setData("damageType", "projectile");
    bullet.setData("damageSource", "minion");
    bullet.setData("supportControlled", false);
    this.physics.moveToObject(bullet, this.player, speed);
  }

  fireEnemyAngle(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    damageType: "projectile" | "explosion" = "projectile",
    damageSource: EnemyDamageSource = "minion"
  ): Phaser.Physics.Arcade.Image {
    const effectiveDamage = damage * (this.bossActive ? (this.bossElite ? 1.58 : 1.18) : 1);
    const bullet = this.enemyBullets.get(x, y, "enemyBullet") as Phaser.Physics.Arcade.Image;
    bullet.enableBody(true, x, y, true, true);
    bullet.setTexture("enemyBullet").setTint(effectiveDamage >= 20 ? 0xff3dbb : 0xffffff).setDepth(8);
    bullet.setData("damage", effectiveDamage);
    bullet.setData("damageType", damageType);
    bullet.setData("damageSource", damageSource);
    bullet.setData("supportControlled", false);
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    return bullet;
  }

  hitEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active || !enemy.active) return;
    enemy.setData("lastOwner", bullet.getData("owner") ?? 1);
    this.dealDirectDamage(enemy, bullet.getData("damage"), bullet.x, bullet.y);
    if ((bullet.getData("owner") ?? 1) === 1) this.applyHitTrait();
    const remainingPierce = bullet.getData("pierce") ?? 0;
    if (remainingPierce > 0) bullet.setData("pierce", remainingPierce - 1);
    else bullet.disableBody(true, true);
  }

  dealDirectDamage(target: Phaser.Physics.Arcade.Image, baseDamage: number, x: number, y: number): void {
    if (!target.active) return;
    const critical = Math.random() < this.actualCritChance();
    const damage = Math.round(baseDamage * (critical ? this.actualCritMultiplier() : 1));
    if (this.bossParts.contains(target)) {
      this.damageBossPart(target, damage);
    } else {
      const hp = (target.getData("hp") ?? 1) - damage;
      target.setData("hp", hp);
      target.setData("lastHitCritical", critical);
      target.setTintFill(critical ? 0xffb4ef : 0xffffff);
      this.time.delayedCall(55, () => {
        if (!target.active) return;
        target.clearTint();
      });
      if (hp <= 0) this.destroyEnemy(target, true);
    }
    if (save.settings.damageNumbers && Math.random() > 0.45) this.floatText(x, y, `${damage}`, critical);
    if (Math.random() > 0.82) sfx("hit");
  }

  destroyEnemy(enemy: Phaser.Physics.Arcade.Image, reward: boolean): void {
    if (!enemy.active) return;
    const x = enemy.x;
    const y = enemy.y;
    if (reward) {
      this.kills += 1;
      if (this.campaignInterludeActive) {
        this.campaignInterludeKills = Math.min(
          this.campaignInterludeTarget,
          this.campaignInterludeKills + 1
        );
        this.showBanner(
          `终战整备 · 击破 ${this.campaignInterludeKills}/${this.campaignInterludeTarget}`,
          520
        );
        if (this.campaignInterludeKills >= this.campaignInterludeTarget) {
          this.time.delayedCall(0, () => this.completeCampaignInterlude());
        }
      }
      const enemyType = enemy.getData("type") as string;
      const baseToken = (
        {
          scout: 1,
          interceptor: 2,
          striker: 3,
          suppressor: 4,
          mine_layer: 5,
          gunship: 6,
          bomber: 8,
          courier: 4
        } as Record<string, number>
      )[enemyType] ?? 1;
      const difficultyTokens =
        baseToken +
        Math.floor((LEVELS[selectedLevel - 1].danger - 1) / 2) +
        Math.floor(this.bossTier / 2) +
        (enemy.getData("eliteVariant") ? 3 : 0);
      this.runTokens += difficultyTokens;
      if (
        save.selectedSpecialization === "power" &&
        enemy.getData("lastHitCritical") === true &&
        (enemy.getData("lastOwner") ?? 1) === 1
      ) {
        this.stats.maxHp += 2;
        this.healPlayer(
          this.stats.maxHp * 0.05 * SPECIALIZATION_BASE_STAT_BOOST,
          "暴击处决"
        );
        this.floatText(x, y - 48, "MAX HP +2", true);
      }
      if (
        save.selectedSpecialization === "wheelchair" &&
        enemy.getData("wheelchairRamKill") === true
      ) {
        const capturedHull = Math.max(
          1,
          Math.round(
            (enemy.getData("maxHp") ?? enemy.getData("hp") ?? 20) *
              (0.05 + (this.upgradeLevels.ram_salvage ?? 0) * 0.0075)
          )
        );
        this.stats.maxHp = Math.round(this.stats.maxHp + capturedHull);
        this.floatText(
          x,
          y - 48,
          `撞击回收 · MAX HP +${Math.round(capturedHull)}`,
          true
        );
      }
      const eliteKill = Boolean(enemy.getData("elite"));
      if (save.selectedSpecialization === "agile" && eliteKill) {
        const oldMaxHp = this.stats.maxHp;
        this.stats.maxHp = Math.ceil(this.stats.maxHp * 1.05);
        this.recordAgileMaxHpGain(this.stats.maxHp - oldMaxHp);
        this.floatText(x, y - 52, `敏捷掠夺 · MAX HP ${this.stats.maxHp}`, true);
      }
      if (eliteKill && Math.random() < 0.42) this.spawnSkillPickup(x, y);
      this.applyKillTrait();
      this.combo += 1;
      this.comboTimer = 2.5;
      const earned = Math.round((enemy.getData("score") ?? 50) * (1 + Math.min(2, this.combo / 100)));
      if (playVariant === "score_duel" && enemy.getData("lastOwner") === 2) this.score2 += earned;
      else this.score += earned;
      this.ultimate = Math.min(
        100,
        this.ultimate + (eliteKill ? 5 : 1)
      );
      this.spawnExperiencePickup(x, y, enemy.getData("xp") ?? 5);
      this.burst(x, y, 0xff4d6d);
      this.floatText(x + 24, y - 20, `◆ +${difficultyTokens}`, true);
      this.unlockAchievement("first_blood");
      if (Math.max(this.score, this.score2) >= 10000) this.unlockAchievement("score_10k");
    }
    enemy.disableBody(true, true);
  }

  applyKillTrait(): void {
    if (save.selectedSpecialization === "defender") {
      this.healPlayer(
        this.stats.maxHp * 0.02 * SPECIALIZATION_BASE_STAT_BOOST,
        `重甲回收 +${formatRoundedNumber(
          2 * SPECIALIZATION_BASE_STAT_BOOST
        )}%`
      );
    } else if (save.selectedSpecialization === "devour") {
      this.stats.maxHp = Math.ceil(this.stats.maxHp * 1.02);
      this.stats.hp = roundHealth(
        this.stats.hp +
          this.stats.maxHp * 0.01 * SPECIALIZATION_BASE_STAT_BOOST,
        this.stats.maxHp
      );
      if (this.kills % 4 === 0) {
        this.showBanner(`吞噬进化 · 最大生命 ${this.stats.maxHp}`, 600);
      }
    }
  }

  applyHitTrait(): void {
    const bloodLevel = this.doctrineLevels.blood_mastery ?? 0;
    if (bloodLevel > 0) {
      this.bloodHitCounter += 1;
      const threshold = Math.max(7, 14 - bloodLevel);
      if (this.bloodHitCounter >= threshold) {
        this.bloodHitCounter = 0;
        const radius = 190 + bloodLevel * 28;
        const damage = 46 + bloodLevel * 26;
        const wave = this.add
          .circle(this.player.x, this.player.y, 24, 0xff3d7f, 0.08)
          .setStrokeStyle(7, 0xff3d7f, 0.88)
          .setDepth(24);
        this.tweens.add({
          targets: wave,
          radius,
          alpha: 0,
          duration: 360,
          onComplete: () => wave.destroy()
        });
        this.closestTargets(this.player.x, this.player.y, 8).forEach((target) => {
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y) <= radius) {
            this.dealDirectDamage(target, damage, target.x, target.y);
          }
        });
        this.showBanner("血潮回响", 480);
      }
    }
    if (save.selectedSpecialization !== "vampire" || this.stats.hp >= this.stats.maxHp) return;
    const healed = Math.max(
      0.15,
      (this.stats.maxHp - this.stats.hp) *
        0.03 *
        SPECIALIZATION_BASE_STAT_BOOST
    );
    this.stats.hp = roundHealth(this.stats.hp + healed, this.stats.maxHp);
    if (Math.random() > 0.72) {
      const mote = this.add
        .circle(this.player.x + Phaser.Math.Between(-30, 30), this.player.y - 34, 5, 0xff3d7f, 0.85)
        .setDepth(20);
      this.tweens.add({
        targets: mote,
        x: this.player.x,
        y: this.player.y,
        alpha: 0,
        duration: 260,
        onComplete: () => mote.destroy()
      });
    }
  }

  recordAgileMaxHpGain(amount: number): void {
    if (save.selectedSpecialization !== "agile" || amount <= 0) return;
    this.agileMaxHpGainAccumulator += amount;
    let pulses = 0;
    while (this.agileMaxHpGainAccumulator >= 100) {
      this.agileMaxHpGainAccumulator -= 100;
      const missingHp = Math.max(0, this.stats.maxHp - this.stats.hp);
      if (missingHp > 0) {
        this.healPlayer(
          missingHp * 0.08 * SPECIALIZATION_BASE_STAT_BOOST,
          "敏捷生命回响"
        );
      }
      pulses += 1;
    }
    if (pulses > 0) {
      this.showBanner(
        `敏捷生命回响 ×${pulses} · 回复 ${formatRoundedNumber(
          8 * SPECIALIZATION_BASE_STAT_BOOST
        )}% 已损生命`,
        850
      );
    }
  }

  healPlayer(amount: number, label?: string): void {
    if (this.time.now < this.darkHealLockUntil) {
      if (label) this.floatText(this.player.x, this.player.y - 48, "黑暗侵蚀 · 无法回血", true);
      return;
    }
    amount *= this.darkHealingScale;
    const before = this.stats.hp;
    this.stats.hp = roundHealth(this.stats.hp + amount, this.stats.maxHp);
    const healed = this.stats.hp - before;
    if (healed <= 0) return;
    this.burst(this.player.x, this.player.y, 0x43ff9a, 0.7);
    if (label) this.floatText(this.player.x, this.player.y - 48, `${label} +${Math.round(healed)}`, true);
  }

  damagePlayerDark(flatDamage: number, maxHpRatio: number, label: string): void {
    const now = this.time.now;
    if (now < this.invulnerableUntil || this.ultimateActive > 0 || this.ended) return;
    const armorScale = 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
    const damageReduction = Phaser.Math.Clamp(
      this.stats.damageTakenMultiplier / Math.max(0.01, armorScale),
      0.25,
      1.4
    );
    const overdriveReduction =
      save.selectedSpecialization === "wheelchair" && now < this.wheelchairOverdriveUntil
        ? 0.7
        : 1;
    const ramArmorReduction =
      save.selectedSpecialization === "wheelchair"
        ? 1 - Math.min(0.25, (this.upgradeLevels.ram_armor ?? 0) * 0.05)
        : 1;
    const damage = Math.max(
      1,
      Math.ceil(
        (flatDamage + this.stats.maxHp * maxHpRatio) *
          damageReduction *
          collisionBossDamageScale(
            this.stats.maxHp,
            save.selectedSpecialization === "wheelchair"
          ) *
          overdriveReduction *
          ramArmorReduction
      )
    );
    this.stats.hp = Math.max(0, this.stats.hp - damage);
    this.playerWasHit = true;
    this.invulnerableUntil = now + 480;
    this.floatText(this.player.x, this.player.y - 56, `${label} -${damage}`, true);
    this.burst(this.player.x, this.player.y, 0x6d0b8f, 1.6);
    this.cameras.main.flash(95, 60, 0, 80);
    if (save.settings.screenShake) this.cameras.main.shake(180, 0.011);
    if (this.stats.hp <= 0) this.endRun(false);
  }

  applyDarkDot(totalDamage: number, duration: number, label: string): void {
    this.darkDotRemaining += totalDamage;
    this.darkDotPerSecond = Math.max(this.darkDotPerSecond, totalDamage / duration);
    this.darkDotUntil = Math.max(this.darkDotUntil, this.time.now + duration * 1000);
    this.darkHealLockUntil = Math.max(this.darkHealLockUntil, this.darkDotUntil);
    this.nextDarkDotTick = Math.min(this.nextDarkDotTick || this.time.now, this.time.now);
    this.showBanner(`${label} · ${formatRoundedNumber(duration)} 秒禁止回血`, 900);
  }

  updateDarkEffects(time: number): void {
    if (this.darkDotRemaining > 0 && time < this.darkDotUntil && time >= this.nextDarkDotTick) {
      this.nextDarkDotTick = time + 250;
      const tick = Math.min(this.darkDotRemaining, this.darkDotPerSecond * 0.25);
      this.darkDotRemaining -= tick;
      const armorScale = 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
      const reduction = Phaser.Math.Clamp(
        this.stats.damageTakenMultiplier / Math.max(0.01, armorScale),
        0.25,
        1.4
      );
      const ramArmorReduction =
        save.selectedSpecialization === "wheelchair"
          ? 1 - Math.min(0.25, (this.upgradeLevels.ram_armor ?? 0) * 0.05)
          : 1;
      const bossDamageScale = collisionBossDamageScale(
        this.stats.maxHp,
        save.selectedSpecialization === "wheelchair"
      );
      this.stats.hp = roundHealth(
        this.stats.hp - tick * reduction * bossDamageScale * ramArmorReduction,
        this.stats.maxHp
      );
      this.player.setTint(0x7f2d9f);
      this.time.delayedCall(90, () => this.player.active && this.player.setTint(SKINS[save.equippedSkin].tint));
      if (this.stats.hp <= 0) this.endRun(false);
    }
    if (time >= this.darkDotUntil) {
      this.darkDotRemaining = 0;
      this.darkDotPerSecond = 0;
    }
    if (time < this.darkStormUntil) {
      const centerX = WORLD_WIDTH / 2;
      const centerY = WORLD_HEIGHT * 0.42;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, centerX, centerY);
      if (distance > 45) {
        this.player.x = Phaser.Math.Linear(this.player.x, centerX, 0.0045);
        this.player.y = Phaser.Math.Linear(this.player.y, centerY, 0.0045);
      }
      if (time >= this.nextDarkStormTick && distance < 285) {
        this.nextDarkStormTick = time + 1000;
        this.damagePlayerDark(300, 0.1, "黑暗风暴");
      }
    }
  }

  updateTemporaryConfiscation(time: number): void {
    if (this.skillsConfiscated && this.skillsConfiscatedUntil > 0 && time >= this.skillsConfiscatedUntil) {
      this.skillsConfiscated = false;
      this.skillsConfiscatedUntil = 0;
      this.showBanner("技能权限已恢复", 760);
    }
  }

  updateWheelchairRecovery(time: number): void {
    if (save.selectedSpecialization !== "wheelchair" || time < this.nextWheelchairHeal) return;
    this.nextWheelchairHeal = time + 5000;
    const healing =
      this.stats.maxHp *
      (0.05 * SPECIALIZATION_BASE_STAT_BOOST +
        (this.upgradeLevels.ram_regen ?? 0) * 0.008);
    this.healPlayer(healing, "撞击核心再生");
    const pulse = this.add
      .circle(this.player.x, this.player.y, 24, 0xffbd3e, 0.05)
      .setStrokeStyle(5, 0xffbd3e, 0.82)
      .setDepth(19);
    this.tweens.add({
      targets: pulse,
      radius: 105,
      alpha: 0,
      duration: 520,
      onComplete: () => pulse.destroy()
    });
  }

  activateWheelchairDash(): void {
    if (this.ended || this.isModal || save.selectedSpecialization !== "wheelchair") return;
    if (this.skillsConfiscated) {
      showToast("破阵推进器被技能篡夺者封锁");
      return;
    }
    const key = "wheelchair-dash";
    const cooldown =
      4800 *
      this.stats.cooldownMultiplier *
      (1 - Math.min(0.3, (this.upgradeLevels.ram_drive ?? 0) * 0.06));
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      showToast(
        `破阵冲刺冷却 ${formatRoundedNumber((this.skillReadyAt[key] - this.time.now) / 1000)}s`
      );
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const direction = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y);
    if (direction.lengthSq() < 10) {
      direction.set(
        Number(this.wasd.D.isDown || this.cursors.right.isDown) -
          Number(this.wasd.A.isDown || this.cursors.left.isDown),
        Number(this.wasd.S.isDown || this.cursors.down.isDown) -
          Number(this.wasd.W.isDown || this.cursors.up.isDown)
      );
    }
    if (direction.lengthSq() < 0.1) direction.set(0, -1);
    direction.normalize();
    const startX = this.player.x;
    const startY = this.player.y;
    const endX = Phaser.Math.Clamp(startX + direction.x * 330, 54, WORLD_WIDTH - 54);
    const endY = Phaser.Math.Clamp(startY + direction.y * 330, 135, WORLD_HEIGHT - 72);
    const distanceToDashPath = (x: number, y: number): number => {
      const dx = endX - startX;
      const dy = endY - startY;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = Phaser.Math.Clamp(
        ((x - startX) * dx + (y - startY) * dy) / lengthSquared,
        0,
        1
      );
      return Phaser.Math.Distance.Between(x, y, startX + dx * t, startY + dy * t);
    };
    const targets = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    for (const enemy of targets) {
      if (!enemy.active || distanceToDashPath(enemy.x, enemy.y) > enemy.displayWidth * 0.36 + 44) {
        continue;
      }
      const elite = Boolean(enemy.getData("elite"));
      const type = enemy.getData("type") as EnemyType;
      const currentHp = enemy.getData("hp") ?? 1;
      let damage = this.wheelchairRamDamage() * 1.55 * (elite ? 1.25 : 1);
      if (type === "scout" && !elite) damage = Math.max(damage, currentHp);
      enemy.setData("hp", currentHp - damage);
      enemy.setData("lastOwner", 1);
      if (currentHp - damage <= 0) {
        enemy.setData("wheelchairRamKill", true);
        this.destroyEnemy(enemy, true);
      } else {
        this.floatText(enemy.x, enemy.y, `破阵 ${Math.round(damage)}`, true);
        this.impactBurst(enemy.x, enemy.y, 0xffbd3e);
      }
    }
    const bossCores = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
      (part) => part.active && ["core", "raid-core"].includes(part.getData("part"))
    );
    for (const core of bossCores) {
      if (
        !this.bossActive ||
        distanceToDashPath(core.x, core.y) >= core.displayWidth * 0.18 + 56
      ) {
        continue;
      }
      const bossDamage =
        (core.getData("part") === "raid-core"
          ? (core.getData("maxHp") ?? this.bossMaxHp / 3) * 0.035
          : this.bossMaxHp * 0.035) * this.wheelchairHullAttackMultiplier();
      if (core.getData("part") === "raid-core") {
        core.setData("collisionFinisher", true);
        this.damageBossPart(core, bossDamage);
      } else {
        core.setData("collisionFinisher", true);
        const phaseMultiplier = this.bossPhase === 1 ? 0.65 : 1.25;
        this.damageBossPart(core, bossDamage / phaseMultiplier);
      }
      this.floatText(core.x, core.y + 38, `破阵 ${Math.round(bossDamage)}`, true);
      this.checkBossPhase();
      if (this.bossHp <= 0 && this.trinityAlive <= 0) this.defeatBoss();
    }
    const trail = this.add.graphics().setDepth(26);
    trail.lineStyle(34, 0xffbd3e, 0.2);
    trail.lineBetween(startX, startY, endX, endY);
    trail.lineStyle(5, 0xffffff, 0.92);
    trail.lineBetween(startX, startY, endX, endY);
    this.player.setPosition(endX, endY);
    this.player.setVelocity(direction.x * 460, direction.y * 460);
    this.targetX = endX;
    this.targetY = endY;
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 760);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 360,
      onComplete: () => trail.destroy()
    });
    this.burst(startX, startY, 0xffbd3e, 1.35);
    this.burst(endX, endY, 0xffbd3e, 1.8);
    this.showBanner("E · 破阵冲刺 · 贯穿撞击", 620);
    if (save.settings.screenShake) this.cameras.main.shake(150, 0.008);
  }

  activateWheelchairOverdrive(): void {
    if (this.ended || this.isModal) return;
    if (save.selectedSpecialization !== "wheelchair") {
      showToast("全速冲锋仅属于撞击流派");
      return;
    }
    if (this.skillsConfiscated) {
      showToast("冲锋引擎被技能篡夺者封锁");
      return;
    }
    const key = "wheelchair-overdrive";
    const cooldown = 16000 * this.stats.cooldownMultiplier;
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      showToast(
        `全速冲锋冷却 ${formatRoundedNumber((this.skillReadyAt[key] - this.time.now) / 1000)}s`
      );
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    this.wheelchairOverdriveUntil = this.time.now + 6000;
    const shock = this.add
      .circle(this.player.x, this.player.y, 28, 0xffbd3e, 0.12)
      .setStrokeStyle(8, 0xffffff, 0.92)
      .setDepth(22);
    this.tweens.add({
      targets: shock,
      radius: 155,
      alpha: 0,
      duration: 460,
      onComplete: () => shock.destroy()
    });
    this.burst(this.player.x, this.player.y, 0xffbd3e, 2);
    this.showBanner("全速冲锋 · 机动 ×1.9 · 受到伤害 -30%", 1050);
    if (save.settings.screenShake) this.cameras.main.shake(190, 0.009);
  }

  setBossPower(power: BossPowerId): void {
    this.bossPower = power;
    this.bossPowerReadyAt = this.time.now + 1000;
    const definition = BOSS_POWER_OPTIONS.find((item) => item.id === power);
    this.showBanner(`G · ${definition?.name ?? "首领权柄"} 已装备`, 1200);
  }

  activateBossPower(): void {
    if (!this.bossPower || this.ended || this.isModal) return;
    if (this.skillsConfiscated) {
      showToast("首领权柄暂时被封锁");
      return;
    }
    if (this.time.now < this.bossPowerReadyAt) {
      showToast(
        `首领权柄冷却 ${formatRoundedNumber(
          (this.bossPowerReadyAt - this.time.now) / 1000
        )}s`
      );
      return;
    }
    this.bossPowerReadyAt = this.time.now + 40000;
    this.bossPowerActiveUntil = this.time.now + 7000;
    this.nextBossPowerPulse = 0;
    if (this.bossPower === "usurper_lock") {
      this.enemyFreezeUntil = Math.max(this.enemyFreezeUntil, this.bossPowerActiveUntil);
      this.showBanner("G · 权限篡夺 · 敌方封锁 7 秒", 1050);
    } else if (this.bossPower === "mirror_copy") {
      this.bossPowerClones.forEach((clone) => clone.destroy());
      this.bossPowerClones = [-1, 1].map((side) =>
        this.add
          .image(this.player.x + side * 88, this.player.y + 32, SHIPS[save.selectedShip].asset)
          .setDisplaySize(this.player.displayWidth * 0.58, this.player.displayHeight * 0.58)
          .setTint(0x9b7dff)
          .setAlpha(0.82)
          .setDepth(18)
      );
      this.showBanner("G · 万象镜像 · 能力复制 7 秒", 1050);
    } else {
      this.showBanner("G · 裂渊权柄 · 陨星轰炸 7 秒", 1050);
    }
    this.burst(this.player.x, this.player.y, 0xffbd3e, 2.4);
  }

  updateBossPower(time: number): void {
    if (!this.bossPower || time >= this.bossPowerActiveUntil) {
      if (this.bossPowerClones.length) {
        this.bossPowerClones.forEach((clone) => clone.destroy());
        this.bossPowerClones = [];
      }
      return;
    }
    if (this.bossPower === "mirror_copy") {
      this.bossPowerClones.forEach((clone, index) => {
        const side = index === 0 ? -1 : 1;
        clone.x = Phaser.Math.Linear(clone.x, this.player.x + side * 92, 0.16);
        clone.y = Phaser.Math.Linear(clone.y, this.player.y + 28, 0.16);
      });
    }
    if (time < this.nextBossPowerPulse) return;
    if (this.bossPower === "titan_meteor") {
      for (let i = 0; i < 5; i += 1) {
        const missile = this.spawnPlayerBullet(
          Phaser.Math.Between(70, WORLD_WIDTH - 70),
          WORLD_HEIGHT + 30,
          "missile",
          150,
          -1180,
          "titan-authority"
        );
        missile.setTint(0xff8a3d).setData("pierce", 12);
      }
      this.nextBossPowerPulse = time + 560;
    } else if (this.bossPower === "mirror_copy") {
      for (const clone of this.bossPowerClones) {
        if (save.selectedSpecialization === "wheelchair") {
          const missile = this.spawnPlayerBullet(
            clone.x,
            clone.y - 25,
            "missile",
            54,
            -620,
            "mirror-authority-missile"
          );
          missile
            .setTint(0x9b7dff)
            .setData("target", this.nearestTarget(missile.x, missile.y));
        } else {
          for (let offset = -1; offset <= 1; offset += 1) {
            const bullet = this.spawnPlayerBullet(
              clone.x,
              clone.y - 25,
              "agileOrb",
              34,
              -980,
              "mirror-authority"
            );
            bullet.setVelocityX(offset * 180).setTint(0x9b7dff).setData("pierce", 3);
          }
        }
      }
      const activeSupport = Object.entries(this.airSupportLevels).find(([, level]) => (level ?? 0) > 0);
      if (activeSupport && Math.random() < 0.32) {
        this.triggerAirSupport(activeSupport[0] as AirSupportSkillId, true);
      }
      this.nextBossPowerPulse = time + 720;
    } else {
      this.enemyFreezeUntil = Math.max(this.enemyFreezeUntil, this.bossPowerActiveUntil);
      this.nextBossPowerPulse = time + 500;
    }
  }

  updatePickups(): void {
    const pickupBonus =
      save.selectedSpecialization === "wheelchair"
        ? (this.upgradeLevels.ram_magnet ?? 0) * 0.22
        : (this.upgradeLevels.magnet ?? 0) * 0.25;
    const radius = this.stats.pickupRadius * (1 + pickupBonus);
    this.pickups.children.each((child) => {
      const pickup = child as Phaser.Physics.Arcade.Image;
      if (!pickup.active) return true;
      const distance = Phaser.Math.Distance.Between(pickup.x, pickup.y, this.player.x, this.player.y);
      if (distance < radius) this.physics.moveToObject(pickup, this.player, 540);
      if (pickup.y > WORLD_HEIGHT + 60) pickup.disableBody(true, true);
      return true;
    });
  }

  collectXp(value: number): void {
    if (this.level >= 100) {
      this.score += value * 2;
      return;
    }
    this.xp += value;
    this.score += value * 2;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level = Math.min(100, this.level + 1);
      this.xpNeeded = xpToNextLevel(this.level);
      if (this.level < 100) this.time.delayedCall(20, () => this.levelUp());
      else this.showBanner("LV.100 · 流派完全体", 1500);
      break;
    }
  }

  levelUp(): void {
    if (this.ended || this.isModal) return;
    showUpgrade(this);
  }

  applyUpgrade(id: string): void {
    const previous = this.upgradeLevels[id] ?? 0;
    this.upgradeLevels[id] = Math.min(5, previous + 1);
    if (id === "armor") {
      const oldMax = this.stats.maxHp;
      this.stats.maxHp = Math.round(this.stats.maxHp * 1.12);
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + (this.stats.maxHp - oldMax));
      this.recordAgileMaxHpGain(this.stats.maxHp - oldMax);
    }
    if (id === "ram_armor") {
      const oldMax = this.stats.maxHp;
      this.stats.maxHp = Math.round(this.stats.maxHp * 1.1);
      this.stats.hp = roundHealth(
        this.stats.hp + this.stats.maxHp - oldMax,
        this.stats.maxHp
      );
    }
    if (id === "drone") this.updateDrones(this.time.now);
    if (id === "blade") this.updateBlades(this.time.now);
    this.showBanner(`${UPGRADES.find((upgrade) => upgrade.id === id)?.name} · Lv.${this.upgradeLevels[id]}`, 900);
  }

  applyDoctrineEvolution(id: string): void {
    const evolution = DOCTRINE_EVOLUTIONS.find((item) => item.id === id);
    if (!evolution) return;
    const previous = this.doctrineLevels[id] ?? 0;
    if (previous >= 5) return;
    this.doctrineLevels[id] = previous + 1;
    if (id === "echo_clone") this.ensureWingClones();
    if (id === "aegis_mastery") {
      const oldMax = this.stats.maxHp;
      this.stats.maxHp = Math.round(this.stats.maxHp * 1.12);
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp - oldMax);
      this.recordAgileMaxHpGain(this.stats.maxHp - oldMax);
      this.stats.damageTakenMultiplier *= 0.94;
    }
    this.showBanner(`${evolution.name} · LV.${this.doctrineLevels[id]}`, 1100);
  }

  applyAirSupportUpgrade(id: AirSupportSkillId): void {
    const skill = AIR_SUPPORT_SKILLS.find((item) => item.id === id);
    if (!skill) return;
    const previous = this.airSupportLevels[id] ?? 0;
    if (previous >= 5) return;
    this.airSupportLevels[id] = previous + 1;
    this.nextAirSupportAt[id] = this.time.now + 900;
    this.showBanner(`${skill.name} · LV.${this.airSupportLevels[id]} · 编队待命`, 1250);
  }

  updateAirSupport(time: number): void {
    for (const skill of AIR_SUPPORT_SKILLS) {
      const level = this.airSupportLevels[skill.id] ?? 0;
      if (level <= 0 || time < (this.nextAirSupportAt[skill.id] ?? 0)) continue;
      this.triggerAirSupport(skill.id);
      const cooldownScale = 1 - Math.min(0.24, (level - 1) * 0.06);
      this.nextAirSupportAt[skill.id] = time + skill.cooldown * cooldownScale;
    }
  }

  triggerAirSupport(id: AirSupportSkillId, debugTrigger = false): void {
    const skill = AIR_SUPPORT_SKILLS.find((item) => item.id === id);
    if (!skill || this.ended) return;
    const level = Math.max(1, this.airSupportLevels[id] ?? (debugTrigger ? 1 : 0));
    if (level <= 0) return;
    const formationCount = id === "hunter_sweep" ? 3 : id === "piercing_bombardment" ? 2 : 1;
    this.launchAirSupportFlyby(skill, formationCount);
    if (id === "piercing_bombardment") {
      this.time.delayedCall(180, () => {
        if (this.ended) return;
        const count = 3 + level;
        for (let i = 0; i < count; i += 1) {
          const x = ((i + 0.5) / count) * WORLD_WIDTH + Phaser.Math.Between(-28, 28);
          const shell = this.spawnPlayerBullet(
            x,
            WORLD_HEIGHT + 36,
            "missile",
            82 + level * 34 * ATTACK_BONUS_SCALE,
            -1180,
            "support-bombardment"
          );
          shell
            .setTint(skill.colorHex)
            .setScale(1.18)
            .setData("pierce", 999)
            .setData("born", this.time.now);
        }
        this.showBanner(`逆航贯穿轰炸 · ${count} 枚`, 620);
      });
    } else if (id === "stasis_wake") {
      this.enemySlowUntil = Math.max(
        this.enemySlowUntil,
        this.time.now + (5000 + level * 500)
      );
      this.showBanner(`引力滞空 · 敌军推进 -${65 + level * 3}%`, 720);
    } else if (id === "absolute_freeze") {
      this.enemyFreezeUntil = Math.max(
        this.enemyFreezeUntil,
        this.time.now + 3200 + level * 350
      );
      this.cameras.main.flash(120, 120, 244, 255);
      this.showBanner(
        `绝对零度 · 全场冻结 ${formatRoundedNumber(3.2 + level * 0.35)} 秒`,
        780
      );
    } else if (id === "phase_escort") {
      const duration = 2400 + level * 300;
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + duration);
      this.enemyBullets.children.each((child) => {
        const bullet = child as Phaser.Physics.Arcade.Image;
        if (
          bullet.active &&
          Phaser.Math.Distance.Between(bullet.x, bullet.y, this.player.x, this.player.y) < 285
        ) {
          bullet.disableBody(true, true);
        }
        return true;
      });
      const shield = this.add
        .circle(this.player.x, this.player.y, this.player.displayWidth * 0.72, 0x43ff9a, 0.06)
        .setStrokeStyle(6, 0x43ff9a, 0.92)
        .setDepth(21);
      this.tweens.add({
        targets: shield,
        scale: 1.35,
        alpha: 0,
        duration,
        onComplete: () => shield.destroy()
      });
      this.showBanner(
        `相位护航 · 无敌 ${formatRoundedNumber(duration / 1000)} 秒`,
        760
      );
    } else if (id === "repair_convoy") {
      this.healPlayer(this.stats.maxHp * (0.1 + level * 0.03), "逆航维修");
      this.enemyBullets.children.each((child) => {
        const bullet = child as Phaser.Physics.Arcade.Image;
        if (
          bullet.active &&
          Phaser.Math.Distance.Between(bullet.x, bullet.y, this.player.x, this.player.y) < 210
        ) {
          const body = bullet.body as Phaser.Physics.Arcade.Body;
          body.velocity.scale(0.45);
        }
        return true;
      });
      this.showBanner(`纳米维修纵队 · 舰体 +${10 + level * 3}%`, 720);
    } else if (id === "hunter_sweep") {
      this.time.delayedCall(360, () => {
        if (this.ended) return;
        const damage = 72 + level * 32 * ATTACK_BONUS_SCALE;
        (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((enemy) => {
          if (enemy.active) {
            enemy.setData("lastOwner", 1);
            this.dealDirectDamage(enemy, damage, enemy.x, enemy.y);
          }
        });
        const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
          (part) => part.active && part.getData("part") === "core"
        );
        if (core) {
          this.damageBossPart(
            core,
            260 + level * 110 * ATTACK_BONUS_SCALE
          );
        }
        this.cameras.main.flash(90, 255, 80, 125);
        this.showBanner("猎杀编队 · 全域扫荡", 620);
      });
    }
    sfx("upgrade");
  }

  launchAirSupportFlyby(
    skill: (typeof AIR_SUPPORT_SKILLS)[number],
    count: number
  ): void {
    const texture = SHIPS[save.selectedShip].asset;
    for (let index = 0; index < count; index += 1) {
      const x =
        count === 1
          ? this.player.x
          : Phaser.Math.Clamp(
              this.player.x + (index - (count - 1) / 2) * 118,
              72,
              WORLD_WIDTH - 72
            );
      const support = this.add
        .image(x, WORLD_HEIGHT + 92 + index * 32, texture)
        .setDisplaySize(72, 72)
        .setTint(skill.colorHex)
        .setAlpha(0.88)
        .setDepth(28);
      const trail = this.add
        .rectangle(x, WORLD_HEIGHT + 154, 9, 160, skill.colorHex, 0.34)
        .setDepth(27);
      this.tweens.add({
        targets: [support, trail],
        y: -150,
        duration: 1180 + index * 90,
        delay: index * 80,
        ease: "Cubic.In",
        onComplete: () => {
          support.destroy();
          trail.destroy();
        }
      });
    }
    this.floatText(
      this.player.x,
      this.player.y - 78,
      `SUPPORT // ${skill.code.split(" / ")[1] ?? skill.code}`,
      true
    );
  }

  ensureWingClones(): void {
    const level = this.doctrineLevels.echo_clone ?? 0;
    const desired = level >= 4 ? 2 : level > 0 ? 1 : 0;
    while (this.wingClones.length < desired) {
      const clone = this.physics.add
        .image(this.player.x, this.player.y + 38, SHIPS[save.selectedShip].asset)
        .setDisplaySize(this.player.displayWidth * 0.5, this.player.displayHeight * 0.5)
        .setTint(SKINS[save.equippedSkin].tint)
        .setAlpha(0.78)
        .setDepth(9);
      (clone.body as Phaser.Physics.Arcade.Body).enable = false;
      this.wingClones.push(clone);
      this.burst(clone.x, clone.y, 0x9b5cff, 1.2);
    }
  }

  updateWingClones(time: number): void {
    if (!this.wingClones.length) return;
    this.wingClones.forEach((clone, index) => {
      if (!clone.active) return;
      const side = this.wingClones.length === 1 ? 1 : index === 0 ? -1 : 1;
      const offsetX = side * (76 + Math.sin(time * 0.002 + index) * 12);
      clone.x = Phaser.Math.Linear(clone.x, this.player.x + offsetX, 0.105);
      clone.y = Phaser.Math.Linear(clone.y, this.player.y + 34 + Math.abs(offsetX) * 0.06, 0.105);
      clone.angle = this.player.angle * 0.65;
    });
    if (
      this.skillsConfiscated ||
      save.selectedSpecialization === "wheelchair" ||
      time < this.nextCloneShot
    ) {
      return;
    }
    const level = this.doctrineLevels.echo_clone ?? 1;
    const sync =
      0.5 + Math.max(0, level - 1) * 0.06 * ATTACK_BONUS_SCALE;
    for (const clone of this.wingClones) {
      const bullet = this.spawnPlayerBullet(
        clone.x,
        clone.y - 24,
        "playerBullet",
        (12 + (this.upgradeLevels.cannon ?? 1) * 4) * sync,
        -820,
        "echo-clone"
      );
      bullet.setTint(0x9b5cff).setData("pierce", level >= 3 ? 1 : 0);
    }
    this.nextCloneShot = time + Math.max(240, 410 - level * 28);
  }

  prepareBossLoadout(): void {
    Object.assign(
      this.upgradeLevels,
      save.selectedSpecialization === "wheelchair"
        ? { laser: 3, missile: 3, arc: 2, blade: 2, ram_mass: 3, ram_drive: 2 }
        : { cannon: 4, laser: 3, missile: 3, drone: 2, damage: 3, haste: 2 }
    );
    this.level = 12;
    this.ultimate = 100;
  }

  buildSummary(): string {
    return UPGRADES.filter((upgrade) => (this.upgradeLevels[upgrade.id] ?? 0) > 0)
      .map((upgrade) => `${upgrade.name} Lv.${this.upgradeLevels[upgrade.id]}`)
      .slice(0, 6)
      .join(" · ");
  }

  damagePlayer(
    amount: number,
    damageType: "projectile" | "collision" | "explosion" = "projectile",
    damageSource: EnemyDamageSource = this.bossActive ? "boss" : "minion"
  ): void {
    const now = this.time.now;
    if (now < this.invulnerableUntil || this.ultimateActive > 0 || this.ended) return;
    if (save.selectedShip === "lightning" && now >= this.shieldReadyAt) {
      this.shieldReadyAt = now + 6000;
      this.showBanner("相位护盾 · 抵消", 650);
      this.burst(this.player.x, this.player.y, 0x2df4ff);
      return;
    }
    const guardianScale = save.selectedShip === "guardian" ? 0.8 : 1;
    const explosionScale = damageType === "explosion" ? this.stats.explosionTakenMultiplier : 1;
    const normalDamage =
      amount *
      enemyUpgradeScale() *
      guardianScale *
      this.stats.damageTakenMultiplier *
      explosionScale;
    const baseFinalDamage =
      damageSource === "boss" && this.stats.maxHp > 1000
        ? Math.ceil(
            this.stats.maxHp *
              0.125 *
              collisionBossDamageScale(
                this.stats.maxHp,
                save.selectedSpecialization === "wheelchair"
              )
          )
        : damageSource === "minion"
          ? Math.max(
              1,
              Math.ceil(
                Math.max(
                  normalDamage * minionHealthDamageMultiplier(this.stats.maxHp),
                  minionPercentDamageFloor(this.stats.maxHp)
                )
              )
            )
          : Math.max(1, Math.ceil(normalDamage));
    const overdriveReduction =
      save.selectedSpecialization === "wheelchair" && now < this.wheelchairOverdriveUntil
        ? 0.7
        : 1;
    const ramArmorReduction =
      save.selectedSpecialization === "wheelchair"
        ? 1 - Math.min(0.25, (this.upgradeLevels.ram_armor ?? 0) * 0.05)
        : 1;
    const finalDamage = Math.max(
      1,
      Math.ceil(baseFinalDamage * overdriveReduction * ramArmorReduction)
    );
    this.playerWasHit = true;
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);
    if (
      !this.emergencyUsed &&
      save.permanentUpgrades.emergency > 0 &&
      this.stats.hp > 0 &&
      this.stats.hp / this.stats.maxHp <= 0.2
    ) {
      this.emergencyUsed = true;
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 8 + save.permanentUpgrades.emergency * 2);
      this.showBanner("紧急修复协议", 700);
    }
    this.invulnerableUntil =
      now + (save.selectedSpecialization === "wheelchair" ? 500 : 800);
    this.combo = Math.floor(this.combo * 0.7);
    sfx("hurt");
    this.burst(this.player.x, this.player.y, 0xff4d6d, 1.25);
    this.cameras.main.flash(75, 255, 34, 72);
    if (save.settings.screenShake) this.cameras.main.shake(120, 0.007);
    if (this.stats.hp <= 0) this.endRun(false);
  }

  activateUltimate(): void {
    if (this.skillsConfiscated) {
      showToast("技能被篡夺：只能使用基础机炮与走位");
      return;
    }
    if (this.ultimate < 100 || this.ended || this.isModal) {
      showToast(this.ultimate >= 100 ? "当前无法启动" : `星核充能 ${Math.floor(this.ultimate)}%`);
      return;
    }
    this.ultimate = 0;
    this.ultimateActive = 6;
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    this.showBanner("星核超载", 900);
    this.burst(this.player.x, this.player.y, 0x2df4ff, 2.4);
    if (save.settings.screenShake) this.cameras.main.shake(180, 0.007);
  }

  activateSkill(kind: "laser" | "missile" | "drone", owner: 1 | 2): void {
    if (this.ended || this.isModal) return;
    if (owner === 1 && save.selectedSpecialization === "wheelchair") {
      showToast("撞击协议：1/2/3 主动武器离线，升级武装会自动释放");
      return;
    }
    if (owner === 1 && this.skillsConfiscated) {
      showToast("技能被篡夺：只能使用基础机炮与走位");
      return;
    }
    const key = `${kind}-${owner}`;
    const cooldownBase = { laser: 5200, missile: 7600, drone: 9800 }[kind];
    const cooldown =
      cooldownBase *
      (owner === 1 ? this.stats.cooldownMultiplier : 1) *
      (owner === 1 && save.selectedShip === "lightning" ? 0.82 : 1);
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      showToast(
        `${kind.toUpperCase()} 冷却 ${formatRoundedNumber(
          Math.max(0, this.skillReadyAt[key] - this.time.now) / 1000
        )}s`
      );
      return;
    }
    const shooter = owner === 2 ? this.player2 : this.player;
    if (!shooter) return;
    this.skillReadyAt[key] = this.time.now + cooldown;
    if (kind === "laser") {
      for (let i = -2; i <= 2; i += 1) {
        const beam = this.spawnPlayerBullet(
          shooter.x + i * 24,
          shooter.y - 45,
          "laserBullet",
          45,
          -1450,
          "active-laser",
          owner
        );
        beam.setVelocityX(i * 55).setData("pierce", 12);
      }
      this.showBanner(`P${owner} · 激光切割`, 700);
    } else if (kind === "missile") {
      const count = save.selectedShip === "bomber" && owner === 1 ? 10 : 7;
      for (let i = 0; i < count; i += 1) {
        const missile = this.spawnPlayerBullet(
          shooter.x + Phaser.Math.Between(-50, 50),
          shooter.y + Phaser.Math.Between(-18, 18),
          "missile",
          44,
          -560,
          "active-missile",
          owner
        );
        missile.setData("target", this.nearestTarget(missile.x, missile.y));
      }
      this.showBanner(`P${owner} · 导弹齐射`, 700);
    } else {
      for (let i = -5; i <= 5; i += 1) {
        const bullet = this.spawnPlayerBullet(
          shooter.x,
          shooter.y - 25,
          "playerBullet",
          23,
          -980,
          "drone-overdrive",
          owner
        );
        bullet.setVelocityX(i * 95).setData("pierce", 2);
      }
      this.showBanner(`P${owner} · 无人机过载`, 700);
    }
    this.burst(shooter.x, shooter.y, owner === 1 ? 0x2df4ff : 0x9b5cff, 1.8);
    if (save.settings.screenShake) this.cameras.main.shake(100, 0.004);
  }

  activateEMP(owner: 1 | 2): void {
    if (this.ended || this.isModal) return;
    if (owner === 1 && save.selectedSpecialization === "wheelchair") {
      showToast("撞击协议 · EMP 冲击波");
    }
    if (owner === 1 && this.skillsConfiscated) {
      showToast("EMP 已被技能篡夺者接管");
      return;
    }
    const key = `emp-${owner}`;
    const cooldown =
      15000 *
      (owner === 1 ? this.stats.cooldownMultiplier : 1) *
      (owner === 1 && save.selectedShip === "lightning" ? 0.82 : 1);
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      showToast(
        `EMP 冷却 ${formatRoundedNumber(
          Math.max(0, this.skillReadyAt[key] - this.time.now) / 1000
        )}s`
      );
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    let cleared = 0;
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        cleared += 1;
        bullet.disableBody(true, true);
      }
      return true;
    });
    (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((enemy) => {
      if (enemy.active) {
        enemy.setData("lastOwner", owner);
        this.dealDirectDamage(
          enemy,
          (save.selectedShip === "bomber" && owner === 1 ? 260 : 200) *
            ATTACK_BONUS_SCALE,
          enemy.x,
          enemy.y
        );
      }
    });
    if (this.bossActive) {
      this.bossHp = Math.max(1, this.bossHp - 520 * ATTACK_BONUS_SCALE);
    }
    const wave = this.add.circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 20, 0x2df4ff, 0.1).setDepth(70);
    wave.setStrokeStyle(10, 0x2df4ff, 0.9);
    this.tweens.add({
      targets: wave,
      radius: 620,
      alpha: 0,
      duration: 520,
      onComplete: () => wave.destroy()
    });
    if (playVariant !== "single" && this.player2?.active) {
      if (owner === 1) {
        this.damagePlayer2Friendly(this.player2MaxHp * 0.12, true);
      } else {
        this.damagePlayerFriendly(this.stats.maxHp * 0.12, true);
      }
    }
    this.showBanner(`P${owner} · EMP 清屏 ×${cleared}`, 900);
    if (cleared >= 20) this.unlockAchievement("emp_master");
    if (save.settings.screenShake) this.cameras.main.shake(260, 0.011);
  }

  activatePhaseDash(): void {
    if (this.ended || this.isModal) return;
    if (this.skillsConfiscated) {
      showToast("相位引擎被暂时封锁");
      return;
    }
    const key = "phase-dash";
    const cooldown = 8200 * this.stats.cooldownMultiplier;
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      showToast(
        `相位闪避冷却 ${formatRoundedNumber(
          (this.skillReadyAt[key] - this.time.now) / 1000
        )}s`
      );
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const direction = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y);
    if (direction.lengthSq() < 10) direction.set(0, -1);
    direction.normalize().scale(170);
    const startX = this.player.x;
    const startY = this.player.y;
    this.player.setPosition(
      Phaser.Math.Clamp(this.player.x + direction.x, 55, WORLD_WIDTH - 55),
      Phaser.Math.Clamp(this.player.y + direction.y, 150, WORLD_HEIGHT - 90)
    );
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 1250);
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (
        bullet.active &&
        Phaser.Math.Distance.Between(bullet.x, bullet.y, this.player.x, this.player.y) < 180
      ) {
        bullet.disableBody(true, true);
      }
      return true;
    });
    const trail = this.add.graphics().setDepth(18);
    trail.lineStyle(18, 0x2df4ff, 0.28);
    trail.lineBetween(startX, startY, this.player.x, this.player.y);
    this.tweens.add({ targets: trail, alpha: 0, duration: 320, onComplete: () => trail.destroy() });
    this.burst(this.player.x, this.player.y, 0x2df4ff, 1.7);
    this.showBanner("相位闪避 · 无敌 1.25 秒", 650);
  }

  activateNanoRepair(): void {
    if (this.ended || this.isModal) return;
    if (this.skillsConfiscated) {
      showToast("纳米修复被暂时封锁");
      return;
    }
    const key = "nano-repair";
    const cooldown = 24000 * this.stats.cooldownMultiplier;
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      showToast(
        `纳米修复冷却 ${formatRoundedNumber(
          (this.skillReadyAt[key] - this.time.now) / 1000
        )}s`
      );
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    this.healPlayer(this.stats.maxHp * 0.18, "纳米修复");
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 650);
    const shield = this.add
      .circle(this.player.x, this.player.y, this.player.displayWidth * 0.62, 0x43ff9a, 0.08)
      .setStrokeStyle(4, 0x43ff9a, 0.8)
      .setDepth(19);
    this.tweens.add({
      targets: shield,
      scale: 1.4,
      alpha: 0,
      duration: 720,
      onComplete: () => shield.destroy()
    });
    this.showBanner("纳米蜂群 · 舰体修复 18%", 750);
  }

  skipLevel(): void {
    if (this.ended || this.isModal) return;
    this.showBanner(`跳过关卡 ${selectedLevel}`, 700);
    this.time.delayedCall(450, () => this.endRun(true));
  }

  surrender(): void {
    if (this.ended || this.isModal) return;
    this.isModal = true;
    this.physics.world.pause();
    this.showBanner("撤退协议已确认 · 自动投降", 900);
    this.cameras.main.fade(600, 45, 0, 18);
    this.time.delayedCall(720, () => {
      this.isModal = false;
      this.endRun(false);
    });
  }

  damagePlayerFriendly(amount: number, explosion: boolean): void {
    const now = this.time.now;
    if (
      this.ended ||
      now < this.invulnerableUntil ||
      this.ultimateActive > 0
    ) {
      return;
    }
    const reduction =
      this.stats.damageTakenMultiplier *
      (explosion ? this.stats.explosionTakenMultiplier : 1) *
      (save.selectedSpecialization === "wheelchair"
        ? 1 - Math.min(0.25, (this.upgradeLevels.ram_armor ?? 0) * 0.05)
        : 1);
    const finalDamage = Math.max(1, Math.ceil(amount * reduction));
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);
    this.invulnerableUntil = now + 360;
    this.player.setTintFill(0xff9b4d);
    this.time.delayedCall(
      90,
      () => this.player.active && this.player.setTint(SKINS[save.equippedSkin].tint)
    );
    this.floatText(this.player.x, this.player.y - 50, `友军爆破 -${finalDamage}`, true);
    if (this.stats.hp <= 0) this.endRun(false);
  }

  damagePlayer2Friendly(amount: number, explosion: boolean): void {
    const now = this.time.now;
    if (
      !this.player2?.active ||
      this.ended ||
      now < this.player2FriendlyInvulnerableUntil ||
      this.ultimateActive > 0
    ) {
      return;
    }
    const specialization = SPECIALIZATIONS[save.selectedSpecialization];
    const armorReduction =
      1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
    const ramArmorReduction =
      save.selectedSpecialization === "wheelchair"
        ? 1 - Math.min(0.25, (this.upgradeLevels.ram_armor ?? 0) * 0.05)
        : 1;
    const finalDamage = Math.max(
      1,
      Math.ceil(
        amount *
          specialization.damageTaken *
          armorReduction *
          ramArmorReduction *
          (explosion ? specialization.explosionTaken : 1)
      )
    );
    this.player2Hp = Math.max(0, this.player2Hp - finalDamage);
    this.player2FriendlyInvulnerableUntil = now + 360;
    this.player2.setTintFill(0xff9b4d);
    this.time.delayedCall(
      90,
      () => this.player2?.active && this.player2.setTint(SKINS[save.equippedSkin].tint)
    );
    this.floatText(this.player2.x, this.player2.y - 50, `友军爆破 -${finalDamage}`, true);
    if (this.player2Hp <= 0) {
      this.showBanner("P2 被友军火力击落", 900);
      this.player2.disableBody(true, true);
    }
  }

  damagePlayer2(
    amount: number,
    damageType: "projectile" | "collision" | "explosion" = "projectile",
    damageSource: EnemyDamageSource = this.bossActive ? "boss" : "minion"
  ): void {
    if (!this.player2 || !this.player2.active || this.ended) return;
    const reduction = selectedShip2 === "guardian" ? 0.8 : 1;
    const specializationReduction = SPECIALIZATIONS[save.selectedSpecialization].damageTaken;
    const armorReduction = 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
    const ramArmorReduction =
      save.selectedSpecialization === "wheelchair"
        ? 1 - Math.min(0.25, (this.upgradeLevels.ram_armor ?? 0) * 0.05)
        : 1;
    const explosionReduction =
      damageType === "explosion" ? SPECIALIZATIONS[save.selectedSpecialization].explosionTaken : 1;
    const normalDamage =
      amount *
      enemyUpgradeScale() *
      reduction *
      specializationReduction *
      armorReduction *
      explosionReduction;
    const baseDamage =
      damageSource === "boss" && this.player2MaxHp > 1000
        ? Math.ceil(
            this.player2MaxHp *
              0.125 *
              collisionBossDamageScale(
                this.player2MaxHp,
                save.selectedSpecialization === "wheelchair"
              )
          )
        : damageSource === "minion"
          ? Math.max(
              1,
              Math.ceil(
                Math.max(
                  normalDamage * minionHealthDamageMultiplier(this.player2MaxHp),
                  minionPercentDamageFloor(this.player2MaxHp)
                )
              )
            )
          : Math.max(1, Math.ceil(normalDamage));
    const finalDamage = Math.max(1, Math.ceil(baseDamage * ramArmorReduction));
    this.player2Hp = Math.max(0, this.player2Hp - finalDamage);
    this.player2.setTintFill(0xff4d6d);
    this.time.delayedCall(
      100,
      () => this.player2?.active && this.player2.setTint(SKINS[save.equippedSkin].tint)
    );
    this.burst(this.player2.x, this.player2.y, 0xff4d6d, 1.3);
    if (save.settings.screenShake) this.cameras.main.shake(85, 0.004);
    if (this.player2Hp <= 0) {
      this.showBanner("P2 战机被击落", 900);
      this.player2.disableBody(true, true);
    }
  }

  pickupEffect(x: number, y: number, isToken = false): void {
    const color = isToken ? 0xffd95e : 0x2df4ff;
    this.burst(x, y, color, isToken ? 1.45 : 1.05);
    const ring = this.add.circle(x, y, 12, color, 0.08).setDepth(32);
    ring.setStrokeStyle(isToken ? 6 : 4, color, 0.95);
    this.tweens.add({
      targets: ring,
      radius: isToken ? 96 : 68,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy()
    });
    sfx("upgrade");
  }

  impactBurst(x: number, y: number, color: number): void {
    this.burst(x, y, color, 1.8);
    const shock = this.add.circle(x, y, 10, color, 0.12).setDepth(35);
    shock.setStrokeStyle(7, color, 0.9);
    this.tweens.add({
      targets: shock,
      radius: 110,
      alpha: 0,
      duration: 330,
      onComplete: () => shock.destroy()
    });
    if (save.settings.screenShake) this.cameras.main.shake(150, 0.01);
  }

  showTaunt(enemy: Phaser.Physics.Arcade.Image): void {
    const lines = ["就这？", "你的准星歪了！", "别躲啦！", "送你回机库！", "引擎在发抖哦", "空域归我们了！"];
    const bubble = this.add
      .text(enemy.x, enemy.y - 58, Phaser.Utils.Array.GetRandom(lines), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "16px",
        fontStyle: "bold",
        color: "#280415",
        backgroundColor: "#fff3f8",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(45);
    this.tweens.add({
      targets: bubble,
      y: bubble.y - 24,
      alpha: 0,
      duration: 1700,
      ease: "Sine.Out",
      onComplete: () => bubble.destroy()
    });
  }

  unlockAchievement(id: string): void {
    if (save.achievements[id]) return;
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) return;
    save.achievements[id] = new Date().toISOString();
    persist();
    showToast(`🏅 获得勋章：${achievement.name}`);
    sfx("upgrade");
  }

  clearBossEntities(): void {
    this.bossParts.children.each((child) => {
      const part = child as Phaser.Physics.Arcade.Image;
      const raidAura = part.getData("raidAura") as Phaser.GameObjects.Arc | undefined;
      raidAura?.destroy();
      if (part.active) part.disableBody(true, true);
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    this.bossEliteAura?.destroy();
    this.bossEliteAura = undefined;
    this.wideArenaBackdrop?.destroy();
    this.wideArenaBackdrop = undefined;
    this.cameras.main.setZoom(1);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.bossActive = false;
    this.skillsConfiscated = false;
    this.skillsConfiscatedUntil = 0;
  }

  completeShadowChase(): void {
    if (!this.bossActive || selectedMode !== "boss") return;
    const encounter = BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex];
    if (encounter?.kind !== "chase") return;
    const escapedAfterDamage = Math.round((encounter.chaseDamageTarget ?? 0) * 100);
    const chaseNumber = [1, 3, 5].indexOf(this.campaignEncounterIndex) + 1;
    const reward =
      Math.round(
        (70 + chaseNumber * 55) *
          campaignDifficultyForLevel(selectedLevel).rewardMultiplier
      );
    this.runTokens += reward;
    this.score += 5200 + chaseNumber * 1800;
    this.nextSpawn = this.time.now + 999999;
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    if (core) {
      this.burst(core.x, core.y, 0x9b5cff, 2.4);
      const afterimage = this.add
        .image(core.x, core.y, "bossShadow")
        .setDisplaySize(core.displayWidth, core.displayHeight)
        .setDepth(35)
        .setTint(0xb77aff);
      this.tweens.add({
        targets: afterimage,
        y: -420,
        alpha: 0,
        scale: 0.62,
        duration: 760,
        ease: "Cubic.In",
        onComplete: () => afterimage.destroy()
      });
    }
    this.clearBossEntities();
    this.campaignEncounterIndex += 1;
    this.showBanner(`黑影受创 ${escapedAfterDamage}% · 逃逸时掉落强化与 ◆ ${reward}`, 1500);
    if (save.settings.screenShake) this.cameras.main.shake(420, 0.012);
    this.time.delayedCall(850, () => {
      showCampaignStory(
        this,
        `PURSUIT ${chaseNumber}/3 COMPLETE`,
        "它又逃进了裂隙",
        `黑影承受了 ${escapedAfterDamage}% 的核心损伤，却在最后一刻切断航迹。它抢走的力量仍在增长，但逃逸时留下了一枚可解析强化。`,
        "回收强化并追踪下一目标",
        () =>
          showAirSupportSelection(this, () =>
            this.startCampaignEncounter(this.campaignEncounterIndex)
          )
      );
    });
  }

  defeatTrinityRaid(): void {
    if (
      !this.bossActive ||
      selectedMode !== "boss" ||
      BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]?.kind !== "trinity"
    ) {
      return;
    }
    this.bossActive = false;
    this.nextSpawn = this.time.now + 999999;
    const reward = Math.round(
      560 * campaignDifficultyForLevel(selectedLevel).rewardMultiplier
    );
    this.runTokens += reward;
    this.score += 36000;
    this.bossTier += 1;
    this.ultimate = 100;
    this.healPlayer(this.stats.maxHp * 0.35, "三神核心回收");
    this.clearBossEntities();
    this.cameras.main.flash(260, 255, 240, 255);
    if (save.settings.screenShake) this.cameras.main.shake(900, 0.023);
    this.showBanner(`三神共斗终结 · ◆ +${reward} · 连续三级进化`, 1800);
    this.time.delayedCall(1200, () => {
      showCampaignStory(
        this,
        "ACT 07 COMPLETE",
        "三枚首领印记同时熄灭",
        "不完全体已经全部击破。解析阵列允许连续进行三次跨流派进化，并从泰坦、镜像与篡夺者中永久截获一项本局权柄。",
        "开始连续解析",
        () =>
          showDoctrineSequence(this, 3, () =>
            showBossPowerSelection(this, () => this.startCampaignInterlude())
          )
      );
    });
  }

  startCampaignInterlude(): void {
    if (this.ended) return;
    this.clearBossEntities();
    this.campaignEncounterIndex = 7;
    this.campaignInterludeKills = 0;
    this.campaignInterludeTarget =
      20 + (campaignDifficultyForLevel(selectedLevel).id === "nightmare" ? 12 : selectedLevel * 2);
    this.campaignInterludeActive = false;
    this.nextSpawn = this.time.now + 999999;
    showCampaignStory(
      this,
      "REARM INTERLUDE",
      "黑影藏进了深层裂隙",
      `终战信号尚未锁定。击破 ${this.campaignInterludeTarget} 架逐步解锁的新兵种完成整备；途中掉落与流派成长全部保留。`,
      "进入终战前整备空域",
      () => {
        this.campaignInterludeActive = true;
        this.nextSpawn = 0;
        this.showBanner(`终战整备 · 击破目标 0/${this.campaignInterludeTarget}`, 1300);
      }
    );
  }

  completeCampaignInterlude(): void {
    if (!this.campaignInterludeActive || this.ended) return;
    this.campaignInterludeActive = false;
    this.nextSpawn = this.time.now + 999999;
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (enemy.active) enemy.disableBody(true, true);
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    this.score += 6000;
    this.healPlayer(this.stats.maxHp * 0.3, "终战整备完成");
    this.showBanner("黑影坐标锁定 · 终战航道开启", 1500);
    this.time.delayedCall(700, () => {
      showCampaignStory(
        this,
        "FINAL VECTOR ACQUIRED",
        "被盗走的三股力量正在汇聚",
        "雷达已锁定力量掠夺者。接下来不再是追逐战：把它压至八分之一生命，逼出隐藏在黑影之下的真正形态。",
        "进入第 8 场战斗",
        () => this.startCampaignEncounter(7)
      );
    });
  }

  triggerShadowRupture(): void {
    if (
      !this.bossActive ||
      selectedMode !== "boss" ||
      this.shadowRuptureTriggered ||
      BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]?.kind !== "shadow_final"
    ) {
      return;
    }
    this.shadowRuptureTriggered = true;
    this.bossActive = false;
    this.nextSpawn = this.time.now + 999999;
    this.score += 24000;
    const reward = Math.round(
      420 * campaignDifficultyForLevel(selectedLevel).rewardMultiplier
    );
    this.runTokens += reward;
    this.bossTier += 1;
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    const ruptureX = core?.x ?? WORLD_WIDTH / 2;
    const ruptureY = core?.y ?? 220;
    const wave = this.add
      .circle(ruptureX, ruptureY, 36, 0x09000f, 0.92)
      .setStrokeStyle(18, 0x8c25ff, 0.92)
      .setDepth(95);
    this.tweens.add({
      targets: wave,
      radius: WORLD_HEIGHT * 1.25,
      alpha: 0,
      duration: 1100,
      ease: "Cubic.Out",
      onComplete: () => wave.destroy()
    });
    this.cameras.main.flash(280, 80, 0, 110);
    if (save.settings.screenShake) this.cameras.main.shake(1200, 0.028);
    this.clearBossEntities();
    this.stats.maxHp = Math.min(this.stats.maxHp, 3000);
    this.stats.hp = roundHealth(this.stats.hp, this.stats.maxHp);
    this.darkHealingScale = 0.5;
    this.campaignEncounterIndex = 8;
    this.showBanner(`黑暗爆炸 · 生命上限封锁至 3000 · 回血效率 -50% · ◆ +${reward}`, 2200);
    this.time.delayedCall(1500, () => {
      showCampaignStory(
        this,
        "TRUE FORM REVEALED",
        "黑影只是它的外壳",
        "全场爆炸让机体沾满黑暗能量：最大生命至多 3000，所有回血减半。三枚被盗首领印记在残骸中点亮——黑暗魔神飞机正式显形。",
        "迎战第 9 场 · 黑暗魔神",
        () => this.startCampaignEncounter(8)
      );
    });
  }

  finishFinalCampaignVictory(): void {
    const unlockBudget = remainingStoreUnlockCost(
      save.permanentUpgrades,
      save.unlockedSkins
    );
    const completionBonus = unlockBudget + 1888;
    this.runTokens += completionBonus;
    this.bossTier = Math.max(this.bossTier, 6);
    this.showBanner(`终局核心回收 · 商店全解锁预算 ◆ +${completionBonus}`, 2200);
    showCampaignStory(
      this,
      "ALL NINE ENCOUNTERS CLEARED",
      "黑暗魔神已从航道抹除",
      `九场战斗全部完成。终局核心包含当前商店所有未购升级与涂装所需的完整预算，并额外回收 1888 星核币。`,
      "观看最终返航结算",
      () => this.endRun(true)
    );
  }

  startCampaignEncounter(index: number, skipStory = false): void {
    if (this.ended) return;
    this.campaignEncounterIndex = Phaser.Math.Clamp(index, 0, BOSS_CAMPAIGN_ENCOUNTERS.length - 1);
    const encounter = BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex];
    this.clearBossEntities();
    this.campaignInterludeActive = false;
    this.bossKind = encounter.bossKind;
    this.bossElite = rollCampaignElite(selectedLevel);
    this.bossMutated =
      ["boss", "trinity"].includes(encounter.kind) && rollCampaignMutation(selectedLevel);
    if (this.bossMutated && ["titan", "mirror", "usurper"].includes(this.bossKind)) {
      const otherKinds = (["titan", "mirror", "usurper"] as BossKind[]).filter(
        (kind) => kind !== this.bossKind
      );
      this.bossMutationKind = Phaser.Utils.Array.GetRandom(otherKinds);
    } else {
      this.bossMutationKind = null;
    }
    this.showBanner(
      `终局战役 ${this.campaignEncounterIndex + 1}/9 · ${encounter.title}`,
      1200
    );
    if (skipStory) {
      if (encounter.kind === "trinity") this.spawnTrinityBosses();
      else this.spawnBoss(encounter.bossKind);
      return;
    }
    this.playBossArrivalCG();
  }

  playBossArrivalCG(): void {
    if (this.bossActive || this.ended) return;
    const incomingKind =
      selectedMode === "campaign" && this.bossTier >= 2
        ? "dark_deity"
        : (["titan", "mirror", "usurper"] as BossKind[])[this.bossTier % 3];
    const incomingElite =
      selectedMode === "boss"
        ? selectedLevel >= 5 || this.bossTier >= 3
        : this.bossTier >= 3;
    this.isModal = true;
    this.physics.world.pause();
    setAdaptiveMusic(3);
    const topBar = this.add.rectangle(WORLD_WIDTH / 2, 54, WORLD_WIDTH, 108, 0x000000, 0.92).setDepth(110);
    const bottomBar = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 54, WORLD_WIDTH, 108, 0x000000, 0.92)
      .setDepth(110);
    const warning = this.add
      .text(
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2,
        `⚠ ${incomingElite ? "ELITE " : ""}${BOSS_NAMES[incomingKind]} // ${
          selectedMode === "campaign"
            ? `CAMPAIGN ${Math.min(3, this.bossTier + 1)}/3`
            : `BOSS TIER ${this.bossTier + 1}`
        }`,
        {
        fontFamily: "Consolas, monospace",
        fontSize: "29px",
        fontStyle: "bold",
        color: incomingElite ? "#ffbd3e" : "#ff4d6d",
        backgroundColor: "#18030dcc",
        padding: { x: 24, y: 16 }
        }
      )
      .setOrigin(0.5)
      .setDepth(112);
    const subtitle = this.add
      .text(
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2 + 62,
        incomingKind === "dark_deity"
            ? "三枚首领印记已全部点亮 · 黑暗魔神真身降临"
          : incomingKind === "shadow"
            ? "它已吸收三首领核心 · 这一次不能再让它逃走"
          : incomingKind === "mirror"
          ? `${incomingElite ? "精英超频：" : "镜像协议："}它读取了你的机体与开火习惯`
          : incomingKind === "usurper"
            ? `${incomingElite ? "精英篡夺：" : "篡夺协议："}战术技能即将被敌方接管`
            : selectedMode === "boss"
              ? `${incomingElite ? "精英炼狱：" : "炼狱协议："}从基础形态迎战`
              : incomingElite
                ? "精英裂隙开启 · 全武装泰坦跃迁"
                : "分数阈值突破 · 裂渊泰坦跃迁",
        {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "18px",
        color: "#f5d9e7"
        }
      )
      .setOrigin(0.5)
      .setDepth(112);
    this.cameras.main.shake(800, 0.014);
    this.cameras.main.flash(130, 255, 40, 110);
    sfx("boss");
    this.time.delayedCall(1900, () => {
      [topBar, bottomBar, warning, subtitle].forEach((item) => item.destroy());
      this.isModal = false;
      this.physics.world.resume();
      this.spawnBoss(incomingKind);
    });
  }

  spawnBoss(kindOverride?: BossKind): void {
    if (this.bossActive || this.ended) return;
    this.bossKind =
      kindOverride ??
      (["titan", "mirror", "usurper"] as BossKind[])[this.bossTier % 3];
    if (selectedMode !== "boss") {
      this.bossElite = this.bossTier >= 3;
      this.bossMutated = false;
      this.bossMutationKind = null;
    } else {
      this.bossElite = rollCampaignElite(selectedLevel) || this.bossTier >= 3;
      this.bossMutated = rollCampaignMutation(selectedLevel);
      if (this.bossMutated) {
        this.bossMutationKind = Phaser.Utils.Array.GetRandom(
          (["titan", "mirror", "usurper"] as BossKind[]).filter(
            (kind) => kind !== this.bossKind
          )
        );
      } else {
        this.bossMutationKind = null;
      }
    }
    this.bossAttackIndex = -1;
    this.bossKilledByCollision = false;
    this.skillsConfiscated = false;
    this.skillsConfiscatedUntil = 0;
    this.bossActive = true;
    this.bossPhase = 1;
    const threatScale = 1 + Math.max(0, selectedLevel - 3) * 0.18;
    const endlessScale = 1 + this.bossTier * (selectedMode === "boss" ? 0.7 : 0.52);
    const modeScale = selectedMode === "boss" ? 1.45 : 1;
    const kindScale =
      this.bossKind === "mirror"
        ? 1.48
        : this.bossKind === "usurper"
          ? 1.05
          : this.bossKind === "shadow"
            ? this.campaignEncounterIndex === 7
              ? 2
              : 1.18
            : this.bossKind === "dark_deity"
              ? 5
              : 1;
    const campaignScale =
      selectedMode === "boss"
        ? campaignDifficultyForLevel(selectedLevel).id === "nightmare"
          ? 1.5
          : campaignDifficultyForLevel(selectedLevel).id === "hard"
            ? 1.22
            : 1
        : 1;
    this.bossMaxHp =
      (selectedMode === "boss" ? 10500 : 7600 + selectedLevel * 950) *
      threatScale *
      (selectedMode === "boss" ? 1 + this.campaignBossesDefeated * 0.16 : endlessScale) *
      modeScale *
      kindScale *
      1.22 *
      (this.bossElite ? 1.7 : 1) *
      (this.bossMutated ? 1.25 : 1) *
      campaignScale *
      enemyUpgradeScale();
    this.bossHp = this.bossMaxHp;
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (enemy.active) enemy.disableBody(true, true);
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    this.showBanner(
      this.skillsConfiscated
        ? `⚠ ${this.bossElite ? "精英 " : ""}${BOSS_NAMES[this.bossKind]} · 技能已被暂时篡夺`
        : `⚠ ${this.bossElite ? "精英 " : ""}${this.bossMutated ? "突变 " : ""}${
            BOSS_NAMES[this.bossKind]
          } · ${selectedMode === "boss" ? `无限首领阶 ${this.bossTier + 1}` : `战役阶 ${this.bossTier + 1}`}`,
      1900
    );
    sfx("boss");
    if (save.settings.screenShake) this.cameras.main.shake(420, 0.009);
    const coreTexture =
      this.bossKind === "mirror"
        ? SHIPS[save.selectedShip].asset
        : this.bossKind === "shadow"
          ? "bossShadow"
          : this.bossKind === "dark_deity"
            ? "bossDarkDeity"
        : this.bossKind === "usurper"
          ? "bossUsurper"
          : "bossTitan";
    const core = this.bossParts.get(WORLD_WIDTH / 2, -230, coreTexture) as Phaser.Physics.Arcade.Image;
    core.enableBody(true, WORLD_WIDTH / 2, -230, true, true);
    const displaySize =
      this.bossKind === "titan"
        ? { width: 860, height: 516 }
        : this.bossKind === "mirror"
          ? { width: 310, height: 310 }
          : this.bossKind === "shadow"
            ? this.campaignEncounterIndex === 7
              ? { width: 510, height: 765 }
              : { width: 350, height: 525 }
            : this.bossKind === "dark_deity"
              ? { width: 760, height: 760 }
          : { width: 570, height: 570 };
    core
      .setTexture(this.textures.exists(coreTexture) ? coreTexture : "bossCore")
      .setDisplaySize(displaySize.width, displaySize.height)
      .setTint(
        this.bossElite
          ? 0xffd29a
          : this.bossKind === "mirror"
            ? SKINS[save.equippedSkin].tint
            : this.bossKind === "shadow" || this.bossKind === "dark_deity"
              ? 0xffffff
            : 0xffffff
      )
      .setData({ part: "core", hp: this.bossMaxHp })
      .setDepth(14);
    this.bossEliteAura?.destroy();
    this.bossEliteAura = undefined;
    if (this.bossElite) {
      this.bossEliteAura = this.add
        .circle(core.x, core.y, Math.max(120, displaySize.width * 0.54), 0xffbd3e, 0.035)
        .setStrokeStyle(10, 0xffbd3e, 0.7)
        .setDepth(13);
      this.tweens.add({
        targets: this.bossEliteAura,
        scale: { from: 0.9, to: 1.08 },
        alpha: { from: 0.35, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 620
      });
    }
    const turretOffset =
      this.bossKind === "titan"
        ? 285
        : this.bossKind === "mirror"
          ? 150
          : this.bossKind === "dark_deity"
            ? 310
            : 225;
    const left = this.bossParts.get(WORLD_WIDTH / 2 - turretOffset, -160, "bossTurret") as Phaser.Physics.Arcade.Image;
    left.enableBody(true, WORLD_WIDTH / 2 - turretOffset, -160, true, true);
    left
      .setTexture("bossTurret")
      .setAlpha(0)
      .setData({ part: "left", hp: this.bossMaxHp * 0.16 })
      .setDepth(15);
    const right = this.bossParts.get(WORLD_WIDTH / 2 + turretOffset, -160, "bossTurret") as Phaser.Physics.Arcade.Image;
    right.enableBody(true, WORLD_WIDTH / 2 + turretOffset, -160, true, true);
    right
      .setTexture("bossTurret")
      .setAlpha(0)
      .setData({ part: "right", hp: this.bossMaxHp * 0.16 })
      .setDepth(15);
    this.tweens.add({
      targets: this.bossEliteAura ? [core, this.bossEliteAura] : [core],
      y: 190,
      duration: 1400,
      ease: "Cubic.Out"
    });
    this.tweens.add({ targets: [left, right], y: 220, duration: 1400, ease: "Cubic.Out" });
    this.nextBossAttack = this.time.now + 2300;
    if (this.bossKind === "usurper") this.nextUsurperDisableAt = this.time.now + 2500;
    if (this.bossKind === "shadow") this.shadowRuptureTriggered = false;
  }

  spawnTrinityBosses(): void {
    if (this.bossActive || this.ended) return;
    this.clearBossEntities();
    this.bossActive = true;
    this.bossKilledByCollision = false;
    this.bossKind = "titan";
    this.bossPhase = 1;
    this.trinityAlive = 3;
    this.trinityDefeatedKinds = [];
    this.wideArenaBackdrop = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 1440, WORLD_HEIGHT, 0x01040d, 0.96)
      .setStrokeStyle(3, 0x6c2fff, 0.28)
      .setDepth(0);
    this.physics.world.setBounds(-180, 0, 1440, WORLD_HEIGHT);
    this.cameras.main.setZoom(0.9);
    const configs: Array<{
      kind: BossKind;
      texture: string;
      x: number;
      width: number;
      height: number;
      tint: number;
    }> = [
      { kind: "titan", texture: "bossTitan", x: 155, width: 330, height: 198, tint: 0xffffff },
      {
        kind: "mirror",
        texture: SHIPS[save.selectedShip].asset,
        x: WORLD_WIDTH / 2,
        width: 220,
        height: 220,
        tint: SKINS[save.equippedSkin].tint
      },
      { kind: "usurper", texture: "bossUsurper", x: WORLD_WIDTH - 155, width: 260, height: 260, tint: 0xffffff }
    ];
    const difficulty = campaignDifficultyForLevel(selectedLevel);
    let totalHp = 0;
    configs.forEach((config, index) => {
      const elite = rollCampaignElite(selectedLevel);
      const mutated = rollCampaignMutation(selectedLevel);
      const mutationKinds = (["titan", "mirror", "usurper"] as BossKind[]).filter(
        (kind) => kind !== config.kind
      );
      const mutationKind = mutated ? Phaser.Utils.Array.GetRandom(mutationKinds) : null;
      const kindScale = config.kind === "mirror" ? 1.2 : config.kind === "usurper" ? 1.05 : 1;
      const maxHp =
        10500 *
        1.1 *
        kindScale *
        (elite ? 1.35 : 1) *
        (mutated ? 1.18 : 1) *
        (difficulty.id === "nightmare" ? 1.32 : difficulty.id === "hard" ? 1.16 : 1) *
        enemyUpgradeScale();
      totalHp += maxHp;
      const core = this.bossParts.get(config.x, -180, config.texture) as Phaser.Physics.Arcade.Image;
      core.enableBody(true, config.x, -180, true, true);
      core
        .setTexture(config.texture)
        .setDisplaySize(config.width, config.height)
        .setTint(elite ? 0xffd29a : config.tint)
        .setDepth(14)
        .setData({
          part: "raid-core",
          raidKind: config.kind,
          hp: maxHp,
          maxHp,
          elite,
          mutated,
          mutationKind,
          nextSpecialAt: this.time.now + (config.kind === "usurper" ? 2500 : 0)
        });
      this.tweens.add({
        targets: core,
        y: 190 + (index === 1 ? 38 : 0),
        duration: 1350 + index * 100,
        ease: "Cubic.Out"
      });
      if (elite || mutated) {
        const aura = this.add
          .circle(config.x, 200, Math.max(config.width, config.height) * 0.54, mutated ? 0x9b5cff : 0xffbd3e, 0.025)
          .setStrokeStyle(6, mutated ? 0x9b5cff : 0xffbd3e, 0.6)
          .setDepth(13);
        this.tweens.add({
          targets: aura,
          alpha: { from: 0.22, to: 0.72 },
          scale: { from: 0.92, to: 1.06 },
          yoyo: true,
          repeat: -1,
          duration: 720
        });
        core.setData("raidAura", aura);
      }
    });
    this.bossMaxHp = totalHp;
    this.bossHp = totalHp;
    this.nextTrinityAttack = this.time.now + 2300;
    this.nextUsurperDisableAt = this.time.now + 2800;
    this.showBanner("三神共斗 · 单体 110% 属性 · 全部击破才算胜利", 1800);
    if (save.settings.screenShake) this.cameras.main.shake(650, 0.012);
  }

  hitBossPart(bullet: Phaser.Physics.Arcade.Image, part: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active || !part.active) return;
    this.damageBossPart(part, bullet.getData("damage") ?? 10);
    if ((bullet.getData("owner") ?? 1) === 1) this.applyHitTrait();
    const remainingPierce = bullet.getData("pierce") ?? 0;
    if (remainingPierce > 0) bullet.setData("pierce", remainingPierce - 1);
    else bullet.disableBody(true, true);
  }

  damageBossPart(part: Phaser.Physics.Arcade.Image, rawDamage: number): void {
    if (!this.bossActive || !part.active) return;
    const partName = part.getData("part");
    if (partName === "raid-core") {
      const collisionFinisher = part.getData("collisionFinisher") === true;
      part.setData("collisionFinisher", false);
      const previousHp = part.getData("hp") ?? 1;
      const nextHp = Math.max(0, previousHp - rawDamage);
      part.setData("hp", nextHp);
      this.bossHp = Math.max(0, this.bossHp - Math.min(previousHp, rawDamage));
      part.setTintFill(0xffc9ec);
      this.time.delayedCall(45, () => part.active && part.clearTint());
      if (nextHp <= 0) {
        const defeatedKind = part.getData("raidKind") as BossKind;
        if (collisionFinisher) {
          this.grantCollisionBossKillGrowth(true);
        }
        this.trinityAlive = Math.max(0, this.trinityAlive - 1);
        this.trinityDefeatedKinds.push(defeatedKind);
        const aura = part.getData("raidAura") as Phaser.GameObjects.Arc | undefined;
        aura?.destroy();
        this.burst(part.x, part.y, 0xff3dbb, 2.5);
        part.disableBody(true, true);
        this.showBanner(`${BOSS_NAMES[defeatedKind]}不完全体已击破 · 剩余 ${this.trinityAlive}`, 1050);
        if (this.trinityAlive <= 0) this.defeatTrinityRaid();
      }
      return;
    }
    if (partName === "core") {
      const multiplier = this.bossPhase === 1 ? 0.65 : 1.25;
      const collisionFinisher = part.getData("collisionFinisher") === true;
      part.setData("collisionFinisher", false);
      this.bossHp = Math.max(0, this.bossHp - rawDamage * multiplier);
      part.setTintFill(0xffc9ec);
      this.time.delayedCall(40, () => part.active && part.clearTint());
      this.checkBossPhase();
      if (this.bossHp <= 0) {
        if (collisionFinisher) this.grantCollisionBossKillGrowth();
        this.defeatBoss();
      }
    } else {
      const hp = (part.getData("hp") ?? 0) - rawDamage;
      part.setData("hp", hp);
      part.setTintFill(0xffffff);
      this.time.delayedCall(45, () => part.active && part.clearTint());
      if (hp <= 0) {
        part.disableBody(true, true);
        this.bossHp = Math.max(1, this.bossHp - this.bossMaxHp * 0.08);
        this.ultimate = Math.min(100, this.ultimate + 20);
        this.score += 1800;
        this.showBanner(`${partName === "left" ? "左侧" : "右侧"}炮台已摧毁`, 1000);
        this.burst(part.x, part.y, 0xff3dbb, 2);
      }
    }
  }

  checkBossPhase(): void {
    const ratio = this.bossHp / this.bossMaxHp;
    const nextPhase = ratio <= 0.35 ? 3 : ratio <= 0.7 ? 2 : 1;
    if (nextPhase <= this.bossPhase) return;
    this.bossPhase = nextPhase;
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    this.showBanner(
      nextPhase === 2
        ? `PHASE II · ${this.bossKind === "mirror" ? "镜像超频" : this.bossKind === "usurper" ? "权限污染" : "裂隙核心"}`
        : `PHASE III · ${this.bossKind === "mirror" ? "万象复制" : this.bossKind === "usurper" ? "全域接管" : "过载狂暴"}`,
      1500
    );
    this.burst(WORLD_WIDTH / 2, 200, nextPhase === 2 ? 0x9b5cff : 0xff3dbb, 2.6);
    if (save.settings.screenShake) this.cameras.main.shake(360, 0.012);
    this.nextBossAttack = this.time.now + 1100;
  }

  updateBoss(time: number, _dt: number): void {
    if (!this.bossActive) return;
    if (time < this.enemyFreezeUntil) return;
    if (this.bossKind === "shadow") {
      this.updateShadowBoss(time, false);
      return;
    }
    if (this.bossKind === "dark_deity") {
      this.updateDarkDeityBoss(time);
      return;
    }
    const parts = this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[];
    const core = parts.find((part) => part.active && part.getData("part") === "core");
    if (core && core.y >= 178) {
      const sway = Math.sin(time * (this.bossKind === "mirror" ? 0.0012 : 0.0008)) * (this.bossKind === "titan" ? 150 : 115);
      core.x = WORLD_WIDTH / 2 + sway;
      if (this.bossEliteAura) {
        this.bossEliteAura.setPosition(core.x, core.y);
      }
      const left = parts.find((part) => part.active && part.getData("part") === "left");
      const right = parts.find((part) => part.active && part.getData("part") === "right");
      const turretOffset = this.bossKind === "titan" ? 285 : this.bossKind === "mirror" ? 150 : 225;
      if (left) left.x = core.x - turretOffset;
      if (right) right.x = core.x + turretOffset;
      if (time >= this.nextTaunt) {
        const bossLines =
          this.bossKind === "mirror"
            ? ["我比你更懂这架战机。", "你会躲开自己的火力吗？", "这就是强化后的你。"]
            : this.bossKind === "usurper"
              ? ["谢谢，你的技能现在归我。", "试试只靠机炮活下来。", "权限？我就是权限。"]
              : ["渺小的飞虫。", "你的火力令我发笑。", "跪服于裂渊！", "逃跑吧，守护者。"];
        const taunt = this.add
          .text(core.x, core.y + 118, Phaser.Utils.Array.GetRandom(bossLines), {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: "18px",
            fontStyle: "bold",
            color: "#fff0fa",
            backgroundColor: "#5b103ccc",
            padding: { x: 12, y: 7 }
          })
          .setOrigin(0.5)
          .setDepth(45);
        this.tweens.add({
          targets: taunt,
          alpha: 0,
          y: taunt.y + 30,
          duration: 1900,
          onComplete: () => taunt.destroy()
        });
        this.nextTaunt = time + 5200;
      }
    }
    if (time < this.nextBossAttack || !core) return;
    if (this.bossKind === "usurper" && time >= this.nextUsurperDisableAt) {
      this.skillsConfiscated = true;
      this.skillsConfiscatedUntil = time + 20000;
      this.nextUsurperDisableAt = time + 40000;
      this.showBanner("权限篡夺 · 技能封锁 20 秒 · 冷却 40 秒", 1100);
    }
    const executeRandom = (attacks: Array<() => void>): void => {
      let attack = Phaser.Math.Between(0, attacks.length - 1);
      if (attacks.length > 1 && attack === this.bossAttackIndex) {
        attack = (attack + Phaser.Math.Between(1, attacks.length - 1)) % attacks.length;
      }
      this.bossAttackIndex = attack;
      attacks[attack]();
      if (this.bossPhase === 3 && Math.random() < (this.bossElite ? 0.55 : 0.32)) {
        this.time.delayedCall(430, () => {
          if (this.bossActive && core.active) {
            this.bossHomingSwarm(core, 4 + this.bossTier, 0xff7de3);
          }
        });
      }
    };
    if (this.bossKind === "titan") {
      const titanAttacks = [
        () => this.bossFanAttack(core),
        () => this.bossSpiralAttack(core),
        () => this.titanMeteorField(),
        () => this.titanLaneSweep(),
        () => this.bossRageAttack(core)
      ];
      executeRandom(titanAttacks);
    } else if (this.bossKind === "mirror") {
      const mirrorAttacks = [
        () => this.mirrorPetalAttack(core),
        () => this.mirrorLanceAttack(),
        () => this.bossHomingSwarm(core, 7 + this.bossPhase * 2, 0x2df4ff),
        () => this.bossFanAttack(core)
      ];
      executeRandom(mirrorAttacks);
    } else {
      const usurperAttacks = [
        () => this.usurperLaserGrid(),
        () => this.bossHomingSwarm(core, 9 + this.bossPhase * 2, 0xffbd3e),
        () => this.usurperEMP(core),
        () => this.usurperDroneLattice()
      ];
      executeRandom(usurperAttacks);
    }
    if (this.bossMutated && this.bossMutationKind && Math.random() < 0.55) {
      this.time.delayedCall(360, () => {
        if (this.bossActive && core.active) {
          this.executeBossKindAttack(core, this.bossMutationKind!);
        }
      });
    }
    const base =
      this.bossKind === "mirror"
        ? 1580
        : this.bossKind === "usurper"
          ? 1750
          : selectedMode === "boss"
            ? 1580
            : 1820;
    this.nextBossAttack =
      time +
      Math.max(
        this.bossElite ? 760 : 920,
        (base - this.bossPhase * 95 - this.bossTier * 38 - selectedLevel * 18) *
          (this.bossElite ? 0.84 : 1)
      );
  }

  executeBossKindAttack(core: Phaser.Physics.Arcade.Image, kind: BossKind): void {
    if (kind === "titan") {
      Phaser.Utils.Array.GetRandom([
        () => this.titanMeteorField(),
        () => this.titanLaneSweep(),
        () => this.bossFanAttack(core)
      ])();
    } else if (kind === "mirror") {
      Phaser.Utils.Array.GetRandom([
        () => this.mirrorPetalAttack(core),
        () => this.mirrorLanceAttack(),
        () => this.bossHomingSwarm(core, 9, 0x2df4ff)
      ])();
    } else if (kind === "usurper") {
      Phaser.Utils.Array.GetRandom([
        () => this.usurperLaserGrid(),
        () => this.usurperEMP(core),
        () => this.usurperDroneLattice()
      ])();
    }
  }

  updateTrinityBosses(time: number): void {
    const cores = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
      (part) => part.active && part.getData("part") === "raid-core"
    );
    cores.forEach((core, index) => {
      const homeX = core.getData("homeX") ?? core.x;
      if (core.getData("homeX") === undefined) core.setData("homeX", core.x);
      core.x = homeX + Math.sin(time * 0.0011 + index * 2.1) * 42;
      const aura = core.getData("raidAura") as Phaser.GameObjects.Arc | undefined;
      aura?.setPosition(core.x, core.y);
    });
    const usurper = cores.find((core) => core.getData("raidKind") === "usurper");
    if (usurper && time >= this.nextUsurperDisableAt) {
      this.skillsConfiscated = true;
      this.skillsConfiscatedUntil = time + 20000;
      this.nextUsurperDisableAt = time + 40000;
      this.showBanner("共斗篡夺协议 · 技能禁用 20 秒 · 冷却 40 秒", 1150);
    }
    if (!cores.length || time < this.nextTrinityAttack) return;
    const attacker = Phaser.Utils.Array.GetRandom(cores);
    const kind = attacker.getData("raidKind") as BossKind;
    if (kind === "mirror") {
      const copiedKind = Phaser.Utils.Array.GetRandom(
        cores.map((core) => core.getData("raidKind") as BossKind).filter((item) => item !== "mirror")
      );
      this.executeBossKindAttack(attacker, copiedKind ?? "titan");
      this.floatText(attacker.x, attacker.y + 90, `复制 ${BOSS_NAMES[copiedKind ?? "titan"]}`, true);
    } else {
      this.executeBossKindAttack(attacker, kind);
    }
    const mutationKind = attacker.getData("mutationKind") as BossKind | null;
    if (attacker.getData("mutated") && mutationKind) {
      this.time.delayedCall(340, () => {
        if (attacker.active && this.bossActive) this.executeBossKindAttack(attacker, mutationKind);
      });
    }
    this.nextTrinityAttack = time + (this.bossElite ? 1050 : 1420);
  }

  updateShadowBoss(time: number, pursuit: boolean): void {
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    if (!core) return;
    const targetY = pursuit ? 116 + Math.sin(time * 0.0017) * 32 : 190;
    core.y = Phaser.Math.Linear(core.y, targetY, pursuit ? 0.035 : 0.018);
    core.x =
      WORLD_WIDTH / 2 +
      Math.sin(time * (pursuit ? 0.00155 : 0.00092)) * (pursuit ? 270 : 185);
    const parts = this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[];
    const left = parts.find((part) => part.active && part.getData("part") === "left");
    const right = parts.find((part) => part.active && part.getData("part") === "right");
    if (left) left.setPosition(core.x - 205, core.y + 30);
    if (right) right.setPosition(core.x + 205, core.y + 30);
    this.bossEliteAura?.setPosition(core.x, core.y);
    if (time < this.nextBossAttack) return;
    const attacks: Array<() => void> = [
      () => this.shadowBulletBarrage(core, pursuit),
      () => this.shadowDelayedExplosion(pursuit),
      () => this.shadowClawAttack(pursuit),
      () => this.shadowPortalAttack(core),
      () => this.shadowChargeAttack(core)
    ];
    let attackIndex = Phaser.Math.Between(0, attacks.length - 1);
    if (attackIndex === this.bossAttackIndex) attackIndex = (attackIndex + 1) % attacks.length;
    this.bossAttackIndex = attackIndex;
    attacks[attackIndex]();
    this.nextBossAttack = time + (pursuit ? 1180 : this.bossElite ? 980 : 1320);
  }

  shadowBulletBarrage(core: Phaser.Physics.Arcade.Image, pursuit: boolean): void {
    const count = pursuit ? 15 : 23;
    const safeGap = Phaser.Math.Between(2, count - 3);
    for (let index = 0; index < count; index += 1) {
      if (Math.abs(index - safeGap) <= (pursuit ? 1 : 2)) continue;
      const angle = 0.16 + ((Math.PI - 0.32) * index) / (count - 1);
      this.fireEnemyAngle(
        core.x,
        core.y + 45,
        angle,
        pursuit ? 255 : 285,
        pursuit ? 18 : 24,
        "projectile",
        "boss"
      )
        .setTint(index % 2 ? 0x7e1fff : 0xff2d8f)
        .setScale(index % 3 === 0 ? 1.2 : 0.92);
    }
  }

  shadowDelayedExplosion(pursuit: boolean): void {
    const x = this.player.x;
    const y = this.player.y;
    const radius = pursuit ? 105 : 145;
    const warning = this.add
      .circle(x, y, radius, 0x260033, 0.12)
      .setStrokeStyle(6, 0xb626ff, 0.92)
      .setDepth(22);
    this.tweens.add({
      targets: warning,
      scale: { from: 0.35, to: 1 },
      alpha: { from: 0.15, to: 0.72 },
      yoyo: true,
      repeat: 3,
      duration: 150,
      onComplete: () => {
        warning.destroy();
        if (!this.bossActive) return;
        const blast = this.add.circle(x, y, radius * 1.08, 0x5a0874, 0.82).setDepth(31);
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < radius) {
          this.damagePlayerDark(0, pursuit ? 0.12 : 0.2, "延迟黑暗爆炸");
        }
        this.tweens.add({ targets: blast, scale: 1.35, alpha: 0, duration: 420, onComplete: () => blast.destroy() });
      }
    });
  }

  shadowClawAttack(pursuit: boolean): void {
    const targetX = this.player.x;
    const claw = this.add
      .rectangle(targetX, WORLD_HEIGHT / 2, pursuit ? 92 : 125, WORLD_HEIGHT, 0x7b0d91, 0.08)
      .setStrokeStyle(4, 0xff2d8f, 0.84)
      .setAngle(Phaser.Math.Between(-12, 12))
      .setDepth(20);
    this.tweens.add({
      targets: claw,
      alpha: { from: 0.1, to: 0.68 },
      yoyo: true,
      repeat: 2,
      duration: 165,
      onComplete: () => {
        const hit = Math.abs(this.player.x - targetX) < (pursuit ? 72 : 95);
        claw.destroy();
        if (!this.bossActive || !hit) return;
        this.damagePlayerDark(0, pursuit ? 0.08 : 0.12, "黑暗爪痕");
        this.applyDarkDot(this.stats.maxHp * (pursuit ? 0.06 : 0.1), 5.5, "流血侵蚀");
      }
    });
  }

  shadowPortalAttack(core: Phaser.Physics.Arcade.Image): void {
    const portal = this.add
      .circle(core.x, core.y + 115, 22, 0x09000f, 0.72)
      .setStrokeStyle(8, 0x8f28ff, 0.92)
      .setDepth(21);
    this.tweens.add({
      targets: portal,
      radius: 105,
      rotation: Math.PI * 2,
      duration: 650,
      onComplete: () => {
        portal.destroy();
        if (!this.bossActive) return;
        const roster = campaignEnemyRoster(Math.max(1, this.campaignBossesDefeated));
        const count = 3 + this.campaignBossesDefeated * 2;
        for (let index = 0; index < count; index += 1) {
          const type = Phaser.Utils.Array.GetRandom(roster) as EnemyType;
          const enemy = this.spawnEnemy(this.time.now, this.bossElite ? `elite_${type}` : type);
          enemy.setPosition(
            Phaser.Math.Clamp(core.x + (index - (count - 1) / 2) * 78, 65, WORLD_WIDTH - 65),
            core.y + 110 + Math.abs(index - count / 2) * 15
          );
        }
        if (this.bossElite) {
          const echo = this.spawnEnemy(this.time.now, "elite_bomber");
          echo
            .setPosition(core.x, core.y + 165)
            .setDisplaySize(230, 230)
            .setData("hp", (echo.getData("hp") ?? 1) * 4)
            .setData("maxHp", (echo.getData("maxHp") ?? 1) * 4)
            .setData("portalBoss", true);
          this.floatText(echo.x, echo.y, "ELITE BOSS ECHO", true);
        }
      }
    });
  }

  shadowChargeAttack(core: Phaser.Physics.Arcade.Image): void {
    const startX = core.x;
    const startY = core.y;
    const targetX = this.player.x;
    const targetY = Math.min(WORLD_HEIGHT - 220, this.player.y);
    const warning = this.add
      .line(0, 0, startX, startY, targetX, targetY, 0x7c22ff, 0.2)
      .setOrigin(0)
      .setLineWidth(22, 4)
      .setDepth(24);
    this.tweens.add({
      targets: warning,
      alpha: { from: 0.15, to: 0.75 },
      yoyo: true,
      repeat: 3,
      duration: 115,
      onComplete: () => {
        warning.destroy();
        if (!core.active || !this.bossActive) return;
        this.tweens.add({
          targets: core,
          x: targetX,
          y: targetY,
          duration: 280,
          ease: "Cubic.In",
          yoyo: true,
          hold: 80,
          onYoyo: () => {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, core.x, core.y) < 145) {
              this.damagePlayerDark(0, 0.12, "黑影冲撞");
              this.applyDarkDot(1000, 5.5, "黑暗能量灼烧");
            }
          },
          onComplete: () => core.setPosition(startX, startY)
        });
      }
    });
  }

  updateDarkDeityBoss(time: number): void {
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    if (!core) return;
    core.x = WORLD_WIDTH / 2 + Math.sin(time * 0.00072) * 135;
    core.y = Phaser.Math.Linear(core.y, 205, 0.02);
    this.bossEliteAura?.setPosition(core.x, core.y);
    if (time < this.nextBossAttack) return;
    const attacks: Array<() => void> = [
      () => this.darkDeityBarrage(core),
      () => this.darkDeityStorm(core),
      () => this.shadowDelayedExplosion(false),
      () => this.shadowPortalAttack(core),
      () => this.shadowChargeAttack(core)
    ];
    let index = Phaser.Math.Between(0, attacks.length - 1);
    if (index === this.bossAttackIndex) index = (index + 1) % attacks.length;
    this.bossAttackIndex = index;
    attacks[index]();
    this.nextBossAttack = time + (this.bossElite ? 820 : 1080);
  }

  darkDeityBarrage(core: Phaser.Physics.Arcade.Image): void {
    const count = 19;
    const safeGap = Phaser.Math.Between(2, count - 3);
    for (let index = 0; index < count; index += 1) {
      if (Math.abs(index - safeGap) <= 2) continue;
      const angle = 0.08 + ((Math.PI - 0.16) * index) / (count - 1);
      this.fireEnemyAngle(core.x, core.y + 65, angle, 310, 1, "projectile", "boss")
        .setTint(index % 3 === 0 ? 0xff7a22 : index % 2 ? 0x4cdfff : 0xc018ff)
        .setScale(1.3)
        .setData("darkFlat", 200)
        .setData("darkDotRatio", 0.15);
    }
  }

  darkDeityStorm(core: Phaser.Physics.Arcade.Image): void {
    this.darkStormUntil = this.time.now + 7000;
    this.nextDarkStormTick = this.time.now + 700;
    const storm = this.add
      .circle(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.42, 70, 0x09000f, 0.42)
      .setStrokeStyle(14, 0x9a18cf, 0.86)
      .setDepth(17);
    this.tweens.add({
      targets: storm,
      radius: 330,
      rotation: Math.PI * 6,
      alpha: { from: 0.42, to: 0.12 },
      duration: 7000,
      onComplete: () => storm.destroy()
    });
    this.stripRandomPlayerAbility();
    this.showBanner("黑暗风暴 · 缓慢吸入 · 力量剥夺", 1150);
    this.burst(core.x, core.y, 0x9a18cf, 2.8);
  }

  stripRandomPlayerAbility(): void {
    const candidates: Array<{ key: string; label: string; strip: () => void }> = [];
    for (const [id, level] of Object.entries(this.upgradeLevels)) {
      if (id !== "cannon" && level > 0) {
        candidates.push({
          key: `upgrade:${id}`,
          label: UPGRADES.find((upgrade) => upgrade.id === id)?.name ?? id,
          strip: () => {
            this.upgradeLevels[id] = 0;
          }
        });
      }
    }
    for (const [id, level] of Object.entries(this.airSupportLevels)) {
      if ((level ?? 0) > 0) {
        candidates.push({
          key: `support:${id}`,
          label: AIR_SUPPORT_SKILLS.find((skill) => skill.id === id)?.name ?? id,
          strip: () => {
            this.airSupportLevels[id as AirSupportSkillId] = 0;
          }
        });
      }
    }
    for (const [id, level] of Object.entries(this.doctrineLevels)) {
      if (level > 0) {
        candidates.push({
          key: `doctrine:${id}`,
          label: DOCTRINE_EVOLUTIONS.find((item) => item.id === id)?.name ?? id,
          strip: () => {
            this.doctrineLevels[id] = 0;
          }
        });
      }
    }
    const available = candidates.filter((candidate) => !this.strippedAbilities.includes(candidate.key));
    if (!available.length) return;
    const stolen = Phaser.Utils.Array.GetRandom(available);
    stolen.strip();
    this.strippedAbilities.push(stolen.key);
    this.finalBossBorrowedPower = stolen.label;
    this.showBanner(`力量剥夺 · ${stolen.label} 已被魔神夺走`, 1200);
    this.useStolenPlayerPower(stolen.key);
  }

  useStolenPlayerPower(key: string): void {
    if (key.includes("missile") || key.includes("bombardment")) {
      const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (part) => part.active && part.getData("part") === "core"
      );
      if (core) this.bossHomingSwarm(core, 7, 0xff7a22);
    } else if (key.startsWith("support:")) {
      this.enemyFreezeUntil = Math.max(this.enemyFreezeUntil, this.time.now + 900);
      this.shadowDelayedExplosion(false);
    } else {
      this.shadowClawAttack(false);
    }
  }

  bossFanAttack(core: Phaser.Physics.Arcade.Image): void {
    const parts = this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[];
    const turrets = parts.filter((part) => part.active && part.getData("part") !== "core");
    const sources = turrets.length ? turrets : [core];
    for (const source of sources) {
      const spreadCount = Math.min(7, 4 + Math.floor(this.bossTier / 2));
      for (let i = -spreadCount; i <= spreadCount; i += 1) {
        if (Math.abs(i) === 1) continue;
        this.fireEnemyAngle(
          source.x,
          source.y + 20,
          Math.PI / 2 + i * 0.145,
          235 + this.bossTier * 11,
          12 + this.bossTier * 1.4,
          "projectile",
          "boss"
        );
      }
    }
  }

  bossSpiralAttack(core: Phaser.Physics.Arcade.Image): void {
    const base = this.time.now * 0.004;
    const count = Math.min(18, 12 + this.bossTier);
    const safeGap = this.bossTier % count;
    for (let i = 0; i < count; i += 1) {
      if (i === safeGap || i === (safeGap + 1) % count) continue;
      this.fireEnemyAngle(
        core.x,
        core.y + 30,
        base + (Math.PI * 2 * i) / count,
        210 + this.bossTier * 9,
        14 + this.bossTier * 1.4,
        "projectile",
        "boss"
      );
    }
    if (Math.random() > 0.55) this.telegraphStrike(this.player.x);
  }

  bossRageAttack(core: Phaser.Physics.Arcade.Image): void {
    for (let i = -5; i <= 5; i += 1) {
      if (i === 0 || i === (this.bossTier % 2 ? 3 : -3)) continue;
      this.fireEnemyAngle(
        core.x,
        core.y + 30,
        Math.PI / 2 + i * 0.12,
        285 + this.bossTier * 10,
        16 + this.bossTier * 1.5,
        "projectile",
        "boss"
      );
    }
    this.time.delayedCall(230, () => {
      if (!this.bossActive) return;
      for (let i = -4; i <= 4; i += 1) {
        if (i === -1 || i === 2) continue;
        this.fireEnemyAngle(
          core.x,
          core.y + 30,
          Math.PI / 2 + 0.06 + i * 0.14,
          270 + this.bossTier * 10,
          16 + this.bossTier * 1.5,
          "projectile",
          "boss"
        );
      }
    });
    if (Math.random() > 0.45) this.telegraphStrike(this.player.x);
  }

  titanMeteorField(): void {
    const count = 6 + this.bossPhase * 2;
    const impactPoints = Array.from({ length: count }, () => ({
      x: Phaser.Math.Between(110, WORLD_WIDTH - 110),
      y: Phaser.Math.Between(340, WORLD_HEIGHT - 130)
    }));
    impactPoints.forEach((point, index) => {
      const warning = this.add
        .circle(point.x, point.y, 68, 0xff4d6d, 0.09)
        .setStrokeStyle(4, 0xffbd3e, 0.9)
        .setDepth(15);
      this.tweens.add({
        targets: warning,
        scale: { from: 0.35, to: 1 },
        alpha: { from: 0.2, to: 0.72 },
        yoyo: true,
        repeat: 2,
        duration: 125,
        delay: index * 45,
        onComplete: () => {
          warning.destroy();
          if (!this.bossActive) return;
          const impact = this.add.circle(point.x, point.y, 82, 0xff5a3d, 0.76).setDepth(23);
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) < 96) {
            this.damageBossHazard(38, "explosion");
          }
          this.burst(point.x, point.y, 0xffbd3e, 1.4);
          this.tweens.add({ targets: impact, scale: 1.5, alpha: 0, duration: 340, onComplete: () => impact.destroy() });
        }
      });
    });
  }

  titanLaneSweep(): void {
    this.telegraphBossLanes(8, [Phaser.Math.Between(1, 6)], 40, 0xff3dbb);
  }

  mirrorPetalAttack(core: Phaser.Physics.Arcade.Image): void {
    const count = 24 + this.bossPhase * 4;
    const gapStart = Phaser.Math.Between(0, count - 1);
    for (let i = 0; i < count; i += 1) {
      const gapDistance = Math.min((i - gapStart + count) % count, (gapStart - i + count) % count);
      if (gapDistance <= 2) continue;
      const angle = (Math.PI * 2 * i) / count + this.time.now * 0.00045;
      const bullet = this.fireEnemyAngle(
        core.x,
        core.y + 18,
        angle,
        210 + this.bossPhase * 18,
        15 + this.bossTier,
        "projectile",
        "boss"
      );
      bullet.setTint(i % 2 ? 0x2df4ff : 0x9b5cff).setScale(i % 3 === 0 ? 1.25 : 0.9);
    }
    const ring = this.add
      .circle(core.x, core.y, 28, 0x2df4ff, 0.06)
      .setStrokeStyle(6, 0x9b5cff, 0.86)
      .setDepth(24);
    this.tweens.add({ targets: ring, radius: 170, alpha: 0, duration: 470, onComplete: () => ring.destroy() });
  }

  mirrorLanceAttack(): void {
    const laneWidth = WORLD_WIDTH / 8;
    const playerLane = Phaser.Math.Clamp(Math.floor(this.player.x / laneWidth), 1, 6);
    const dangerLanes = new Set<number>([playerLane, (playerLane + 2) % 8, (playerLane + 5) % 8]);
    dangerLanes.forEach((lane) => this.telegraphStrike(laneWidth * (lane + 0.5)));
  }

  bossHomingSwarm(core: Phaser.Physics.Arcade.Image, count: number, tint: number): void {
    for (let i = 0; i < count; i += 1) {
      this.time.delayedCall(i * 75, () => {
        if (!this.bossActive || !core.active) return;
        const angle = Math.PI / 2 + (i - (count - 1) / 2) * 0.16;
        const bullet = this.fireEnemyAngle(
          core.x + Math.cos(i) * 80,
          core.y + 30,
          angle,
          185,
          16 + this.bossTier,
          "projectile",
          "boss"
        );
        bullet
          .setTint(tint)
          .setScale(1.2)
          .setData("homingUntil", this.time.now + 1100)
          .setData("homingSpeed", 255 + this.bossPhase * 15);
      });
    }
  }

  usurperLaserGrid(): void {
    const safeA = Phaser.Math.Between(1, 6);
    const safeB = (safeA + Phaser.Math.Between(2, 4)) % 8;
    this.telegraphBossLanes(8, [safeA, safeB], 42, 0xffbd3e);
  }

  usurperEMP(core: Phaser.Physics.Arcade.Image): void {
    const radius = Math.min(360, 250 + this.bossPhase * 38);
    const warning = this.add
      .circle(core.x, core.y, radius, 0x9b5cff, 0.055)
      .setStrokeStyle(7, 0xffbd3e, 0.84)
      .setDepth(18);
    this.tweens.add({
      targets: warning,
      alpha: { from: 0.12, to: 0.62 },
      scale: { from: 0.82, to: 1 },
      yoyo: true,
      repeat: 3,
      duration: 130,
      onComplete: () => {
        warning.destroy();
        if (!this.bossActive || !core.active) return;
        const shock = this.add
          .circle(core.x, core.y, radius, 0xffbd3e, 0.36)
          .setStrokeStyle(12, 0x9b5cff, 0.9)
          .setDepth(24);
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, core.x, core.y) < radius) {
          this.damageBossHazard(44, "explosion");
        }
        this.playerBullets.children.each((child) => {
          const bullet = child as Phaser.Physics.Arcade.Image;
          if (bullet.active && Phaser.Math.Distance.Between(bullet.x, bullet.y, core.x, core.y) < radius) {
            bullet.disableBody(true, true);
          }
          return true;
        });
        this.tweens.add({ targets: shock, scale: 1.25, alpha: 0, duration: 380, onComplete: () => shock.destroy() });
      }
    });
  }

  usurperDroneLattice(): void {
    const columns = 10;
    const safeColumn = Phaser.Math.Between(1, columns - 2);
    for (let row = 0; row < 3; row += 1) {
      this.time.delayedCall(row * 260, () => {
        if (!this.bossActive) return;
        for (let column = 0; column < columns; column += 1) {
          if (Math.abs(column - ((safeColumn + row) % columns)) <= 1) continue;
          const bullet = this.fireEnemyAngle(
            ((column + 0.5) / columns) * WORLD_WIDTH,
            110 + row * 42,
            Math.PI / 2,
            245 + row * 25,
            17 + this.bossTier,
            "projectile",
            "boss"
          );
          bullet.setTint(row % 2 ? 0xffbd3e : 0x9b5cff).setScale(1.15);
        }
      });
    }
  }

  telegraphBossLanes(laneCount: number, safeLanes: number[], damage: number, color: number): void {
    const width = WORLD_WIDTH / laneCount;
    for (let lane = 0; lane < laneCount; lane += 1) {
      if (safeLanes.includes(lane)) continue;
      const x = width * (lane + 0.5);
      const warning = this.add
        .rectangle(x, WORLD_HEIGHT / 2, width - 18, WORLD_HEIGHT, color, 0.08)
        .setStrokeStyle(3, color, 0.68)
        .setDepth(12);
      this.tweens.add({
        targets: warning,
        alpha: { from: 0.09, to: 0.56 },
        yoyo: true,
        repeat: 3,
        duration: 125,
        onComplete: () => {
          warning.destroy();
          if (!this.bossActive) return;
          const beam = this.add
            .rectangle(x, WORLD_HEIGHT / 2, width - 30, WORLD_HEIGHT, color, 0.68)
            .setDepth(22);
          if (Math.abs(this.player.x - x) < (width - 22) / 2) {
            this.damageBossHazard(damage, "explosion");
          }
          this.tweens.add({ targets: beam, alpha: 0, duration: 360, onComplete: () => beam.destroy() });
        }
      });
    }
  }

  damageBossHazard(
    amount: number,
    damageType: "projectile" | "collision" | "explosion" = "explosion"
  ): void {
    const now = this.time.now;
    if (!this.bossActive || this.ended || now - this.lastBossHazardDamageAt < 320) return;
    this.lastBossHazardDamageAt = now;
    // 大型预警技能命中时不应被此前普通子弹残留的无敌帧吞掉。
    if (this.ultimateActive <= 0) this.invulnerableUntil = Math.min(this.invulnerableUntil, now);
    this.damagePlayer(amount, damageType, "boss");
  }

  telegraphStrike(x: number): void {
    const warning = this.add.rectangle(x, WORLD_HEIGHT / 2, 52, WORLD_HEIGHT, 0xff3dbb, 0.11).setDepth(6);
    warning.setStrokeStyle(3, 0xff4d6d, 0.8);
    this.tweens.add({
      targets: warning,
      alpha: { from: 0.15, to: 0.7 },
      yoyo: true,
      repeat: 3,
      duration: 110,
      onComplete: () => {
        warning.destroy();
        const beam = this.add.rectangle(x, WORLD_HEIGHT / 2, 38, WORLD_HEIGHT, 0xff3dbb, 0.74).setDepth(18);
        if (Math.abs(this.player.x - x) < 42) this.damageBossHazard(32, "explosion");
        this.tweens.add({ targets: beam, alpha: 0, duration: 380, onComplete: () => beam.destroy() });
      }
    });
  }

  bankPendingTokens(showFeedback = true): number {
    if (this.runTokens <= 0) return 0;
    const rawTokens = this.runTokens;
    const bankedTokens = Math.floor(
      rawTokens * (1 + (save.permanentUpgrades.recovery ?? 0) * 0.04)
    );
    this.runTokens = 0;
    save.starCores += bankedTokens;
    persist();
    if (showFeedback) {
      this.floatText(
        WORLD_WIDTH / 2,
        340,
        `仓库同步完成 · ◆ +${bankedTokens}`,
        true
      );
      this.showBanner(`本段代币已永久保存 · 仓库 ${save.starCores}`, 1300);
    }
    return bankedTokens;
  }

  archivePendingRun(): number {
    if (this.ended) return 0;
    return this.bankPendingTokens(false);
  }

  defeatBoss(): void {
    if (!this.bossActive) return;
    const defeatedKind = this.bossKind;
    const defeatedElite = this.bossElite;
    this.bossActive = false;
    this.skillsConfiscated = false;
    const defeatedTier = this.bossTier + 1;
    const bossScore = Math.round((9000 + defeatedTier * 4200) * (defeatedElite ? 1.5 : 1));
    this.score += bossScore;
    const baseBossTokens =
      selectedMode === "boss"
        ? 95 + defeatedTier * 65 + selectedLevel * 15
        : 32 + defeatedTier * 20 + selectedLevel * 9;
    const bossTokens = Math.round(baseBossTokens * (defeatedElite ? 1.5 : 1));
    this.runTokens += bossTokens;
    this.floatText(
      WORLD_WIDTH / 2,
      300,
      `${defeatedElite ? "精英 " : ""}${BOSS_NAMES[defeatedKind]} ${defeatedTier} 击破 · ◆ +${bossTokens}`,
      true
    );
    this.bossParts.children.each((child) => {
      const part = child as Phaser.Physics.Arcade.Image;
      if (part.active) {
        this.burst(part.x, part.y, 0xff3dbb, 2);
        part.disableBody(true, true);
      }
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    this.bossEliteAura?.destroy();
    this.bossEliteAura = undefined;
    this.cameras.main.flash(160, 230, 255, 255);
    if (save.settings.screenShake) this.cameras.main.shake(600, 0.018);
    for (let i = 0; i < 8; i += 1) {
      this.time.delayedCall(i * 110, () =>
        this.burst(
          WORLD_WIDTH / 2 + Phaser.Math.Between(-180, 180),
          190 + Phaser.Math.Between(-90, 90),
          i % 2 ? 0xff3dbb : 0xffbd3e,
          Phaser.Math.FloatBetween(1.2, 2.2)
        )
      );
    }
    this.unlockAchievement("boss_slayer");
    this.bossTier = defeatedTier;
    this.levelCompleteTriggered = false;
    const totalScore = this.score + this.score2;
    this.nextBossScore =
      selectedMode === "endless"
        ? totalScore + 30000 + this.bossTier * 14000 + selectedLevel * 1800
        : selectedMode === "campaign"
          ? totalScore + 23000 + this.bossTier * 9000 + selectedLevel * 1500
          : 0;
    this.ultimate = Math.min(100, this.ultimate + 36);
    this.healPlayer(this.stats.maxHp * (selectedMode === "boss" ? 0.22 : 0.12), "首领能量回收");
    this.showBanner(
      `${defeatedElite ? "精英 " : ""}${BOSS_NAMES[defeatedKind]}击破 · 技能权限恢复`,
      1500
    );
    if (selectedMode === "campaign" && defeatedKind === "dark_deity") {
      this.nextSpawn = this.time.now + 999999;
      this.showBanner("普通战役完成 · 最终 Boss 已击破", 1800);
      this.time.delayedCall(1800, () => this.endRun(true));
      return;
    }
    if (selectedMode === "endless") {
      const stored = this.bankPendingTokens();
      this.showBanner(
        `无尽检查点 · ◆ ${stored} 已入库 · 下一清兵阈值 ${this.nextBossScore}`,
        1700
      );
    }
    this.time.delayedCall(1700, () => {
      showAirSupportSelection(this, () => {
        showDoctrineEvolution(this, () => {
          this.bossPhase = 0;
          if (selectedMode === "boss") {
            this.showBanner(`下一名 Boss 跃迁 · TIER ${this.bossTier + 1}`, 900);
            this.time.delayedCall(850, () => this.playBossArrivalCG());
          } else {
            this.showBanner(
              `${
                selectedMode === "campaign" ? "普通战役推进" : "无尽航线继续"
              } · 下一阈值 ${this.nextBossScore}`,
              1100
            );
          }
        });
      });
    });
  }

  playVictoryCG(onComplete: () => void): void {
    setAdaptiveMusic(0);
    const topBar = this.add.rectangle(WORLD_WIDTH / 2, 56, WORLD_WIDTH, 112, 0x000000, 0.94).setDepth(120);
    const bottomBar = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 56, WORLD_WIDTH, 112, 0x000000, 0.94)
      .setDepth(120);
    const title = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.42, "航线净空", {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "42px",
        fontStyle: "bold",
        color: "#eaffff",
        stroke: "#1c7188",
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(122)
      .setAlpha(0);
    const caption = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.42 + 64, `第 ${selectedLevel} 区域信号恢复 · 守护舰队正在跃迁`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "16px",
        color: "#82cfe0"
      })
      .setOrigin(0.5)
      .setDepth(122)
      .setAlpha(0);
    for (let i = 0; i < 20; i += 1) {
      const streak = this.add
        .rectangle(
          Phaser.Math.Between(20, WORLD_WIDTH - 20),
          Phaser.Math.Between(100, WORLD_HEIGHT - 100),
          3,
          Phaser.Math.Between(35, 100),
          i % 3 === 0 ? 0x9b5cff : 0x2df4ff,
          0.55
        )
        .setDepth(116);
      this.tweens.add({
        targets: streak,
        y: WORLD_HEIGHT + 130,
        duration: Phaser.Math.Between(420, 900),
        repeat: 2,
        onRepeat: () => {
          streak.y = -100;
          streak.x = Phaser.Math.Between(20, WORLD_WIDTH - 20);
        },
        onComplete: () => streak.destroy()
      });
    }
    this.tweens.add({ targets: [title, caption], alpha: 1, duration: 500 });
    this.tweens.add({
      targets: [this.player, ...(this.player2?.active ? [this.player2] : [])],
      y: -160,
      scaleX: "+=0.05",
      scaleY: "+=0.05",
      duration: 1900,
      ease: "Cubic.In"
    });
    sfx("victory");
    this.time.delayedCall(2600, () => {
      [topBar, bottomBar, title, caption].forEach((item) => item.destroy());
      onComplete();
    });
  }

  endRun(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.physics.world.pause();
    const totalScore = this.score + this.score2;
    const combatTokens = this.runTokens;
    this.runTokens = 0;
    const reward = Math.floor(
      (rewardForRun(selectedMode, totalScore, victory) + combatTokens) *
        (1 + (save.permanentUpgrades.recovery ?? 0) * 0.04)
    );
    const complete = (): void =>
      finishRun({
        mode: selectedMode,
        victory,
        score: this.score,
        score2: this.score2,
        seconds: this.elapsedSeconds,
        kills: this.kills,
        level: this.level,
        reward,
        combatTokens,
        bosses: this.bossTier,
        missionLevel: selectedLevel
      });
    if (victory) this.playVictoryCG(complete);
    else this.time.delayedCall(850, complete);
  }

  updateHud(): void {
    this.stats.maxHp = Math.max(1, Math.round(this.stats.maxHp));
    this.stats.hp = roundHealth(this.stats.hp, this.stats.maxHp);
    this.player2MaxHp = Math.max(1, Math.round(this.player2MaxHp));
    this.player2Hp = roundHealth(this.player2Hp, this.player2MaxHp);
    const g = this.hud.graphics;
    g.clear();
    g.fillStyle(0x071827, 0.88);
    g.fillRoundedRect(28, 72, 190, 12, 5);
    g.fillStyle(this.stats.hp / this.stats.maxHp < 0.3 ? 0xff4d6d : 0x2df4ff, 1);
    g.fillRoundedRect(28, 72, 190 * (this.stats.hp / this.stats.maxHp), 12, 5);
    if (this.player2) {
      g.fillStyle(0x071827, 0.88);
      g.fillRoundedRect(WORLD_WIDTH - 218, 72, 190, 12, 5);
      g.fillStyle(this.player2Hp / this.player2MaxHp < 0.3 ? 0xff4d6d : 0x9b5cff, 1);
      g.fillRoundedRect(
        WORLD_WIDTH - 218,
        72,
        190 * (this.player2Hp / this.player2MaxHp),
        12,
        5
      );
    }
    g.fillStyle(0x071827, 0.8);
    g.fillRoundedRect(WORLD_WIDTH / 2 - 130, 96, 260, 7, 3);
    g.fillStyle(0x9b5cff, 1);
    g.fillRoundedRect(WORLD_WIDTH / 2 - 130, 96, 260 * (this.xp / this.xpNeeded), 7, 3);
    g.lineStyle(6, 0x15354a, 0.9);
    g.strokeCircle(WORLD_WIDTH - 78, WORLD_HEIGHT - 192, 45);
    g.lineStyle(6, this.ultimate >= 100 ? 0x43ff9a : 0x2df4ff, 1);
    g.beginPath();
    g.arc(
      WORLD_WIDTH - 78,
      WORLD_HEIGHT - 192,
      45,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (this.ultimate / 100),
      false
    );
    g.strokePath();
    if (this.bossActive) {
      g.fillStyle(0x240c2d, 0.92);
      g.fillRoundedRect(78, 130, WORLD_WIDTH - 156, 16, 5);
      g.fillStyle(0xff3dbb, 1);
      g.fillRoundedRect(78, 130, (WORLD_WIDTH - 156) * (this.bossHp / this.bossMaxHp), 16, 5);
      g.lineStyle(1, 0xffa3d4, 0.6);
      g.strokeRoundedRect(78, 130, WORLD_WIDTH - 156, 16, 5);
      this.hud.bossName.setText(
        `${this.bossElite ? "ELITE // " : ""}${this.bossMutated ? "MUTATED // " : ""}${
          BOSS_NAMES[this.bossKind]
        } // TIER ${this.bossTier + 1} // PHASE ${this.bossPhase}${
          this.skillsConfiscated ? " // SKILLS STOLEN" : ""
        }`
      );
    } else {
      this.hud.bossName.setText("");
    }
    this.hud.hp.setText(`P1 ${Math.round(this.stats.hp)} / ${Math.round(this.stats.maxHp)}`);
    this.hud.score.setText(
      this.player2
        ? `P2 ${Math.round(this.player2Hp)}/${Math.round(this.player2MaxHp)}  ·  ${this.score}:${this.score2}`
        : this.score.toString().padStart(7, "0")
    );
    this.hud.time.setText(formatTime(this.elapsedSeconds));
    const campaignStatus =
      selectedMode === "boss"
        ? `BOSS TIER ${this.bossTier + (this.bossActive ? 1 : 0)}`
        : selectedMode === "campaign"
          ? `CAMPAIGN ${Math.min(3, this.bossTier + (this.bossActive ? 1 : 0))}/3`
          : `NEXT BOSS ${Math.max(0, this.nextBossScore - this.score - this.score2)}`;
    this.hud.level.setText(
      `${SPECIALIZATIONS[save.selectedSpecialization].code} · LV.${this.level}/100  //  ◆ ${
        this.runTokens
      }${
        save.selectedSpecialization === "wheelchair" && this.time.now < this.wheelchairOverdriveUntil
          ? "  //  FULL SPEED"
          : ""
      }  //  ${campaignStatus}${
        this.bossPower ? `  //  G ${BOSS_POWER_OPTIONS.find((item) => item.id === this.bossPower)?.name}` : ""
      }`
    );
    this.hud.combo.setText(this.combo > 1 ? `${this.combo} COMBO` : "");
  }

  updateDebug(): void {
    if (!DEBUG) return;
    const panel = document.querySelector("#debug-panel");
    if (!panel) return;
    panel.innerHTML = [
      `FPS ${Math.round(this.game.loop.actualFps)}`,
      `ENEMY ${this.enemies.countActive(true)}`,
      `BULLET ${this.enemyBullets.countActive(true)}`,
      `PHASE ${this.bossPhase}`,
      `HP ${Math.round(this.stats.hp)}`
    ].join("<br>");
  }

  nearestTarget(x: number, y: number): Phaser.Physics.Arcade.Image | null {
    let nearest: Phaser.Physics.Arcade.Image | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const group of [this.enemies, this.bossParts]) {
      for (const child of group.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (!child.active) continue;
        const dx = child.x - x;
        const dy = child.y - y;
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) {
          nearest = child;
          nearestDistance = distance;
        }
      }
    }
    return nearest;
  }

  closestTargets(x: number, y: number, count: number): Phaser.Physics.Arcade.Image[] {
    return ([...this.enemies.getChildren(), ...this.bossParts.getChildren()] as Phaser.Physics.Arcade.Image[])
      .filter((target) => target.active)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Squared(x, y, a.x, a.y) - Phaser.Math.Distance.Squared(x, y, b.x, b.y)
      )
      .slice(0, count);
  }

  floatText(x: number, y: number, text: string, critical = false): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: "Consolas, monospace",
        fontSize: critical ? "24px" : "16px",
        fontStyle: "bold",
        color: critical ? "#ffbd3e" : "#dffcff"
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      y: y - 45,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy()
    });
  }

  burst(x: number, y: number, color: number, scale = 1): void {
    const ring = this.add.circle(x, y, 10, color, 0.5).setDepth(30);
    ring.setStrokeStyle(4, color, 1);
    this.tweens.add({
      targets: ring,
      radius: 42 * scale,
      alpha: 0,
      duration: 330,
      onComplete: () => ring.destroy()
    });
    if (save.settings.quality === "high") {
      for (let i = 0; i < 7; i += 1) {
        const spark = this.add.rectangle(x, y, 4, 14, color, 1).setDepth(29);
        const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.25;
        this.tweens.add({
          targets: spark,
          x: x + Math.cos(angle) * 55 * scale,
          y: y + Math.sin(angle) * 55 * scale,
          alpha: 0,
          rotation: angle,
          duration: 280,
          onComplete: () => spark.destroy()
        });
      }
    }
  }

  showBanner(text: string, duration = 1200): void {
    const banner = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.4, text, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "29px",
        fontStyle: "bold",
        color: "#eaffff",
        backgroundColor: "#071827cc",
        stroke: "#0a2030",
        strokeThickness: 8,
        padding: { x: 28, y: 14 }
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      y: WORLD_HEIGHT * 0.38,
      duration: 180,
      hold: Math.max(250, duration - 400),
      yoyo: true,
      onComplete: () => banner.destroy()
    });
  }
}

refreshRails();
window.addEventListener("beforeunload", () => {
  activeScene?.archivePendingRun();
});
const bootParams = new URLSearchParams(location.search);
const autoStartMode = bootParams.get("autostart");
const requestedLevel = Number(bootParams.get("level"));
if (requestedLevel >= 1 && requestedLevel <= 5) selectedLevel = requestedLevel;
const requestedVariant = bootParams.get("variant");
if (requestedVariant === "coop" || requestedVariant === "score_duel") playVariant = requestedVariant;
const requestedSpecialization = bootParams.get("specialization") as SpecializationId | null;
if (requestedSpecialization && requestedSpecialization in SPECIALIZATIONS) {
  save.selectedSpecialization = requestedSpecialization;
}
if (autoStartMode === "campaign" || autoStartMode === "boss" || autoStartMode === "endless") {
  selectedMode = autoStartMode;
  startRun();
} else if (bootParams.get("screen") === "pilot") {
  showPilotSelect();
} else if (bootParams.get("screen") === "levels") {
  showLevelSelect();
} else if (bootParams.get("screen") === "about") {
  showAbout();
} else if (bootParams.get("screen") === "medals") {
  showMedalGallery();
} else {
  showMenu();
}
