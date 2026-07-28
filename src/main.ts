import Phaser from "phaser";
import "./styles.css";
import {
  DEFAULT_SAVE,
  type GameMode,
  type SaveData,
  type SkinId,
  type ShipId,
  type SpecializationId,
  chooseUnique,
  formatTime,
  loadSave,
  rewardForRun,
  xpToNextLevel
} from "./game-logic";

const WORLD_WIDTH = 1080;
const WORLD_HEIGHT = 1280;
const SAVE_KEY = "starfall_save_v1";
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
    trait: "初始暴击 10% / 效果 120% · 暴击击杀回血 5% 并 MAX HP +2"
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
    trait: "击杀回复 2% 最大生命 · 爆炸减伤 50%"
  },
  vampire: {
    name: "吸血流派",
    code: "BLOOD ECHO",
    icon: "◉",
    description: "所有基础属性降低 11%，但每次命中都会抽取敌方能量修复机体。",
    hp: 0.89,
    speed: 0.89,
    damage: 0.89,
    fireRate: 0.89,
    cooldown: 1.11,
    damageTaken: 1.11,
    explosionTaken: 1,
    scale: 1,
    trait: "每次命中回复 3% 已损生命 · 受伤 +11%"
  },
  devour: {
    name: "吞噬流派",
    code: "EVOLUTION",
    icon: "∞",
    description: "基础数值降低 10%，用持续击杀在本局中无限进化舰体。",
    hp: 0.9,
    speed: 0.9,
    damage: 0.9,
    fireRate: 0.9,
    cooldown: 1.08,
    damageTaken: 1,
    explosionTaken: 1,
    scale: 1,
    trait: "每次击杀：生命上限 +2% · 回复最大生命 1%"
  },
  wheelchair: {
    name: "轮椅流派",
    code: "JUGGERNAUT",
    icon: "◉",
    description: "关闭全部射击武器，以机体作为唯一武器。撞击成长、持续再生，适合正面碾压。",
    hp: 1.12,
    speed: 0.82,
    damage: 1,
    fireRate: 0,
    cooldown: 1,
    damageTaken: 0.5,
    explosionTaken: 0.5,
    scale: 1.12,
    trait: "无法射击 · 撞杀最大生命 +5% · 每 5 秒双重恢复"
  }
};

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

type PlayVariant = "single" | "coop" | "score_duel";
type BossKind = "titan" | "mirror" | "usurper";
type TemporarySkill = "overdrive" | "prism" | "singularity";
type AgileTrajectory = "fan" | "arc" | "helix" | "scatter" | "cross" | "circle";
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
  usurper: "技能篡夺者"
};

const DOCTRINE_EVOLUTIONS = [
  {
    id: "echo_clone",
    school: "通用",
    icon: "◫",
    name: "镜像僚机",
    description: (level: number) =>
      level === 0
        ? "复制当前战机作为僚机，体积、伤害、射速与机动均为本体 50%。"
        : `镜像僚机同步率提升，伤害与射速额外 +${(level + 1) * 6}%。`
  },
  {
    id: "lance_mastery",
    school: "力量",
    icon: "▲",
    name: "贯星长枪",
    description: (level: number) => `直线弹伤害 +${(level + 1) * 18}%，并获得额外贯穿。`
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
    description: (level: number) => `每 12 次击杀获得 +${(level + 1) * 2}% 本局伤害。`
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
    name: "等离子激光",
    icon: "↟",
    kind: "weapon",
    description: (level) =>
      level === 0 ? "解锁贯穿敌阵的高能光束" : `激光宽度与贯穿伤害提升 · Lv.${level + 1}`
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
    id: "damage",
    name: "火控核心",
    icon: "△",
    kind: "passive",
    description: (level) => `全部武器伤害 +${(level + 1) * 8}%`
  },
  {
    id: "haste",
    name: "超频引擎",
    icon: "»",
    kind: "passive",
    description: (level) => `全部武器射速 +${(level + 1) * 7}%`
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
    description: (level) => `暴击率 +${(level + 1) * 4}%`
  }
];

let save: SaveData = loadSave(localStorage.getItem(SAVE_KEY));
let selectedMode: GameMode = "endless";
let selectedLevel = 1;
let playVariant: PlayVariant = "single";
let selectedShip2: ShipId = "guardian";
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
  document.querySelector(".app-shell")?.classList.remove("playing");
  overlayRoot.innerHTML = "";
  uiRoot.innerHTML = `
    <section class="screen home-screen" aria-label="主菜单">
      <nav class="home-nav"><span>STARGUARD // COMMAND</span><span class="live-dot">防线在线</span></nav>
      <div class="home-hero">
        <div class="menu-logo">
          <div class="eyebrow">INTERSTELLAR GUARDIAN</div>
          <h1>星际守护者</h1>
          <span class="en">NEON ABYSS · AIR STRIKE</span>
        </div>
        <div class="ship-showcase">${fighterPreview(save.selectedShip, "hero-fighter")}</div>
        <div class="mission-brief">
          <span>最新战况</span><strong>裂隙舰队正在逼近星港边境</strong>
          <small>选择战机与航线，在泰坦完成跃迁前摧毁它。</small>
        </div>
      </div>
      <button class="primary-button" id="start-button">进入作战序列</button>
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
      <div class="version">SYSTEM ONLINE // v0.2.0</div>
    </section>
  `;
  document.querySelector("#start-button")!.addEventListener("click", () => {
    sfx("click");
    showPilotSelect();
  });
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
      ${screenHeader("STEP 02 / INFINITE PROTOCOL", "选择无限协议")}
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
               .join("")}</select> · 方向键 / Enter / J K</div>`
      }
      <div class="protocol-grid">
        <button class="protocol-card ${selectedMode === "endless" ? "selected" : ""}" data-protocol="endless">
          <span>PROTOCOL 01</span><i>∞</i>
          <h3>深空无限航线</h3>
          <p>持续飞行、持续构筑。每达到新的分数阈值都会遭遇更强 Boss，击败后继续前进。</p>
          <div><b>分数触发 BOSS</b><b>敌群混编</b><b>奖励递增</b></div>
        </button>
        <button class="protocol-card danger ${selectedMode === "boss" ? "selected" : ""}" data-protocol="boss">
          <span>PROTOCOL 02</span><i>⚠</i>
          <h3>泰坦炼狱</h3>
          <p>以基础形态直接挑战高强度 Boss。Boss 将无限重生并强化，但奖励极为丰厚。</p>
          <div><b>基础武装开局</b><b>极高难度</b><b>巨额代币</b></div>
        </button>
      </div>
      <div class="danger-select">
        <div><span>STARTING THREAT</span><strong>选择初始威胁等级</strong></div>
        ${[
          { id: 3, name: "高压", copy: "敌机数量与弹速明显提升" },
          { id: 4, name: "深渊", copy: "精英密集，Boss 攻击更快" },
          { id: 5, name: "噩梦", copy: "奖励最高，几乎没有喘息时间" }
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
          selectedMode === "boss" ? "泰坦炼狱" : "深空无限航线"
        }</strong>
        <small>本次飞行没有终点。死亡或主动撤退时结算全部代币。</small>
      </div>
      <button class="primary-button flow-next" id="launch-level">点火 · 进入无限空域</button>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showPilotSelect);
  document.querySelectorAll<HTMLButtonElement>("[data-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      playVariant = button.dataset.variant as PlayVariant;
      showLevelSelect();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-protocol]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.protocol as GameMode;
      showLevelSelect();
    });
  });
  document.querySelector<HTMLSelectElement>("#ship-two")?.addEventListener("change", (event) => {
    selectedShip2 = (event.target as HTMLSelectElement).value as ShipId;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLevel = Number(button.dataset.level);
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
        <div class="about-logo">星际守护者 <small>v0.2.0</small></div>
        <p>沉浸式俯视飞行战斗：没有终点，只有不断升级的敌群、分数阈值与无限泰坦。</p>
        <div class="key-table">
          <div><kbd>WASD / 方向键</kbd><span>移动战机</span></div>
          <div><kbd>SPACE</kbd><span>按住持续开火</span></div>
          <div><kbd>1 / 2 / 3</kbd><span>激光、导弹、无人机技能</span></div>
          <div><kbd>Q</kbd><span>EMP 一键清屏</span></div>
          <div><kbd>E</kbd><span>星核超载</span></div>
          <div><kbd>F</kbd><span>相位闪避：位移并短暂无敌</span></div>
          <div><kbd>R</kbd><span>纳米修复：恢复 18% 最大生命</span></div>
          <div><kbd>X</kbd><span>一键自动投降</span></div>
          <div><kbd>ESC</kbd><span>暂停</span></div>
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
    { id: "firepower", icon: "▲", name: "火力校准", effect: "全部武器伤害 +3%/级", max: 12 },
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
          <label><span>高质量特效</span><input id="quality" class="switch" type="checkbox" ${
            save.settings.quality === "high" ? "checked" : ""
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
    save.settings.quality = (event.target as HTMLInputElement).checked ? "high" : "low";
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
      roundPixels: false
    }
  };
  game = new Phaser.Game(config);
}

function showUpgrade(scene: BattleScene): void {
  scene.isModal = true;
  scene.physics.world.pause();
  const available = UPGRADES.filter((upgrade) => (scene.upgradeLevels[upgrade.id] ?? 0) < 5);
  const draw = (): void => {
    const options = chooseUnique(available, 3);
    overlayRoot.innerHTML = `
      <div class="overlay">
        <div class="overlay-panel">
          <div class="eyebrow">TACTICAL UPLINK</div>
          <h2>选择战术升级</h2>
          <p>战斗已暂时冻结 · 当前等级 ${scene.level}</p>
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
    (evolution) => (scene.doctrineLevels[evolution.id] ?? 0) < 5
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
        <div class="eyebrow">${result.victory ? "MISSION COMPLETE" : "INFINITE FLIGHT ARCHIVED"}</div>
        <h2>${
          playVariant === "score_duel"
            ? result.score >= (result.score2 ?? 0)
              ? "P1 赢得空域"
              : "P2 赢得空域"
            : result.victory
              ? `关卡 ${result.missionLevel} 完成`
              : "本次无限航迹已封存"
        }</h2>
        <p>${result.victory ? "泰坦核心已被摧毁，航道暂时安全。" : "星核数据已回收，调整构筑后再次出击。"}</p>
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
          result.victory && result.missionLevel < 5 ? "进入下一关" : "再次出击"
        }</button>
        <div class="overlay-actions">
          <button class="secondary-button" id="result-hangar">机库</button>
          <button class="secondary-button" id="result-menu">主菜单</button>
        </div>
      </div>
    </div>
  `;
  document.querySelector("#again-run")!.addEventListener("click", () => {
    if (result.victory && result.missionLevel < 5) selectedLevel = result.missionLevel + 1;
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
    pickupRadius: 90,
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
  bossEliteAura?: Phaser.GameObjects.Arc;
  bossAttackIndex = -1;
  skillsConfiscated = false;
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
  nextAgileBloom = 0;
  agileVolleyIndex = 0;
  nextWheelchairHeal = 0;
  wheelchairOverdriveUntil = 0;
  lastBossHazardDamageAt = -10000;
  temporarySkill: TemporarySkill | null = null;
  temporarySkillUntil = 0;
  nextTemporaryPattern = 0;
  doctrineLevels: Record<string, number> = {};
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
    this.load.image("enemyScoutArt", "/assets/enemies/enemy_scout.png");
    this.load.image("enemyInterceptorArt", "/assets/enemies/enemy_interceptor.png");
    this.load.image("enemyStrikerArt", "/assets/enemies/enemy_striker.png");
    this.load.image("enemySuppressorArt", "/assets/enemies/enemy_suppressor.png");
    this.load.image("enemyMineLayerArt", "/assets/enemies/enemy_mine_layer.png");
    this.load.image("enemyEliteArt", "/assets/enemies/enemy_elite_gunship.png");
    this.load.image("enemyBomberArt", "/assets/enemies/enemy_bomber.png");
    this.load.image("enemyCourierArt", "/assets/enemies/enemy_courier.png");
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
            grantEvolution: (id: string) => void;
            setMaxHp: (value: number) => void;
            hitPlayer: (amount: number) => void;
            defeatBoss: () => void;
            primeRamKill: () => void;
            criticalExecute: () => void;
            eliteExecute: () => void;
            grantTemporarySkill: (skill: TemporarySkill) => void;
            clearTemporarySkill: () => void;
            ramBoss: () => void;
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
          bossActive: this.bossActive,
          bossTier: this.bossTier,
          bossKind: this.bossKind,
          bossElite: this.bossElite,
          bossHp: this.bossHp,
          bossMaxHp: this.bossMaxHp,
          skillsConfiscated: this.skillsConfiscated,
          worldWidth: WORLD_WIDTH,
          doctrineLevels: { ...this.doctrineLevels },
          cloneCount: this.wingClones.filter((clone) => clone.active).length,
          playerWeapons: (this.playerBullets.getChildren() as Phaser.Physics.Arcade.Image[])
            .filter((bullet) => bullet.active)
            .map((bullet) => bullet.getData("weapon")),
          nextBossScore: this.nextBossScore,
          player2: Boolean(this.player2?.active),
          playerHp: this.stats.hp,
          playerMaxHp: this.stats.maxHp,
          playerScale: this.player.displayWidth / 98,
          specialization: save.selectedSpecialization,
          critChance: this.actualCritChance(),
          critEffect: this.actualCritMultiplier(),
          agileDamageMultiplier:
            save.selectedSpecialization === "agile"
              ? this.virtualDoctrineCritChance() * 100 * 0.005
              : 0,
          agileSpeedMultiplier:
            save.selectedSpecialization === "agile" ? this.agileSpeedMultiplier() : 1,
          wheelchairRamDamage:
            save.selectedSpecialization === "wheelchair" ? this.wheelchairRamDamage() : 0,
          wheelchairOverdriveActive: this.time.now < this.wheelchairOverdriveUntil,
          wheelchairOverdriveRemaining: Math.max(0, this.wheelchairOverdriveUntil - this.time.now),
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
              eliteVariant: Boolean(enemy.getData("eliteVariant")),
              texture: enemy.texture.key,
              ramInjected: Boolean(enemy.getData("ramInjected")),
              debugInjected: Boolean(enemy.getData("debugInjected"))
            })),
          runTokens: this.runTokens,
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
        grantEvolution: (id: string) => this.applyDoctrineEvolution(id),
        setMaxHp: (value: number) => {
          this.stats.maxHp = Math.max(1, value);
          this.stats.hp = this.stats.maxHp;
        },
        hitPlayer: (amount: number) => {
          this.invulnerableUntil = 0;
          this.damagePlayer(amount);
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
        criticalExecute: () => {
          const enemy = this.spawnEnemy(this.time.now, "scout");
          enemy.setData("lastHitCritical", true).setData("lastOwner", 1);
          this.destroyEnemy(enemy, true);
        },
        eliteExecute: () => {
          const enemy = this.spawnEnemy(this.time.now, "gunship");
          enemy.setData("lastOwner", 1);
          this.destroyEnemy(enemy, true);
        },
        grantTemporarySkill: (skill: TemporarySkill) => this.activateTemporarySkill(skill),
        clearTemporarySkill: () => {
          this.temporarySkill = null;
          this.temporarySkillUntil = 0;
        },
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
        }
      };
    }
    const levelConfig = LEVELS[selectedLevel - 1];
    this.campaignBossAt = levelConfig.duration;
    this.nextBossScore = 13000 + selectedLevel * 2500;
    this.nextFlightToken = this.time.now + 4500;
    this.nextSkillPickup = this.time.now + Phaser.Math.Between(11000, 16000);
    this.showBanner(
      selectedMode === "boss"
        ? `首领炼狱 · 威胁 ${selectedLevel}`
        : `无限航线 · ${levelConfig.name}`
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
            ? "轮椅协议 · 撞击歼敌 · G 全速冲锋 · Q 清屏"
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
    const damageBoost = 1 + (save.permanentUpgrades.firepower ?? 0) * 0.03;
    const speedBoost = 1 + (save.permanentUpgrades.engine ?? 0) * 0.025;
    const armorBoost = 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
    this.stats.maxHp = Math.round(ship.hp * specialization.hp * hpBoost);
    this.stats.hp = this.stats.maxHp;
    this.stats.speed = ship.speed * specialization.speed * speedBoost;
    this.stats.damageMultiplier = damageBoost * ship.damage * specialization.damage;
    this.stats.cooldownMultiplier = specialization.cooldown;
    this.stats.damageTakenMultiplier = specialization.damageTaken * armorBoost;
    this.stats.explosionTakenMultiplier = specialization.explosionTaken;
    this.stats.fireRateMultiplier = specialization.fireRate;
    this.stats.critChance = save.selectedSpecialization === "power" ? 0.1 : 0.05;
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
            ? "撞击歼敌  [G]全速冲锋/减伤30%  [Q]清屏 [E]超载  [F]相位闪避 [R]纳米修复"
            : "SPACE 开火  [1]激光 [2]导弹 [3]无人机  [Q]清屏 [E]超载  [F]相位闪避 [R]纳米修复"
          : "P1 WASD/SPACE/Q/E  ·  P2 方向键/ENTER/J/K",
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
        this.damagePlayer(
          projectile.getData("damage") ?? 12,
          projectile.getData("damageType") ?? "projectile"
        );
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
          projectile.getData("damageType") ?? "projectile"
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
      this.collisionReadyAt = now + (overdriveActive ? 260 : 480);
      const isElite = Boolean(enemy.getData("elite"));
      const baseRamDamage = this.wheelchairRamDamage() * (isElite ? 1.25 : 1);
      const ramDamage =
        type === "scout" && !isElite
          ? Math.max(baseRamDamage, enemy.getData("hp") ?? maxHp)
          : baseRamDamage;
      const remainingHp = (enemy.getData("hp") ?? maxHp) - ramDamage;
      enemy.setData("hp", remainingHp);
      this.damagePlayer(isElite ? 24 : type === "striker" || type === "suppressor" || type === "mine_layer" ? 18 : 14, "collision");
      if (remainingHp <= 0) {
        enemy.setData("lastOwner", 1);
        enemy.setData("wheelchairRamKill", true);
        this.destroyEnemy(enemy, true);
      } else {
        enemy.setVelocityY(-220);
        this.floatText(enemy.x, enemy.y, `碾压 ${Math.round(ramDamage)}`, true);
      }
      this.impactBurst(enemy.x, enemy.y, 0xffbd3e);
      return;
    }
    if (type === "gunship" || type === "bomber") {
      const collisionDamage = maxHp * 0.25;
      enemy.setData("hp", Math.max(1, (enemy.getData("hp") ?? maxHp) - collisionDamage));
      if (owner === 1) this.damagePlayer(24, "collision");
      else this.damagePlayer2(24, "collision");
      this.floatText(enemy.x, enemy.y, `撞击 -25%`, true);
      enemy.setVelocityY(-180);
    } else {
      const collisionDamage = Math.max(1, Math.ceil(enemy.getData("hp") ?? maxHp));
      if (owner === 1) this.damagePlayer(collisionDamage, "collision");
      else this.damagePlayer2(collisionDamage, "collision");
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
      this.collisionReadyAt = now + (wheelchairRam ? 520 : 950);
      this.damagePlayer(38, "collision");
    } else {
      this.player2CollisionReadyAt = now + 950;
      this.damagePlayer2(38, "collision");
    }
    const bossRamDamage = wheelchairRam ? this.bossMaxHp * 0.02 : 75;
    this.bossHp = Math.max(0, this.bossHp - bossRamDamage);
    this.checkBossPhase();
    if (this.bossHp <= 0) this.defeatBoss();
    this.floatText(part.x, part.y + 35, `冲撞 ${Math.round(bossRamDamage)}`, true);
    this.impactBurst(part.x, part.y, 0xffbd3e);
  }

  wheelchairRamDamage(): number {
    const cannonLevel = this.upgradeLevels.cannon ?? 1;
    const lanceLevel = this.doctrineLevels.lance_mastery ?? 0;
    const openingOneHitDamage = 39.5;
    return (
      Math.max(openingOneHitDamage, 12 + cannonLevel * 4) *
      (1 + lanceLevel * 0.18) *
      this.currentDamageMultiplier()
    );
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
    this.input.keyboard!.on("keydown-E", () => this.activateUltimate());
    this.input.keyboard!.on("keydown-F", () => this.activatePhaseDash());
    this.input.keyboard!.on("keydown-G", () => this.activateWheelchairOverdrive());
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
        const spark = this.add
          .image(this.player.x + offset, this.player.y + this.player.displayHeight * 0.35, "engineSpark")
          .setTint(SKINS[save.equippedSkin].tint)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(6)
          .setScale(Phaser.Math.FloatBetween(0.5, 1.1));
        this.tweens.add({
          targets: spark,
          y: spark.y + Phaser.Math.Between(55, 105),
          alpha: 0,
          scale: 0.1,
          duration: Phaser.Math.Between(220, 420),
          onComplete: () => spark.destroy()
        });
      }
    }
  }

  spawnFlightToken(): void {
    const value = 2 + selectedLevel + this.bossTier;
    const token = this.pickups.get(
      Phaser.Math.Between(80, WORLD_WIDTH - 80),
      -50,
      "flightCoin"
    ) as Phaser.Physics.Arcade.Image;
    token.enableBody(true, token.x, -50, true, true);
    token
      .setTexture("flightCoin")
      .setDepth(7)
      .setData({ kind: "token", value })
      .setVelocity(Phaser.Math.Between(-42, 42), Phaser.Math.Between(115, 165))
      .setAngularVelocity(120);
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
      save.selectedSpecialization === "wheelchair" ||
      time < this.nextTemporaryPattern ||
      this.skillsConfiscated
    ) {
      return;
    }
    if (this.temporarySkill === "prism") {
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
      (1 + (this.upgradeLevels.speed ?? 0) * 0.06) *
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
    if (save.selectedSpecialization === "wheelchair") return;
    const haste = this.stats.fireRateMultiplier * (1 + (this.upgradeLevels.haste ?? 0) * 0.07);
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

  fireCannon(
    level: number,
    shooter: Phaser.Physics.Arcade.Image = this.player,
    owner = 1
  ): void {
    const spread = Math.min(3, Math.floor((level + 1) / 2));
    const powerCount = level >= 4 ? 3 : 2;
    if (owner === 1 && save.selectedSpecialization === "agile") {
      const projectileRatio = 1.14 + Math.min(100, this.level) * 0.01;
      this.agileBulletAccumulator += powerCount * projectileRatio;
      const bloomLevel = this.doctrineLevels.bloom_mastery ?? 0;
      const baseCount = Math.max(2, Math.floor(this.agileBulletAccumulator));
      this.agileBulletAccumulator -= baseCount;
      const count = baseCount + (bloomLevel > 0 ? bloomLevel + 1 : 0);
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
          8 + level * 2.8,
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
        (12 + level * 4) * (1 + lanceLevel * 0.18),
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
    const count = Math.min(38, 20 + Math.floor(this.level / 6) + bloomLevel * 3);
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
        5 + level * 1.25,
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
      28 + level * 12,
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
        36 + level * 13,
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
      this.dealDirectDamage(target, 32 + level * 18, target.x, target.y);
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
          this.dealDirectDamage(target, 18 + (this.upgradeLevels.blade ?? 0) * 11, target.x, target.y);
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
    bullet.setTexture(texture).setActive(true).setVisible(true).setDepth(8);
    (bullet.body as Phaser.Physics.Arcade.Body).setSize(bullet.width, bullet.height, true);
    bullet.setData("damage", damage * this.currentDamageMultiplier());
    bullet.setData("weapon", weapon);
    bullet.setData("owner", owner);
    bullet.setData("pierce", 0);
    bullet.setVelocity(0, velocityY);
    return bullet;
  }

  currentDamageMultiplier(): number {
    const passive = 1 + (this.upgradeLevels.damage ?? 0) * 0.08;
    const balanced = save.selectedShip === "balanced" && this.combo > 20 ? 1.12 : 1;
    const devourLevel = this.doctrineLevels.devour_mastery ?? 0;
    const adaptiveDamage = 1 + Math.floor(this.kills / 12) * devourLevel * 0.02;
    const agileCritConversion =
      save.selectedSpecialization === "agile"
        ? 1 + this.virtualDoctrineCritChance() * 100 * 0.005
        : 1;
    const temporaryDamage =
      this.temporarySkill === "overdrive"
        ? 1.65
        : this.temporarySkill === "prism"
          ? 1.25
          : this.temporarySkill === "singularity"
            ? 1.35
            : 1;
    return (
      this.stats.damageMultiplier *
      passive *
      balanced *
      adaptiveDamage *
      agileCritConversion *
      temporaryDamage
    );
  }

  virtualDoctrineCritChance(): number {
    return Phaser.Math.Clamp(
      0.1 + Math.max(0, this.level - 1) * 0.05 + (this.upgradeLevels.luck ?? 0) * 0.05,
      0,
      1
    );
  }

  doctrineCritEffect(): number {
    return 1.2 + Math.max(0, this.level - 1) * 0.05 + (this.upgradeLevels.luck ?? 0) * 0.05;
  }

  actualCritChance(): number {
    if (save.selectedSpecialization === "agile" || save.selectedSpecialization === "wheelchair") {
      return 0;
    }
    if (save.selectedSpecialization === "power") return this.virtualDoctrineCritChance();
    return Phaser.Math.Clamp(this.stats.critChance + (this.upgradeLevels.luck ?? 0) * 0.04, 0, 1);
  }

  actualCritMultiplier(): number {
    return save.selectedSpecialization === "power" ? this.doctrineCritEffect() : 1.75;
  }

  agileSpeedMultiplier(): number {
    return 1 + this.doctrineCritEffect() * 100 * 0.001;
  }

  updateProjectiles(time: number): void {
    this.playerBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return true;
      if (bullet.getData("weapon") === "missile") {
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
      if (playVariant === "score_duel" && this.player2?.active) {
        const owner = bullet.getData("owner") ?? 1;
        const opponent = owner === 1 ? this.player2 : this.player;
        if (
          opponent.active &&
          Phaser.Math.Distance.Between(bullet.x, bullet.y, opponent.x, opponent.y) < 28
        ) {
          if (owner === 1) {
            this.damagePlayer2(9);
            this.score += 75;
          } else {
            this.damagePlayer(9);
            this.score2 += 75;
          }
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
    const rolledType: EnemyType =
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
    const eliteVariant = forcedElite || (!forcedType && Math.random() < eliteChance);
    const eliteClass = eliteVariant || type === "gunship" || type === "bomber";
    const textures: Record<EnemyType, string> = {
      scout: "enemyScoutArt",
      interceptor: "enemyInterceptorArt",
      striker: "enemyStrikerArt",
      suppressor: "enemySuppressorArt",
      mine_layer: "enemyMineLayerArt",
      gunship: "enemyEliteArt",
      bomber: "enemyBomberArt",
      courier: "enemyCourierArt"
    };
    const texture = textures[type];
    const enemy = this.enemies.get(Phaser.Math.Between(70, WORLD_WIDTH - 70), -80, texture) as Phaser.Physics.Arcade.Image;
    enemy.enableBody(true, enemy.x, -80, true, true);
    enemy
      .setTexture(texture)
      .setDepth(eliteVariant ? 9 : 7)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .clearTint()
      .setAngle(type === "interceptor" || type === "gunship" ? 180 : 0);
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
      (eliteVariant ? 2.15 : 1);
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
      elite: eliteClass,
      eliteVariant,
      damageScale: eliteVariant ? 1.45 : 1,
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
    enemy.setVelocity(
      type === "courier" ? Phaser.Math.Between(-55, 55) : 0,
      baseSpeed * Math.min(1.45, intensity) * 0.72 * (eliteVariant ? 0.92 : 1)
    );
    if (eliteVariant) {
      enemy.setTint(0xffe3a3);
      this.floatText(enemy.x, 48, "ELITE", true);
    }
    return enemy;
  }

  updateEnemies(time: number, _dt: number): void {
    if (!this.bossActive && time >= this.nextSpawn) {
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
      if (enemy.getData("eliteVariant")) {
        enemy.setAlpha(0.88 + Math.sin(time * 0.008 + enemy.getData("aiPattern")) * 0.12);
      }
      if (type === "scout") {
        enemy.x = enemy.getData("originX") + Math.sin(age * 0.003) * 48;
      } else if (type === "interceptor") {
        enemy.x = enemy.getData("originX") + Math.sin(age * 0.006) * 105;
      } else if (type === "striker") {
        enemy.x = enemy.getData("originX") + Math.sin(age * 0.0048 + enemy.getData("aiPattern")) * 125;
      } else if (type === "suppressor") {
        enemy.x = enemy.getData("originX") + Math.sin(age * 0.0026 + enemy.getData("aiPattern")) * 165;
      } else if (type === "mine_layer") {
        enemy.x = enemy.getData("originX") + Math.sin(age * 0.0017 + enemy.getData("aiPattern")) * 120;
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
      if (
        type !== "courier" &&
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
    this.physics.moveToObject(bullet, this.player, speed);
  }

  fireEnemyAngle(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    damageType: "projectile" | "explosion" = "projectile"
  ): Phaser.Physics.Arcade.Image {
    const effectiveDamage = damage * (this.bossActive ? (this.bossElite ? 1.58 : 1.18) : 1);
    const bullet = this.enemyBullets.get(x, y, "enemyBullet") as Phaser.Physics.Arcade.Image;
    bullet.enableBody(true, x, y, true, true);
    bullet.setTexture("enemyBullet").setTint(effectiveDamage >= 20 ? 0xff3dbb : 0xffffff).setDepth(8);
    bullet.setData("damage", effectiveDamage);
    bullet.setData("damageType", damageType);
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
        if (target.getData("eliteVariant")) target.setTint(0xffe3a3);
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
        this.healPlayer(this.stats.maxHp * 0.05, "暴击处决");
        this.floatText(x, y - 48, "MAX HP +2", true);
      }
      if (
        save.selectedSpecialization === "wheelchair" &&
        enemy.getData("wheelchairRamKill") === true
      ) {
        this.stats.maxHp = Math.ceil(this.stats.maxHp * 1.05);
        this.floatText(x, y - 48, `碾压成长 · HP ${this.stats.maxHp}`, true);
      }
      const eliteKill = Boolean(enemy.getData("elite"));
      if (save.selectedSpecialization === "agile" && eliteKill) {
        this.stats.maxHp = Math.ceil(this.stats.maxHp * 1.05);
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
      const pickup = this.pickups.get(x, y, "pickup") as Phaser.Physics.Arcade.Image;
      pickup.enableBody(true, x, y, true, true);
      pickup
        .setTexture("pickup")
        .setDepth(6)
        .setData({ kind: "xp", value: enemy.getData("xp") ?? 5 });
      pickup.setVelocity(Phaser.Math.Between(-35, 35), 55);
      this.burst(x, y, 0xff4d6d);
      this.floatText(x + 24, y - 20, `◆ +${difficultyTokens}`, true);
      this.unlockAchievement("first_blood");
      if (Math.max(this.score, this.score2) >= 10000) this.unlockAchievement("score_10k");
    }
    enemy.disableBody(true, true);
  }

  applyKillTrait(): void {
    if (save.selectedSpecialization === "defender") {
      this.healPlayer(this.stats.maxHp * 0.02, "重甲回收 +2%");
    } else if (save.selectedSpecialization === "devour") {
      this.stats.maxHp = Math.ceil(this.stats.maxHp * 1.02);
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp * 0.01);
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
    const healed = Math.max(0.15, (this.stats.maxHp - this.stats.hp) * 0.03);
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + healed);
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

  healPlayer(amount: number, label?: string): void {
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    const healed = this.stats.hp - before;
    if (healed <= 0) return;
    this.burst(this.player.x, this.player.y, 0x43ff9a, 0.7);
    if (label) this.floatText(this.player.x, this.player.y - 48, `${label} +${Math.ceil(healed)}`, true);
  }

  updateWheelchairRecovery(time: number): void {
    if (save.selectedSpecialization !== "wheelchair" || time < this.nextWheelchairHeal) return;
    this.nextWheelchairHeal = time + 5000;
    const missingHp = Math.max(0, this.stats.maxHp - this.stats.hp);
    const healing = this.stats.maxHp * 0.05 + missingHp * 0.05;
    this.healPlayer(healing, "轮椅再生");
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

  activateWheelchairOverdrive(): void {
    if (this.ended || this.isModal) return;
    if (save.selectedSpecialization !== "wheelchair") {
      showToast("全速冲锋仅属于轮椅流派");
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
        `全速冲锋冷却 ${((this.skillReadyAt[key] - this.time.now) / 1000).toFixed(1)}s`
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

  updatePickups(): void {
    const radius = this.stats.pickupRadius * (1 + (this.upgradeLevels.magnet ?? 0) * 0.25);
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
      this.stats.damageTakenMultiplier *= 0.94;
    }
    this.showBanner(`${evolution.name} · LV.${this.doctrineLevels[id]}`, 1100);
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
    const sync = 0.5 + Math.max(0, level - 1) * 0.06;
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
    Object.assign(this.upgradeLevels, {
      cannon: 4,
      laser: 3,
      missile: 3,
      drone: 2,
      damage: 3,
      haste: 2
    });
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
    damageType: "projectile" | "collision" | "explosion" = "projectile"
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
    const baseFinalDamage =
      this.bossActive && this.stats.maxHp > 1000
        ? Math.ceil(this.stats.maxHp * 0.125)
        : Math.max(
            1,
            Math.ceil(
              amount *
                enemyUpgradeScale() *
                guardianScale *
                this.stats.damageTakenMultiplier *
                explosionScale
            )
          );
    const overdriveReduction =
      save.selectedSpecialization === "wheelchair" && now < this.wheelchairOverdriveUntil
        ? 0.7
        : 1;
    const finalDamage = Math.max(1, Math.ceil(baseFinalDamage * overdriveReduction));
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
    this.invulnerableUntil = now + 800;
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
      showToast("轮椅协议：武器系统离线，请使用撞击");
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
      showToast(`${kind.toUpperCase()} 冷却 ${(Math.max(0, this.skillReadyAt[key] - this.time.now) / 1000).toFixed(1)}s`);
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
          90,
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
          88,
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
          46,
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
      showToast("轮椅协议：攻击技能已转化为装甲能源");
      return;
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
      showToast(`EMP 冷却 ${(Math.max(0, this.skillReadyAt[key] - this.time.now) / 1000).toFixed(1)}s`);
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
        this.dealDirectDamage(enemy, save.selectedShip === "bomber" && owner === 1 ? 260 : 200, enemy.x, enemy.y);
      }
    });
    if (this.bossActive) this.bossHp = Math.max(1, this.bossHp - 520);
    const wave = this.add.circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 20, 0x2df4ff, 0.1).setDepth(70);
    wave.setStrokeStyle(10, 0x2df4ff, 0.9);
    this.tweens.add({
      targets: wave,
      radius: 620,
      alpha: 0,
      duration: 520,
      onComplete: () => wave.destroy()
    });
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
      showToast(`相位闪避冷却 ${((this.skillReadyAt[key] - this.time.now) / 1000).toFixed(1)}s`);
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
      showToast(`纳米修复冷却 ${((this.skillReadyAt[key] - this.time.now) / 1000).toFixed(1)}s`);
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

  damagePlayer2(
    amount: number,
    damageType: "projectile" | "collision" | "explosion" = "projectile"
  ): void {
    if (!this.player2 || !this.player2.active || this.ended) return;
    const reduction = selectedShip2 === "guardian" ? 0.8 : 1;
    const specializationReduction = SPECIALIZATIONS[save.selectedSpecialization].damageTaken;
    const armorReduction = 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
    const explosionReduction =
      damageType === "explosion" ? SPECIALIZATIONS[save.selectedSpecialization].explosionTaken : 1;
    const finalDamage =
      this.bossActive && this.player2MaxHp > 1000
        ? Math.ceil(this.player2MaxHp * 0.125)
        : Math.ceil(
            amount *
              enemyUpgradeScale() *
              reduction *
              specializationReduction *
              armorReduction *
              explosionReduction
          );
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

  playBossArrivalCG(): void {
    if (this.bossActive || this.ended) return;
    const incomingKind = (["titan", "mirror", "usurper"] as BossKind[])[this.bossTier % 3];
    const incomingElite = this.bossTier >= 3 || (selectedMode === "boss" && this.bossTier >= 1);
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
        `⚠ ${incomingElite ? "ELITE " : ""}${BOSS_NAMES[incomingKind]} // INFINITE TIER ${this.bossTier + 1}`,
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
        incomingKind === "mirror"
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
      this.spawnBoss();
    });
  }

  spawnBoss(): void {
    if (this.bossActive || this.ended) return;
    this.bossKind = (["titan", "mirror", "usurper"] as BossKind[])[this.bossTier % 3];
    this.bossElite = this.bossTier >= 3 || (selectedMode === "boss" && this.bossTier >= 1);
    this.bossAttackIndex = -1;
    this.skillsConfiscated = this.bossKind === "usurper";
    this.bossActive = true;
    this.bossPhase = 1;
    const threatScale = 1 + Math.max(0, selectedLevel - 3) * 0.18;
    const endlessScale = 1 + this.bossTier * (selectedMode === "boss" ? 0.7 : 0.52);
    const modeScale = selectedMode === "boss" ? 1.45 : 1;
    const kindScale = this.bossKind === "mirror" ? 1.48 : this.bossKind === "usurper" ? 1.05 : 1;
    this.bossMaxHp =
      (selectedMode === "boss" ? 10500 : 7600 + selectedLevel * 950) *
      threatScale *
      endlessScale *
      modeScale *
      kindScale *
      1.22 *
      (this.bossElite ? 1.7 : 1) *
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
        : `⚠ ${this.bossElite ? "精英 " : ""}${BOSS_NAMES[this.bossKind]} · 无限阶 ${this.bossTier + 1}`,
      1900
    );
    sfx("boss");
    if (save.settings.screenShake) this.cameras.main.shake(420, 0.009);
    const coreTexture =
      this.bossKind === "mirror"
        ? SHIPS[save.selectedShip].asset
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
          : { width: 570, height: 570 };
    core
      .setTexture(this.textures.exists(coreTexture) ? coreTexture : "bossCore")
      .setDisplaySize(displaySize.width, displaySize.height)
      .setTint(
        this.bossElite
          ? 0xffd29a
          : this.bossKind === "mirror"
            ? SKINS[save.equippedSkin].tint
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
    const turretOffset = this.bossKind === "titan" ? 285 : this.bossKind === "mirror" ? 150 : 225;
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
    if (partName === "core") {
      const multiplier = this.bossPhase === 1 ? 0.65 : 1.25;
      this.bossHp = Math.max(0, this.bossHp - rawDamage * multiplier);
      part.setTintFill(0xffc9ec);
      this.time.delayedCall(40, () => part.active && part.clearTint());
      this.checkBossPhase();
      if (this.bossHp <= 0) this.defeatBoss();
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
          12 + this.bossTier * 1.4
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
        14 + this.bossTier * 1.4
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
        16 + this.bossTier * 1.5
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
          16 + this.bossTier * 1.5
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
        15 + this.bossTier
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
          16 + this.bossTier
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
            17 + this.bossTier
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
    this.damagePlayer(amount, damageType);
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
    this.nextBossScore =
      this.score + this.score2 + 12000 + this.bossTier * 6000 + selectedLevel * 1200;
    this.ultimate = Math.min(100, this.ultimate + 36);
    this.healPlayer(this.stats.maxHp * (selectedMode === "boss" ? 0.22 : 0.12), "首领能量回收");
    this.showBanner(
      `${defeatedElite ? "精英 " : ""}${BOSS_NAMES[defeatedKind]}击破 · 技能权限恢复`,
      1500
    );
    this.time.delayedCall(1700, () => {
      showDoctrineEvolution(this, () => {
        this.bossPhase = 0;
        if (selectedMode === "boss") {
          this.showBanner(`下一首领正在跃迁 · 阶 ${this.bossTier + 1}`, 900);
          this.time.delayedCall(1100, () => this.playBossArrivalCG());
        } else {
          this.showBanner(`无限航线继续 · 下一阈值 ${this.nextBossScore}`, 1100);
        }
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
    const reward = Math.floor(
      (rewardForRun(selectedMode, totalScore, victory) + this.runTokens) *
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
        combatTokens: this.runTokens,
        bosses: this.bossTier,
        missionLevel: selectedLevel
      });
    if (victory) this.playVictoryCG(complete);
    else this.time.delayedCall(850, complete);
  }

  updateHud(): void {
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
        `${this.bossElite ? "ELITE // " : ""}${BOSS_NAMES[this.bossKind]} // TIER ${
          this.bossTier + 1
        } // PHASE ${this.bossPhase}${
          this.skillsConfiscated ? " // SKILLS STOLEN" : ""
        }`
      );
    } else {
      this.hud.bossName.setText("");
    }
    this.hud.hp.setText(`P1 ${Math.ceil(this.stats.hp)} / ${this.stats.maxHp}`);
    this.hud.score.setText(
      this.player2
        ? `P2 ${Math.ceil(this.player2Hp)}/${this.player2MaxHp}  ·  ${this.score}:${this.score2}`
        : this.score.toString().padStart(7, "0")
    );
    this.hud.time.setText(formatTime(this.elapsedSeconds));
    this.hud.level.setText(
      `${SPECIALIZATIONS[save.selectedSpecialization].code} · LV.${this.level}/100  //  ◆ ${
        this.runTokens
      }${
        save.selectedSpecialization === "wheelchair" && this.time.now < this.wheelchairOverdriveUntil
          ? "  //  FULL SPEED"
          : ""
      }  //  NEXT BOSS ${Math.max(0, this.nextBossScore - this.score - this.score2)}`
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
      `HP ${Math.ceil(this.stats.hp)}`
    ].join("<br>");
  }

  nearestTarget(x: number, y: number): Phaser.Physics.Arcade.Image | null {
    return this.closestTargets(x, y, 1)[0] ?? null;
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
