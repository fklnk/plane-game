import Phaser from "phaser";
import "./styles.css";
import {
  DEFAULT_SAVE,
  dailyLoginOffer,
  BOSS_SEQUENCE_LEGENDARY_SKIN,
  DEVOUR_SWALLOW_LEVELS,
  type GameMode,
  localDayIndex,
  SHADOW_ENDING_SKIN_REWARDS,
  type SkinId,
  type ShipId,
  type SpecializationId,
  SPECIALIZATION_BASE_STAT_BOOST,
  chooseUnique,
  chooseUniqueWeighted,
  collisionBossDamageScale,
  collisionHullAttackMultiplier,
  devourHealingAmount,
  agileCritEffectSpeedMultiplier,
  agileCritRateAttackBonus,
  formatRoundedNumberForDisplay,
  formatTime,
  independentBossHealthAfterDamage,
  minionHealthDamageMultiplier,
  minionPercentDamageFloor,
  reactiveArmorRelease,
  roundHealth,
  rewardForRun,
  WHEELCHAIR_ACTIVE_SKILLS,
  WHEELCHAIR_BOSS_COLLISION_MAX_HP_PERCENT,
  wheelchairActiveDamageTakenMultiplier,
  xpToNextLevel
} from "./game-logic";
import {
  BOSS_CAMPAIGN_ENCOUNTERS,
  bossPassiveDropChoices,
  bossPowerDropChoices,
  campaignClearScoreRequirement,
  campaignDifficultyForLevel,
  campaignEncounterAttackScale,
  campaignEncounterPowerScale,
  campaignEnemyRoster,
  campaignFinalBossStatScale,
  chaseRemainingHpRatio,
  finalCampaignReward,
  INCOMPLETE_TRINITY_STAT_SCALE,
  rollBossMutationKind,
  rollCampaignElite,
  rollCampaignMutation
} from "./boss-campaign";

import {ACHIEVEMENT_SKIN_IDS, ACHIEVEMENTS, achievementSkinBulletDisplaySize, achievementSkinBulletTextureKey, achievementSkinTextureKey, AGILE_CLONE_COUNTS, AGILE_CLONE_DAMAGE_RATIOS, AGILE_CLONE_FUSION_HP_BONUS, AGILE_CLONE_HP_RATIOS, AGILE_CLONE_INTERVALS, AGILE_CLONE_MAX_COUNT, AGILE_LUNGE_DURATION, AGILE_LUNGE_HIT_WIDTH, AGILE_LUNGE_MAX_HEAL_HITS, AGILE_LUNGE_REACH, AGILE_LUNGE_REACHES, AgileTrajectory, AIR_SUPPORT_SKILLS, AIR_SUPPORT_VALUES, AirSupportSkillId, ATTACK_BONUS_SCALE, BOSS_KIND_TO_POWER, BOSS_NAMES, BOSS_PASSIVE_OPTIONS, BOSS_POWER_COOLDOWN_MS, BOSS_POWER_DAMAGE_SCALE, BOSS_POWER_FREEZE_MS, BOSS_POWER_FX_KEYS, BOSS_POWER_OPTIONS, BOSS_SKILL_FX, BossKind, BossPassiveDefinition, BossPassiveId, BossPowerId, CAMPAIGN_MYSTERY_MESSAGES, CAMPAIGN_MYSTERY_THRESHOLDS, DARK_CORRUPTION_HP_DRAIN, DARK_CORRUPTION_PER_TICK, DARK_CORRUPTION_TICK_MS, DARK_SWARM_DAMAGE_SCALE, DARK_SWARM_HP_SCALE, DEBUG, distancePointToSegment, DOCTRINE_EVOLUTIONS, EnemyDamageSource, EnemyMutation, EnemyType, LEVELS, MINION_MUTATION_COLORS, PlayVariant, POWER_FLAME_COOLDOWNS, POWER_FLAME_DAMAGE, POWER_FLAME_DURATIONS, POWER_FLAME_LENGTHS, POWER_FLAME_WIDTHS, SHADOW_ENDING_ACHIEVEMENTS, SHADOW_ENDINGS, ShadowEnding, shadowTextureForAbsorbedPowers, SHIPS, SKIN_RARITY_LABELS, SKINS, SPECIALIZATIONS, specializationStats, TemporarySkill, UpgradeDefinition, UPGRADES, WORLD_HEIGHT, WORLD_WIDTH} from "./data";
import { SpawnDirectorMixin } from "./spawn-director";
import { buildPoolFor, setShowUpgrade, UpgradeSystemMixin } from "./upgrade-system";
import { finishRun, setSettlementNavigation } from "./run-settlement";
import {
  activeScene,
  cooldownToast,
  enemyUpgradeScale,
  ensureAudio,
  game,
  isNineBattleMode,
  permanentArmorScale,
  persist,
  playVariant,
  refreshRails,
  save,
  selectedLevel,
  selectedMode,
  setActiveScene,
  setAdaptiveMusic,
  setGame,
  setPlayVariant,
  setSave,
  setSelectedLevel,
  setSelectedMode,
  sfx,
  showToast,
  stopAdaptiveMusic,
  totalPermanentLevels
} from "./runtime-state";

// === 可自定义键位系统 ===
// 动作 id → 默认 Phaser 键码名(addKeys 用的名字,如 "KeyW"/"SPACE"/"ONE"/"COMMA")
export type BindableAction =
  | "p1_move_up" | "p1_move_down" | "p1_move_left" | "p1_move_right"
  | "p1_fire" | "p1_skill1" | "p1_skill2" | "p1_skill3"
  | "p1_emp" | "p1_overdrive" | "p1_phase_dash" | "p1_doctrine" | "p1_power" | "p1_repair"
  | "p2_move_up" | "p2_move_down" | "p2_move_left" | "p2_move_right"
  | "p2_fire" | "p2_emp" | "p2_overdrive" | "p2_laser" | "p2_doctrine" | "p2_repair" | "p2_phase_dash"
  | "surrender";

const DEFAULT_KEYBINDINGS: Record<BindableAction, string> = {
  p1_move_up: "KeyW",
  p1_move_down: "KeyS",
  p1_move_left: "KeyA",
  p1_move_right: "KeyD",
  p1_fire: "SPACE",
  p1_skill1: "ONE",
  p1_skill2: "TWO",
  p1_skill3: "THREE",
  p1_emp: "KeyQ",
  p1_overdrive: "KeyE",
  p1_phase_dash: "KeyF",
  p1_doctrine: "KeyG",
  p1_power: "KeyV",
  p1_repair: "KeyR",
  p2_move_up: "UP",
  p2_move_down: "DOWN",
  p2_move_left: "LEFT",
  p2_move_right: "RIGHT",
  p2_fire: "ENTER",
  p2_emp: "KeyJ",
  p2_overdrive: "KeyK",
  p2_laser: "KeyL",
  p2_doctrine: "KeyM",
  p2_repair: "KeyN",
  p2_phase_dash: "COMMA",
  surrender: "KeyX"
};

const KEY_ACTION_LABELS: Record<BindableAction, string> = {
  p1_move_up: "P1 上移",
  p1_move_down: "P1 下移",
  p1_move_left: "P1 左移",
  p1_move_right: "P1 右移",
  p1_fire: "P1 开火",
  p1_skill1: "P1 技能1(激光/破阵冲角)",
  p1_skill2: "P1 技能2(导弹/反应装甲)",
  p1_skill3: "P1 技能3(无人机/堡垒)",
  p1_emp: "P1 EMP 清屏",
  p1_overdrive: "P1 超载/破阵冲刺",
  p1_phase_dash: "P1 相位闪避",
  p1_doctrine: "P1 流派技能(龙息/突刺等)",
  p1_power: "P1 首领权柄",
  p1_repair: "P1 纳米修复",
  p2_move_up: "P2 上移",
  p2_move_down: "P2 下移",
  p2_move_left: "P2 左移",
  p2_move_right: "P2 右移",
  p2_fire: "P2 开火",
  p2_emp: "P2 EMP 清屏",
  p2_overdrive: "P2 超载",
  p2_laser: "P2 激光切割",
  p2_doctrine: "P2 流派技能(龙息/突刺等)",
  p2_repair: "P2 纳米修复",
  p2_phase_dash: "P2 相位闪避",
  surrender: "一键投降"
};

// 动作 id 的键码名(优先玩家自定义,缺省默认)
function boundKeyCode(action: BindableAction): string {
  return save.settings.keybindings[action] ?? DEFAULT_KEYBINDINGS[action];
}

// Phaser 键码名 → 人类可读显示
const KEY_NAME_ALIASES: Record<string, string> = {
  SPACE: "空格",
  ENTER: "回车",
  BACKSPACE: "退格",
  TAB: "Tab",
  ESC: "Esc",
  UP: "↑",
  DOWN: "↓",
  LEFT: "←",
  RIGHT: "→",
  COMMA: ",",
  PERIOD: ".",
  SLASH: "/",
  SEMICOLON: ";",
  QUOTE: "'",
  LEFT_BRACKET: "[",
  RIGHT_BRACKET: "]",
  BACKSLASH: "\\",
  MINUS: "-",
  EQUALS: "=",
  BACKQUOTE: "`",
  CAPS_LOCK: "CapsLock",
  SHIFT: "Shift",
  CONTROL: "Ctrl",
  ALT: "Alt",
  META: "Win",
  DELETE: "Delete",
  INSERT: "Insert",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  PRINT_SCREEN: "PrintScreen",
  PAUSE: "Pause",
  NUM_LOCK: "NumLock",
  SCROLL_LOCK: "ScrollLock"
};
const KEY_NAME_ALIASES_LETTERS: Record<string, string> = {};
for (let i = 65; i <= 90; i += 1) {
  KEY_NAME_ALIASES_LETTERS[`Key${String.fromCharCode(i)}`] = String.fromCharCode(i);
}
const KEY_NAME_ALIASES_DIGITS: Record<string, string> = {};
for (let i = 0; i <= 9; i += 1) {
  KEY_NAME_ALIASES_DIGITS[
    ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"][i]
  ] = String(i);
}
function keyCodeDisplayName(code: string): string {
  return (
    KEY_NAME_ALIASES[code] ??
    KEY_NAME_ALIASES_LETTERS[code] ??
    KEY_NAME_ALIASES_DIGITS[code] ??
    code
  );
}

// 不可绑定的特殊键(Esc/Win/Shift/Ctrl/Alt/功能键/编辑键等)
const RESERVED_KEY_CODES = new Set<string>([
  "ESC", "TAB", "BACKSPACE",
  "SHIFT", "CONTROL", "ALT", "META",
  "CAPS_LOCK", "NUM_LOCK", "SCROLL_LOCK", "PRINT_SCREEN", "PAUSE",
  "INSERT", "DELETE", "HOME", "END", "PAGE_UP", "PAGE_DOWN",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
  "F13", "F14", "F15", "F16", "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24",
  "NUMPAD_ZERO", "NUMPAD_ONE", "NUMPAD_TWO", "NUMPAD_THREE", "NUMPAD_FOUR",
  "NUMPAD_FIVE", "NUMPAD_SIX", "NUMPAD_SEVEN", "NUMPAD_EIGHT", "NUMPAD_NINE",
  "NUMPAD_ADD", "NUMPAD_SUBTRACT", "NUMPAD_MULTIPLY", "NUMPAD_DIVIDE",
  "NUMPAD_DECIMAL", "NUMPAD_ENTER", "NUMPAD_EQUALS", "PLUS", "HELP", "LOCK"
]);

// Phaser 键码名 → 数字 keyCode(用于 keydown 事件反查动作)
const PHASER_CODE_TO_NUMBER: Record<string, number> = {
  ESC: 27, TAB: 9, BACKSPACE: 8, ENTER: 13, SPACE: 32,
  UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
  COMMA: 188, PERIOD: 190, SLASH: 191, SEMICOLON: 186, QUOTE: 222,
  LEFT_BRACKET: 219, RIGHT_BRACKET: 221, BACKSLASH: 220, MINUS: 189,
  EQUALS: 187, BACKQUOTE: 192,
  SHIFT: 16, CONTROL: 17, ALT: 18, META: 91,
  CAPS_LOCK: 20, DELETE: 46, INSERT: 45, HOME: 36, END: 35,
  PAGE_UP: 33, PAGE_DOWN: 34
};
for (let i = 0; i <= 9; i += 1) {
  PHASER_CODE_TO_NUMBER[
    ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"][i]
  ] = 48 + i;
}
for (let i = 65; i <= 90; i += 1) {
  PHASER_CODE_TO_NUMBER[`Key${String.fromCharCode(i)}`] = i;
}
const NUMBER_TO_PHASER_CODE: Record<number, string> = {};
for (const [name, code] of Object.entries(PHASER_CODE_TO_NUMBER)) {
  NUMBER_TO_PHASER_CODE[code] = name;
}

// 某个键码名当前被哪个动作占用(用于冲突检测),返回动作 id
function actionHoldingKeyCode(code: string, except?: BindableAction): BindableAction | undefined {
  return (Object.keys(DEFAULT_KEYBINDINGS) as BindableAction[]).find(
    (action) => action !== except && boundKeyCode(action) === code
  );
}

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
            <div><div class="feature-name">流派融合强化</div><div class="feature-copy">先选基础技能 · 融合技自然衔接</div></div>
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
// #overlay-root 在 app-shell 注入后查询(运行时弹窗根节点)
const overlayRoot = document.querySelector<HTMLDivElement>("#overlay-root")!;

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

function shipMarkup(): string {
  return `
    <div class="css-ship" aria-hidden="true">
      <span class="wing left"></span><span class="wing right"></span>
      <span class="fuselage"></span><span class="core"></span>
      <span class="thruster one"></span><span class="thruster two"></span>
    </div>
  `;
}

function fighterPreview(shipId: ShipId, className = "", showEquippedSkin = false): string {
  const ship = SHIPS[shipId];
  const equippedSkin = SKINS[save.equippedSkin];
  const skinAvailable =
    showEquippedSkin &&
    save.equippedSkin !== "standard" &&
    save.unlockedSkins.includes(save.equippedSkin) &&
    Boolean(equippedSkin.asset);
  const source = skinAvailable ? equippedSkin.asset! : `assets/fighters/${ship.asset}.png`;
  const label = skinAvailable ? equippedSkin.name : ship.name;
  return `
    <div class="fighter-preview ${className} ${skinAvailable ? "achievement-skin-equipped" : ""}">
      <img src="${source}" alt="${label}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
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
    <section class="screen home-screen" id="home-screen" aria-label="主菜单">
      <div class="home-hero">
        <div class="menu-logo">
          <div class="eyebrow">STAR ABYSS · v0.7.1</div>
          <h1>星渊突击</h1>
          <span class="en">NEON ABYSS</span>
        </div>
        <div class="ship-showcase">${fighterPreview(save.selectedShip, "hero-fighter", true)}</div>
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
      <div class="version">SYSTEM ONLINE</div>
    </section>
  `;
  document.querySelector("#start-button")!.addEventListener("click", () => {
    sfx("click");
    showLevelSelect();
  });
  // Also start the run when Enter / Space is pressed while the home
  // overlay is the topmost panel. This is the missing piece that makes
  // an IME typing in the Trae chat panel unable to launch the game from
  // the home menu.
  // 模块级单例监听器:先移除旧实例再注册,避免多次返回主菜单时监听器累积
  document.removeEventListener("keydown", homeStartFromKey);
  document.addEventListener("keydown", homeStartFromKey);
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

function showPilotSelect(owner: 1 | 2 = 1, restoredScrollTop = 0): void {
  const isP2 = owner === 2;
  const single = playVariant === "single";
  const shipKey: "selectedShip" | "selectedShip2" = isP2 ? "selectedShip2" : "selectedShip";
  const specKey: "selectedSpecialization" | "selectedSpecialization2" = isP2
    ? "selectedSpecialization2"
    : "selectedSpecialization";
  const currentShip = save[shipKey];
  const currentSpec = save[specKey];
  const selectedStats = specializationStats(currentShip, currentSpec);
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader(
        single ? "STEP 02 / FRAME & ROLE" : isP2 ? "STEP 03 / P2 FRAME & ROLE" : "STEP 02 / P1 FRAME & ROLE",
        single ? "选择战机与专精" : isP2 ? "P2 选择战机与专精" : "P1 选择战机与专精"
      )}
      <div class="pilot-flow-hint">${
        single
          ? "先选择机体，再装载一种战斗流派。六种流派拥有完全不同的弹道、成长和生存机制。"
          : isP2
            ? "P2 可重复选择与 P1 相同或不同的战机与流派，立即开始战斗。"
            : "P1 先选择机体与流派，随后轮到 P2 选择（可与 P1 相同或不同）。"
      }</div>
      <div class="pilot-select-grid">
        ${Object.entries(SHIPS)
          .map(
            ([id, ship]) => `
              <button class="pilot-card ${currentShip === id ? "selected" : ""}" data-pilot="${id}">
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
            const stats = specializationStats(currentShip, id as SpecializationId);
            return `
              <button class="specialization-card ${
                currentSpec === id ? "selected" : ""
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
      <button class="primary-button flow-next" id="pilot-next">${
        single ? "确认战机 · 点火出击" : isP2 ? "P2 确认 · 点火出击" : "P1 确认 · P2 选择"
      }</button>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", () =>
    single ? showLevelSelect() : isP2 ? showPilotSelect(1) : showLevelSelect()
  );
  document.querySelectorAll<HTMLButtonElement>("[data-pilot]").forEach((button) => {
    button.addEventListener("click", () => {
      save[shipKey] = button.dataset.pilot as ShipId;
      persist();
      sfx("upgrade");
      // 只更新 selected class,保留滚动位置 + 更新面板数据
      document
        .querySelectorAll<HTMLButtonElement>("[data-pilot]")
        .forEach((b) => b.classList.toggle("selected", b === button));
      const heading = document.querySelector(".specialization-heading small");
      if (heading) {
        const stats = specializationStats(save[shipKey], save[specKey]);
        heading.textContent = `当前最终面板：HP ${stats.hp} · SPD ${stats.speed} · ATK ${stats.damage}`;
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-specialization]").forEach((button) => {
    button.addEventListener("click", () => {
      save[specKey] = button.dataset.specialization as SpecializationId;
      persist();
      sfx("upgrade");
      // 只更新 selected class,保留滚动位置
      document
        .querySelectorAll<HTMLButtonElement>("[data-specialization]")
        .forEach((b) => b.classList.toggle("selected", b === button));
      const heading = document.querySelector(".specialization-heading small");
      if (heading) {
        const stats = specializationStats(save[shipKey], save[specKey]);
        heading.textContent = `当前最终面板：HP ${stats.hp} · SPD ${stats.speed} · ATK ${stats.damage}`;
      }
    });
  });
  document.querySelector("#pilot-next")!.addEventListener("click", () => {
    sfx("click");
    if (single || isP2) {
      startRun();
    } else {
      showPilotSelect(2);
    }
  });
  if (restoredScrollTop > 0) {
    requestAnimationFrame(() => {
      const screen = document.querySelector<HTMLElement>(".screen");
      if (screen) screen.scrollTop = restoredScrollTop;
    });
  }
}

function showLevelSelect(restoredScrollTop = 0): void {
  if (![3, 4, 5].includes(selectedLevel)) setSelectedLevel(3);
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("STEP 01 / COMBAT PROTOCOL", "选择游戏模式")}
      <div class="variant-tabs">
        <button class="${playVariant === "single" ? "active" : ""}" data-variant="single">单人飞行</button>
        <button class="${playVariant === "coop" ? "active" : ""}" data-variant="coop">双人合作</button>
        <button class="${playVariant === "score_duel" ? "active" : ""}" data-variant="score_duel">双人竞分</button>
      </div>
      ${
        playVariant === "single"
          ? ""
          : `<div class="dual-config">P1 · WASD / Space / Q E　｜　P2 · 方向键 / Enter / J K L
             <span class="ff-row">
               友军伤害
               <button class="toggle-switch ${save.settings.friendlyFire ? "on" : ""}" id="ff-toggle" role="switch" aria-checked="${save.settings.friendlyFire}">
                 <span class="toggle-knob"></span>
               </button>
               <span class="ff-label">${save.settings.friendlyFire ? "开启" : "关闭"}</span>
             </span>
             · 下一步为 P1/P2 分别选择战机与专精</div>`
      }
      <div class="protocol-grid">
        <button class="protocol-card theme-campaign ${selectedMode === "campaign" ? "selected" : ""}" data-protocol="campaign">
          <span class="protocol-band"></span>
          <span class="protocol-no">PROTOCOL 01 · EXPEDITION</span>
          <span class="protocol-sigil">◆</span>
          <h3>星渊征途</h3>
          <p>进入无法预测的深空航道。保持火力、回收异常掉落，未知威胁会在你最投入时突然现身。</p>
          <div class="protocol-tags"><b>未知航道</b><b>连续惊喜</b><b>最终结算</b></div>
        </button>
        <button class="protocol-card theme-endless ${selectedMode === "endless" ? "selected" : ""}" data-protocol="endless">
          <span class="protocol-band"></span>
          <span class="protocol-no">PROTOCOL 02 · ENDLESS</span>
          <span class="protocol-sigil">∞</span>
          <h3>永夜航线</h3>
          <p>小怪与 Boss 无限循环。每次击败 Boss 立即把本段代币存入仓库，并延长下一轮清兵时间。</p>
          <div class="protocol-tags"><b>即时存币</b><b>清兵期递增</b><b>无限构筑</b></div>
        </button>
        <button class="protocol-card theme-boss ${selectedMode === "boss" ? "selected" : ""}" data-protocol="boss">
          <span class="protocol-band"></span>
          <span class="protocol-no">PROTOCOL 03 · ABYSS</span>
          <span class="protocol-sigil">⚠</span>
          <h3>九渊试炼</h3>
          <p>固定九场：三首领与三次黑影追逐、三不完全体同屏、黑影本体和最终真身。终战后本局结束。</p>
          <div class="protocol-tags"><b>固定九战</b><b>追逐黑影</b><b>终局结算</b></div>
        </button>
      </div>
      <div class="danger-select">
        <div><span>STARTING THREAT</span><strong>选择初始威胁等级</strong></div>
        ${[
          { id: 3, name: "爽玩", copy: "所有敌方单位均为普通形态，轻松开局" },
          { id: 4, name: "普通", copy: "约 50% 敌军与 Boss 变为精英" },
          { id: 5, name: "地狱", copy: "全员精英，25% 概率追加突变能力" }
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
        <strong>${
          playVariant === "single"
            ? "单人飞行"
            : playVariant === "coop"
              ? "双人合作"
              : "双人竞分"
        } · ${
          selectedMode === "campaign"
            ? "星渊征途 · 未知深空航线"
            : selectedMode === "endless"
              ? "永夜航线 · 分段存币"
              : "九渊试炼 · 固定九战终局"
        }</strong>
        <small>${
          playVariant !== "single"
            ? "下一步为 P1 / P2 分别选择战机与专精，两者可相同可不同。"
            : selectedMode === "campaign"
              ? "持续推进并留意异常回波；完全体黑影和最终真身会在战斗中主动召唤小兵。"
              : selectedMode === "endless"
                ? "每次 Boss 击破立即保存本段代币，死亡或退出也会保护尚未入库的代币。"
                : "没有额外清兵战；完成九场并击破最终真身后胜利结算。"
        }</small>
      </div>
      <button class="primary-button flow-next" id="config-next">配置战机与专精 · 下一步</button>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
  document.querySelectorAll<HTMLButtonElement>("[data-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      setPlayVariant(button.dataset.variant as PlayVariant);
      save.lastVariant = playVariant;
      persist();
      showLevelSelect(scrollTop);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-protocol]").forEach((button) => {
    button.addEventListener("click", () => {
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      setSelectedMode(button.dataset.protocol as GameMode);
      save.lastMode = selectedMode;
      persist();
      showLevelSelect(scrollTop);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      setSelectedLevel(Number(button.dataset.level));
      save.lastLevel = selectedLevel;
      persist();
      showLevelSelect(scrollTop);
    });
  });
  document.querySelector("#config-next")!.addEventListener("click", () => {
    sfx("click");
    showPilotSelect(1);
  });
  // 双人模式:友军互相伤害开关(持久化到存档设置)
  document.querySelector("#ff-toggle")?.addEventListener("click", () => {
    save.settings.friendlyFire = !save.settings.friendlyFire;
    persist();
    sfx("click");
    const toggle = document.querySelector<HTMLButtonElement>("#ff-toggle");
    const label = document.querySelector<HTMLSpanElement>(".ff-label");
    if (toggle) {
      toggle.classList.toggle("on", save.settings.friendlyFire);
      toggle.setAttribute("aria-checked", String(save.settings.friendlyFire));
    }
    if (label) label.textContent = save.settings.friendlyFire ? "开启" : "关闭";
  });
  if (restoredScrollTop > 0) {
    requestAnimationFrame(() => {
      const screen = document.querySelector<HTMLElement>(".screen");
      if (screen) screen.scrollTop = restoredScrollTop;
    });
  }
}

function showAbout(): void {
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("ABOUT / FLIGHT MANUAL", "关于与操作")}
      <div class="about-panel">
        <div class="about-logo">星渊突击 <small>v0.7.1</small></div>
        <p>三类空域协议：星渊征途推进通关、永夜航线分段存币、九渊试炼固定九战终局。</p>
        <div class="key-table">
          <div><kbd>WASD / 方向键</kbd><span>移动战机</span></div>
          <div><kbd>SPACE</kbd><span>按住持续开火</span></div>
          <div><kbd>1 / 2 / 3</kbd><span>激光、导弹、无人机；撞击流派为破阵冲角、反应装甲、堡垒姿态</span></div>
          <div><kbd>Q</kbd><span>EMP 一键清屏</span></div>
          <div><kbd>E</kbd><span>星核超载；撞击流派为破阵冲刺</span></div>
          <div><kbd>G</kbd><span>流派专属主动技能：力量龙息喷火、敏捷影步突刺、撞击全速推进</span></div>
          <div><kbd>V</kbd><span>首领权柄：击破 Boss 后获得，保留到本局结束</span></div>
          <div><kbd>F</kbd><span>相位闪避：位移并短暂无敌</span></div>
          <div><kbd>R</kbd><span>纳米修复：恢复 18% 最大生命</span></div>
          <div><kbd>X</kbd><span>一键自动投降</span></div>
          <div><kbd>ESC</kbd><span>暂停</span></div>
          <div><kbd>双人模式</kbd><span>双方子弹、导弹与 EMP 爆炸对友军伤害可在开局 STEP 01 界面开关</span></div>
          <div><kbd>P2 操作</kbd><span>方向键移动 · Enter 开火 · J EMP · K 超载 · L 激光 · M 流派技能 · N 纳米修复 · ，相位闪避</span></div>
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
              <div><span>${achievement.category}</span><h3>${achievement.name}</h3><p>${
                obtainedAt ? achievement.detail : "解锁后可见"
              }</p>
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
    { id: "hull", icon: "⬡", name: "舰体强化", effect: "初始最大生命 +4%/级", max: 15 },
    { id: "firepower", icon: "▲", name: "火力校准", effect: "全部武器伤害 +2%/级", max: 15 },
    { id: "engine", icon: "⌁", name: "引擎超频", effect: "基础移动速度 +2.5%/级", max: 13 },
    { id: "armor", icon: "◈", name: "相位装甲", effect: "受到伤害 -1.5%/级", max: 13 },
    { id: "recovery", icon: "◆", name: "代币回收", effect: "每局星核币收益 +4%/级", max: 11 },
    { id: "emergency", name: "紧急修复", effect: "首次濒危时自动修复", max: 8 },
    { id: "reroll", icon: "↻", name: "战术重构", effect: "每级额外获得 1 次重抽", max: 6 }
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
            // 商店升级价格翻倍(代币获取减半后,通过让升级更贵来平衡),显示与扣费必须一致
            const cost = (40 + level * 28) * 2;
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
      <div class="achievement-skin-shop">
        <div class="shop-title">成就皮肤 <span>已解锁 ${save.unlockedSkins.filter((id) => id !== "standard").length}/${ACHIEVEMENT_SKIN_IDS.length}</span></div>
        <p class="achievement-skin-note">这里只保留结局与 Boss 成就奖励，不消耗星核币。所有模型均为独立主体，不是基础战机换色。</p>
        <button class="skin-base-button ${save.equippedSkin === "standard" ? "equipped" : ""}" data-achievement-skin="standard">
          <span>基础机体</span><small>恢复当前所选战机的原始模型</small><strong>${save.equippedSkin === "standard" ? "使用中" : "装备"}</strong>
        </button>
        <div class="achievement-skin-grid">
          ${ACHIEVEMENT_SKIN_IDS.map((id) => {
            const skin = SKINS[id];
            const owned = save.unlockedSkins.includes(id);
            const equipped = save.equippedSkin === id;
            return `
              <article class="achievement-skin-card rarity-${skin.rarity} ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}" style="--skin-accent:${skin.accent}">
                <div class="achievement-skin-model effect-${skin.effect}">
                  <img class="achievement-skin-airframe" src="${skin.asset}" alt="${skin.name}" />
                  <img class="achievement-skin-projectile" src="${skin.bulletAsset}" alt="${skin.name}专属子弹" />
                </div>
                <span class="achievement-skin-rarity">${SKIN_RARITY_LABELS[skin.rarity ?? "rare"]}</span>
                <h3>${skin.name}</h3>
                <small>${skin.code}</small>
                <p>${skin.description}</p>
                <em>${owned ? `✓ ${skin.unlock}` : `未解锁 · ${skin.unlock}`}</em>
                <button class="buy-button" data-achievement-skin="${id}" ${owned ? "" : "disabled"}>${equipped ? "已装备" : owned ? "装备" : "未解锁"}</button>
              </article>
            `;
          }).join("")}
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
      // 商店升级价格翻倍(代币获取减半后,通过让升级更贵来平衡)
      const cost = (40 + level * 28) * 2;
      if (level >= max || save.starCores < cost) return;
      save.starCores -= cost;
      save.permanentUpgrades[id] = level + 1;
      persist();
      sfx("upgrade");
      showToast(`升级完成 · 敌方同步强化系数 ${Math.round((enemyUpgradeScale() - 1) * 100)}%`);
      showHangar(scrollTop);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-achievement-skin]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.achievementSkin as SkinId;
      if (id !== "standard" && !save.unlockedSkins.includes(id)) return;
      const scrollTop = document.querySelector<HTMLElement>(".screen")?.scrollTop ?? 0;
      save.equippedSkin = id;
      persist();
      sfx("upgrade");
      showToast(id === "standard" ? "已恢复基础机体" : `已装备 · ${SKINS[id].name}`);
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
        <div class="setting-row">
          <label><span>自动开火（免按 SPACE）</span><input id="auto-fire" class="switch" type="checkbox" ${
            save.settings.autoFire ? "checked" : ""
          } /></label>
        </div>
        <button class="secondary-button" id="open-keybindings">键位设置</button>
        <button class="secondary-button" id="reset-save">重置本地进度</button>
      </div>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showMenu);
  document.querySelector("#open-keybindings")!.addEventListener("click", () => {
    sfx("click");
    showKeybindings();
  });
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
  document.querySelector<HTMLInputElement>("#auto-fire")!.addEventListener("change", (event) => {
    save.settings.autoFire = (event.target as HTMLInputElement).checked;
    persist();
  });
  document.querySelector("#reset-save")!.addEventListener("click", () => {
    if (confirm("确认重置全部解锁、纪录和设置？此操作无法撤销。")) {
      setSave(structuredClone(DEFAULT_SAVE));
      persist();
      showMenu();
      showToast("本地进度已重置");
    }
  });
}

// === 键位设置界面 ===
const KEYBIND_GROUP_ORDER: Array<{ title: string; actions: BindableAction[] }> = [
  {
    title: "P1 操作",
    actions: [
      "p1_move_up", "p1_move_down", "p1_move_left", "p1_move_right",
      "p1_fire", "p1_skill1", "p1_skill2", "p1_skill3",
      "p1_emp", "p1_overdrive", "p1_phase_dash", "p1_doctrine", "p1_power", "p1_repair"
    ]
  },
  {
    title: "P2 操作",
    actions: [
      "p2_move_up", "p2_move_down", "p2_move_left", "p2_move_right",
      "p2_fire", "p2_emp", "p2_overdrive", "p2_laser", "p2_doctrine", "p2_repair", "p2_phase_dash"
    ]
  },
  { title: "通用", actions: ["surrender"] }
];

function showKeybindings(): void {
  let listeningAction: BindableAction | null = null;
  const stopListening = (): void => {
    listeningAction = null;
    document.querySelectorAll<HTMLButtonElement>(".keybind-key").forEach((btn) => {
      btn.classList.remove("listening");
      btn.textContent = keyCodeDisplayName(boundKeyCode(btn.dataset.action as BindableAction));
    });
  };
  const renderRows = (): void => {
    document.querySelectorAll<HTMLButtonElement>(".keybind-key").forEach((btn) => {
      const action = btn.dataset.action as BindableAction;
      btn.textContent = keyCodeDisplayName(boundKeyCode(action));
    });
  };
  uiRoot.innerHTML = `
    <section class="screen">
      ${screenHeader("KEY BINDINGS", "键位设置")}
      <div class="keybind-hint">点击动作后按下新键即可重绑。Esc / Win / Shift / Ctrl / Alt 等系统键与功能键不可绑定；同一按键不可重复使用。</div>
      <div class="keybind-groups">
        ${KEYBIND_GROUP_ORDER.map(
          (group) => `
            <div class="keybind-group">
              <h3>${group.title}</h3>
              ${group.actions
                .map(
                  (action) => `
                    <div class="keybind-row">
                      <span>${KEY_ACTION_LABELS[action]}</span>
                      <button class="keybind-key" data-action="${action}">${keyCodeDisplayName(
                        boundKeyCode(action)
                      )}</button>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
        ).join("")}
      </div>
      <div class="overlay-actions">
        <button class="secondary-button" id="keybind-reset">恢复默认键位</button>
        <button class="secondary-button" id="keybind-back">返回设置</button>
      </div>
    </section>
  `;
  document.querySelector(".back-button")!.addEventListener("click", showSettings);
  document.querySelector("#keybind-back")!.addEventListener("click", showSettings);
  document.querySelector("#keybind-reset")!.addEventListener("click", () => {
    if (confirm("恢复全部默认键位？")) {
      save.settings.keybindings = {};
      persist();
      renderRows();
      showToast("键位已恢复默认");
    }
  });
  document.querySelectorAll<HTMLButtonElement>(".keybind-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action as BindableAction;
      sfx("click");
      if (listeningAction === action) {
        stopListening();
        return;
      }
      listeningAction = action;
      document.querySelectorAll<HTMLButtonElement>(".keybind-key").forEach((b) =>
        b.classList.remove("listening")
      );
      btn.classList.add("listening");
      btn.textContent = "按下新键…(Esc 取消)";
    });
  });
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!listeningAction) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // Esc 取消当前重绑
    if (event.keyCode === 27) {
      stopListening();
      return;
    }
    const name = NUMBER_TO_PHASER_CODE[event.keyCode];
    if (!name) {
      showToast("该按键不支持绑定，请换一个键");
      return;
    }
    if (RESERVED_KEY_CODES.has(name)) {
      showToast("该按键为系统保留键，不可绑定");
      return;
    }
    const conflict = actionHoldingKeyCode(name, listeningAction);
    if (conflict) {
      showToast(`「${KEY_ACTION_LABELS[conflict]}」已占用该按键`);
      return;
    }
    save.settings.keybindings[listeningAction] = name;
    persist();
    sfx("upgrade");
    showToast(`${KEY_ACTION_LABELS[listeningAction]} → ${keyCodeDisplayName(name)}`);
    listeningAction = null;
    renderRows();
  };
  window.addEventListener("keydown", onKeyDown, true);
  // 界面销毁时移除监听
  const cleanup = (): void => {
    window.removeEventListener("keydown", onKeyDown, true);
  };
  const originalBack = document.querySelector(".back-button")!;
  originalBack.addEventListener("click", cleanup);
  document.querySelector("#keybind-back")!.addEventListener("click", cleanup);
  document.querySelector("#keybind-reset")!.addEventListener("click", cleanup);
}

function destroyGame(): void {
  activeScene?.archivePendingRun();
  setActiveScene(null);
  stopAdaptiveMusic();
  if (game) {
    game.destroy(true);
    setGame(null);
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
  setGame(new Phaser.Game(config));
}

function showUpgrade(scene: BattleScene, onComplete?: () => void): void {
  // 升级/构筑选择界面:游戏完全暂停,玩家不会在选择期间被攻击或走位
  scene.upgradePanelOpen = true;
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
  // 支援协议的等级存在 airSupportLevels,其余存在 upgradeLevels
  const airSupportIds = new Set<string>(AIR_SUPPORT_SKILLS.map((skill) => skill.id));
  const isDuo = playVariant !== "single";
  const levelOf = (owner: 1 | 2, id: string): number =>
    airSupportIds.has(id)
      ? scene.airSupportLevels[id as AirSupportSkillId] ?? 0
      : (scene.upgradesOf(owner)[id] ?? 0);
  // 融合技出池条件:已拥有任一本流派基础技能(≥1 级)即出现,与万象影袭一致
  const FUSION_REQUIREMENTS: Record<string, readonly string[]> = {
    power_fusion: ["power_flamethrower", "drone"],
    agile_shadow_lunge: ["agile_lunge", "agile_shadow_clone"],
    defender_fusion: ["defender_thorns", "blade"],
    vampire_fusion: ["vampire_siphon", "arc"],
    devour_fusion: ["devour_swallow", "stasis_wake"],
    wheelchair_fusion: ["ram_shockwave", "ram_armor"]
  };
  // 每个玩家按自己的专精/等级独立出池(出池规则抽至 upgrade-system.ts)
  const upgradePoolConfig = {
    collisionUpgradeIds,
    airSupportIds,
    levelOf,
    fusionRequirements: FUSION_REQUIREMENTS
  };
  const buildPool = (owner: 1 | 2): UpgradeDefinition[] => buildPoolFor(scene, owner, upgradePoolConfig);
  // 单侧三选一:流派专属不保证必出,专属只凭权重(比其他强化高 60%)提高出现概率
  const pickForOwner = (owner: 1 | 2): UpgradeDefinition[] => {
    const pool = buildPool(owner);
    return chooseUniqueWeighted(pool, 3);
  };
  // 1/2/3 键快速选择(普通升级时用,双人只作用于左侧 P1)
  const keyHandler = (event: KeyboardEvent): void => {
    if (event.key !== "1" && event.key !== "2" && event.key !== "3") return;
    const slot = Number(event.key) - 1;
    const card = document.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`);
    if (card) card.click();
  };
  document.addEventListener("keydown", keyHandler);
  const closeUpgrade = (): void => {
    document.removeEventListener("keydown", keyHandler);
    overlayRoot.innerHTML = "";
    scene.upgradePanelOpen = false;
    scene.isModal = false;
    scene.physics.world.resume();
    sfx("upgrade");
    onComplete?.();
  };

  if (!isDuo) {
    // === 单人:单侧三选一(保持原交互) ===
    const draw = (): void => {
      const options = pickForOwner(1);
      if (options.length === 0) {
        // 可选强化已全部满级:直接关闭,避免空界面卡死
        showToast("所有强化均已满级");
        closeUpgrade();
        return;
      }
      overlayRoot.innerHTML = `
        <div class="overlay">
          <div class="overlay-panel">
            <div class="eyebrow">TACTICAL UPLINK</div>
            <h2>选择战术升级</h2>
            <p>${
              scene.specOf(1) === "wheelchair"
                ? `撞击专属强化与特殊武装 · 无机炮、无无人机子弹 · 当前等级 ${scene.level}`
                : `战斗已暂时冻结 · 当前等级 ${scene.level}`
            }</p>
            <div class="upgrade-grid">
              ${options
                .map((upgrade, index) => {
                  const level = levelOf(1, upgrade.id);
                  return `
                    <button class="upgrade-card" data-upgrade="${upgrade.id}" data-slot="${index}">
                      <span class="upgrade-icon"><span>${upgrade.icon}</span></span>
                      <span class="upgrade-level">${level === 0 ? "NEW" : `LV.${level} → ${level + 1}`} · ${index + 1}</span>
                      <h3>${upgrade.name}</h3>
                      <p>${(upgrade.short ?? upgrade.description)(level)}</p>
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
          scene.applyUpgrade(button.dataset.upgrade!, 1);
          closeUpgrade();
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
    return;
  }

  // === 双人:同一界面左右分栏,P1 左 / P2 右,各自独立选择 ===
  const pickedOwners = new Set<1 | 2>();
  const shipNameOf = (owner: 1 | 2): string => SHIPS[scene.shipOf(owner)].name;
  const specNameOf = (owner: 1 | 2): string => SPECIALIZATIONS[scene.specOf(owner)].name;
  const renderSide = (owner: 1 | 2): void => {
    const sideEl = document.getElementById(`upgrade-side-${owner}`);
    const gridEl = sideEl?.querySelector<HTMLDivElement>(".upgrade-grid");
    const statusEl = sideEl?.querySelector<HTMLDivElement>(".upgrade-side-status");
    if (!sideEl || !gridEl || !statusEl) return;
    if (pickedOwners.has(owner)) {
      gridEl.innerHTML = "";
      sideEl.classList.add("done");
      statusEl.textContent = "已选择 · 强化生效";
      return;
    }
    const options = pickForOwner(owner);
    if (options.length === 0) {
      // 该玩家可选的强化已全部满级:自动视为已完成,避免界面卡死
      pickedOwners.add(owner);
      sideEl.classList.add("done");
      statusEl.textContent = "强化已全部满级";
      gridEl.innerHTML = "";
      if (pickedOwners.size >= 2) {
        scene.time.delayedCall(260, closeUpgrade);
      }
      return;
    }
    gridEl.innerHTML = options
      .map((upgrade, index) => {
        const level = levelOf(owner, upgrade.id);
        return `
          <button class="upgrade-card" data-upgrade="${upgrade.id}" data-owner="${owner}" ${
            owner === 1 ? `data-slot="${index}"` : ""
          }>
            <span class="upgrade-icon"><span>${upgrade.icon}</span></span>
            <span class="upgrade-level">${level === 0 ? "NEW" : `LV.${level} → ${level + 1}`} · ${index + 1}</span>
            <h3>${upgrade.name}</h3>
            <p>${(upgrade.short ?? upgrade.description)(level)}</p>
          </button>
        `;
      })
      .join("");
    gridEl.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach((button) => {
      button.addEventListener("click", () => {
        const ownerId = Number(button.dataset.owner) as 1 | 2;
        scene.applyUpgrade(button.dataset.upgrade!, ownerId);
        pickedOwners.add(ownerId);
        sfx("upgrade");
        renderSide(ownerId);
        // 双方都选完后自动关闭
        if (pickedOwners.size >= 2) {
          scene.time.delayedCall(380, closeUpgrade);
        }
      });
    });
  };
  overlayRoot.innerHTML = `
    <div class="overlay upgrade-duo-overlay">
      <div class="overlay-panel upgrade-duo-panel">
        <div class="eyebrow">TACTICAL UPLINK · DUO</div>
        <h2>双人战术升级</h2>
        <p>P1 与 P2 各自选择强化 · 共享经验等级 ${scene.level}</p>
        <div class="upgrade-duo-sides">
          <div class="upgrade-duo-side" id="upgrade-side-1">
            <div class="upgrade-side-header">
              <span class="upgrade-side-tag p1">P1</span>
              <span class="upgrade-side-ship">${shipNameOf(1)}</span>
              <span class="upgrade-side-spec">${specNameOf(1)}</span>
            </div>
            <div class="upgrade-grid"></div>
            <div class="upgrade-side-status">选择你的强化</div>
          </div>
          <div class="upgrade-duo-side" id="upgrade-side-2">
            <div class="upgrade-side-header">
              <span class="upgrade-side-tag p2">P2</span>
              <span class="upgrade-side-ship">${shipNameOf(2)}</span>
              <span class="upgrade-side-spec">${specNameOf(2)}</span>
            </div>
            <div class="upgrade-grid"></div>
            <div class="upgrade-side-status">选择你的强化</div>
          </div>
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
  renderSide(1);
  renderSide(2);
  document.querySelector("#reroll-upgrade")?.addEventListener("click", () => {
    if (scene.rerolls <= 0) return;
    scene.rerolls -= 1;
    sfx("click");
    // 只重抽尚未选择的玩家那一侧,已选的保留
    if (!pickedOwners.has(1)) renderSide(1);
    if (!pickedOwners.has(2)) renderSide(2);
    const rerollBtn = document.querySelector<HTMLButtonElement>("#reroll-upgrade");
    if (rerollBtn) rerollBtn.textContent = `重抽 ×${scene.rerolls}`;
  });
  document.querySelector("#pause-build")?.addEventListener("click", () => {
    showToast(scene.buildSummary());
  });
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

function showBossPowerChoice(
  scene: BattleScene,
  powers: BossPowerId[],
  onComplete: () => void,
  newlyRecovered?: BossPowerId
): void {
  const options = BOSS_POWER_OPTIONS.filter((option) => powers.includes(option.id));
  if (!options.length) {
    onComplete();
    return;
  }
  scene.isModal = true;
  scene.physics.world.pause();
  const cardHtml = options
    .map((option, index) => {
      const tag = option.id === newlyRecovered
        ? "首领本源"
        : scene.bossPower === option.id
          ? "V · 当前装备"
          : `候选 ${index + 1}`;
      return `
    <button class="boss-power-card ${scene.bossPower === option.id ? "equipped" : ""}" data-boss-power="${option.id}">
      <span class="boss-power-vfx" style="--boss-power-image:url('${option.asset}')"></span>
      <span class="boss-power-index">${tag}</span>
      <span class="boss-power-source">来源 · ${option.source}</span>
      <h3>${option.name}</h3>
      <p>${option.description}</p>
    </button>
  `;
    })
    .join("");
  overlayRoot.innerHTML = `
    <div class="overlay boss-power-overlay">
      <div class="overlay-panel boss-power-panel">
        <div class="eyebrow">BOSS AUTHORITY RECOVERED</div>
        <h2>首领主动技能三选一</h2>
        <p>当前 Boss 的本源主动必定进入候选。主动权柄只能装备一个；选择后会替换当前 <kbd>V</kbd> 键技能，被动强化不会被替换。</p>
        <div class="boss-power-grid">
          ${cardHtml}
        </div>
        ${
          scene.bossPower
            ? `
        <div class="boss-power-keep-row">
          <button class="secondary-button" id="keep-boss-power">↩ 保留当前主动权柄（不替换）</button>
          ${
            scene.bossPowerLevel < 3
              ? `<button class="secondary-button" id="upgrade-boss-power">▲ 升阶当前权柄 LV.${scene.bossPowerLevel} → ${
                  scene.bossPowerLevel + 1
                }（伤害 +50% · 持续 +35%）</button>`
              : ""
          }
        </div>`
            : ""
        }
        <div class="evolution-note">本界面只选择主动权柄 · 一次选择一项 · 同时只能装备一个 V 键技能。</div>
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
  document.querySelector<HTMLButtonElement>("#keep-boss-power")?.addEventListener("click", () => {
    overlayRoot.innerHTML = "";
    scene.isModal = false;
    scene.physics.world.resume();
    sfx("click");
    onComplete();
  });
  document.querySelector<HTMLButtonElement>("#upgrade-boss-power")?.addEventListener("click", () => {
    scene.upgradeBossPower();
    overlayRoot.innerHTML = "";
    scene.isModal = false;
    scene.physics.world.resume();
    sfx("upgrade");
    onComplete();
  });
}

// === 三神共斗合并选择:主动 + 被动 一次面板里各选一张,都选完后才确认 ===
function showTrinityCombinedChoice(
  scene: BattleScene,
  bossKinds: readonly BossKind[],
  onComplete: () => void
): void {
  // 主动:本源 boss 们的主动 + 玩家当前已装备 + 随机填满 3 个
  const primaryPowers = bossKinds.slice(0, 3).map((kind) => BOSS_KIND_TO_POWER[kind]);
  const powerIds: BossPowerId[] = [];
  primaryPowers.forEach((id) => {
    if (!powerIds.includes(id)) powerIds.push(id);
  });
  if (scene.bossPower && !powerIds.includes(scene.bossPower)) {
    powerIds.push(scene.bossPower);
  }
  while (powerIds.length < 3) {
    const pool = BOSS_POWER_OPTIONS.map((o) => o.id).filter(
      (id) => !powerIds.includes(id)
    );
    if (!pool.length) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    powerIds.push(pick);
  }
  const powerOptions = powerIds
    .map((id) => BOSS_POWER_OPTIONS.find((option) => option.id === id))
    .filter((option): option is (typeof BOSS_POWER_OPTIONS)[number] => Boolean(option));

  // 被动:本源 boss 们对应的被动池(各随机一个) + 玩家已装备的最后一项 + 随机填满 3 个
  const passiveIds = bossPassiveDropChoices(bossKinds, scene.bossPassives);
  const lastOwned = scene.bossPassives.length
    ? scene.bossPassives[scene.bossPassives.length - 1]
    : null;
  let combinedPassives = [...passiveIds];
  if (lastOwned && !combinedPassives.includes(lastOwned)) {
    combinedPassives.unshift(lastOwned);
  }
  const seenPassive = new Set<BossPassiveId>();
  const uniquePassives: BossPassiveId[] = [];
  for (const id of combinedPassives) {
    if (!seenPassive.has(id)) {
      seenPassive.add(id);
      uniquePassives.push(id);
    }
  }
  const passivePool = BOSS_PASSIVE_OPTIONS.map((o) => o.id).filter(
    (id) => !seenPassive.has(id)
  );
  while (uniquePassives.length < 3 && passivePool.length) {
    const pick = passivePool.splice(
      Math.floor(Math.random() * passivePool.length),
      1
    )[0];
    uniquePassives.push(pick);
  }
  // 最多展示 3 个被动:玩家已装备项 + 新候选去重后可能超过 3,超出的截断
  const passiveOptions = uniquePassives
    .slice(0, 3)
    .map((id) => BOSS_PASSIVE_OPTIONS.find((option) => option.id === id))
    .filter((option): option is BossPassiveDefinition => Boolean(option));

  if (!powerOptions.length && !passiveOptions.length) {
    scene.showBanner("三神共斗奖励为空 · 直接进入下一战", 1000);
    onComplete();
    return;
  }

  scene.isModal = true;
  scene.physics.world.pause();

  const headerKinds: BossKind[] = (bossKinds.length
    ? [...bossKinds]
    : (["titan", "mirror", "usurper"] as BossKind[])
  ).slice(0, 3);
  const headerHtml = `
    <div class="boss-passive-header">
      ${headerKinds
        .map(
          (kind) =>
            `<span class="boss-passive-mini" title="${BOSS_NAMES[kind]}">${BOSS_NAMES[kind]}</span>`
        )
        .join(`<span class="boss-passive-mini-sep">·</span>`)}
    </div>
  `;

  const powerSectionHtml = powerOptions.length
    ? `
      <div class="trinity-section trinity-section-power">
        <h3>主动权柄 · 三选一</h3>
        <p>只能装备一个 V 键技能，新选择会替换旧主动。</p>
        <div class="boss-power-grid trinity-grid">
          ${powerOptions
            .map(
              (option, index) => `
            <button class="boss-power-card ${scene.bossPower === option.id ? "equipped" : ""}" data-trinity-power="${option.id}">
              <span class="boss-power-vfx" style="--boss-power-image:url('${option.asset}')"></span>
              <span class="boss-power-index">${scene.bossPower === option.id ? "V · 当前装备" : `候选 ${index + 1}`}</span>
              <span class="boss-power-source">来源 · ${option.source}</span>
              <h3>${option.name}</h3>
              <p>${option.description}</p>
            </button>
          `
            )
            .join("")}
        </div>
        ${
          scene.bossPower
            ? `<div class="boss-power-keep-row"><button class="secondary-button" data-trinity-keep-power>↩ 保留当前主动权柄</button></div>`
            : ""
        }
      </div>
    `
    : "";

  const passiveSectionHtml = passiveOptions.length
    ? `
      <div class="trinity-section trinity-section-passive">
        <h3>专属被动 · 三选一</h3>
        <p>被动不占用 V 键，可以一直选然后累加。</p>
        <div class="boss-passive-grid trinity-grid">
          ${passiveOptions
            .map(
              (option, index) => `
            <button class="boss-passive-card" data-trinity-passive="${option.id}">
              <span class="boss-passive-emblem">${option.icon}</span>
              <span class="boss-passive-index">候选 ${index + 1}</span>
              <span class="boss-passive-source">来源 · ${BOSS_NAMES[option.kind]}</span>
              <h3>${option.name}</h3>
              <small>${option.code}</small>
              <p>${option.description}</p>
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `
    : "";

  overlayRoot.innerHTML = `
    <div class="overlay trinity-combined-overlay">
      <div class="overlay-panel trinity-combined-panel">
        <div class="eyebrow">TRINITY DUAL PICK</div>
        <h2>三神共斗 · 主动 + 被动同时选择</h2>
        ${headerHtml}
        <p>左侧选择主动权柄（替换 V 键），右侧选择专属被动（累加）。两侧都点选后，底部按钮才可确认。</p>
        <div class="trinity-combined-body">
          ${powerSectionHtml}
          ${passiveSectionHtml}
        </div>
        <div class="overlay-actions trinity-actions">
          <button class="secondary-button" id="trinity-confirm" disabled>两侧都选好后确认</button>
        </div>
        <div class="evolution-note">已累计 ${scene.bossPassives.length} 项专属被动 · V 键当前为 ${scene.bossPower ? "已装备" : "空"}</div>
      </div>
    </div>
  `;

  let pickedPower: BossPowerId | "keep" | null = null;
  let pickedPassive: BossPassiveId | null = null;

  const refreshConfirm = (): void => {
    const ready =
      (powerOptions.length === 0 || pickedPower !== null) &&
      (passiveOptions.length === 0 || pickedPassive !== null);
    const btn = document.querySelector<HTMLButtonElement>("#trinity-confirm");
    if (btn) {
      btn.disabled = !ready;
      btn.textContent = ready ? "确认本次三神选择" : "两侧都选好后确认";
    }
  };

  document
    .querySelectorAll<HTMLButtonElement>("[data-trinity-power]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        pickedPower = button.dataset.trinityPower as BossPowerId;
        document
          .querySelectorAll<HTMLButtonElement>("[data-trinity-power]")
          .forEach((b) => b.classList.remove("selected"));
        document
          .querySelector<HTMLButtonElement>("[data-trinity-keep-power]")
          ?.classList.remove("selected");
        button.classList.add("selected");
        sfx("click");
        refreshConfirm();
      });
    });

  document
    .querySelector<HTMLButtonElement>("[data-trinity-keep-power]")
    ?.addEventListener("click", () => {
      pickedPower = "keep";
      document
        .querySelectorAll<HTMLButtonElement>("[data-trinity-power]")
        .forEach((b) => b.classList.remove("selected"));
      document
        .querySelector<HTMLButtonElement>("[data-trinity-keep-power]")
        ?.classList.add("selected");
      sfx("click");
      refreshConfirm();
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-trinity-passive]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        pickedPassive = button.dataset.trinityPassive as BossPassiveId;
        document
          .querySelectorAll<HTMLButtonElement>("[data-trinity-passive]")
          .forEach((b) => b.classList.remove("selected"));
        button.classList.add("selected");
        sfx("click");
        refreshConfirm();
      });
    });

  document
    .querySelector<HTMLButtonElement>("#trinity-confirm")
    ?.addEventListener("click", () => {
      if (pickedPower && pickedPower !== "keep") {
        scene.setBossPower(pickedPower);
      }
      if (pickedPassive) {
        scene.grantBossPassive(pickedPassive);
      }
      overlayRoot.innerHTML = "";
      scene.isModal = false;
      scene.physics.world.resume();
      sfx("upgrade");
      onComplete();
    });

  refreshConfirm();
}

function showBossPassiveChoice(
  scene: BattleScene,
  bossKinds: readonly BossKind[],
  onComplete: () => void
): void {
  const passiveIds = bossPassiveDropChoices(bossKinds, scene.bossPassives);
  const options = passiveIds
    .map((id) => BOSS_PASSIVE_OPTIONS.find((option) => option.id === id))
    .filter((option): option is BossPassiveDefinition => Boolean(option));
  if (!options.length) {
    scene.showBanner("该 Boss 的专属被动已全部获得", 1000);
    onComplete();
    return;
  }
  scene.isModal = true;
  scene.physics.world.pause();
  // === 顶部:三只小 boss 头像,代表本次三神掉落 ===
  const headerKinds: BossKind[] = (bossKinds.length
    ? [...bossKinds]
    : (["titan", "mirror", "usurper"] as BossKind[])
  ).slice(0, 3);
  const headerHtml = `
    <div class="boss-passive-header">
      ${headerKinds
        .map(
          (kind) =>
            `<span class="boss-passive-mini" title="${BOSS_NAMES[kind]}">${BOSS_NAMES[kind]}</span>`
        )
        .join(`<span class="boss-passive-mini-sep">·</span>`)}
    </div>
  `;
  // === 卡片:顶部居中大 emblem,中段标题/来源/副标题,底部描述 ===
  const cardHtml = options
    .map(
      (option, index) => `
    <button class="boss-passive-card" data-boss-passive="${option.id}" style="--passive-index:${index}">
      <span class="boss-passive-emblem">${option.icon}</span>
      <span class="boss-passive-index">候选 ${index + 1}</span>
      <span class="boss-passive-source">来源 · ${BOSS_NAMES[option.kind]}</span>
      <h3>${option.name}</h3>
      <small>${option.code}</small>
      <p>${option.description}</p>
    </button>
  `
    )
    .join("");
  overlayRoot.innerHTML = `
    <div class="overlay boss-power-overlay boss-passive-overlay">
      <div class="overlay-panel boss-power-panel boss-passive-panel">
        <div class="eyebrow">EXCLUSIVE BOSS AUGMENT</div>
        <h2>专属被动强化三选一</h2>
        ${headerHtml}
        <p>这是黑影夺走的 Boss 专属强化。被动可以累计很多项，不占用 <kbd>V</kbd> 键，但本次掉落只能选择一项。</p>
        <div class="boss-passive-grid">
          ${cardHtml}
        </div>
        <div class="evolution-note">已累计 ${scene.bossPassives.length} 项专属被动 · 选择后永久保留到本局结束。</div>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>("[data-boss-passive]").forEach((button) => {
    button.addEventListener("click", () => {
      scene.grantBossPassive(button.dataset.bossPassive as BossPassiveId);
      overlayRoot.innerHTML = "";
      scene.isModal = false;
      scene.physics.world.resume();
      sfx("upgrade");
      onComplete();
    });
  });
}

// === 终局抉择:损坏的黑暗核心 —— 摧毁还是保留 ===
function showDarkCoreChoice(
  scene: BattleScene,
  onChosen: (choice: "destroyed" | "kept") => void
): void {
  scene.isModal = true;
  scene.physics.world.pause();
  overlayRoot.innerHTML = `
    <div class="overlay dark-core-overlay">
      <div class="overlay-panel dark-core-panel">
        <div class="eyebrow">SALVAGED ARTIFACT · UNSTABLE</div>
        <h2>损坏的黑暗核心</h2>
        <p>黑暗魔神陨落，残骸中央悬着一枚裂开的核心。它还在跳动，节奏和你的心率正在同步。残党正从四面涌来，你必须立刻决定。</p>
        <div class="dark-core-grid">
          <button class="dark-core-card" data-core-choice="destroyed">
            <span class="core-icon">✖</span>
            <h3>摧毁核心</h3>
            <p>当场碎裂核心。黑暗能量灌入所有残党，同时顺着裂口侵蚀你。侵蚀满 100% 就会吞没你——在那之前清完残党，你还能活下来。</p>
            <span class="core-warn">残党强化 · 与侵蚀赛跑</span>
          </button>
          <button class="dark-core-card" data-core-choice="kept">
            <span class="core-icon">◈</span>
            <h3>保留核心</h3>
            <p>把核心锁进货舱带走。残党不会被强化，你也不会被侵蚀——但没人知道一枚“损坏”的核心在这场战斗里会变成什么。</p>
            <span class="core-warn">残党维持原状 · 核心状态未知</span>
          </button>
        </div>
        <div class="evolution-note">这是本局最后一个决定 · 无法撤回</div>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>("[data-core-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.coreChoice as "destroyed" | "kept";
      overlayRoot.innerHTML = "";
      scene.isModal = false;
      scene.physics.world.resume();
      sfx("upgrade");
      onChosen(choice);
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
    scene.game.loop.resetDelta();
    scene.resumeFromManualPause();
    sfx("click");
  });
  document.querySelector("#restart-run")!.addEventListener("click", () => {
    destroyGame();
    startRun();
  });
  document.querySelector("#quit-run")!.addEventListener("click", showMenu);
}

// 结算与快速重开已抽至 run-settlement.ts(finishRun)


// === 模块级 window/document 单例监听器 ===
// setupInput / showMenu 每局(每次打开)先 remove 再 add 同名函数,避免跨局累积:
// 旧闭包会钉住已销毁的 BattleScene 无法被 GC,且按键/组字/失焦事件会重复触发。

// 主菜单键盘启动(Enter/Space):输入法组字时 e.key 会变成 "Process",
// 但 e.code 始终是 "Enter"/"Space",保证输入法开启也能键盘启动。
function homeStartFromKey(e: KeyboardEvent): void {
  if (e.code !== "Enter" && e.code !== "Space") return;
  const home = document.getElementById("home-screen");
  if (!home) return;
  if (home.classList.contains("hidden")) return;
  if ((document.activeElement as HTMLElement | null)?.closest?.("#overlay-root")) return;
  e.preventDefault();
  sfx("click");
  showLevelSelect();
}

const CODE_TO_KEYCODE: Record<string, number> = {
  KeyA: 65, KeyB: 66, KeyC: 67, KeyD: 68, KeyE: 69, KeyF: 70, KeyG: 71, KeyH: 72,
  KeyI: 73, KeyJ: 74, KeyK: 75, KeyL: 76, KeyM: 77, KeyN: 78, KeyO: 79, KeyP: 80,
  KeyQ: 81, KeyR: 82, KeyS: 83, KeyT: 84, KeyU: 85, KeyV: 86, KeyW: 87, KeyX: 88,
  KeyY: 89, KeyZ: 90,
  Digit0: 48, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53,
  Digit6: 54, Digit7: 55, Digit8: 56, Digit9: 57,
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  Space: 32, Enter: 13, Escape: 27, Tab: 9, Backspace: 8,
  Comma: 188, Period: 190, Slash: 191, Semicolon: 186, Quote: 222,
  BracketLeft: 219, BracketRight: 221, Backslash: 220, Minus: 189,
  Equal: 187, Backquote: 192,
  ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17,
  AltLeft: 18, AltRight: 18, MetaLeft: 91, MetaRight: 91
};

// IME 组字键位转译:输入框聚焦时完全放行,画布聚焦时把组字事件转成真实键位派发
function relayImeKey(event: KeyboardEvent, type: "keydown" | "keyup"): void {
  if (!activeScene || activeScene.ended || activeScene.isModal) return;
  const target = event.target as HTMLElement | null;
  const editable = Boolean(
    target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
  if (editable) return;
  if (!event.isComposing && event.keyCode !== 229) return;
  const keyCode = CODE_TO_KEYCODE[event.code];
  if (!keyCode) return;
  event.preventDefault();
  window.dispatchEvent(new KeyboardEvent(type, { keyCode, code: event.code, bubbles: true }));
}
function relayImeKeyDown(event: KeyboardEvent): void {
  relayImeKey(event, "keydown");
}
function relayImeKeyUp(event: KeyboardEvent): void {
  relayImeKey(event, "keyup");
}

// 全局阻断 IME 组字候选弹出(输入框聚焦时完全放行)
function blockImeCandidate(e: CompositionEvent): void {
  const target = e.target as HTMLElement | null;
  const editable = Boolean(
    target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
  if (editable) return;
  if (activeScene && !activeScene.isModal && !activeScene.ended) e.preventDefault();
}

// 失焦自动暂停:常驻监听,任何对局状态下失焦都暂停;菜单/结算态由 activeScene 守卫拦截
function onWindowBlur(): void {
  if (activeScene && !activeScene.isModal && !activeScene.ended) showPause(activeScene);
}

export class BattleScene extends SpawnDirectorMixin(
  UpgradeSystemMixin(Phaser.Scene)
) {
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
  keyMap: Record<string, Phaser.Input.Keyboard.Key> = {};
  focusGuardTimer?: Phaser.Time.TimerEvent;
  upgradeLevels: Record<string, number> = { cannon: 1 };
  // P2 独立强化等级(双人:共享经验,各自选择各自强化)
  upgradeLevels2: Record<string, number> = { cannon: 1 };
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
  // P2 独立数值(双人):与 P1 的 stats 平行。P2 血量仍以 player2Hp/player2MaxHp 为准。
  stats2 = {
    speed: 420,
    damageMultiplier: 1,
    cooldownMultiplier: 1,
    damageTakenMultiplier: 1,
    explosionTakenMultiplier: 1,
    fireRateMultiplier: 1,
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
  // 双人模式:接管是否已发生(防死亡路径重复触发接管,把幸存者血再次清零)
  coopHandoverDone = false;
  kills = 0;
  combo = 0;
  comboTimer = 0;
  ultimate = 0;
  ultimateActive = 0;
  overdriveDamageMul = 1;          // E 键星核超载的伤害加成
  xpMultiplier = 1;                // 磁吸增益 — 经验倍数
  // === 力量流派:龙息喷火 ===
  flamethrowerActiveUntil = 0;
  flamethrowerNextReadyAt = 0;
  nextFlamethrowerFxAt = 0;
  flamethrowerLength = 80;
  flamethrowerWidth = 80;
  flamethrowerDmgPerFrame = 18;
  flamethrowerVisual?: Phaser.GameObjects.Image;
  // === 敏捷流派:影步突刺 ===
  lungingUntil = 0;
  lungingStartedAt = 0;
  lungingDuration = 0;
  lungingFromX = 0;
  lungingFromY = 0;
  lungingToX = 0;
  lungingToY = 0;
  lungingReadyAt = 0;
  lungingHits = 0;
  // === 突刺联动:4 影分身突刺(底部向上) ===
  lungingShadowClones: Phaser.Physics.Arcade.Image[] = [];
  lungingShadowUntil = 0;  // 突刺分身的存活截止时间
  // === 敏捷流派:影分身 ===
  nextShadowCloneAt = 0;
  shadowClones: Phaser.Physics.Arcade.Image[] = [];
  // P2 敏捷:独立影分身编队
  nextShadowCloneAt2 = 0;
  shadowClones2: Phaser.Physics.Arcade.Image[] = [];
  // === BOSS 被动护符(本局) ===
  mirrorEchoArmed = false;
  mirrorEchoTriggered = false;
  usurperBlight = false;
  deityPactArmed = false;
  deityPactTriggered = false;
  // === 吞噬流派:吞噬(动态体型) ===
  devourSizeMul = 1;          // 玩家当前体积倍数(从吞噬累加)
  devourBonusMaxHp = 0;       // 仅记录吞噬得到的额外生命，用于越级吞噬反噬
  devourSizeLossNextAt = 0;   // 下次缓慢损失(回归基础,避免无限膨胀)
  devourKillCount = 0;        // 累计吞噬数(每 10 触发光环)
  // P2 吞噬:独立状态
  devourSizeMul2 = 1;
  devourBonusMaxHp2 = 0;
  devourSizeLossNextAt2 = 0;
  devourKillCount2 = 0;
  player2OriginalMaxHp = 0;
  // === 防御流派:荆棘护甲(反伤) ===
  thornsAccumulator = 0;      // 累计反伤(到达 1000 触发回血)
  thornsAccumulator2 = 0;     // P2 反伤累计
  // === 吸血流派:虹吸链(8 条链子主动发射) ===
  siphonedEnemies: Array<{ enemy: Phaser.Physics.Arcade.Image; until: number; owner: 1 | 2 }> = [];
  siphonChains: Array<{
    sx: number; sy: number;        // 起点(玩家)
    hx: number; hy: number;        // 链头位置(锚定敌人 或 飞行末)
    length: number;                // 当前链长(px)
    maxLength: number;             // 链子总长(100)
    life: number;                  // 剩余时间(ms)
    maxLife: number;
    anchor?: Phaser.Physics.Arcade.Image;  // 锚定敌人
    angle: number;                 // 飞行方向(只对未锚定链子有意义)
    visual?: Phaser.GameObjects.Image;
    owner: 1 | 2;                  // 链子归属玩家
  }> = [];
  siphonChainsCooldownUntil = 0;  // 内部防同帧刷屏
  nextSiphonHealAt = 0;
  nextSiphonGroupFxAt = 0;
  invulnerableUntil = 0;
  // 主动技能无敌(突刺/万象影袭)截止时间:用于区分被动受击无敌帧,
  // Boss 预警大技能只穿透被动无敌帧,不会抹掉主动技能无敌
  activeInvulnerableUntil = 0;
  player2FriendlyInvulnerableUntil = 0;
  shieldReadyAt = 0;
  emergencyUsed = false;
  rerolls = 1;
  isModal = false;
  ended = false;
  bossActive = false;
  bossHp = 0;
  bossMaxHp = 18000;
  bossMaxHpBeforeFinalBalance = 18000;
  bossPhase = 0;
  bossTier = 0;
  bossKind: BossKind = "titan";
  bossElite = false;
  bossMutated = false;
  bossMutationKind: BossKind | null = null;
  bossEliteAura?: Phaser.GameObjects.Arc;
  bossAttackIndex = -1;
  bossActiveSkillTypes: string[] = [];
  skillsConfiscated = false;
  skillsConfiscatedUntil = 0;
  nextBossAttack = 0;
  nextBossScore = 5000;
  nextSpawn = 0;
  // === 普通战役:航线门流程状态(清兵达标并清场后出现红/蓝/绿三扇门) ===
  campaignGates: Phaser.GameObjects.Container[] = [];
  campaignGateUntil = 0;        // 门消失时间(基于 time)
  campaignGatesOpen = false;    // 门流程进行中(防止重复生成/重复触发)
  campaignHalfGateDone = false; // 本航段半程航线门已给过(阈值 50%),防止重复出现
  // === 升级选择队列:弹窗忙时先排队,逐个弹出(修复同时吸收大量经验丢三选一) ===
  pendingLevelUps = 0;
  levelUpScheduled = false;
  // === 融合技状态(六流派融合强化) ===
  nextGoldenEmberAt: Record<1 | 2, number> = { 1: 0, 2: 0 };
  // 金龙炼狱:G 键召唤的小喷火无人机编队(最多 4 个,15s 冷却)
  fusionDrones: Record<1 | 2, Phaser.GameObjects.Image[]> = { 1: [], 2: [] };
  fusionDroneFlames: Record<1 | 2, Phaser.GameObjects.Image[]> = { 1: [], 2: [] };
  fusionDroneUntil: Record<1 | 2, number> = { 1: 0, 2: 0 };
  fusionDroneNextReadyAt: Record<1 | 2, number> = { 1: 0, 2: 0 };
  thornStarUntil: Record<1 | 2, number> = { 1: 0, 2: 0 };
  thornStarGauge: Record<1 | 2, number> = { 1: 0, 2: 0 };
  thornStarVisual: Record<1 | 2, Phaser.GameObjects.Container | undefined> = {
    1: undefined,
    2: undefined
  };
  thornStarAoeAt: Record<1 | 2, number> = { 1: 0, 2: 0 };
  vampireNetworkFxAt: Record<1 | 2, number> = { 1: 0, 2: 0 };
  devourMawUntil: Record<1 | 2, number> = { 1: 0, 2: 0 };
  devourMawVisual: Record<1 | 2, Phaser.GameObjects.Arc | undefined> = {
    1: undefined,
    2: undefined
  };
  nextDevourMawTickAt: Record<1 | 2, number> = { 1: 0, 2: 0 };
  celestialChargeUntil: Record<1 | 2, number> = { 1: 0, 2: 0 };
  celestialReadyAt: Record<1 | 2, number> = { 1: 0, 2: 0 };
  // === 升级选择面板打开中:游戏完全暂停(isModal + 物理暂停) ===
  upgradePanelOpen = false;
  // === Boss 权柄等级与被动升级 ===
  bossPowerLevel = 1;
  bossPassiveLevels: Record<string, number> = {};
  // === 死亡来源(结算界面展示) ===
  lastDamageCause = "未知威胁";
  nextFlightToken = 0;
  nextSkillPickup = 0;
  nextShot = 0;
  nextLaser = 0;
  nextMissile = 0;
  nextDroneShot = 0;
  nextArc = 0;
  nextBladeDamage = 0;
  // P2 自动武器:独立时间戳与编队(双人各自选强化)
  nextLaser2 = 0;
  nextMissile2 = 0;
  nextDroneShot2 = 0;
  nextArc2 = 0;
  nextBladeDamage2 = 0;
  drones2: Phaser.GameObjects.Image[] = [];
  blades2: Phaser.GameObjects.Image[] = [];
  // P2 龙息喷火:独立状态
  flamethrowerActiveUntil2 = 0;
  flamethrowerNextReadyAt2 = 0;
  flamethrowerLength2 = 80;
  flamethrowerWidth2 = 80;
  flamethrowerDmgPerFrame2 = 18;
  flamethrowerVisual2?: Phaser.GameObjects.Image;
  nextFlamethrowerFxAt2 = 0;
  // P2 影步突刺:独立状态
  lungingReadyAt2 = 0;
  lungingUntil2 = 0;
  lungingStartedAt2 = 0;
  lungingDuration2 = 0;
  lungingFromX2 = 0;
  lungingFromY2 = 0;
  lungingToX2 = 0;
  lungingToY2 = 0;
  lungingHits2 = 0;
  lungingShadowClones2: Phaser.Physics.Arcade.Image[] = [];
  lungingShadowUntil2 = 0;
  // P2 独立无敌(相位闪避/突刺/纳米修复生效)
  player2InvulnUntil = 0;
  nextTaunt = 2600;
  nextTrail = 0;
  nextWheelchairTrail = 0; // 轮椅超载尾迹独立计时(与引擎尾迹分离,互不压制)
  nextAchievementSkinFx = 0;
  visualEffectsReadyAt = 0;
  levelCompleteTriggered = false;
  // 清兵期冻结的底层分数:阈值达标瞬间锁定,清兵/Boss 阶段击杀只加显示分数,
  // 下一阈值以冻结值为基准,避免底层分数被清兵期击杀提前推高
  bossClearScore = 0;
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
  // P2 敏捷:独立积累器,避免与 P1 共享弹幕节奏
  agileBulletAccumulator2 = 0;
  nextAgileBloom2 = 0;
  agileVolleyIndex2 = 0;
  wheelchairInitialMaxHp = 0;
  nextWheelchairHeal = 0;
  wheelchairOverdriveUntil = 0;
  wheelchairBreachUntil = 0;
  wheelchairReactiveArmorUntil = 0;
  wheelchairReactiveStoredDamage = 0;
  wheelchairFortressUntil = 0;
  wheelchairFortressBaseWidth = 0;
  wheelchairFortressBaseHeight = 0;
  wheelchairFortressApplied = false;
  wheelchairReactiveArmorVisual?: Phaser.GameObjects.Arc;
  wheelchairFortressVisual?: Phaser.GameObjects.Arc;
  // P2 撞击流派独立状态
  wheelchairInitialMaxHp2 = 0;
  nextWheelchairHeal2 = 0;
  wheelchairOverdriveUntil2 = 0;
  wheelchairBreachUntil2 = 0;
  wheelchairReactiveArmorUntil2 = 0;
  wheelchairReactiveStoredDamage2 = 0;
  wheelchairFortressUntil2 = 0;
  wheelchairFortressBaseWidth2 = 0;
  wheelchairFortressBaseHeight2 = 0;
  wheelchairFortressApplied2 = false;
  wheelchairReactiveArmorVisual2?: Phaser.GameObjects.Arc;
  wheelchairFortressVisual2?: Phaser.GameObjects.Arc;
  nextRamShockwave = 0;
  bossPower: BossPowerId | null = null;
  recoveredBossPowers: BossPowerId[] = [];
  bossPassives: BossPassiveId[] = [];
  bossPowerDamageMultiplier = 1;
  bossPowerAreaMultiplier = 1;
  bossPowerCooldownMultiplier = 1;
  bossPowerDurationMultiplier = 1;
  bossPowerHealRatio = 0;
  bossPowerMissingHealRatio = 0;
  bossPowerCloneBonus = 0;
  bossPowerInvulnMs = 0;
  bossPassiveBossDamageTakenMultiplier = 1;
  shadowRiftBladeBonus = 0;
  bossPowerOverchargeChance = 0;
  bossPowerOverchargeDamage = 0;
  bossPowerResonanceThreshold = 4;
  bossPowerResonanceDamage = 1.5;
  bossPowerRateMultiplier = 1;
  bossPowerCritChance = 0;
  bossPowerActiveUntil = 0;
  bossPowerReadyAt = 0;
  bossPowerClones: Phaser.GameObjects.Image[] = [];
  nextBossPowerPulse = 0;
  mirrorMimicIndex = 0;
  campaignEncounterIndex = 0;
  campaignBossesDefeated = 0;
  campaignInterludeActive = false;
  campaignInterludeKills = 0;
  campaignInterludeTarget = 0;
  campaignInterludeStartScore = 0;
  campaignInterludeNextEncounter = 0;
  campaignInterludeWave = 0;
  campaignMysteryStage = 0;
  campaignMysteryVariant = 0;
  lastBannerText = "";
  trinityAlive = 0;
  trinityDefeatedKinds: BossKind[] = [];
  nextTrinityAttack = 0;
  nextUsurperDisableAt = 0;
  nextUsurperDrainAt = 0;
  // 最终 boss(黑暗魔神):定期剥夺玩家技能(含 V 键权柄),冷却后再次剥夺
  nextDarkDeityDisableAt = 0;
  // Boss 版荆棘反伤(防御流派反击被篡夺):持续期间玩家攻击 Boss 按比例反弹伤害
  bossThornCounterUntil = 0;
  usurperStolenSkill:
    | "laser"
    | "missile"
    | "drone"
    | "emp"
    | "agile_fusion"
    | "agile_clone"
    | "defender_counter"
    | "vampire_siphon"
    | null = null;
  usurperStolenUntil = 0;
  nextBossMinionSummon = 0;
  darkHealLockUntil = 0;
  darkHealingScale = 1;
  darkDotRemaining = 0;
  darkDotPerSecond = 0;
  darkDotUntil = 0;
  nextDarkDotTick = 0;
  nextDarkEnergyFxAt = 0;
  darkStormUntil = 0;
  nextDarkStormTick = 0;
  strippedAbilities: string[] = [];
  finalBossBorrowedPower: string | null = null;
  shadowRuptureTriggered = false;
  // 黑影/黑暗魔神冲刺期间:暂停核心漂移,让冲刺 tween 完全接管位置(时间戳兜底,避免 tween 被中断后卡死)
  shadowChargingUntil = 0;
  bossKilledByCollision = false;
  wideArenaBackdrop?: Phaser.GameObjects.Rectangle;
  lastBossHazardDamageAt = -10000;
  temporarySkill: TemporarySkill | null = null;
  temporarySkillUntil = 0;
  nextTemporaryPattern = 0;
  temporarySkillShield?: Phaser.GameObjects.Arc;
  temporarySkillShieldUntil = 0;
  doctrineLevels: Record<string, number> = {};
  // === 最终 boss · 黑暗飞机相关状态 ===
  darkAircraftSpawned = false;          // 50% 血量时只召唤一次
  darkAircraftRetreating = false;        // 隐退模式(停止攻击,回血)
  darkAircraft?: Phaser.Physics.Arcade.Image;
  darkAircraftHp = 0;
  darkAircraftMaxHp = 0;
  darkAircraftNextHealAt = 0;
  darkAircraftNextAttack = 0;
  darkAircraftPhase: "idle" | "firework" | "clone" | "missile" | "stealth" | "enraged" = "idle";
  darkAircraftClones: Phaser.Physics.Arcade.Image[] = [];
  darkAircraftEnraged = false;
  darkAircraftEnrageUntil = 0;
  darkAircraftDamageWindow: number[] = []; // 时间戳数组(用于检测 1s 内 27.5% 伤害)
  darkDeityInvulnUntil = 0;               // 黑暗契约 V 键无敌窗口
  darkAircraftMaxHpBeforeLock = 0;        // 被锁 3000 之前玩家的真实 maxHp(用于突破时还原)
  originalPlayerMaxHp = 0;                // 玩家开局原始最大血量
  bossShattered = false;                  // 支离破碎：boss 释放同归于尽
  shatteredPlayerMaxHpOriginal = 0;       // 支离破碎前玩家的真实 maxHp(用于还原)
  shatteredPlayerDamageOriginal = 1;      // 支离破碎前玩家的真实 damageMultiplier
  finalSwarmActive = false;               // 终局残党涌入
  finalSwarmRemaining = 0;
  finalSwarmWaveIndex = 0;
  finalSwarmNextWaveAt = 0;
  // === 终局:损坏的黑暗核心(摧毁 / 保留 两种抉择) ===
  darkCoreChoice: "destroyed" | "kept" | null = null;
  darkCorruption = 0;                     // 摧毁后玩家的黑暗侵蚀值(0-100)
  nextCorruptionTick = 0;
  shadowEnding: ShadowEnding | null = null;
  airSupportLevels: Partial<Record<AirSupportSkillId, number>> = {};
  nextAirSupportAt: Partial<Record<AirSupportSkillId, number>> = {};
  enemySlowUntil = 0;
  enemyFreezeUntil = 0;
  enemyFreezeStartedAt = 0;
  enemyFreezeMotionOffset = 0;
  wingClones: Phaser.Physics.Arcade.Image[] = [];
  nextCloneShot = 0;
  bloodHitCounter = 0;
  collisionReadyAt = 0;
  player2CollisionReadyAt = 0;
  targetReticle?: Phaser.GameObjects.Container;
  horizonGlow?: Phaser.GameObjects.Graphics;
  bossTransientEffects = new Set<Phaser.GameObjects.GameObject>();
  // 裸建的 Boss 本体图(afterimage / 黑影窃取演出),不属于任何对象池,
  // 只靠 tween onComplete 销毁;若 tween 被中断会永久残留在背景上。
  // 统一登记后由 clearBossEntities 兜底销毁。
  bossTransientVisuals = new Set<Phaser.GameObjects.GameObject>();
  activeBossAttackTypes = new Map<string, number>();
  hud!: {
    graphics: Phaser.GameObjects.Graphics;
    hp: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
    time: Phaser.GameObjects.Text;
    level: Phaser.GameObjects.Text;
    combo: Phaser.GameObjects.Text;
    bossName: Phaser.GameObjects.Text;
    p2: Phaser.GameObjects.Text;
  };

  constructor() {
    super("battle");
  }

  resumeFromManualPause(): void {
    const now = this.time.now;
    this.visualEffectsReadyAt = Math.max(this.visualEffectsReadyAt, now + 320);
    this.nextTrail = Math.max(this.nextTrail, now + 90);
    this.nextShot = Math.max(this.nextShot, now + 45);
    this.nextLaser = Math.max(this.nextLaser, now + 100);
    this.nextMissile = Math.max(this.nextMissile, now + 150);
    this.nextDroneShot = Math.max(this.nextDroneShot, now + 190);
    if (!this.bossActive) this.nextSpawn = Math.max(this.nextSpawn, now + 160);
    this.nextBossAttack = Math.max(this.nextBossAttack, now + 220);
    Object.keys(this.nextAirSupportAt).forEach((id, index) => {
      const key = id as AirSupportSkillId;
      if ((this.nextAirSupportAt[key] ?? 0) <= now) {
        this.nextAirSupportAt[key] = now + 260 + index * 70;
      }
    });
  }

  trackBossEffect<T extends Phaser.GameObjects.GameObject>(effect: T, lifetime = 3200): T {
    this.bossTransientEffects.add(effect);
    effect.once("destroy", () => this.bossTransientEffects.delete(effect));
    this.time.delayedCall(lifetime, () => {
      if (!effect.active) return;
      this.tweens.killTweensOf(effect);
      effect.destroy();
    });
    return effect;
  }

  // 登记裸建的 Boss 本体图,确保它们不会因 tween 被中断而残留
  trackBossVisual<T extends Phaser.GameObjects.GameObject>(visual: T): T {
    this.bossTransientVisuals.add(visual);
    visual.once("destroy", () => this.bossTransientVisuals.delete(visual));
    return visual;
  }

  clearBossAttackEffects(): void {
    for (const effect of this.bossTransientEffects) {
      this.tweens.killTweensOf(effect);
      if (effect.active) effect.destroy();
    }
    this.bossTransientEffects.clear();
    // 兜底销毁任何残存的 Boss 本体图(正常流程中它们已被 tween 销毁,不会重复触发)
    for (const visual of this.bossTransientVisuals) {
      this.tweens.killTweensOf(visual);
      if (visual.active) visual.destroy();
    }
    this.bossTransientVisuals.clear();
    this.activeBossAttackTypes.clear();
  }

  startBossAttackType(type: string, attack: () => void, lifetime = 7000, force = false): boolean {
    const now = this.time.now;
    for (const [activeType, expiresAt] of this.activeBossAttackTypes) {
      if (expiresAt <= now) this.activeBossAttackTypes.delete(activeType);
    }
    // force=true 的招牌技能(镜像模仿玩家 / 篡夺者偷取技能)不受并发上限限制,
    // 避免场上同时存在多个攻击时就"释放不出来"
    // 噩梦难度 Boss 与黑影系 Boss(黑影/黑暗魔神)场上同时存在的技能上限 4 → 5,其余保持 4
    const nightmareOrShadowBoss =
      campaignDifficultyForLevel(selectedLevel).id === "nightmare" ||
      this.bossKind === "shadow" ||
      this.bossKind === "dark_deity";
    const bossSkillCap = nightmareOrShadowBoss ? 5 : 4;
    if (!force && !this.activeBossAttackTypes.has(type) && this.activeBossAttackTypes.size >= bossSkillCap) {
      return false;
    }
    this.activeBossAttackTypes.set(type, now + lifetime);
    attack();
    return true;
  }

  preload(): void {
    Object.values(SHIPS).forEach((ship) => {
      this.load.image(ship.asset, `assets/fighters/${ship.asset}.png`);
    });
    // 战斗场景只把当前装备的一款成就皮肤上传到显存；商店图不重复载入 Phaser。
    const equippedSkin = save.unlockedSkins.includes(save.equippedSkin)
      ? SKINS[save.equippedSkin]
      : SKINS.standard;
    if (equippedSkin.asset) {
      this.load.image(achievementSkinTextureKey(save.equippedSkin), equippedSkin.asset);
    }
    if (equippedSkin.bulletAsset) {
      this.load.image(
        achievementSkinBulletTextureKey(save.equippedSkin),
        equippedSkin.bulletAsset
      );
    }
    this.load.spritesheet(
      "siphonChainFx",
      "assets/effects/generated/siphon_chain_strip.png",
      { frameWidth: 512, frameHeight: 64 }
    );
    this.load.spritesheet(
      "flamethrowerFx",
      "assets/effects/generated/flamethrower_strip.png",
      { frameWidth: 256, frameHeight: 256 }
    );
    const animatedBossFx: Array<[string, string]> = [
      ["bossPowerFx_titan", "boss_power_titan.png"],
      ["bossPowerFx_mirror", "boss_power_mirror.png"],
      ["bossPowerFx_usurper", "boss_power_usurper.png"],
      ["bossPowerFx_shadow", "boss_power_shadow.png"],
      ["bossPowerFx_dark_deity", "boss_power_dark_deity.png"],
      ["bossPowerFx_freeze", "boss_power_freeze.png"],
      ["bossPowerFx_pulsar", "boss_power_pulsar.png"],
      ["bossPowerFx_gravity", "boss_power_gravity.png"],
      ["bossPowerFx_photon", "boss_power_photon.png"],
      ["bossSkillFx_titan", "boss_skills_titan.png"],
      ["bossSkillFx_mirror", "boss_skills_mirror.png"],
      ["bossSkillFx_usurper", "boss_skills_usurper.png"],
      ["bossSkillFx_shadow", "boss_skills_shadow.png"],
      ["bossSkillFx_dark_deity", "boss_skills_dark_deity.png"],
      ["bossSkillFx_dark_aircraft", "boss_skills_dark_aircraft.png"]
    ];
    animatedBossFx.forEach(([key, filename]) => {
      this.load.spritesheet(key, `assets/effects/generated/${filename}`, {
        frameWidth: 256,
        frameHeight: 256
      });
    });
    this.load.image("bossTitan", "assets/enemies/boss_titan.png");
    this.load.image("bossUsurper", "assets/enemies/boss_usurper.png");
    this.load.image("bossShadow", "assets/enemies/boss_shadow.png");
    this.load.image("bossShadowStage1", "assets/enemies/boss_shadow_stage1.png");
    this.load.image("bossShadowStage2", "assets/enemies/boss_shadow_stage2.png");
    this.load.image("bossShadowStage3", "assets/enemies/boss_shadow_stage3.png");
    this.load.image("bossShadowComplete", "assets/enemies/boss_shadow_complete.png");
    this.load.image("bossDarkDeity", "assets/enemies/boss_dark_deity.png");
    this.load.image("enemyScoutArt", "assets/enemies/enemy_scout.png");
    this.load.image("enemyInterceptorArt", "assets/enemies/enemy_interceptor.png");
    this.load.image("enemyStrikerArt", "assets/enemies/enemy_striker.png");
    this.load.image("enemySuppressorArt", "assets/enemies/enemy_suppressor.png");
    this.load.image("enemyMineLayerArt", "assets/enemies/enemy_mine_layer.png");
    this.load.image("enemyGunshipArt", "assets/enemies/enemy_gunship.png");
    this.load.image("enemyEliteArt", "assets/enemies/enemy_elite_gunship.png");
    this.load.image("enemyBomberArt", "assets/enemies/enemy_bomber.png");
    this.load.image("enemyCourierArt", "assets/enemies/enemy_courier.png");
    this.load.image("enemyEliteScoutArt", "assets/enemies/enemy_elite_scout.png");
    this.load.image("enemyEliteInterceptorArt", "assets/enemies/enemy_elite_interceptor.png");
    this.load.image("enemyEliteStrikerArt", "assets/enemies/enemy_elite_striker.png");
    this.load.image("enemyEliteSuppressorArt", "assets/enemies/enemy_elite_suppressor.png");
    this.load.image("enemyEliteMineLayerArt", "assets/enemies/enemy_elite_mine_layer.png");
    this.load.image("enemyEliteBomberArt", "assets/enemies/enemy_elite_bomber.png");
    this.load.image("enemyEliteCourierArt", "assets/enemies/enemy_elite_courier.png");
    this.load.image("starCoreTokenArt", "assets/pickups/star_core_token.png");
  }

  create(): void {
    setActiveScene(this);
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
            damageBossToRemainingRatio: (ratio: number) => void;
            defeatNextTrinityBoss: () => void;
            collisionFinishBoss: () => void;
            grantBossPower: (power: BossPowerId) => void;
            completeInterlude: () => void;
            setInterludeProgressRatio: (ratio: number) => void;
            healPlayer: (amount: number) => void;
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
          bossMaxHpBeforeFinalBalance: this.bossMaxHpBeforeFinalBalance,
          bossEncounterPowerScale:
            isNineBattleMode()
              ? campaignEncounterPowerScale(this.campaignEncounterIndex)
              : 1,
          bossEncounterAttackScale: this.currentBossEncounterAttackScale(),
          bossFinalStatScale:
            isNineBattleMode()
              ? campaignFinalBossStatScale(this.campaignEncounterIndex)
              : 1,
          skillsConfiscated: this.skillsConfiscated,
          skillsConfiscatedRemaining: Math.max(0, this.skillsConfiscatedUntil - this.time.now),
          campaignEncounterIndex: this.campaignEncounterIndex,
          campaignEncounterKind:
            BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]?.kind ?? "endless",
          campaignBossesDefeated: this.campaignBossesDefeated,
          campaignInterludeActive: this.campaignInterludeActive,
          campaignInterludeKills: this.campaignInterludeKills,
          campaignInterludeTarget: this.campaignInterludeTarget,
          campaignInterludeScore: Math.max(
            0,
            this.score + this.score2 - this.campaignInterludeStartScore
          ),
          campaignInterludeStartScore: this.campaignInterludeStartScore,
          campaignInterludeNextEncounter: this.campaignInterludeNextEncounter,
          campaignInterludeWave: this.campaignInterludeWave,
          campaignMysteryStage: this.campaignMysteryStage,
          hudLevelText: this.hud.level.text,
          lastBannerText: this.lastBannerText,
          trinityAlive: this.trinityAlive,
          bossPower: this.bossPower,
          bossPowerActiveRemaining: Math.max(0, this.bossPowerActiveUntil - this.time.now),
          bossPowerCooldownRemaining: Math.max(0, this.bossPowerReadyAt - this.time.now),
          darkHealLockRemaining: Math.max(0, this.darkHealLockUntil - this.time.now),
          darkHealingScale: this.darkHealingScale,
          darkDotRemaining: this.darkDotRemaining,
          nextBossMinionSummonRemaining: Number.isFinite(this.nextBossMinionSummon)
            ? Math.max(0, this.nextBossMinionSummon - this.time.now)
            : null,
          strippedAbilities: [...this.strippedAbilities],
          finalBossBorrowedPower: this.finalBossBorrowedPower,
          worldWidth: WORLD_WIDTH,
          arenaBoundsWidth: this.physics.world.bounds.width,
          bossPartStates: (
            this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]
          )
            .filter((part) => part.active)
            .map((part) => ({
              part: part.getData("part"),
              raidKind: part.getData("raidKind") ?? null,
              hp: part.getData("hp") ?? null,
              maxHp: part.getData("maxHp") ?? null,
              elite: Boolean(part.getData("elite")),
              texture: part.texture.key,
              x: part.x,
              y: part.y
            })),
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
              owner: bullet.getData("owner"),
              texture: bullet.texture.key,
              achievementSkinBullet: Boolean(bullet.getData("achievementSkinBullet")),
              displayWidth: bullet.displayWidth,
              displayHeight: bullet.displayHeight
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
              debugInjected: Boolean(enemy.getData("debugInjected")),
              bossSummoned: Boolean(enemy.getData("bossSummoned"))
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
          this.clearPlayerBullets();
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
          if (isNineBattleMode()) {
            this.campaignBossesDefeated = 3;
            this.campaignEncounterIndex = 8;
            this.startCampaignEncounter(8, true);
          } else {
            this.bossTier = 2;
            this.spawnBoss("dark_deity");
          }
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
          const raidCores = (
            this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]
          ).filter(
            (part) => part.active && part.getData("part") === "raid-core"
          );
          if (raidCores.length) {
            raidCores.forEach((core) =>
              core.active &&
              this.damageBossPart(core, (core.getData("hp") ?? 1) + 1)
            );
            return;
          }
          const core = (
            this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]
          ).find((part) => part.active && part.getData("part") === "core");
          if (!core) return;
          const phaseMultiplier = this.bossPhase === 1 ? 0.65 : 1.25;
          this.damageBossPart(core, this.bossHp / phaseMultiplier + 1);
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
          this.clearPlayerBullets();
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
        damageBossToRemainingRatio: (ratio: number) => {
          const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
            (part) => part.active && part.getData("part") === "core"
          );
          if (!core) return;
          const targetHp = this.bossMaxHp * Phaser.Math.Clamp(ratio, 0, 1);
          const effectiveDamage = Math.max(0, this.bossHp - targetHp);
          const phaseMultiplier = this.bossPhase === 1 ? 0.65 : 1.25;
          this.damageBossPart(core, effectiveDamage / phaseMultiplier);
        },
        defeatNextTrinityBoss: () => {
          const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
            (part) => part.active && part.getData("part") === "raid-core"
          );
          if (core) this.damageBossPart(core, (core.getData("hp") ?? 1) + 1);
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
          const missingScore = Math.max(
            0,
            this.campaignInterludeTarget -
              (this.score + this.score2 - this.campaignInterludeStartScore)
          );
          this.score += missingScore;
          this.completeCampaignInterlude();
        },
        setInterludeProgressRatio: (ratio: number) => {
          if (!this.campaignInterludeActive) return;
          const progress = Math.round(
            this.campaignInterludeTarget * Phaser.Math.Clamp(ratio, 0, 0.99)
          );
          this.score =
            this.campaignInterludeStartScore + progress - this.score2;
          this.updateCampaignMysteryFeedback();
          this.updateHud();
        },
        healPlayer: (amount: number) => this.healPlayer(Math.max(0, amount)),
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
      selectedMode === "endless" ? 31200 + selectedLevel * 3840 : 0;
    this.nextFlightToken = this.time.now + 4500;
    this.nextSkillPickup = this.time.now + Phaser.Math.Between(11000, 16000);
    this.showBanner(
      selectedMode === "campaign"
        ? `星渊征途 · ${levelConfig.name} · 未知深空航线`
        : selectedMode === "endless"
          ? `永夜航线 · ${levelConfig.name} · 首轮阈值 ${this.nextBossScore}`
          : `九渊试炼 · ${campaignDifficultyForLevel(selectedLevel).name} · 战斗 1/9`
    );
    if (selectedLevel === 5) this.unlockAchievement("level_five");
    if (selectedMode === "campaign") {
      this.time.delayedCall(700, () => {
        this.startCampaignInterlude(0, 0);
      });
    } else if (selectedMode === "boss") {
      this.time.delayedCall(700, () => {
        this.startCampaignEncounter(0);
      });
    }
    this.time.delayedCall(900, () => {
      if (!save.seenTutorial) {
        this.showBanner(
          save.selectedSpecialization === "wheelchair"
            ? "撞击协议 · [1]破阵冲角 · [2]反应装甲 · [3]堡垒姿态 · [E]破阵冲刺"
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
    g.fillEllipse(48, 55, 92, 66);
    g.fillStyle(0x163a57, 1);
    g.fillRoundedRect(10, 48, 76, 32, 14);
    g.fillStyle(0xdffcff, 1);
    g.fillRoundedRect(36, 4, 24, 87, 12);
    g.fillStyle(0x3478ff, 1);
    g.fillEllipse(48, 43, 16, 38);
    g.lineStyle(3, 0x2df4ff, 0.9);
    g.strokeRoundedRect(10, 48, 76, 32, 14);
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
    g.fillRoundedRect(4, 0, 16, 30, 8);
    g.fillCircle(12, 5, 8);
    g.fillStyle(0xff3dbb, 1);
    g.fillRoundedRect(7, 24, 10, 14, 5);
    g.generateTexture("missile", 24, 38);
    g.clear();

    g.fillStyle(0xff715b, 1);
    g.fillCircle(10, 10, 8);
    g.lineStyle(2, 0xffe0a6, 1);
    g.strokeCircle(10, 10, 8);
    g.generateTexture("enemyBullet", 20, 20);
    g.clear();

    g.fillStyle(0x8a2e5d, 1);
    g.fillRoundedRect(4, 15, 76, 40, 18);
    g.fillStyle(0xff4d6d, 1);
    g.fillRoundedRect(29, 8, 26, 58, 12);
    g.lineStyle(2, 0xff8ab7, 0.8);
    g.strokeRoundedRect(4, 15, 76, 40, 18);
    g.generateTexture("enemyScout", 84, 74);
    g.clear();

    g.fillStyle(0x3f285f, 1);
    g.fillRoundedRect(5, 6, 88, 52, 8);
    g.fillStyle(0x9b5cff, 1);
    g.fillRoundedRect(33, 9, 32, 57, 12);
    g.lineStyle(2, 0xf084ff, 0.7);
    g.strokeRoundedRect(5, 6, 88, 52, 8);
    g.generateTexture("enemyGunship", 98, 72);
    g.clear();

    g.fillStyle(0x203d73, 1);
    g.fillRoundedRect(2, 18, 72, 38, 18);
    g.fillStyle(0x49b8ff, 1);
    g.fillRoundedRect(27, 4, 22, 60, 11);
    g.lineStyle(2, 0xa7e7ff, 0.8);
    g.strokeRoundedRect(2, 18, 72, 38, 18);
    g.generateTexture("enemyInterceptor", 76, 72);
    g.clear();

    g.fillStyle(0x4f2318, 1);
    g.fillRoundedRect(5, 14, 104, 52, 12);
    g.fillStyle(0xff8a3d, 1);
    g.fillRoundedRect(36, 2, 42, 70, 17);
    g.fillCircle(57, 40, 11);
    g.lineStyle(3, 0xffcf70, 0.8);
    g.strokeRoundedRect(5, 14, 104, 52, 12);
    g.generateTexture("enemyBomber", 114, 76);
    g.clear();

    g.fillStyle(0x234637, 1);
    g.fillRoundedRect(4, 10, 86, 48, 18);
    g.fillStyle(0x43ff9a, 1);
    g.fillRoundedRect(30, 2, 34, 64, 15);
    g.lineStyle(3, 0xb9ffdc, 0.9);
    g.strokeRoundedRect(4, 10, 86, 48, 18);
    g.generateTexture("enemyCourier", 94, 70);
    g.clear();

    g.fillStyle(0x19344d, 1);
    g.fillEllipse(24, 20, 46, 34);
    g.lineStyle(2, 0x2df4ff, 0.8);
    g.strokeEllipse(24, 20, 46, 34);
    g.generateTexture("drone", 48, 38);
    g.clear();

    // 金龙炼狱专属:金色小喷火无人机(比普通护航无人机更醒目)
    g.fillStyle(0xffd66b, 0.16);
    g.fillCircle(32, 25, 30);
    g.fillStyle(0x2a1a06, 1);
    g.fillEllipse(32, 26, 52, 38);
    g.lineStyle(3, 0xffd66b, 1);
    g.strokeEllipse(32, 26, 52, 38);
    g.fillStyle(0xffe9a8, 1);
    g.fillCircle(32, 26, 10);
    g.lineStyle(2, 0xfff2c8, 0.9);
    g.strokeCircle(32, 26, 15);
    g.generateTexture("fusionDrone", 64, 52);
    g.clear();

    g.fillStyle(0x2df4ff, 0.18);
    g.fillCircle(18, 18, 17);
    g.lineStyle(3, 0x2df4ff, 0.95);
    g.strokeCircle(18, 18, 13);
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

    // 临时技能拾取:统一青色风格,内层实心,外层双圈,中央有星点
    g.fillStyle(0x2df4ff, 0.16);
    g.fillCircle(24, 24, 23);
    g.fillStyle(0x0a2030, 1);
    g.fillCircle(24, 24, 16);
    g.lineStyle(3, 0x2df4ff, 0.95);
    g.strokeCircle(24, 24, 20);
    g.lineStyle(2, 0x9ff7ff, 0.9);
    g.strokeCircle(24, 24, 12);
    g.fillStyle(0x2df4ff, 1);
    g.fillCircle(24, 24, 4);
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
    g.fillEllipse(180, 94, 220, 176);
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
    const armorBoost = permanentArmorScale();
    this.stats.maxHp = Math.round(ship.hp * specialization.hp * hpBoost);
    this.stats.hp = this.stats.maxHp;
    this.originalPlayerMaxHp = this.stats.maxHp;
    this.wheelchairInitialMaxHp = this.stats.maxHp;
    this.stats.speed = ship.speed * specialization.speed * speedBoost;
    this.stats.damageMultiplier =
      damageBoost * ship.damage * specialization.damage;
    this.stats.cooldownMultiplier = specialization.cooldown;
    this.stats.damageTakenMultiplier = specialization.damageTaken * armorBoost;
    this.stats.fireRateMultiplier = specialization.fireRate;
    this.stats.critChance =
      (save.selectedSpecialization === "power" ? 0.1 : 0.05) *
      SPECIALIZATION_BASE_STAT_BOOST;
    this.xpMultiplier = 1;
    this.stats.explosionTakenMultiplier = specialization.explosionTaken;
    this.nextWheelchairHeal = this.time.now + 5000;
    this.wheelchairBreachUntil = 0;
    this.wheelchairReactiveArmorUntil = 0;
    this.wheelchairReactiveStoredDamage = 0;
    this.wheelchairFortressUntil = 0;
    this.wheelchairFortressApplied = false;
    this.wheelchairReactiveArmorVisual?.destroy();
    this.wheelchairReactiveArmorVisual = undefined;
    this.wheelchairFortressVisual?.destroy();
    this.wheelchairFortressVisual = undefined;
    this.nextAgileBloom = this.time.now + 1350;
    this.nextShadowCloneAt = this.time.now + 12000;
    // 先让核心贴图进入显存，再逐步开启高频粒子，避免开局首秒卡顿。
    this.visualEffectsReadyAt = this.time.now + 650;
    this.devourKillCount = 0;
    this.devourBonusMaxHp = 0;
    this.rerolls = 1 + save.permanentUpgrades.reroll;
    // Boss 权柄等级 / 被动等级 / 死亡来源 每局重置
    this.bossPowerLevel = 1;
    this.bossPassiveLevels = {};
    this.lastDamageCause = "未知威胁";
    // === 普通战役:航线门流程初始化 ===
    this.campaignGates = [];
    this.campaignGateUntil = 0;
    this.campaignGatesOpen = false;
    // === BOSS 护符:每局重置 ===
    this.mirrorEchoArmed = false;
    this.mirrorEchoTriggered = false;
    this.usurperBlight = false;
    this.deityPactArmed = false;
    this.deityPactTriggered = false;
    const equippedSkin = save.unlockedSkins.includes(save.equippedSkin)
      ? SKINS[save.equippedSkin]
      : SKINS.standard;
    const achievementTexture = achievementSkinTextureKey(save.equippedSkin);
    const playerTexture =
      equippedSkin.asset && this.textures.exists(achievementTexture)
        ? achievementTexture
        : this.textures.exists(ship.asset)
          ? ship.asset
          : "player";
    this.player = this.physics.add.image(
      playVariant === "single" ? WORLD_WIDTH / 2 : WORLD_WIDTH * 0.37,
      WORLD_HEIGHT - 180,
      playerTexture
    );
    this.player
      .setDisplaySize(98 * specialization.scale, 98 * specialization.scale)
      .setDepth(10)
      .setCollideWorldBounds(true)
      .setData("owner", 1);
    this.wheelchairFortressBaseWidth = this.player.displayWidth;
    this.wheelchairFortressBaseHeight = this.player.displayHeight;
    this.configurePlayerBody(this.player);
    this.targetX = this.player.x;
    this.targetY = this.player.y;
    if (playVariant !== "single") {
      // 双人模式:P2 按独立选择的战机与专精创建(可与 P1 相同或不同)
      const ship2 = SHIPS[save.selectedShip2];
      const spec2 = SPECIALIZATIONS[save.selectedSpecialization2];
      const texture2 = this.textures.exists(ship2.asset) ? ship2.asset : "player";
      this.player2 = this.physics.add.image(WORLD_WIDTH * 0.63, WORLD_HEIGHT - 180, texture2);
      this.player2
        .setDisplaySize(98 * spec2.scale, 98 * spec2.scale)
        .setDepth(10)
        .setCollideWorldBounds(true)
        .setData("owner", 2);
      this.configurePlayerBody(this.player2);
      this.player2MaxHp = Math.max(1, Math.round(ship2.hp * spec2.hp * hpBoost));
      this.player2Hp = this.player2MaxHp;
      this.player2OriginalMaxHp = this.player2MaxHp;
      this.wheelchairInitialMaxHp2 = this.player2MaxHp;
      this.wheelchairFortressBaseWidth2 = this.player2.displayWidth;
      this.wheelchairFortressBaseHeight2 = this.player2.displayHeight;
      this.stats2.speed = ship2.speed * spec2.speed * speedBoost;
      this.stats2.damageMultiplier = damageBoost * ship2.damage * spec2.damage;
      this.stats2.cooldownMultiplier = spec2.cooldown;
      this.stats2.damageTakenMultiplier = spec2.damageTaken * armorBoost;
      this.stats2.fireRateMultiplier = spec2.fireRate;
      this.stats2.critChance =
        (save.selectedSpecialization2 === "power" ? 0.1 : 0.05) * SPECIALIZATION_BASE_STAT_BOOST;
      this.stats2.explosionTakenMultiplier = spec2.explosionTaken;
    }
  }

  configurePlayerBody(player: Phaser.Physics.Arcade.Image, worldDiameter = 28): void {
    const scale = player.displayWidth / player.width;
    const bodySourceSize = worldDiameter / scale;
    player.body!.setSize(bodySourceSize, bodySourceSize);
    player.body!.setOffset((player.width - bodySourceSize) / 2, (player.height - bodySourceSize) / 2);
  }

  // === 双人模式:按 owner 取各自的战机/专精/数值 ===
  shipOf(owner: 1 | 2): ShipId {
    return owner === 2 ? save.selectedShip2 : save.selectedShip;
  }

  specOf(owner: 1 | 2): SpecializationId {
    return owner === 2 ? save.selectedSpecialization2 : save.selectedSpecialization;
  }

  // 友军伤害开关:仅双人模式且设置开启时生效(菜单 STEP 01 可配置)
  friendlyFireEnabled(): boolean {
    return playVariant !== "single" && save.settings.friendlyFire;
  }

  // 按键按住状态(移动/开火等 held 动作,键位可重绑)
  keyHeld(action: BindableAction): boolean {
    const key = this.keyMap[boundKeyCode(action)];
    return Boolean(key?.isDown);
  }

  statsOf(
    owner: 1 | 2
  ): Pick<
    typeof this.stats,
    | "speed"
    | "damageMultiplier"
    | "cooldownMultiplier"
    | "damageTakenMultiplier"
    | "explosionTakenMultiplier"
    | "fireRateMultiplier"
    | "critChance"
  > {
    return owner === 2 ? this.stats2 : this.stats;
  }

  maxHpOf(owner: 1 | 2): number {
    return owner === 2 ? this.player2MaxHp : this.stats.maxHp;
  }

  hpOf(owner: 1 | 2): number {
    return owner === 2 ? this.player2Hp : this.stats.hp;
  }

  upgradesOf(owner: 1 | 2): Record<string, number> {
    return owner === 2 ? this.upgradeLevels2 : this.upgradeLevels;
  }

  createHud(): void {
    const cockpit = this.add.graphics().setDepth(48);
    cockpit.fillStyle(0x020713, 0.94);
    cockpit.fillRect(0, 0, 18, WORLD_HEIGHT);
    cockpit.fillRect(WORLD_WIDTH - 18, 0, 18, WORLD_HEIGHT);
    cockpit.fillRoundedRect(0, WORLD_HEIGHT - 56, 170, 56, 18);
    cockpit.fillRoundedRect(WORLD_WIDTH - 170, WORLD_HEIGHT - 56, 170, 56, 18);
    cockpit.lineStyle(4, 0x183f5c, 0.95);
    cockpit.lineBetween(0, WORLD_HEIGHT - 56, 170, WORLD_HEIGHT - 56);
    cockpit.lineBetween(WORLD_WIDTH, WORLD_HEIGHT - 56, WORLD_WIDTH - 170, WORLD_HEIGHT - 56);
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
      hp: this.add.text(28, 58, "", { ...font, fontSize: "20px", fontStyle: "bold" }).setDepth(51),
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
      combo: this.add.text(28, 144, "", { ...font, fontSize: "20px", color: "#ffbd3e" }).setDepth(51),
      bossName: this.add
        .text(WORLD_WIDTH / 2, 105, "", {
          ...font,
          fontSize: "13px",
          color: "#ff8ac9",
          letterSpacing: 2
        })
        .setOrigin(0.5)
        .setDepth(51),
      p2: this.add
        .text(28, 116, "", {
          ...font,
          fontSize: "20px",
          color: "#dfc0ff",
          fontStyle: "bold"
        })
        .setOrigin(0, 0.5)
        .setDepth(52)
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
            ? `撞击歼敌  [${keyCodeDisplayName(boundKeyCode("p1_skill1"))}]破阵冲角  [${keyCodeDisplayName(boundKeyCode("p1_skill2"))}]反应装甲  [${keyCodeDisplayName(boundKeyCode("p1_skill3"))}]堡垒姿态  [${keyCodeDisplayName(boundKeyCode("p1_overdrive"))}]破阵冲刺  [${keyCodeDisplayName(boundKeyCode("p1_doctrine"))}]全速推进  [${keyCodeDisplayName(boundKeyCode("p1_power"))}]权柄`
            : `${keyCodeDisplayName(boundKeyCode("p1_fire"))} 开火  [${keyCodeDisplayName(boundKeyCode("p1_skill1"))}]激光 [${keyCodeDisplayName(boundKeyCode("p1_skill2"))}]导弹 [${keyCodeDisplayName(boundKeyCode("p1_skill3"))}]无人机  [${keyCodeDisplayName(boundKeyCode("p1_emp"))}]清屏 [${keyCodeDisplayName(boundKeyCode("p1_overdrive"))}]超载  [${keyCodeDisplayName(boundKeyCode("p1_phase_dash"))}]闪避 [${keyCodeDisplayName(boundKeyCode("p1_repair"))}]修复`
          : `P1 ${keyCodeDisplayName(boundKeyCode("p1_move_left"))}${keyCodeDisplayName(boundKeyCode("p1_move_right"))}/${keyCodeDisplayName(boundKeyCode("p1_fire"))}/1-3/Q/E/G/F/R  ·  P2 ${keyCodeDisplayName(boundKeyCode("p2_move_up"))}${keyCodeDisplayName(boundKeyCode("p2_move_down"))}${keyCodeDisplayName(boundKeyCode("p2_move_left"))}${keyCodeDisplayName(boundKeyCode("p2_move_right"))}/${keyCodeDisplayName(boundKeyCode("p2_fire"))}/J/K/L/M/N/，  ·  友军伤害${save.settings.friendlyFire ? "开启" : "关闭"}`,
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
      projectile.getData("damageSource") ?? "minion",
      (projectile.getData("source") as Phaser.Physics.Arcade.Image | undefined) ?? null
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
      this.grantRunTokens(value);
      this.floatText(collector.x, collector.y - 54, "飞行代币", true);
      this.pickupEffect(collector.x, collector.y, true);
    } else if (kind === "skill") {
      this.activateTemporarySkill(value as TemporarySkill);
      this.pickupEffect(collector.x, collector.y, true);
    } else if (kind === "boss_upgrade") {
      const onCollected = item.getData("onCollected") as (() => void) | undefined;
      const stolenKind = value as BossKind;
      item.disableBody(true, true);
      this.pickupEffect(collector.x, collector.y, true);
      this.cameras.main.flash(160, 230, 255, 255);
      this.showBanner(
        `◆ 夺回 ${BOSS_NAMES[stolenKind]}专属强化 · 主动 + 被动同时选择`,
        2000
      );
      this.floatText(WORLD_WIDTH / 2, 340, "黑影强化核心已回收", true);
      this.burst(WORLD_WIDTH / 2, 340, 0xc16cff, 1.6);
      // 规矩:打完 boss 不掉强化。打跑黑影后一次性给回主动 + 被动,玩家一块选
      this.time.delayedCall(1200, () => {
        showTrinityCombinedChoice(this, [stolenKind], () => {
          onCollected?.();
        });
      });
      return;
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
    if (this.specOf(owner) === "wheelchair") {
      const isP2 = owner === 2;
      const ownerSprite = isP2 ? this.player2 : this.player;
      if (!ownerSprite?.active) return;
      const fortressActive = now < (isP2 ? this.wheelchairFortressUntil2 : this.wheelchairFortressUntil);
      const overdriveActive = now < (isP2 ? this.wheelchairOverdriveUntil2 : this.wheelchairOverdriveUntil);
      if (isP2) this.player2CollisionReadyAt = now + (fortressActive ? 145 : overdriveActive ? 163 : 230);
      else this.collisionReadyAt = now + (fortressActive ? 145 : overdriveActive ? 163 : 230);
      const isElite = Boolean(enemy.getData("elite"));
      const baseRamDamage = this.wheelchairRamDamage(owner) * (isElite ? 1.25 : 1);
      let ramDamage =
        type === "scout" && !isElite
          ? Math.max(baseRamDamage, enemy.getData("hp") ?? maxHp)
          : baseRamDamage;
      if (isP2) {
        this.damagePlayer2(
          isElite || type === "gunship" || type === "bomber"
            ? 24
            : type === "striker" || type === "suppressor" || type === "mine_layer"
              ? 18
              : 14,
          "collision",
          "minion"
        );
      } else {
        this.damagePlayer(
          isElite || type === "gunship" || type === "bomber"
            ? 24
            : type === "striker" || type === "suppressor" || type === "mine_layer"
              ? 18
              : 14,
          "collision",
          "minion"
        );
      }
      ramDamage += this.consumeWheelchairReactiveCharge(enemy.x, enemy.y, owner);
      const remainingHp = (enemy.getData("hp") ?? maxHp) - ramDamage;
      enemy.setData("hp", remainingHp);
      if (remainingHp <= 0) {
        enemy.setData("lastOwner", owner);
        enemy.setData("wheelchairRamKill", true);
        this.destroyEnemy(enemy, true);
      } else {
        // === 撞击流派专属:被碰飞(台球效果) ===
        // 敌人被高速碰走,沿撞击方向飞,撞到下个敌人造成等同 ramDamage
        const dx = enemy.x - ownerSprite.x;
        const dy = enemy.y - (ownerSprite.y - 20);
        const len = Math.hypot(dx, dy) || 1;
        const knockSpeed = fortressActive ? 1380 : 1080;
        const knockVx = (dx / len) * knockSpeed;
        const knockVy = (dy / len) * knockSpeed - 60; // 略微向上飘
        enemy.setVelocity(knockVx, knockVy);
        enemy.setData("wheelchairKnockedUntil", this.time.now + (fortressActive ? 1850 : 1400));
        enemy.setData("wheelchairKnockDamage", ramDamage);
        // 可用的边缘反弹次数
        enemy.setData("billiardBounceLeft", fortressActive ? 6 : 4);
        this.spawnKnockedFx(enemy, 0xffd54a, 0xffe5a3);
        enemy.setTint(0xffe5a3);
        this.floatText(enemy.x, enemy.y, `碾压 ${Math.round(ramDamage)}`, true);
      }
      this.impactBurst(enemy.x, enemy.y, 0xffbd3e);
      this.triggerRamShockwave(enemy.x, enemy.y, enemy, false, owner);
      return;
    }
    // === 吞噬流派专属:升级 ≥ 1 → 碰撞改为吞噬/咬伤 ===
    if (this.specOf(owner) === "devour") {
      const devourLevel = this.upgradesOf(owner).devour_swallow ?? 0;
      if (devourLevel > 0) {
        // 体积比较:敌人 vs 玩家
        const ownerSprite = owner === 2 ? this.player2 : this.player;
        if (!ownerSprite?.active) return;
        const playerSize = ownerSprite.displayWidth * ownerSprite.displayHeight;
        const enemySize = enemy.displayWidth * enemy.displayHeight;
        const ratio = enemySize / playerSize;
        const sizeThreshold =
          DEVOUR_SWALLOW_LEVELS[Math.min(devourLevel, DEVOUR_SWALLOW_LEVELS.length) - 1]
            .sizeThreshold;
        // 星渊巨口(吞噬融合技):吞噬范围 +25%
        const swallowThreshold =
          (this.upgradesOf(owner).devour_fusion ?? 0) > 0 ? sizeThreshold * 1.25 : sizeThreshold;
        if (ratio <= swallowThreshold) {
          // 体积 ≤ 阈值 → 吞噬
          if (owner === 1) this.collisionReadyAt = now + 200;
          else this.player2CollisionReadyAt = now + 200;
          this.devourEnemy(enemy, devourLevel, owner);
          this.burst(enemy.x, enemy.y, 0x9b18ff, 1.0);
          const sizeMul = owner === 2 ? this.devourSizeMul2 : this.devourSizeMul;
          this.floatText(enemy.x, enemy.y, `吞噬 +${(sizeMul * 100 - 100).toFixed(0)}%`, true);
          return;
        } else {
          // 体积 > 阈值 → 越级吞噬爆炸并承受额外生命反噬
          if (owner === 1) this.collisionReadyAt = now + 600;
          else this.player2CollisionReadyAt = now + 600;
          this.devourOversizedEnemy(enemy, owner);
          this.floatText(enemy.x, enemy.y, `越级吞噬 · 体积 ${(ratio * 100).toFixed(0)}%`, true);
          return;
        }
      }
    }
    if (type === "gunship" || type === "bomber") {
      const collisionDamage = maxHp * 0.25;
      enemy.setData("hp", Math.max(1, (enemy.getData("hp") ?? maxHp) - collisionDamage));
      // 重炮/轰炸机撞击伤害:按玩家最大生命 30% 计算,不再固定 24(HP>1000 由 damagePlayer 按设定结算)
      const collisionAmount = Math.max(10, Math.round(this.stats.maxHp * 0.3));
      if (owner === 1) this.damagePlayer(collisionAmount, "collision", "minion", enemy);
      else this.damagePlayer2(collisionAmount, "collision", "minion");
      this.floatText(enemy.x, enemy.y, `撞击 -25%`, true);
      enemy.setVelocityY(-180);
    } else {
      const rawCollisionDamage = Math.max(1, Math.ceil(enemy.getData("hp") ?? maxHp));
      // 撞击伤害上限:最多 30% 玩家最大生命(保底 10 点),高血量小兵不再一撞秒杀玩家
      const collisionDamage = Math.min(
        rawCollisionDamage,
        Math.max(10, Math.round(this.stats.maxHp * 0.3))
      );
      if (owner === 1) this.damagePlayer(collisionDamage, "collision", "minion", enemy);
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
    const wheelchairRam = this.specOf(owner) === "wheelchair";
    const fortressActive =
      wheelchairRam && now < (owner === 1 ? this.wheelchairFortressUntil : this.wheelchairFortressUntil2);
    // Boss 撞击伤害:按玩家最大生命 30% 计算,不再固定 38
    // (HP>1000 由 damagePlayer 按设定 8%~12.5% 结算;撞击流派走碰撞特殊算法)
    const bossCollisionAmount = Math.max(10, Math.round(this.stats.maxHp * 0.3));
    if (owner === 1) {
      this.collisionReadyAt = now + (fortressActive ? 165 : wheelchairRam ? 325 : 950);
      this.damagePlayer(bossCollisionAmount, "collision", "boss");
    } else {
      this.player2CollisionReadyAt = now + 950;
      this.damagePlayer2(bossCollisionAmount, "collision", "boss");
    }
    const hullAttackMultiplier = wheelchairRam ? this.wheelchairHullAttackMultiplier() : 1;
    const reactiveBonus = wheelchairRam
      ? this.consumeWheelchairReactiveCharge(part.x, part.y)
      : 0;
    // 非撞击流派碰到 Boss 不给 Boss 造成伤害:否则黑影/黑暗魔神主动冲锋撞向玩家时,
    // 每次命中都会"自伤"扣血(看起来像 Boss 自动掉血)。撞击流派的撞伤机制不受影响。
    const bossRamDamage = (wheelchairRam
      ? this.bossMaxHp * 0.03 * hullAttackMultiplier
      : 0) + reactiveBonus;
    let displayedDamage = bossRamDamage;
    if (part.getData("part") === "raid-core") {
      const raidDamage = (wheelchairRam
        ? (part.getData("maxHp") ?? this.bossMaxHp / 3) *
          0.03 *
          hullAttackMultiplier
        : 0) + reactiveBonus;
      displayedDamage = raidDamage;
      part.setData("collisionFinisher", wheelchairRam);
      this.damageBossPart(part, raidDamage);
    } else {
      part.setData("collisionFinisher", wheelchairRam);
      const phaseMultiplier = this.bossPhase === 1 ? 0.65 : 1.25;
      this.damageBossPart(part, bossRamDamage / phaseMultiplier);
    }
    this.checkBossPhase();
    if (this.bossHp <= 0 && this.trinityAlive <= 0) this.defeatBoss();
    if (displayedDamage > 0) {
      this.floatText(part.x, part.y + 35, `冲撞 ${Math.round(displayedDamage)}`, true);
      this.impactBurst(part.x, part.y, 0xffbd3e);
    }
    if (fortressActive) this.triggerRamShockwave(part.x, part.y, part, true);
  }

  wheelchairRamDamage(owner: 1 | 2 = 1): number {
    const ul = this.upgradesOf(owner);
    const cannonLevel = ul.cannon ?? 1;
    const ramMassLevel = ul.ram_mass ?? 0;
    const lanceLevel = this.doctrineLevels.lance_mastery ?? 0;
    const openingOneHitDamage = 39.5 * 2.1;
    return (
      Math.max(openingOneHitDamage, 18 + cannonLevel * 6) *
      (1 + ramMassLevel * 0.18) *
      (1 + lanceLevel * 0.18 * ATTACK_BONUS_SCALE) *
      this.currentDamageMultiplier(owner)
    );
  }

  wheelchairHullAttackMultiplier(owner: 1 | 2 = 1): number {
    if (this.specOf(owner) !== "wheelchair") return 1;
    const isP2 = owner === 2;
    const maxHp = isP2 ? this.player2MaxHp : this.stats.maxHp;
    const initial = isP2 ? this.wheelchairInitialMaxHp2 : this.wheelchairInitialMaxHp;
    return collisionHullAttackMultiplier(maxHp - initial);
  }

  triggerRamShockwave(
    x: number,
    y: number,
    primaryTarget?: Phaser.Physics.Arcade.Image,
    inheritedImpact = false,
    owner: 1 | 2 = 1
  ): void {
    const level = this.upgradesOf(owner).ram_shockwave ?? 0;
    if (level <= 0 || (!inheritedImpact && this.time.now < this.nextRamShockwave)) return;
    if (!inheritedImpact) {
      this.nextRamShockwave = this.time.now + Math.max(520, 1100 - level * 90);
    }
    const radius = (145 + (level - 1) * 18) * (inheritedImpact ? 0.82 : 1);
    const damage =
      this.wheelchairRamDamage(owner) *
      (0.24 + level * 0.06) *
      (inheritedImpact ? 0.72 : 1);
    const targets = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter(
        (enemy) =>
          enemy.active &&
          enemy !== primaryTarget &&
          Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius
      )
      .slice(0, 1 + Math.min(4, level));
    for (const target of targets) {
      target.setData("lastOwner", owner);
      this.dealDirectDamage(target, damage, target.x, target.y);
    }
    const wave = this.add
      .circle(x, y, 52, 0xff8a2d, 0.08)
      .setStrokeStyle(7, 0xffe5a3, 0.94)
      .setDepth(25);
    this.tweens.add({
      targets: wave,
      scale: radius / 38,
      rotation: Math.PI / 3,
      alpha: 0,
      duration: 340,
      onComplete: () => wave.destroy()
    });
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const plate = this.add.rectangle(
        x + Math.cos(angle) * 32,
        y + Math.sin(angle) * 32,
        28,
        8,
        index % 2 ? 0xffffff : 0xffbd3e,
        0.86
      ).setRotation(angle).setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: plate,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        scaleX: 0.18,
        alpha: 0,
        duration: 300 + index * 8,
        onComplete: () => plate.destroy()
      });
    }
  }

  // 撞击流派专属:被碰飞敌人拖尾(明显台球视觉)
  spawnKnockedFx(
    enemy: Phaser.Physics.Arcade.Image,
    coreColor: number,
    sparkColor: number
  ): void {
    // 先移除旧拖尾计时器:链式击飞(已击飞敌人再次被碰飞)会覆盖写新 trail,
    // 若不先 remove,旧计时器会继续按延长后的 wheelchairKnockedUntil 生成粒子,
    // 造成短暂双份粒子。
    (enemy.getData("wheelchairKnockTrail") as Phaser.Time.TimerEvent | undefined)?.remove();
    // 5 条短暂的速度线
    for (let i = 0; i < 5; i += 1) {
      const angle = (Math.PI * 2 * i) / 5;
      const line = this.add
        .rectangle(enemy.x, enemy.y, 6, 26, coreColor, 0.85)
        .setRotation(angle)
        .setDepth(20)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: line,
        x: enemy.x - Math.cos(angle) * 32,
        y: enemy.y - Math.sin(angle) * 32,
        alpha: 0,
        scale: 0.2,
        duration: 280,
        onComplete: () => line.destroy()
      });
    }
    // 持续拖尾粒子(80ms 一次)
    const trail = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        if (!enemy.active || this.time.now > (enemy.getData("wheelchairKnockedUntil") ?? 0)) {
          trail.remove();
          return;
        }
        // 留 3 颗不同大小的粒子
        for (let j = 0; j < 3; j += 1) {
          const r = 3 + Math.random() * 3;
          const spark = this.add
            .circle(enemy.x + Phaser.Math.Between(-6, 6), enemy.y + Phaser.Math.Between(-6, 6), r, sparkColor, 0.8)
            .setDepth(19)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: spark,
            scale: 0.3,
            alpha: 0,
            duration: 360,
            onComplete: () => spark.destroy()
          });
        }
      }
    });
    enemy.setData("wheelchairKnockTrail", trail);
  }

  // 每帧检测:被碰飞的敌人撞到其他敌人造成等同 ramDamage
  updateWheelchairKnocked(time: number): void {
    const knocked = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
      (e) => e.active && time < (e.getData("wheelchairKnockedUntil") ?? 0)
    );
    if (!knocked.length) return;
    for (const ball of knocked) {
      // === 撞到地图边缘反弹,继续当台球飞 ===
      const body = ball.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        const half = Math.max(ball.displayWidth, ball.displayHeight) * 0.5;
        let bounced = false;
        let vx = body.velocity.x;
        let vy = body.velocity.y;
        if (ball.x <= half && vx < 0) {
          ball.x = half;
          vx = -vx;
          bounced = true;
        } else if (ball.x >= WORLD_WIDTH - half && vx > 0) {
          ball.x = WORLD_WIDTH - half;
          vx = -vx;
          bounced = true;
        }
        if (ball.y <= half && vy < 0) {
          ball.y = half;
          vy = -vy;
          bounced = true;
        } else if (ball.y >= WORLD_HEIGHT - half && vy > 0) {
          ball.y = WORLD_HEIGHT - half;
          vy = -vy;
          bounced = true;
        }
        if (bounced) {
          const left = (ball.getData("billiardBounceLeft") as number) ?? 0;
          if (left > 0) {
            // 反弹保留 88% 速度,并延长寿命让它能撞到下一个目标
            ball.setVelocity(vx * 0.88, vy * 0.88);
            ball.setData("billiardBounceLeft", left - 1);
            ball.setData(
              "wheelchairKnockedUntil",
              Math.max((ball.getData("wheelchairKnockedUntil") as number) ?? 0, time + 700)
            );
            this.impactBurst(ball.x, ball.y, 0xffd54a);
            if (save.settings.screenShake) this.cameras.main.shake(90, 0.004);
          } else {
            // 反弹次数用尽,停止台球状态
            ball.setData("wheelchairKnockedUntil", 0);
            (ball.getData("wheelchairKnockTrail") as Phaser.Time.TimerEvent | undefined)?.remove();
            ball.setData("wheelchairKnockTrail", undefined);
            ball.setVelocity(0, 0);
            ball.clearTint();
            continue;
          }
        }
      }
      // 撞到其他敌人
      const hit = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (e) =>
          e !== ball &&
          e.active &&
          Phaser.Math.Distance.Between(ball.x, ball.y, e.x, e.y) < 28
      );
      if (hit) {
        const dmg = (ball.getData("wheelchairKnockDamage") as number) ?? 0;
        const before = hit.getData("hp") ?? 1;
        this.renderBilliardChainImpact(ball, hit);
        this.triggerRamShockwave(hit.x, hit.y, hit, true);
        hit.setData("lastOwner", 1);
        if (before - dmg <= 0) {
          hit.setData("wheelchairRamKill", true);
          this.destroyEnemy(hit, true);
          this.burst(hit.x, hit.y, 0xffd54a, 1.4);
          this.floatText(hit.x, hit.y, `弹碰 ${Math.round(dmg)}`, true);
        } else {
          hit.setData("hp", before - dmg);
          // 被弹碰的敌人也继承被碰飞效果(链式台球)
          const dx = hit.x - ball.x;
          const dy = hit.y - ball.y;
          const len = Math.hypot(dx, dy) || 1;
          hit.setVelocity((dx / len) * 800, (dy / len) * 800 - 40);
          hit.setData("wheelchairKnockedUntil", time + 1100);
          hit.setData("wheelchairKnockDamage", dmg * 0.85);
          hit.setData("billiardBounceLeft", 4);
          this.spawnKnockedFx(hit, 0xffd54a, 0xffe5a3);
          hit.setTint(0xffe5a3);
          this.floatText(hit.x, hit.y, `弹碰 ${Math.round(dmg)}`, true);
          this.impactBurst(hit.x, hit.y, 0xffd54a);
        }
        // 碰飞源消耗(被击打后停止飞)
        ball.setData("wheelchairKnockedUntil", 0);
        (ball.getData("wheelchairKnockTrail") as Phaser.Time.TimerEvent | undefined)?.remove();
        ball.setData("wheelchairKnockTrail", undefined);
        ball.setVelocity(0, 0);
        ball.setTint(0xff5450);
        continue;
      }
      // 撞到 boss:台球对 boss 完全无效,只是被弹开(不造成伤害)
      const partHit = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (p) =>
          p.active &&
          p.getData("part") === "core" &&
          Phaser.Math.Distance.Between(ball.x, ball.y, p.x, p.y) < 80
      );
      if (partHit) {
        const awayX = ball.x - partHit.x;
        const awayY = ball.y - partHit.y;
        const awayLen = Math.hypot(awayX, awayY) || 1;
        const left = (ball.getData("billiardBounceLeft") as number) ?? 0;
        if (left > 0) {
          ball.setVelocity((awayX / awayLen) * 700, (awayY / awayLen) * 700);
          ball.setData("billiardBounceLeft", left - 1);
        } else {
          ball.setData("wheelchairKnockedUntil", 0);
          (ball.getData("wheelchairKnockTrail") as Phaser.Time.TimerEvent | undefined)?.remove();
          ball.setData("wheelchairKnockTrail", undefined);
          ball.setVelocity(0, 0);
          ball.clearTint();
        }
      }
    }
  }

  renderDevourMaw(targetX: number, targetY: number, resisted = false): void {
    const vortex = this.add.ellipse(targetX, targetY, 150, 58, 0x18001f, 0.72)
      .setStrokeStyle(8, resisted ? 0xff5a3d : 0x9b18ff, 0.92)
      .setDepth(26)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: vortex,
      rotation: Math.PI,
      scaleX: resisted ? 1.35 : 0.12,
      scaleY: resisted ? 0.7 : 1.5,
      alpha: 0,
      duration: resisted ? 360 : 520,
      onComplete: () => vortex.destroy()
    });
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const radius = resisted ? 86 : 112;
      const tooth = this.add.rectangle(
        targetX + Math.cos(angle) * radius,
        targetY + Math.sin(angle) * radius * 0.48,
        24,
        7,
        index % 2 ? 0xd55cff : 0xffffff,
        0.94
      ).setRotation(angle).setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: tooth,
        x: resisted ? targetX + Math.cos(angle) * 54 : targetX,
        y: resisted ? targetY + Math.sin(angle) * 26 : targetY,
        scale: resisted ? 1.4 : 0.2,
        alpha: 0,
        duration: resisted ? 260 : 410,
        delay: index * 10,
        onComplete: () => tooth.destroy()
      });
    }
  }

  renderBilliardChainImpact(
    source: Phaser.Physics.Arcade.Image,
    target: Phaser.Physics.Arcade.Image
  ): void {
    const angle = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);
    const beamLength = Math.max(
      42,
      Phaser.Math.Distance.Between(source.x, source.y, target.x, target.y)
    );
    const collisionLine = this.add
      .rectangle(
        (source.x + target.x) / 2,
        (source.y + target.y) / 2,
        beamLength,
        10,
        0xffd45a,
        0.72
      )
      .setRotation(angle)
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD);
    const rack = this.add
      .circle(target.x, target.y, 62, 0xff7a22, 0.08)
      .setStrokeStyle(6, 0xfff3ba, 0.94)
      .setRotation(angle)
      .setDepth(26)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: collisionLine,
      scaleX: 1.3,
      scaleY: 0.15,
      alpha: 0,
      duration: 230,
      onComplete: () => collisionLine.destroy()
    });
    this.tweens.add({
      targets: rack,
      scale: 2.2,
      rotation: angle + Math.PI / 3,
      alpha: 0,
      duration: 390,
      ease: "Cubic.Out",
      onComplete: () => rack.destroy()
    });
    for (let index = 0; index < 10; index += 1) {
      const shardAngle = angle + Math.PI + Phaser.Math.FloatBetween(-1.1, 1.1);
      const shard = this.add
        .rectangle(target.x, target.y, 9, 19, index % 2 ? 0xffffff : 0xffa51f, 0.92)
        .setRotation(shardAngle + Math.PI / 4)
        .setDepth(27)
        .setBlendMode(Phaser.BlendModes.ADD);
      const distance = Phaser.Math.Between(70, 145);
      this.tweens.add({
        targets: shard,
        x: target.x + Math.cos(shardAngle) * distance,
        y: target.y + Math.sin(shardAngle) * distance,
        rotation: shardAngle + Phaser.Math.FloatBetween(-1.5, 1.5),
        scale: 0.2,
        alpha: 0,
        duration: 280 + index * 18,
        onComplete: () => shard.destroy()
      });
    }
  }

  // === 吞噬流派:吞噬小兵 ===
  devourEnemy(enemy: Phaser.Physics.Arcade.Image, mul: number, owner: 1 | 2 = 1): void {
    if (!enemy.active) return;
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    enemy.setData("lastOwner", owner);
    const swallowedEnemyMaxHp = Math.max(
      0,
      Number(enemy.getData("maxHp") ?? enemy.getData("hp") ?? 0)
    );
    const maxHp = isP2 ? this.player2MaxHp : this.stats.maxHp;
    const baseMaxHp = isP2 ? this.player2OriginalMaxHp : this.originalPlayerMaxHp;
    const hp = isP2 ? this.player2Hp : this.stats.hp;
    const extraMaxHp = Math.max(0, maxHp - baseMaxHp);
    const missingHp = Math.max(0, maxHp - hp);
    const devourHealing = devourHealingAmount(extraMaxHp, missingHp, swallowedEnemyMaxHp);
    // 吞噬视觉:敌人从大到小被吸入玩家
    const targetX = ownerSprite.x;
    const targetY = ownerSprite.y;
    this.renderDevourMaw(enemy.x, enemy.y);
    this.tweens.add({
      targets: enemy,
      x: targetX,
      y: targetY,
      scale: 0,
      alpha: 0,
      rotation: Math.PI * 2,
      duration: 360,
      ease: "Cubic.In",
      onComplete: () => {
        this.destroyEnemy(enemy, true);
      }
    });
    // 紫色吞噬光环
    this.burst(ownerSprite.x, ownerSprite.y, 0x9b18ff, 1.2);
    this.bigExplosion(enemy.x, enemy.y, 0x9b18ff, 0.4);
    this.impactBurst(enemy.x, enemy.y, 0xc16cff);
    const tier = DEVOUR_SWALLOW_LEVELS[Math.min(Math.max(1, mul), DEVOUR_SWALLOW_LEVELS.length) - 1];
    // Lv.1 上限为初始机体 200%；满级上限是 Lv.1 上限的 1.3 倍，即初始机体 260%。
    const sizeMul = isP2 ? this.devourSizeMul2 : this.devourSizeMul;
    const newSizeMul = Math.min(tier.maxSizeMultiplier, sizeMul + tier.sizeGain);
    if (isP2) this.devourSizeMul2 = newSizeMul;
    else this.devourSizeMul = newSizeMul;
    this.applyDevourSize(owner);
    const maxHpGain = tier.maxHealthGain;
    if (isP2) {
      this.player2MaxHp += maxHpGain;
      this.devourBonusMaxHp2 += maxHpGain;
      const hpBeforeHealing = this.player2Hp;
      this.healPlayer2(devourHealing);
      const actualHealing = Math.max(0, this.player2Hp - hpBeforeHealing);
      this.floatText(
        ownerSprite.x,
        ownerSprite.y - 50,
        `MAX +${maxHpGain} · 回复 ${formatRoundedNumberForDisplay(actualHealing)} · 体型 ×${this.devourSizeMul2.toFixed(2)}`,
        true
      );
      this.devourKillCount2 += 1;
      if (this.devourKillCount2 >= 10) {
        this.devourKillCount2 = 0;
        this.activateDevourAura(2);
      }
      if (this.time.now > this.devourSizeLossNextAt2) {
        this.devourSizeLossNextAt2 = this.time.now + 8000;
      }
    } else {
      this.stats.maxHp += maxHpGain;
      this.devourBonusMaxHp += maxHpGain;
      const hpBeforeHealing = this.stats.hp;
      this.healPlayer(devourHealing);
      const actualHealing = Math.max(0, this.stats.hp - hpBeforeHealing);
      this.recordAgileMaxHpGain(maxHpGain);
      this.floatText(
        this.player.x,
        this.player.y - 50,
        `MAX +${maxHpGain} · 回复 ${formatRoundedNumberForDisplay(actualHealing)} · 体型 ×${this.devourSizeMul.toFixed(2)}`,
        true
      );
      // 累计吞噬计数 — 每 10 触发全屏吞噬光环
      this.devourKillCount += 1;
      if (this.devourKillCount >= 10) {
        this.devourKillCount = 0;
        this.activateDevourAura();
      }
      // 慢速回归(防止无限膨胀):每 8 秒掉 0.05 倍,直到回到 1.0
      if (this.time.now > this.devourSizeLossNextAt) {
        this.devourSizeLossNextAt = this.time.now + 8000;
      }
    }
  }

  // 吞噬流派累计 10 杀 → 全屏深渊光环
  activateDevourAura(owner: 1 | 2 = 1): void {
    const level = this.upgradesOf(owner).devour_swallow ?? 1;
    const dmgMul = 0.4 + level * 0.08;     // Lv1 0.48 / Lv2 0.56 / Lv3 0.64 / Lv4 0.72 / Lv5 0.80
    const duration = 1200 + level * 200;   // 1.4s/1.6s/1.8s/2.0s/2.2s
    const ownerSprite = owner === 2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    // 星渊巨口(吞噬融合技):吞噬 10 连触发黑洞,吸附并持续吞噬
    const fusionLevel = this.upgradesOf(owner).devour_fusion ?? 0;
    if (fusionLevel > 0) {
      this.devourMawUntil[owner] = this.time.now + 2500;
      this.showBanner(
        owner === 2 ? "P2 ◉ 星渊巨口 · 黑洞开启 2.5s" : "◉ 星渊巨口 · 黑洞开启 2.5s",
        1200
      );
    }
    this.showBanner(owner === 2 ? "P2 ◆ 深渊吞噬 · 10 连" : "◆ 深渊吞噬 · 10 连", 1200);
    this.cameras.main.flash(120, 80, 0, 130);
    if (save.settings.screenShake) this.cameras.main.shake(360, 0.018);
    // 华丽特效:深紫漩涡爆发
    this.triggerSpecialtyFX(0x4a0070, {
      ring: 0x9b00d0,
      style: "vortex",
      flash: [220, 0, 130, 80],
      shake: 320,
      count: 60,
    });
    for (let index = 0; index < 4; index += 1) {
      const spiral = this.add.ellipse(
        ownerSprite.x,
        ownerSprite.y,
        180 + index * 85,
        55 + index * 24,
        0x09000f,
        0.18
      ).setStrokeStyle(8 - index, index % 2 ? 0xc16cff : 0x6a0a9f, 0.8)
        .setDepth(62)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spiral,
        rotation: (index % 2 ? -1 : 1) * Math.PI * 2,
        scaleX: 0.08,
        scaleY: 2.8,
        alpha: 0,
        duration: duration * (0.7 + index * 0.08),
        onComplete: () => spiral.destroy()
      });
    }
    // 全屏暗紫光罩
    const aura = this.add
      .rectangle(0, 0, WORLD_WIDTH * 2, WORLD_HEIGHT * 2, 0x4a0070, 0.55)
      .setOrigin(0, 0)
      .setDepth(60)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tweens.add({
      targets: aura,
      alpha: { from: 0.55, to: 0 },
      duration,
      onComplete: () => aura.destroy()
    });
    // 圆形冲击波
    const wave = this.add
      .circle(ownerSprite.x, ownerSprite.y, 100, 0x9b18ff, 0)
      .setStrokeStyle(20, 0xc16cff, 0.85)
      .setDepth(61);
    this.tweens.add({
      targets: wave,
      radius: Math.max(WORLD_WIDTH, WORLD_HEIGHT) * 1.4,
      alpha: 0,
      duration,
      ease: "Cubic.Out",
      onComplete: () => wave.destroy()
    });
    // 立刻全屏伤害(100% 玩家伤害) + 击退
    const baseDmg = this.computePlayerDamage(owner) * 1.6;
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      enemy.setData("lastOwner", owner);
      const before = enemy.getData("hp") ?? 1;
      const dmg = baseDmg * dmgMul;
      if (before - dmg <= 0) {
        enemy.setData("wheelchairRamKill", true);
        this.destroyEnemy(enemy, true);
      } else {
        enemy.setData("hp", before - dmg);
      }
      // 击退(向屏外)
      const dx = enemy.x - ownerSprite.x;
      const dy = enemy.y - ownerSprite.y;
      const len = Math.hypot(dx, dy) || 1;
      enemy.setVelocity((dx / len) * 720, (dy / len) * 720);
    }
    // 首领核心伤害
    for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (part.active && part.getData("part") === "core") {
        this.damageBossPart(part, baseDmg * dmgMul * 0.6);
      }
    }
    // 清掉场景内所有敌弹
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        bullet.disableBody(true, true);
        this.burst(bullet.x, bullet.y, 0x9b18ff, 0.6);
      }
      return true;
    });
    // 紫色中心大爆(以触发者位置为准,P2 触发时不再出现在 P1 处)
    this.bigExplosion(ownerSprite.x, ownerSprite.y, 0x9b18ff, 1.4);
  }

  // 应用吞噬体积到玩家 sprite
  applyDevourSize(owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    const baseW = 98 * SPECIALIZATIONS[this.specOf(owner)].scale;
    const baseH = 98 * SPECIALIZATIONS[this.specOf(owner)].scale;
    const sizeMul = isP2 ? this.devourSizeMul2 : this.devourSizeMul;
    const w = baseW * sizeMul;
    const h = baseH * sizeMul;
    ownerSprite.setDisplaySize(w, h);
    // 同步物理 body 大小
    if (ownerSprite.body) {
      // 用 displayWidth/Height(缩放后的显示尺寸)设置 body,与视觉体型联动;
      // 之前用未缩放的源纹理 width/height,首次吞噬后 hitbox 突变且不再随体型变化。
      (ownerSprite.body as Phaser.Physics.Arcade.Body).setSize(
        ownerSprite.displayWidth * 0.6,
        ownerSprite.displayHeight * 0.7,
        true
      );
    }
  }

  // 缓慢回归基础体型(每 8 秒降 0.05 倍,直到 1.0)
  updateDevourSizeDecay(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const sizeMul = isP2 ? this.devourSizeMul2 : this.devourSizeMul;
    const lossNextAt = isP2 ? this.devourSizeLossNextAt2 : this.devourSizeLossNextAt;
    if (sizeMul > 1.01 && time > lossNextAt) {
      if (isP2) this.devourSizeMul2 = Math.max(1.0, sizeMul - 0.05);
      else this.devourSizeMul = Math.max(1.0, sizeMul - 0.05);
      this.applyDevourSize(owner);
      if (isP2) this.devourSizeLossNextAt2 = time + 8000;
      else this.devourSizeLossNextAt = time + 8000;
    }
  }

  renderThornCounter(source: Phaser.Physics.Arcade.Image, lethal: boolean, owner: 1 | 2 = 1): void {
    const ownerSprite = owner === 2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    const barrier = this.add.circle(
      ownerSprite.x,
      ownerSprite.y,
      ownerSprite.displayWidth * 0.76,
      0x43106d,
      0.08
    ).setStrokeStyle(lethal ? 6 : 3, lethal ? 0xff7de3 : 0xc16cff, 0.86)
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: barrier,
      rotation: lethal ? Math.PI : Math.PI / 3,
      scale: lethal ? 1.9 : 1.35,
      alpha: 0,
      duration: lethal ? 620 : 360,
      onComplete: () => barrier.destroy()
    });
    const angle = Phaser.Math.Angle.Between(ownerSprite.x, ownerSprite.y, source.x, source.y);
    for (let index = -2; index <= 2; index += 1) {
      const spread = angle + index * 0.1;
      const thorn = this.add.rectangle(
        ownerSprite.x,
        ownerSprite.y,
        42,
        8,
        index === 0 ? 0xffffff : 0x9b5cff,
        0.92
      ).setRotation(spread).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: thorn,
        x: source.x + Math.cos(spread) * index * 7,
        y: source.y + Math.sin(spread) * index * 7,
        scaleX: lethal ? 1.8 : 1.2,
        alpha: 0,
        duration: 220 + Math.abs(index) * 35,
        onComplete: () => thorn.destroy()
      });
    }
  }

  devourOversizedEnemy(enemy: Phaser.Physics.Arcade.Image, owner: 1 | 2 = 1): void {
    if (!enemy.active) return;
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    const x = enemy.x;
    const y = enemy.y;
    const bonusBefore = Math.max(0, isP2 ? this.devourBonusMaxHp2 : this.devourBonusMaxHp);
    const explosionDamage = bonusBefore * 2;
    const maxHp = isP2 ? this.player2MaxHp : this.stats.maxHp;
    const hp = isP2 ? this.player2Hp : this.stats.hp;
    const missingBefore = Math.max(0, maxHp - hp);
    const emergencyHeal = missingBefore * 0.05;
    const lostBonus = bonusBefore * 0.5;
    enemy.setData("lastOwner", owner);
    this.renderDevourMaw(x, y);
    this.destroyEnemy(enemy, true);
    if (isP2) {
      this.devourBonusMaxHp2 = Math.max(0, bonusBefore - lostBonus);
      this.player2MaxHp = Math.max(this.player2OriginalMaxHp, this.player2MaxHp - lostBonus);
      this.player2Hp = roundHealth(Math.min(this.player2MaxHp, this.player2Hp), this.player2MaxHp);
      this.healPlayer2(emergencyHeal, "越级吞噬急救");
    } else {
      this.devourBonusMaxHp = Math.max(0, bonusBefore - lostBonus);
      this.stats.maxHp = Math.max(this.originalPlayerMaxHp, this.stats.maxHp - lostBonus);
      this.stats.hp = roundHealth(Math.min(this.stats.maxHp, this.stats.hp), this.stats.maxHp);
      this.healPlayer(emergencyHeal, "越级吞噬急救");
    }
    if (explosionDamage > 0) {
      for (const target of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (
          target.active &&
          Phaser.Math.Distance.Between(x, y, target.x, target.y) <= 260
        ) {
          this.dealDirectDamage(target, explosionDamage, target.x, target.y, true, owner);
        }
      }
      for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (
          part.active &&
          ["core", "raid-core"].includes(part.getData("part")) &&
          Phaser.Math.Distance.Between(x, y, part.x, part.y) <= 320
        ) {
          this.damageBossPart(part, explosionDamage);
        }
      }
    }
    this.bigExplosion(x, y, 0xd91cff, 1.7);
    this.triggerSpecialtyFX(0x7a0db5, {
      ring: 0xff4dbb,
      style: "vortex",
      shake: 300,
      count: save.settings.quality === "high" ? 34 : 18
    });
    if (ownerSprite?.active) {
      this.floatText(
        ownerSprite.x,
        ownerSprite.y - 68,
        `爆炸 ${Math.round(explosionDamage)} · 额外生命 -${lostBonus.toFixed(1)}`,
        true
      );
    }
  }

  // === 防御流派:荆棘护甲 — 受击时反伤给攻击者 ===
  applyThorns(
    damageAmount: number,
    source: Phaser.Physics.Arcade.Image | null,
    owner: 1 | 2 = 1
  ): void {
    if (this.specOf(owner) !== "defender") return;
    if ((this.upgradesOf(owner).defender_thorns ?? 0) <= 0) return;
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    const receivedDamage = Math.max(0, damageAmount);
    const targetMaxHp = source?.active
      ? ((source.getData("maxHp") as number) ?? (source.getData("hp") as number) ?? 0)
      : 0;
    // 荆棘星垒(防御融合技):反伤提高 50%+15%/级,累计 400 反伤触发星垒 AOE
    const fusionLevel = this.upgradesOf(owner).defender_fusion ?? 0;
    const reflectMul = fusionLevel > 0 ? 1.5 + fusionLevel * 0.15 : 1;
    const reflect = Math.max(
      1,
      Math.round((receivedDamage * 3 + targetMaxHp * 0.015) * reflectMul)
    );
    if (isP2) this.thornsAccumulator2 += reflect;
    else this.thornsAccumulator += reflect;
    if (fusionLevel > 0) {
      this.thornStarGauge[owner] += reflect;
      if (this.thornStarGauge[owner] >= 400) {
        this.thornStarGauge[owner] = 0;
        this.thornStarUntil[owner] = this.time.now + 2500;
        this.showBanner(
          isP2 ? "P2 ✦ 荆棘星垒 · 反伤 AOE 2.5s" : "✦ 荆棘星垒 · 反伤 AOE 2.5s",
          1000
        );
        this.cameras.main.flash(90, 90, 255, 110);
        if (save.settings.screenShake) this.cameras.main.shake(260, 0.014);
      }
    }
    if (owner === 1) this.healPlayer(reflect * 0.5, "荆棘回流");
    else this.healPlayer2(reflect * 0.5, "荆棘回流");
    if (source && source.active) {
      source.setData("lastOwner", owner);
      const before = source.getData("hp") ?? 1;
      this.renderThornCounter(source, before - reflect <= 0, owner);
      if (before - reflect <= 0) {
        // 反死:回 2% 最大生命 + 1.2% 最大生命上限
        const maxHp = this.maxHpOf(owner);
        const hpHeal = maxHp * 0.02;
        const maxHpGain = Math.round(maxHp * 0.012);
        if (isP2) {
          this.player2MaxHp += maxHpGain;
          this.player2Hp = roundHealth(Math.min(this.player2MaxHp, this.player2Hp + hpHeal), this.player2MaxHp);
        } else {
          this.stats.maxHp += maxHpGain;
          this.stats.hp = roundHealth(Math.min(this.stats.maxHp, this.stats.hp + hpHeal), this.stats.maxHp);
          this.recordAgileMaxHpGain(maxHpGain);
        }
        this.floatText(
          ownerSprite.x,
          ownerSprite.y - 50,
          `反死 +${maxHpGain} MAX · +${Math.round(hpHeal)} HP`,
          true
        );
        this.burst(source.x, source.y, 0x9b5cff, 0.8);
        // 华丽特效:深紫反死爆发
        this.triggerSpecialtyFX(0x6a0a3a, {
          ring: 0x9b5cff,
          style: "thorns",
          flash: [140, 60, 30, 100],
          shake: 160,
          count: 28,
        });
        this.destroyEnemy(source, true);
      } else {
        source.setData("hp", before - reflect);
        this.burst(source.x, source.y, 0xc16cff, 0.5);
      }
      this.floatText(source.x, source.y, `反伤 ${reflect} · 回流 ${Math.round(reflect * 0.5)}`, true);
    }
    // 累计 1000 触发回血(5% maxHp + 5% 已损);荆棘星垒(defender_fusion)使共鸣阈值减半为 500
    const resonanceThreshold = fusionLevel > 0 ? 500 : 1000;
    if ((isP2 ? this.thornsAccumulator2 : this.thornsAccumulator) >= resonanceThreshold) {
      const maxHp = this.maxHpOf(owner);
      const hp = this.hpOf(owner);
      if (isP2) {
        this.thornsAccumulator2 -= resonanceThreshold;
        this.player2Hp = roundHealth(
          Math.min(maxHp, hp + maxHp * 0.05 + Math.max(0, maxHp - hp) * 0.05),
          maxHp
        );
      } else {
        this.thornsAccumulator -= resonanceThreshold;
        this.stats.hp = roundHealth(
          Math.min(maxHp, hp + maxHp * 0.05 + Math.max(0, maxHp - hp) * 0.05),
          maxHp
        );
      }
      this.showBanner(isP2 ? `P2 ◆ 荆棘共鸣 · 累计反伤 ${resonanceThreshold}` : `◆ 荆棘共鸣 · 累计反伤 ${resonanceThreshold}`, 800);
      // 华丽特效:深紫荆棘爆发
      this.triggerSpecialtyFX(0x9b5cff, {
        ring: 0x6a0a3a,
        style: "thorns",
        flash: [180, 100, 30, 80],
        shake: 280,
        count: 50,
      });
    }
  }

  // === 吸血流派:虹吸链(链子命中敌方后锚定,把敌人加入吸血池) ===
  applySiphon(enemy: Phaser.Physics.Arcade.Image, owner: 1 | 2 = 1): void {
    if (this.specOf(owner) !== "vampire") return;
    if ((this.upgradesOf(owner).vampire_siphon ?? 0) <= 0) return;
    if (!enemy.active) return;
    const found = this.siphonedEnemies.findIndex((s) => s.enemy === enemy && s.owner === owner);
    if (found >= 0) {
      this.siphonedEnemies[found].until = this.time.now + 8000;
    } else {
      this.siphonedEnemies.push({ enemy, until: this.time.now + 8000, owner });
      this.burst(enemy.x, enemy.y, 0xff3d7f, 0.6);
    }
  }

  damageSiphonTarget(target: Phaser.Physics.Arcade.Image, damage: number, owner: 1 | 2 = 1): void {
    if (!target.active || damage <= 0) return;
    target.setData("lastOwner", owner);
    if (this.bossParts.contains(target)) {
      this.damageBossPart(target, damage);
      return;
    }
    const before = (target.getData("hp") as number) ?? 1;
    if (before - damage <= 0) {
      target.setData("wheelchairRamKill", true);
      this.destroyEnemy(target, true);
    } else {
      target.setData("hp", before - damage);
    }
  }

  clearSiphonChains(): void {
    this.siphonChains.forEach((chain) => chain.visual?.destroy());
    this.siphonChains = [];
  }

  removeSiphonChain(index: number): void {
    this.siphonChains[index]?.visual?.destroy();
    this.siphonChains.splice(index, 1);
  }

  // 单条虹吸链(子弹命中同帧触发,每个单位最多 1 条,链长 100px,有实体)
  spawnSiphonChain(enemy: Phaser.Physics.Arcade.Image, owner: 1 | 2 = 1): void {
    if (this.specOf(owner) !== "vampire") return;
    if ((this.upgradesOf(owner).vampire_siphon ?? 0) <= 0) return;
    if (this.time.now < this.siphonChainsCooldownUntil) return;
    if (this.siphonChains.length >= 8) return;
    if (!enemy.active) return;
    const ownerSprite = owner === 2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    // 该敌人是否已经有链子(锚定中或链头 24px 内)
    const alreadyChained = this.siphonChains.some(
      (c) =>
        c.anchor === enemy ||
        (!c.anchor && Phaser.Math.Distance.Between(c.hx, c.hy, enemy.x, enemy.y) < 24)
    );
    if (alreadyChained) return;
    // 链子从归属玩家向敌人方向延伸,起点 = 归属玩家,锚定 = 敌人
    const dx = enemy.x - ownerSprite.x;
    const dy = enemy.y - (ownerSprite.y - 10);
    const dist = Math.hypot(dx, dy) || 1;
    const maxLength = Math.min(1100, dist);
    const visual = this.add
      .image(ownerSprite.x, ownerSprite.y, "siphonChainFx")
      .setOrigin(0.5)
      .setDepth(13)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setAlpha(0.82);
    this.siphonChains.push({
      sx: ownerSprite.x,
      sy: ownerSprite.y - 10,
      hx: ownerSprite.x + (dx / dist) * maxLength,
      hy: ownerSprite.y - 10 + (dy / dist) * maxLength,
      length: maxLength,
      maxLength,
      life: 8000,
      maxLife: 8000,
      anchor: enemy,
      angle: Math.atan2(dy, dx),
      visual,
      owner
    });
    // 锚定瞬间扣 50% 归属玩家伤害
    const dmg = this.computePlayerDamage(owner) * 0.5;
    this.damageSiphonTarget(enemy, dmg, owner);
    this.burst(enemy.x, enemy.y, 0xff3d7f, 0.8);
    this.applySiphon(enemy, owner);
    this.siphonChainsCooldownUntil = this.time.now + 200;
  }

  // 吸血流派:子弹命中同帧触发,生成虹吸链(最多 8 条同时存在)

  // 每帧更新链子:飞行 / 锚定 + 路径碰撞(扣血但不入吸血池)
  updateSiphon(time: number, dt: number): void {
    // 双人:任一玩家为吸血且升级过虹吸才维持链子系统
    const activeVampireOwners = ([1, 2] as const).filter(
      (o) =>
        this.specOf(o) === "vampire" &&
        (this.upgradesOf(o).vampire_siphon ?? 0) > 0 &&
        (o === 1 ? this.player.active : Boolean(this.player2?.active))
    );
    if (activeVampireOwners.length === 0) {
      this.siphonedEnemies = [];
      this.clearSiphonChains();
      return;
    }
    const spriteOf = (owner: 1 | 2): Phaser.Physics.Arcade.Image =>
      owner === 2 ? this.player2! : this.player;
    for (let i = this.siphonChains.length - 1; i >= 0; i -= 1) {
      const c = this.siphonChains[i];
      c.life -= dt * 1000;
      if (c.life <= 0) {
        this.removeSiphonChain(i);
        continue;
      }
      const ownerSprite = spriteOf(c.owner);
      if (c.anchor) {
        if (!c.anchor.active) {
          this.removeSiphonChain(i);
          continue;
        }
        // 链头 = 锚定敌人当前位置
        c.hx = c.anchor.x;
        c.hy = c.anchor.y;
        // 链尾 = 归属玩家当前位置(每帧同步)
        c.sx = ownerSprite.x;
        c.sy = ownerSprite.y - 10;
        // 链长 = 实际距离(> maxLength 时压缩到上限)
        const realDist = Phaser.Math.Distance.Between(c.sx, c.sy, c.hx, c.hy);
        if (realDist > c.maxLength) {
          // 距离过远 → 链子拉到最大长度,角度指向敌人
          const ux = (c.hx - c.sx) / realDist;
          const uy = (c.hy - c.sy) / realDist;
          c.hx = c.sx + ux * c.maxLength;
          c.hy = c.sy + uy * c.maxLength;
          c.length = c.maxLength;
        } else {
          c.length = realDist;
        }
      }
      // === 链子实体碰撞:链子经过的每个敌人(非锚定)都扣 30% 归属玩家伤害(不入吸血池) ===
      const chainHit = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (e) =>
          e.active &&
          e !== c.anchor &&
          // 距离链段 ≤ 18px 视为被链子"扫"到
          distancePointToSegment(e.x, e.y, c.sx, c.sy, c.hx, c.hy) < 22
      );
      if (chainHit) {
        // 0.5s 内部冷却,防止持续扣血
        const last = (chainHit.getData("siphonSweepLast") as number) ?? 0;
        if (time - last >= 500) {
          chainHit.setData("siphonSweepLast", time);
          const dmg = this.computePlayerDamage(c.owner) * 0.3;
          this.damageSiphonTarget(chainHit, dmg, c.owner);
          this.floatText(chainHit.x, chainHit.y - 12, `扫 ${Math.round(dmg)}`, true);
        }
      }
      // === 血星网络(吸血融合技):每 0.5s 链头向最近 2 个敌人分支电弧,伤害并吸血 ===
      const vampFusion = this.upgradesOf(c.owner).vampire_fusion ?? 0;
      if (vampFusion > 0 && c.anchor && time >= this.vampireNetworkFxAt[c.owner]) {
        this.vampireNetworkFxAt[c.owner] = time + 500;
        const nearest = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[])
          .filter((e) => e.active && e !== c.anchor)
          .map((e) => ({
            e,
            d: Phaser.Math.Distance.Between(c.hx, c.hy, e.x, e.y)
          }))
          .filter((item) => item.d < 320)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        for (const item of nearest) {
          const maxHp = Number(item.e.getData("maxHp")) || 1;
          const dmg = Math.max(1, Math.round(maxHp * (0.005 + vampFusion * 0.001)));
          item.e.setData("lastOwner", c.owner);
          this.dealDirectDamage(item.e, dmg, item.e.x, item.e.y, false, c.owner);
          const arcLine = this.add
            .line(0, 0, c.hx, c.hy, item.e.x, item.e.y, 0xff2d6f, 0.9)
            .setLineWidth(2.5)
            .setDepth(20);
          this.tweens.add({
            targets: arcLine,
            alpha: 0,
            duration: 180,
            onComplete: () => arcLine.destroy()
          });
          if (c.owner === 1) this.healPlayer(dmg * 0.2, "血星网络");
          else this.healPlayer2(dmg * 0.2, "血星网络");
        }
      }
      // 画链子(从归属玩家起点到链头)
      this.drawSiphonChain(
        c.sx,
        c.sy,
        c.hx,
        c.hy,
        c.life / c.maxLife,
        c.visual
      );
    }
    // 吸血池:每 0.3s 一次回血
    for (let i = this.siphonedEnemies.length - 1; i >= 0; i -= 1) {
      const s = this.siphonedEnemies[i];
      if (!s.enemy.active || time > s.until) {
        this.siphonedEnemies.splice(i, 1);
        continue;
      }
    }
    if (this.siphonedEnemies.length === 0) return;
    const count = this.siphonedEnemies.length;
    const ratio = Math.min(1.2, 0.8 + (count - 1) * 0.05);
    const baseHealRatio = 0.012;
    const healRatio = baseHealRatio * ratio;
    if (time < this.nextSiphonHealAt) return;
    this.nextSiphonHealAt = time + 300;
    for (const s of this.siphonedEnemies) {
      const ownerSprite = spriteOf(s.owner);
      const missing = Math.max(0, this.maxHpOf(s.owner) - this.hpOf(s.owner));
      if (missing > 0) {
        // 血星网络(吸血融合技):链子吸血提高 15%
        const vampFusionMul =
          (this.upgradesOf(s.owner).vampire_fusion ?? 0) > 0 ? 1.15 : 1;
        if (s.owner === 1) this.healPlayer(missing * healRatio * vampFusionMul);
        else this.healPlayer2(missing * healRatio * vampFusionMul);
      }
      if ((this.upgradesOf(s.owner).vampire_siphon ?? 0) >= 5 && s.enemy.active) {
        const targetMaxHp =
          (s.enemy.getData("maxHp") as number) ??
          (this.bossParts.contains(s.enemy) ? this.bossMaxHp : 1);
        const maxHealthDamage = Math.max(1, targetMaxHp * 0.01);
        this.damageSiphonTarget(s.enemy, maxHealthDamage, s.owner);
        if (save.settings.damageNumbers) {
          this.floatText(
            s.enemy.x,
            s.enemy.y - 18,
            `虹吸 ${Math.round(maxHealthDamage)}`,
            true
          );
        }
      }
      // 紫红脉动环 + 能量粒子(动态被吸视觉)
      if (count >= 4 && time >= this.nextSiphonGroupFxAt) {
        this.nextSiphonGroupFxAt = time + 900;
        const groupRing = this.add
          .circle(ownerSprite.x, ownerSprite.y, 36, 0xff3d7f, 0.06)
          .setStrokeStyle(4, 0xffaaff, 0.72)
          .setDepth(14);
        this.tweens.add({
          targets: groupRing,
          radius: 86,
          alpha: 0,
          duration: 520,
          onComplete: () => groupRing.destroy()
        });
      }
      const ring = this.add
        .circle(s.enemy.x, s.enemy.y, 16, 0xff3d7f, 0.45)
        .setStrokeStyle(2, 0xffaaff, 0.85)
        .setDepth(14)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ring,
        radius: 38,
        alpha: 0,
        duration: 480,
        onComplete: () => ring.destroy()
      });
      // 向上飘的能量粒子
      for (let p = 0; p < 2; p += 1) {
        const particle = this.add
          .circle(s.enemy.x + Phaser.Math.Between(-8, 8), s.enemy.y + 10, 2.5, 0xffaaff, 0.9)
          .setDepth(14)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: particle,
          x: s.enemy.x + Phaser.Math.Between(-6, 6),
          y: ownerSprite.y - 20,
          alpha: 0,
          scale: 0.4,
          duration: 600,
          onComplete: () => particle.destroy()
        });
      }
    }
  }

  // 画虹吸链:复用单张生成纹理，只更新位置/旋转/拉伸，不再每帧创建 Graphics。
  drawSiphonChain(
    x1: number, y1: number,
    x2: number, y2: number,
    alpha = 1,
    visual?: Phaser.GameObjects.Image
  ): void {
    if (!visual?.active) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const total = Math.hypot(dx, dy) || 1;
    const pulse = 1 + Math.sin(this.time.now * 0.018 + total * 0.01) * 0.08;
    visual
      .setFrame(Math.floor(this.time.now / 95) % 4)
      .setPosition((x1 + x2) / 2, (y1 + y2) / 2)
      .setRotation(Math.atan2(dy, dx))
      .setDisplaySize(total, 22 * pulse)
      .setAlpha(Phaser.Math.Clamp(alpha * (0.68 + pulse * 0.12), 0, 0.86));
  }

  // === 融合技形态(六流派融合:金龙炼狱/荆棘星垒/血星网络/星渊巨口/天体碰撞/万象影袭) ===
  updateFusions(time: number, owner: 1 | 2): void {
    this.updateThornStar(time, owner);
    this.updateDevourMaw(time, owner);
    this.updateCelestial(time, owner);
  }

  // 荆棘星垒(防御):每累计 400 反伤触发 2.5s,期间反伤 AOE
  updateThornStar(time: number, owner: 1 | 2): void {
    const fusionLevel = this.upgradesOf(owner).defender_fusion ?? 0;
    if (fusionLevel <= 0) return;
    const isP2 = owner === 2;
    const sprite = isP2 ? this.player2 : this.player;
    const until = this.thornStarUntil[owner];
    if (until > 0 && time >= until) {
      this.thornStarUntil[owner] = 0;
      this.thornStarVisual[owner]?.destroy();
      this.thornStarVisual[owner] = undefined;
      return;
    }
    if (until <= 0 || !sprite?.active) return;
    if (!this.thornStarVisual[owner]?.active) {
      const ring = this.add
        .circle(0, 0, 150, 0x000000, 0.14)
        .setStrokeStyle(6, 0x43ff9a, 0.9);
      const spikes: Phaser.GameObjects.Triangle[] = [];
      for (let i = 0; i < 8; i++) {
        spikes.push(
          this.add
            .triangle(0, 0, 0, -150, -13, -132, 13, -132, 0x43ff9a, 0.9)
            .setRotation((Math.PI * 2 * i) / 8)
        );
      }
      this.thornStarVisual[owner] = this.add
        .container(sprite.x, sprite.y, [ring, ...spikes])
        .setDepth(46);
    }
    const visual = this.thornStarVisual[owner]!;
    visual.setPosition(sprite.x, sprite.y);
    visual.rotation += 0.045;
    if (time >= this.thornStarAoeAt[owner]) {
      this.thornStarAoeAt[owner] = time + 250;
      for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (!enemy.active) continue;
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y) > 220) continue;
        const maxHp = Number(enemy.getData("maxHp")) || 1;
        const dmg = Math.max(1, Math.round(maxHp * (0.02 + fusionLevel * 0.005)));
        enemy.setData("lastOwner", owner);
        this.dealDirectDamage(enemy, dmg, enemy.x, enemy.y, false, owner);
        this.burst(enemy.x, enemy.y, 0x43ff9a, 0.4);
      }
    }
  }

  // 星渊巨口(吞噬):黑洞吸附 + 持续伤害 + 吸入吞噬
  updateDevourMaw(time: number, owner: 1 | 2): void {
    const fusionLevel = this.upgradesOf(owner).devour_fusion ?? 0;
    if (fusionLevel <= 0) return;
    const isP2 = owner === 2;
    const sprite = isP2 ? this.player2 : this.player;
    const until = this.devourMawUntil[owner];
    if (until > 0 && time >= until) {
      this.devourMawUntil[owner] = 0;
      this.devourMawVisual[owner]?.destroy();
      this.devourMawVisual[owner] = undefined;
      return;
    }
    if (until <= 0 || !sprite?.active) return;
    if (!this.devourMawVisual[owner]?.active) {
      this.devourMawVisual[owner] = this.add
        .circle(sprite.x, sprite.y, 120, 0x0a0018, 0.62)
        .setStrokeStyle(10, 0x9b18ff, 0.9)
        .setDepth(48)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    const visual = this.devourMawVisual[owner]!;
    visual.setPosition(sprite.x, sprite.y);
    visual.setScale(1 + Math.sin(time * 0.02) * 0.08);
    if (time >= this.nextDevourMawTickAt[owner]) {
      this.nextDevourMawTickAt[owner] = time + 250;
      for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (!enemy.active) continue;
        const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y);
        if (dist > 320) continue;
        const angle = Math.atan2(sprite.y - enemy.y, sprite.x - enemy.x);
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        enemy.setVelocity(
          body.velocity.x + Math.cos(angle) * 240,
          body.velocity.y + Math.sin(angle) * 240
        );
        const maxHp = Number(enemy.getData("maxHp")) || 1;
        const dmg = Math.max(1, Math.round(maxHp * (0.015 + fusionLevel * 0.005)));
        enemy.setData("lastOwner", owner);
        this.dealDirectDamage(enemy, dmg, enemy.x, enemy.y, false, owner);
        if (dist < 60 && enemy.active) {
          // 吸入即吞噬:回血 + 微量体型成长
          this.burst(enemy.x, enemy.y, 0x9b18ff, 0.9);
          const heal = Math.max(1, Math.round(maxHp * 0.02));
          if (isP2) this.healPlayer2(heal, "星渊巨口");
          else this.healPlayer(heal, "星渊巨口");
          this.destroyEnemy(enemy, true);
        }
      }
    }
  }

  // 天体碰撞(撞击):堡垒姿态 3 键变为蓄力后全屏天体坠落
  updateCelestial(time: number, owner: 1 | 2): void {
    const fusionLevel = this.upgradesOf(owner).wheelchair_fusion ?? 0;
    if (fusionLevel <= 0) return;
    const chargeUntil = this.celestialChargeUntil[owner];
    if (chargeUntil <= 0) return;
    if (time >= chargeUntil) {
      this.celestialChargeUntil[owner] = 0;
      this.triggerCelestialImpact(owner, fusionLevel);
      return;
    }
    // 蓄力中:屏幕边缘警示 + 玩家蓄能环
    const isP2 = owner === 2;
    const sprite = isP2 ? this.player2 : this.player;
    if (!sprite?.active) return;
    const progress = 1 - (chargeUntil - time) / 1400;
    if (Math.random() < 0.3) {
      // 蓄力余烬必须带衰减并按时销毁,否则长局(多次天体碰撞)会累积上千个残留圆圈
      const ember = this.add
        .circle(
          Phaser.Math.Between(40, WORLD_WIDTH - 40),
          Phaser.Math.Between(60, 300),
          Phaser.Math.FloatBetween(6, 14),
          0xff7a22,
          0.75
        )
        .setDepth(15)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ember,
        alpha: 0,
        scale: 0.2,
        duration: 420,
        onComplete: () => ember.destroy()
      });
    }
    this.burst(sprite.x + Phaser.Math.Between(-60, 60), sprite.y + Phaser.Math.Between(-60, 60), 0xffd45a, 0.25);
    if (progress > 0.45 && Math.random() < 0.4) {
      this.cameras.main.shake(0.01, 0.002);
    }
  }

  triggerCelestialImpact(owner: 1 | 2, level: number): void {
    const isP2 = owner === 2;
    const sprite = isP2 ? this.player2 : this.player;
    const cx = sprite?.x ?? WORLD_WIDTH / 2;
    const cy = sprite?.y ?? WORLD_HEIGHT / 2;
    this.cameras.main.flash(320, 255, 130, 50);
    if (save.settings.screenShake) this.cameras.main.shake(1000, 0.032);
    // 全屏冲击波特效
    const wave = this.add
      .circle(cx, cy, 60, 0xff7a22, 0)
      .setStrokeStyle(26, 0xffd45a, 0.95)
      .setDepth(95)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: wave,
      radius: WORLD_HEIGHT * 1.6,
      alpha: 0,
      duration: 700,
      ease: "Cubic.Out",
      onComplete: () => wave.destroy()
    });
    this.bigExplosion(cx, cy, 0xffd45a, 2.2);
    // 全场敌人:最大生命 % + 固定伤害
    const maxHpPct = 0.45 + level * 0.08;
    const flat = 400 + level * 200;
    for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!enemy.active) continue;
      const maxHp = Number(enemy.getData("maxHp")) || 1;
      enemy.setData("lastOwner", owner);
      this.dealDirectDamage(enemy, Math.round(maxHp * maxHpPct) + flat, enemy.x, enemy.y, false, owner);
    }
    // Boss 核心:固定高额伤害
    for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (part.active && ["core", "raid-core"].includes(part.getData("part"))) {
        this.damageBossPart(part, 600 + level * 300);
      }
    }
    // 玩家 2s 无敌
    if (isP2) this.player2InvulnUntil = Math.max(this.player2InvulnUntil, this.time.now + 2000);
    else this.activeInvulnerableUntil = Math.max(this.activeInvulnerableUntil, this.time.now + 2000);
    this.showBanner(isP2 ? "P2 ☄ 天体碰撞 · 全屏震击" : "☄ 天体碰撞 · 全屏震击", 1200);
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
    // === 键位系统:按玩家自定义(或默认)动态构建按键对象 ===
    this.cursors = this.input.keyboard!.createCursorKeys(); // 固定方向键:单人 P1 方向键移动 + 技能方向参考
    // Phaser 的 KeyCodes 只认 "A"/"SPACE"/"UP" 等名字或数字键码,不含 "KeyW" 这类 code 名
    // (addKey("KeyW") 会得到键码 undefined 的无效 Key,isDown 恒 false)。
    // 因此用 PHASER_CODE_TO_NUMBER 转成数字键码逐个 addKey,map 仍按原动作键名索引。
    const keyMap: Record<string, Phaser.Input.Keyboard.Key> = {};
    for (const action of Object.keys(DEFAULT_KEYBINDINGS) as BindableAction[]) {
      const code = boundKeyCode(action);
      const keyCode = PHASER_CODE_TO_NUMBER[code];
      if (keyCode === undefined) continue; // 防御:非法绑定名(重绑界面已过滤)
      keyMap[code] = this.input.keyboard!.addKey(keyCode);
    }
    this.keyMap = keyMap;
    this.wasd = {
      A: keyMap[boundKeyCode("p1_move_left")],
      W: keyMap[boundKeyCode("p1_move_up")],
      S: keyMap[boundKeyCode("p1_move_down")],
      D: keyMap[boundKeyCode("p1_move_right")]
    } as Record<string, Phaser.Input.Keyboard.Key>;
    this.actionKeys = {
      SPACE: keyMap[boundKeyCode("p1_fire")],
      ENTER: keyMap[boundKeyCode("p2_fire")]
    } as Record<string, Phaser.Input.Keyboard.Key>;
    // Game keys are never blocked by IME. The game has no in-game text
    // inputs that should swallow key events, so chat panels in the IDE /
    // Trae can't lock the player out.
    const inGameTextField = (_e: KeyboardEvent): boolean => false;
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragActive) return;
      this.targetX = Phaser.Math.Clamp(pointer.x, 42, WORLD_WIDTH - 42);
      this.targetY = Phaser.Math.Clamp(pointer.y, 105, WORLD_HEIGHT - 70);
    });
    this.input.on("pointerup", () => {
      this.dragActive = false;
    });
    // Force the game canvas to take focus when the player clicks / touches
    // anywhere in the play area. Without this the IME can latch onto an
    // unrelated contenteditable (e.g. the Trae chat panel) and silently
    // swallow key events before they reach the game.
    this.game.canvas.setAttribute("tabindex", "0");
    const grabFocus = (): void => {
      try {
        this.game.canvas.focus({ preventScroll: true });
      } catch {
        this.game.canvas.focus();
      }
      // 同时提升所在窗口/iframe 的焦点,确保游戏文档真正拿到键盘事件;
      // 否则点击落在预览 iframe 里时,聊天框可能仍然持有焦点。
      try {
        window.focus();
      } catch {
        // ignore
      }
    };
    grabFocus();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      grabFocus();
      if (playVariant !== "single") return;
      if (pointer.x > WORLD_WIDTH - 170 && pointer.y > WORLD_HEIGHT - 250) return;
      this.dragActive = true;
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });
    // Aggressively re-grab canvas focus every 250ms whenever focus has
    // drifted to something unrelated (e.g. the Trae chat panel). This keeps
    // game keys flowing to the game even while the user is typing pinyin
    // in an external panel.
    this.focusGuardTimer?.remove(false);
    this.focusGuardTimer = this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return grabFocus();
        if (el === this.game.canvas) return;
        // Allow focus to remain on in-game overlay panels (settings etc.)
        if ((el as any).closest?.("#overlay-root")) return;
        // 绝不抢占输入框/可编辑元素:否则会打断中文输入法的组字流程,
        // 留下半组合状态,候选框压到画布上并把游戏按键吞掉。
        const editable =
          el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
        if (editable) return;
        grabFocus();
      }
    });
    // === 中文输入法兼容:IME 组字期间的 keydown/keyup 的 keyCode 是 229,
    // Phaser 按 keyCode 识别按键会全部忽略,导致输入法开启时游戏无响应。
    // 这里在捕获阶段把组字事件转译成真实键位(按 event.code)重新派发,
    // 让游戏始终可玩;输入框聚焦时完全放行,不影响中文打字。===
    // 模块级单例监听器:先移除再注册同名函数,避免重开对局时向 window 累积监听器
    window.removeEventListener("keydown", relayImeKeyDown, true);
    window.removeEventListener("keyup", relayImeKeyUp, true);
    window.removeEventListener("compositionstart", blockImeCandidate, true);
    window.removeEventListener("compositionupdate", blockImeCandidate, true);
    window.addEventListener("keydown", relayImeKeyDown, true);
    window.addEventListener("keyup", relayImeKeyUp, true);
    // 画布聚焦时阻止 IME 组字开始,避免候选框压到游戏上;输入框里正常组字不受影响。
    this.game.canvas.addEventListener(
      "compositionstart",
      (e) => {
        if (activeScene === this && !this.isModal && !this.ended) e.preventDefault();
      },
      true
    );
    // 全局阻断 IME 组字候选弹出(输入框聚焦时完全放行),画布上的中文输入不再弹候选框。
    window.addEventListener("compositionstart", blockImeCandidate, true);
    window.addEventListener("compositionupdate", blockImeCandidate, true);
    // === 统一按键分发:所有可绑定动作走 keydown 事件(键位可在设置中重绑) ===
    const keyActionForCode = (name: string): BindableAction | undefined =>
      (Object.keys(DEFAULT_KEYBINDINGS) as BindableAction[]).find(
        (action) => boundKeyCode(action) === name
      );
    const executeAction = (action: BindableAction): void => {
      switch (action) {
        case "p1_skill1": this.activateSkill("laser", 1); return;
        case "p1_skill2": this.activateSkill("missile", 1); return;
        case "p1_skill3": this.activateSkill("drone", 1); return;
        case "p1_emp": this.activateEMP(1); return;
        case "p1_overdrive":
          if (save.selectedSpecialization === "wheelchair") this.activateWheelchairDash();
          else this.activateOverdrive();
          return;
        case "p1_phase_dash": this.activatePhaseDash(); return;
        case "p1_doctrine": {
          if (this.skillsConfiscated) {
            showToast("技能被篡夺：只能使用基础机炮与走位");
            return;
          }
          const specialization = save.selectedSpecialization;
          if (specialization === "power" && (this.upgradeLevels.power_flamethrower ?? 0) > 0) {
            this.activateFlamethrower();
            return;
          }
          if (specialization === "agile") {
            if ((this.upgradeLevels.agile_lunge ?? 0) > 0) this.activateLunge();
            else showToast("流派技能键需要先取得「影步突刺」强化");
            return;
          }
          if (specialization === "wheelchair") {
            this.activateWheelchairOverdrive();
            return;
          }
          if (specialization === "power") {
            showToast("流派技能键需要先取得「龙息喷火」强化");
            return;
          }
          showToast("当前流派的专属强化为被动效果，无需触发");
          return;
        }
        case "p1_power":
          if (this.bossPower) this.activateBossPower();
          else showToast("尚未获得首领权柄（击破 Boss 后获得）");
          return;
        case "p1_repair": this.activateNanoRepair(); return;
        case "p2_emp":
          if (playVariant !== "single") this.activateEMP(2);
          return;
        case "p2_overdrive":
          if (playVariant !== "single") this.activateOverdrive(2);
          return;
        case "p2_laser":
          if (playVariant !== "single") this.activateSkill("laser", 2);
          return;
        case "p2_doctrine": {
          if (playVariant === "single") return;
          const spec = this.specOf(2);
          const ul2 = this.upgradesOf(2);
          if (spec === "power" && (ul2.power_flamethrower ?? 0) > 0) {
            this.activateFlamethrower(2);
            return;
          }
          if (spec === "agile") {
            if ((ul2.agile_lunge ?? 0) > 0) this.activateLunge(2);
            else showToast("流派技能键需要先取得「影步突刺」强化");
            return;
          }
          if (spec === "wheelchair") {
            this.activateWheelchairOverdrive(2);
            return;
          }
          if (spec === "power") {
            showToast("流派技能键需要先取得「龙息喷火」强化");
            return;
          }
          showToast("当前流派的专属强化为被动效果，无需触发");
          return;
        }
        case "p2_repair":
          if (playVariant !== "single") this.activateNanoRepair(2);
          return;
        case "p2_phase_dash":
          if (playVariant !== "single") this.activatePhaseDash(2);
          return;
        case "surrender": this.surrender(); return;
        default: return;
      }
    };
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (inGameTextField(event)) return;
      const name = NUMBER_TO_PHASER_CODE[event.keyCode];
      if (!name) return;
      // 单人 DEBUG:按 P2 激光绑定键可快速升级(开发调试用)
      if (DEBUG && playVariant === "single" && name === boundKeyCode("p2_laser")) {
        this.levelUp();
        return;
      }
      const action = keyActionForCode(name);
      if (action) executeAction(action);
    });
    // 固定键(不可重绑):Esc 暂停 / B 调试
    this.input.keyboard!.on("keydown-ESC", (e: KeyboardEvent) => { if (!inGameTextField(e)) showPause(this); });
    this.input.keyboard!.on("keydown-B", (e: KeyboardEvent) => {
      if (inGameTextField(e)) return;
      if (DEBUG && !this.bossActive) this.spawnBoss();
    });
    // 失焦自动暂停:常驻监听(去掉 once),每局先移除再注册;
    // 菜单/结算态由 onWindowBlur 里的 activeScene 守卫拦截,不会误暂停。
    window.removeEventListener("blur", onWindowBlur);
    window.addEventListener("blur", onWindowBlur);
  }

  update(time: number, delta: number): void {
    if (this.ended || this.isModal) return;
    this.updateEnemyFreezeLifecycle(time);
    // 标签页/暂停恢复时 Phaser 可能送来一帧异常大的 delta；限制模拟步长，
    // 避免恢复首帧把移动、生成和碰撞一次性补算完。
    const dt = Math.min(delta, 34) / 1000;
    this.elapsedSeconds += dt;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    this.updateStars(dt);
    this.updatePlayer(time, dt);
    this.updateWheelchairRecovery(time, 1);
    this.updateWheelchairActiveSkills(time, 1);
    if (playVariant !== "single") {
      this.updateWheelchairRecovery(time, 2);
      this.updateWheelchairActiveSkills(time, 2);
    }
    this.updateFlightExperience(time);
    this.updateTemporarySkill(time);
    this.updateAirSupport(time);
    this.updateBossPower(time);
    this.updateDarkEffects(time);
    this.updateTemporaryConfiscation(time);
    this.updateFinalSwarm(time);
    this.updateDarkCorruption(time);
    this.updateWheelchairKnocked(time);
    this.updateFlamethrower(time, 1);
    if (playVariant !== "single") this.updateFlamethrower(time, 2);
    this.updateFusionDrones(time, 1);
    if (playVariant !== "single") this.updateFusionDrones(time, 2);
    this.updateLunge(time, 1);
    if (playVariant !== "single") this.updateLunge(time, 2);
    this.updateShadowClones(time, 1);
    if (playVariant !== "single") this.updateShadowClones(time, 2);
    this.updateSiphon(time, dt);
    this.updateFusions(time, 1);
    if (playVariant !== "single") this.updateFusions(time, 2);
    this.updateDevourSizeDecay(time, 1);
    if (playVariant !== "single") this.updateDevourSizeDecay(time, 2);
    if (
      !this.skillsConfiscated &&
      save.selectedSpecialization === "agile" &&
      time >= this.nextShadowCloneAt &&
      (this.upgradeLevels.agile_shadow_clone ?? 0) > 0
    ) {
      this.spawnShadowClones(1);
    }
    if (
      playVariant !== "single" &&
      !this.skillsConfiscated &&
      save.selectedSpecialization2 === "agile" &&
      time >= this.nextShadowCloneAt2 &&
      (this.upgradesOf(2).agile_shadow_clone ?? 0) > 0
    ) {
      this.spawnShadowClones(2);
    }
    this.updateWeapons(time);
    this.updateProjectiles(time);
    this.updateEnemies(time, dt);
    this.updatePickups();
    this.updateCampaignMysteryFeedback();
    // === 普通战役清兵航段:
    // 半程(阈值 50%):停止刷兵,清场后先出三扇航线门,选门奖励后继续推进;
    // 整程(阈值 100%):停止刷兵,清场后直接进入首领降临(不再出第二道门) ===
    if (
      this.campaignInterludeActive &&
      !this.campaignHalfGateDone &&
      !this.levelCompleteTriggered &&
      this.score + this.score2 - this.campaignInterludeStartScore >=
        this.campaignInterludeTarget * 0.5
    ) {
      // 半程:立即停止刷兵,清完剩余小兵后开航线门
      this.campaignHalfGateDone = true;
      this.nextSpawn = this.time.now + 999999;
      this.showBanner("◆ 航线门信号锁定 · 清空剩余威胁", 1200);
    }
    if (
      this.campaignInterludeActive &&
      this.campaignHalfGateDone &&
      !this.campaignGatesOpen &&
      !this.levelCompleteTriggered &&
      !(this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).some((enemy) => enemy.active)
    ) {
      // 半程门:清场后出现红/蓝/绿三扇随机航线门
      this.spawnCampaignGates(time);
    }
    if (
      this.campaignInterludeActive &&
      this.campaignGatesOpen &&
      this.campaignGates.length > 0 &&
      !this.levelCompleteTriggered
    ) {
      if (time >= this.campaignGateUntil) {
        // 门超时未选:关闭航线门,继续推进
        this.clearCampaignGates();
        this.completeCampaignGate();
      } else {
        this.checkCampaignGateCollision();
      }
    }
    if (
      this.campaignInterludeActive &&
      this.campaignHalfGateDone &&
      !this.levelCompleteTriggered &&
      this.score + this.score2 - this.campaignInterludeStartScore >=
        this.campaignInterludeTarget
    ) {
      // 整程:达到完整阈值,停止刷兵,清场后进入首领
      this.levelCompleteTriggered = true;
      this.nextSpawn = this.time.now + 999999;
      this.showBanner("◆ 信号锁定 · 清空剩余威胁后首领降临", 1200);
    }
    if (
      this.campaignInterludeActive &&
      this.levelCompleteTriggered &&
      !this.bossActive &&
      !(this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).some((enemy) => enemy.active)
    ) {
      // 整程清场:不再出第二道门,直接进入首领降临
      this.completeCampaignGate();
    }
    this.updateBoss(time, dt);
    this.lockFrozenHostiles(time);
    this.updateHud();
    this.updateDebug();
    // 仅在打死小兵时掉落小兵强化技能和代币,周期定时刷新已禁用
    this.nextFlightToken = time + 999999;
    this.nextSkillPickup = time + 999999;
    const scoreProgress = this.campaignInterludeActive
      ? (this.score + this.score2 - this.campaignInterludeStartScore) /
        Math.max(1, this.campaignInterludeTarget)
      : (this.score + this.score2) / Math.max(1, this.nextBossScore);
    const intensityStage = this.bossActive
      ? 3
      : scoreProgress >= 0.72
        ? 2
        : scoreProgress >= 0.3
          ? 1
          : 0;
    setAdaptiveMusic(intensityStage);
    if (
      selectedMode === "endless" &&
      !this.bossActive &&
      !this.levelCompleteTriggered &&
      this.score + this.score2 >= this.nextBossScore
    ) {
      // 达到分数阈值:立即停止刷兵,玩家需先清完场上剩余小兵,最后才召唤 Boss
      this.levelCompleteTriggered = true;
      // 冻结底层分数:清兵期击杀只涨显示分数,不推动下一阈值
      this.bossClearScore = this.score + this.score2;
      this.nextSpawn = this.time.now + 999999;
      this.showBanner("◆ 信号锁定 · 清空剩余威胁后首领降临", 1200);
    }
    // === 阈值达标且场上小兵已全部清空 → 触发 Boss 降临 ===
    if (
      selectedMode === "endless" &&
      this.levelCompleteTriggered &&
      !this.bossActive &&
      !(this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).some((enemy) => enemy.active)
    ) {
      this.playBossArrivalCG();
    }
    // === 突刺联动:影分身突刺 ===
    this.updateLungeShadowClones(time, 1);
    if (playVariant !== "single") this.updateLungeShadowClones(time, 2);
    // === 镜像残响护符:HP < 30% 时召唤 1 个镜像影分身(无敌) ===
    this.checkMirrorEcho();
  }

  updateCampaignMysteryFeedback(): void {
    if (
      !this.campaignInterludeActive ||
      this.campaignMysteryStage >= CAMPAIGN_MYSTERY_THRESHOLDS.length
    ) {
      return;
    }
    const progressRatio =
      (this.score + this.score2 - this.campaignInterludeStartScore) /
      Math.max(1, this.campaignInterludeTarget);
    const stage = this.campaignMysteryStage;
    if (progressRatio < CAMPAIGN_MYSTERY_THRESHOLDS[stage]) return;
    this.campaignMysteryStage += 1;
    const messages = CAMPAIGN_MYSTERY_MESSAGES[stage];
    const message = messages[(this.campaignMysteryVariant + stage) % messages.length];
    if (stage === 0) {
      this.ultimate = Math.min(100, this.ultimate + 6);
      this.burst(this.player.x, this.player.y, 0x2df4ff, 1.35);
    } else if (stage === 1) {
      this.spawnFlightToken();
      this.cameras.main.flash(90, 45, 244, 255);
    } else if (stage === 2) {
      this.spawnSkillPickup(
        Phaser.Math.Clamp(
          this.player.x + Phaser.Math.Between(-150, 150),
          90,
          WORLD_WIDTH - 90
        ),
        -55
      );
      this.ultimate = Math.min(100, this.ultimate + 10);
    } else {
      this.ultimate = Math.min(100, this.ultimate + 16);
      this.healPlayer(this.stats.maxHp * 0.06, "未知共振");
      this.cameras.main.flash(120, 90, 25, 145);
    }
    this.showBanner(message, stage === 3 ? 1250 : 950);
    sfx("upgrade");
  }

  updateStars(dt: number): void {
    const encounter = BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex];
    const pursuitScale =
      isNineBattleMode() && encounter?.kind === "chase" && this.bossActive
        ? 3.1
        : 1;
    for (const star of this.stars) {
      star.y +=
        star.getData("speed") *
        dt *
        (this.bossPhase === 3 ? 1.7 : 1) *
        pursuitScale;
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
    // 开局和暂停恢复后的几帧只更新位置，不集中创建拖尾与环境粒子。
    if (time < this.visualEffectsReadyAt) return;
    this.spawnAchievementSkinFx(time);
    this.spawnEngineTrailFx(time, this.player);
    if (this.player2?.active) {
      this.spawnEngineTrailFx(time, this.player2);
    }
    if (time >= this.nextTrail) {
      this.nextTrail = time + (save.settings.quality === "high" ? 45 : 75);
    }
  }

  spawnEngineTrailFx(time: number, shooter: Phaser.Physics.Arcade.Image): void {
    if (!shooter?.active) return;
    if (time < this.nextTrail) return;
    for (const offset of [-18, 18]) {
      const spark = this.engineTrails.get(
        shooter.x + offset,
        shooter.y + shooter.displayHeight * 0.35,
        "flamethrowerFx",
        Math.floor(time / 72) % 4
      ) as Phaser.GameObjects.Image | null;
      if (!spark) continue;
      this.tweens.killTweensOf(spark);
      spark
        .setActive(true)
        .setVisible(true)
        .setPosition(shooter.x + offset, shooter.y + shooter.displayHeight * 0.35)
        .setTexture("flamethrowerFx", Math.floor(time / 72) % 4)
        .setDisplaySize(30, 66)
        .setFlipY(true)
        .setTint(offset < 0 ? 0xffd27a : 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6)
        .setAlpha(0.74);
      this.tweens.add({
        targets: spark,
        y: spark.y + Phaser.Math.Between(36, 58),
        alpha: 0,
        scaleX: spark.scaleX * 0.55,
        scaleY: spark.scaleY * 0.72,
        duration: Phaser.Math.Between(170, 250),
        onComplete: () => spark.setActive(false).setVisible(false)
      });
    }
  }

  spawnBossUpgradePickup(
    x: number,
    y: number,
    defeatedKind: BossKind,
    onCollected: () => void
  ): void {
    const tint =
      defeatedKind === "titan"
        ? 0xff9a45
        : defeatedKind === "mirror"
          ? 0x54f4ff
          : 0xc86cff;
    const pickup = this.pickups.get(x, y, "skillPickup") as Phaser.Physics.Arcade.Image;
    pickup.enableBody(true, x, y, true, true);
    pickup
      .setTexture("skillPickup")
      .setDisplaySize(72, 72)
      .setDepth(36)
      .setTint(tint)
      .setData({
        kind: "boss_upgrade",
        value: defeatedKind,
        onCollected,
        born: this.time.now
      })
      .setVelocity(0, 95)
      .setAngularVelocity(110);
    this.showBanner(`${BOSS_NAMES[defeatedKind]}专属强化掉落 · 接触后被动三选一`, 1400);
  }

  activateTemporarySkill(skill: TemporarySkill): void {
    const names: Record<TemporarySkill, string> = {
      overdrive: "歼灭超频",
      prism: "棱镜散射",
      singularity: "奇点花火",
      rapidfire: "急速扫射",
      ironclad: "钢铁壁垒"
    };
    const colors: Record<TemporarySkill, number> = {
      overdrive: 0xffbd3e,
      prism: 0x9b5cff,
      singularity: 0x9b5cff,
      rapidfire: 0x2df4ff,
      ironclad: 0x2df4ff
    };
    this.temporarySkill = skill;
    this.temporarySkillUntil = this.time.now + 12000;
    this.nextTemporaryPattern = this.time.now + 260;
    this.showBanner(`${names[skill]} · 12 秒临时强化`, 1050);
    this.burst(this.player.x, this.player.y, colors[skill], 2);
  }

  updateTemporarySkill(time: number): void {
    if (!this.temporarySkill) return;
    if (time >= this.temporarySkillUntil) {
      this.showBanner("临时技能能源耗尽", 650);
      this.temporarySkill = null;
      if (this.temporarySkillShield) {
        this.temporarySkillShield.destroy();
        this.temporarySkillShield = undefined;
      }
      return;
    }
    if (this.temporarySkillShield && time >= this.temporarySkillShieldUntil) {
      this.temporarySkillShield.destroy();
      this.temporarySkillShield = undefined;
    }
    if (time < this.nextTemporaryPattern || this.skillsConfiscated) {
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
        if (!bullet.getData("achievementSkinBullet")) {
          bullet.setVelocity(i * 135, -790 + Math.abs(i) * 28).setTint(i % 2 ? 0xff7de3 : 0x2df4ff);
        } else {
          bullet.setVelocity(i * 135, -790 + Math.abs(i) * 28);
        }
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
        bullet.setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480);
        if (!bullet.getData("achievementSkinBullet")) {
          bullet.setTint(i % 2 ? 0x9b5cff : 0xffbd3e);
        }
        bullet.setData("born", time);
      }
      this.nextTemporaryPattern = time + 1280;
    } else if (this.temporarySkill === "rapidfire") {
      // 急速扫射:每隔 90ms 一次全弹幕扫射
      const burst = save.selectedSpecialization === "agile" ? 6 : 4;
      for (let i = 0; i < burst; i += 1) {
        const offset = (i - (burst - 1) / 2) * 14;
        const bullet = this.spawnPlayerBullet(
          this.player.x + offset,
          this.player.y - 38,
          "playerBullet",
          6 + (this.upgradeLevels.cannon ?? 1) * 1.6,
          -1100,
          "temporary-rapidfire"
        );
        bullet.setVelocityX(offset * 6);
      }
      this.burst(this.player.x, this.player.y - 30, 0x2df4ff, 0.7);
      this.nextTemporaryPattern = time + 90;
    } else if (this.temporarySkill === "ironclad") {
      // 钢铁壁垒:玩家周围生成半透明护盾圈,每 220ms 反弹来袭弹幕
      this.burst(this.player.x, this.player.y, 0x2df4ff, 1.1);
      this.temporarySkillShieldUntil = time + 12000;
      if (!this.temporarySkillShield) {
        this.temporarySkillShield = this.add
          .circle(this.player.x, this.player.y, 80, 0x2df4ff, 0.08)
          .setStrokeStyle(3, 0x2df4ff, 0.7)
          .setDepth(9);
      }
      this.temporarySkillShield.setAlpha(0.18 + Math.sin(time * 0.008) * 0.04);
      this.temporarySkillShield.setPosition(this.player.x, this.player.y);
      this.nextTemporaryPattern = time + 220;
    } else {
      this.nextTemporaryPattern = time + 800;
    }
  }

  updatePlayer(time: number, dt: number): void {
    // Do not block on IME; player keeps full control while typing pinyin
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
        : 1) *
      (save.selectedSpecialization === "wheelchair" && time < this.wheelchairFortressUntil
        ? WHEELCHAIR_ACTIVE_SKILLS.fortressStance.speedMultiplier
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
      time >= this.nextWheelchairTrail
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
      this.nextWheelchairTrail = time + 45;
    }
    this.player.setAlpha(time < this.invulnerableUntil && Math.floor(time / 80) % 2 === 0 ? 0.28 : 1);
    if (this.ultimateActive > 0) {
      this.ultimateActive -= dt;
      // E 超载视觉：基础机体在亮青色和原色之间闪烁。
      this.player.setTint(Math.floor(this.ultimateActive * 6) % 2 === 0 ? 0x9ffcff : 0xffffff);
      if (this.ultimateActive <= 0) {
        this.overdriveDamageMul = 1;
        this.player.clearTint();
      }
    }
    if (this.player2) {
      // 双人模式 P2 按自己的战机/专精计算速度
      const p2Spec = this.specOf(2);
      const p2Ul = this.upgradesOf(2);
      const p2Speed =
        this.stats2.speed *
        (1 +
          (p2Spec === "wheelchair"
            ? (p2Ul.ram_drive ?? 0) * 0.06
            : (p2Ul.speed ?? 0) * 0.06)) *
        (p2Spec === "agile" ? this.agileSpeedMultiplier(2) : 1);
      const direction2 = new Phaser.Math.Vector2(
        Number(this.keyHeld("p2_move_right")) - Number(this.keyHeld("p2_move_left")),
        Number(this.keyHeld("p2_move_down")) - Number(this.keyHeld("p2_move_up"))
      );
      if (direction2.lengthSq() > 0) {
        direction2.normalize().scale(p2Speed);
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
      // P2 的自动武器独立于 P1 撞击流分支
      if (playVariant !== "single" && this.player2?.active) this.updateAutoWeapons(time, 2);
      return;
    }
    const haste =
      this.stats.fireRateMultiplier *
      (1 + (this.upgradeLevels.haste ?? 0) * 0.07 * ATTACK_BONUS_SCALE);
    const ultimateHaste = this.ultimateActive > 0 ? 1.6 : 1;
    // Game keys always fire, even while an IME is composing pinyin
    if (
      (save.settings.autoFire ||
        this.actionKeys.SPACE.isDown ||
        (this.sys.game.device.input.touch && this.dragActive)) &&
      time >= this.nextShot
    ) {
      const level = this.upgradeLevels.cannon ?? 1;
      this.fireCannon(level);
      this.nextShot = time + 190 / haste / ultimateHaste;
    }
    if (
      this.player2 &&
      (save.settings.autoFire || this.actionKeys.ENTER.isDown) &&
      this.specOf(2) !== "wheelchair" &&
      time >= (this.player2.getData("nextShot") ?? 0)
    ) {
      this.fireCannon(this.upgradesOf(2).cannon ?? 1, this.player2, 2);
      const p2Haste =
        this.stats2.fireRateMultiplier *
        (1 + (this.upgradesOf(2).haste ?? 0) * 0.07 * ATTACK_BONUS_SCALE);
      this.player2.setData("nextShot", time + 210 / p2Haste / ultimateHaste);
      this.spawnAchievementSkinFx(time, this.player2);
    }
    if (this.skillsConfiscated) {
      // P1 技能被篡夺:只停 P1 自动武器,P2 不受影响
      if (playVariant !== "single" && this.player2?.active) this.updateAutoWeapons(time, 2);
      return;
    }
    this.updateAutoWeapons(time, 1);
    if (playVariant !== "single" && this.player2?.active) this.updateAutoWeapons(time, 2);
  }

  // 自动武器系统(P1 非撞击流派与 P2 共用):激光/导弹/无人机/电弧/旋刃自动开火
  updateAutoWeapons(time: number, owner: 1 | 2): void {
    const isP2 = owner === 2;
    const ul = this.upgradesOf(owner);
    const shooter = isP2 ? this.player2 : this.player;
    if (!shooter?.active) return;
    const weaponHaste =
      this.statsOf(owner).fireRateMultiplier *
      (1 + (ul.haste ?? 0) * 0.07 * ATTACK_BONUS_SCALE);
    const ultimateHaste = this.ultimateActive > 0 ? 1.6 : 1;
    if ((ul.laser ?? 0) > 0 && time >= (isP2 ? this.nextLaser2 : this.nextLaser)) {
      this.fireLaser(ul.laser, shooter, owner);
      if (isP2) this.nextLaser2 = time + 920 / weaponHaste / ultimateHaste;
      else this.nextLaser = time + 920 / weaponHaste / ultimateHaste;
    }
    if ((ul.missile ?? 0) > 0 && time >= (isP2 ? this.nextMissile2 : this.nextMissile)) {
      this.fireMissiles(ul.missile, shooter, owner);
      if (isP2) this.nextMissile2 = time + 1250 / weaponHaste / ultimateHaste;
      else this.nextMissile = time + 1250 / weaponHaste / ultimateHaste;
    }
    if ((ul.drone ?? 0) > 0) {
      this.updateDrones(time, owner);
      const nextDroneShot = isP2 ? this.nextDroneShot2 : this.nextDroneShot;
      if (time >= nextDroneShot) {
        const drones = isP2 ? this.drones2 : this.drones;
        for (const drone of drones) {
          this.spawnPlayerBullet(drone.x, drone.y - 10, "playerBullet", 7, -920, "drone", owner);
        }
        if (isP2) this.nextDroneShot2 = time + 620 / weaponHaste / ultimateHaste;
        else this.nextDroneShot = time + 620 / weaponHaste / ultimateHaste;
      }
    }
    if ((ul.arc ?? 0) > 0 && time >= (isP2 ? this.nextArc2 : this.nextArc)) {
      this.fireArc(ul.arc, shooter, owner);
      if (isP2) this.nextArc2 = time + 1450 / weaponHaste / ultimateHaste;
      else this.nextArc = time + 1450 / weaponHaste / ultimateHaste;
    }
    if ((ul.blade ?? 0) > 0) this.updateBlades(time, owner);
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
    // 玩家主炮每射击一次,影分身同步射击一次(仅 P1 本体开火时触发)
    if (shooter === this.player) {
      this.shadowClonesSyncFire(1);
    } else if (owner === 2) {
      this.shadowClonesSyncFire(2);
    }
    if (this.specOf(owner as 1 | 2) === "agile") {
      this.fireAgileVolley(level, shooter, owner as 1 | 2);
      return;
    }
    const count = powerCount;
    const lanceLevel = this.doctrineLevels.lance_mastery ?? 0;
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

  // 敏捷流派主炮弹幕(P1/P2 独立积累器,避免共享节奏)
  fireAgileVolley(level: number, shooter: Phaser.Physics.Arcade.Image, owner: 1 | 2): void {
    const isP2 = owner === 2;
    const projectileRatio =
      1.14 + Math.min(100, this.level) * 0.01 * ATTACK_BONUS_SCALE;
    const powerCount = level >= 4 ? 3 : 2;
    const bloomLevel = this.doctrineLevels.bloom_mastery ?? 0;
    let accumulator = isP2 ? this.agileBulletAccumulator2 : this.agileBulletAccumulator;
    let volleyIndex = isP2 ? this.agileVolleyIndex2 : this.agileVolleyIndex;
    const nextBloom = isP2 ? this.nextAgileBloom2 : this.nextAgileBloom;
    accumulator += powerCount * projectileRatio;
    const baseCount = Math.max(2, Math.floor(accumulator));
    accumulator -= baseCount;
    const count =
      baseCount +
      (bloomLevel > 0
        ? Math.max(1, Math.round((bloomLevel + 1) * ATTACK_BONUS_SCALE))
        : 0);
    volleyIndex += 1;
    const patterns: AgileTrajectory[] = ["fan", "arc", "helix", "scatter", "cross", "circle", "twin"];
    let pattern = Phaser.Utils.Array.GetRandom(patterns);
    if (pattern === "circle" && this.time.now >= nextBloom) {
      this.fireAgileBloom(level, shooter, owner);
      const delay = Math.max(980, 1850 - this.level * 7);
      if (isP2) {
        this.nextAgileBloom2 = this.time.now + delay;
        this.agileBulletAccumulator2 = accumulator;
        this.agileVolleyIndex2 = volleyIndex;
      } else {
        this.nextAgileBloom = this.time.now + delay;
        this.agileBulletAccumulator = accumulator;
        this.agileVolleyIndex = volleyIndex;
      }
      return;
    }
    if (pattern === "circle") pattern = "fan";
    const twinSideOf = (index: number): number => (index % 2 === 0 ? -1 : 1);
    // 子弹发散程度削弱 20%:所有图案的发散角度 ×0.8,弹道更聚拢
    const spreadScale = 0.8;
    for (let i = 0; i < count; i += 1) {
      const normalized = count === 1 ? 0 : i / (count - 1) - 0.5;
      let angle = -Math.PI / 2 + normalized * ((1.18 + bloomLevel * 0.08) * spreadScale);
      if (pattern === "arc") angle = -Math.PI / 2 + normalized * 0.5 * spreadScale;
      if (pattern === "helix") angle = -Math.PI / 2 + normalized * 0.72 * spreadScale;
      if (pattern === "scatter") {
        angle = -Math.PI / 2 + Phaser.Math.FloatBetween(-0.82, 0.82) * spreadScale;
      }
      if (pattern === "cross") {
        angle =
          -Math.PI / 2 +
          (i % 2 === 0 ? -1 : 1) * (0.16 + Math.floor(i / 2) * 0.16) * spreadScale;
      }
      // 双子螺旋:左右两束强螺旋交错摆动,像两翼展开
      if (pattern === "twin") {
        angle = -Math.PI / 2 + twinSideOf(i) * ((0.42 + normalized * 0.16) * spreadScale);
      }
      const bullet = this.spawnPlayerBullet(
        shooter.x + normalized * 58,
        shooter.y - 38 + Math.sin(i * 2.3 + volleyIndex * 0.7) * 12,
        "agileOrb",
        8 + level * 2.8 * ATTACK_BONUS_SCALE,
        0,
        "agile-orb",
        owner
      );
      bullet.setVelocity(Math.cos(angle) * 820, Math.sin(angle) * 820);
      // 双子螺旋:相位按左右两侧反向错开,螺旋更花哨
      const curvePhase =
        pattern === "twin"
          ? twinSideOf(i) * (Math.PI * 0.62) + (i * 0.33) % (Math.PI * 2)
          : (Math.PI * 2 * i) / count + volleyIndex * 0.46;
      bullet.setData("curvePhase", curvePhase);
      bullet.setData(
        "curveAmount",
        pattern === "twin"
          ? 5.4 + level * 0.22
          : 3.1 + Math.min(5, level * 0.17) + bloomLevel * 0.62
      );
      bullet.setData("born", this.time.now);
      bullet.setData("trajectory", pattern);
      bullet.setData("arcDirection", i % 2 === 0 ? -1 : 1);
      const isSkinBullet =
        achievementSkinBulletTextureKey(save.equippedSkin) &&
        Boolean(SKINS[save.equippedSkin]?.bulletAsset);
      if (!isSkinBullet) {
        bullet.setTint(i % 3 === 0 ? 0xff7de3 : i % 2 ? 0x9b5cff : 0x2df4ff);
      }
      (bullet.body as Phaser.Physics.Arcade.Body).setCircle(4, 7, 7);
    }
    if (isP2) {
      this.agileBulletAccumulator2 = accumulator;
      this.agileVolleyIndex2 = volleyIndex;
    } else {
      this.agileBulletAccumulator = accumulator;
      this.agileVolleyIndex = volleyIndex;
    }
    if (this.time.now >= nextBloom) {
      this.fireAgileBloom(level, shooter, owner);
      const delay = Math.max(980, 1850 - this.level * 7);
      if (isP2) this.nextAgileBloom2 = this.time.now + delay;
      else this.nextAgileBloom = this.time.now + delay;
    }
    if (Math.random() < 0.24) sfx("shoot");
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
    const volleyIndex = owner === 2 ? this.agileVolleyIndex2 : this.agileVolleyIndex;
    const phase = volleyIndex * 0.24;
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
      bullet.setVelocity(Math.cos(angle) * 545, Math.sin(angle) * 545);
      if (!bullet.getData("achievementSkinBullet")) {
        bullet.setTint(i % 3 === 0 ? 0xff7de3 : i % 2 ? 0x9b5cff : 0x2df4ff);
      }
      bullet
        .setData("born", this.time.now)
        .setData("curvePhase", angle);
      (bullet.body as Phaser.Physics.Arcade.Body).setCircle(4, 7, 7);
    }
    this.burst(shooter.x, shooter.y - 18, 0x9b5cff, 1.35);
  }

  fireLaser(
    level: number,
    shooter: Phaser.Physics.Arcade.Image = this.player,
    owner: 1 | 2 = 1
  ): void {
    const bullet = this.spawnPlayerBullet(
      shooter.x,
      shooter.y - 52,
      "laserBullet",
      28 + level * 12 * ATTACK_BONUS_SCALE,
      -1250,
      "laser",
      owner
    );
    bullet.setScale(1 + level * 0.13, 1);
    bullet.setData("pierce", 4 + level);
  }

  fireMissiles(
    level: number,
    shooter: Phaser.Physics.Arcade.Image = this.player,
    owner: 1 | 2 = 1
  ): void {
    const count = level >= 4 ? 3 : level >= 2 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const missile = this.spawnPlayerBullet(
        shooter.x + (i - (count - 1) / 2) * 32,
        shooter.y - 20,
        "missile",
        36 + level * 13 * ATTACK_BONUS_SCALE,
        -500,
        "missile",
        owner
      );
      missile.setData("target", this.nearestTarget(missile.x, missile.y));
    }
  }

  updateDrones(_time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ul = this.upgradesOf(owner);
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite) return;
    const drones = isP2 ? this.drones2 : this.drones;
    const desired = Math.min(3, Math.ceil((ul.drone ?? 0) / 2));
    while (drones.length < desired) {
      drones.push(this.add.image(shipSprite.x, shipSprite.y, "drone").setDepth(9));
    }
    // 等级回落时销毁多余对象,避免残影一直跟随
    while (drones.length > desired) drones.pop()?.destroy();
    drones.forEach((drone, index) => {
      const offset = (index - (drones.length - 1) / 2) * 88;
      drone.x = Phaser.Math.Linear(drone.x, shipSprite.x + offset, 0.18);
      drone.y = Phaser.Math.Linear(drone.y, shipSprite.y + 28 + Math.abs(offset) * 0.08, 0.18);
    });
  }

  fireArc(
    level: number,
    shooter: Phaser.Physics.Arcade.Image = this.player,
    owner: 1 | 2 = 1
  ): void {
    const targets = this.closestTargets(shooter.x, shooter.y, 1 + Math.floor(level / 2));
    if (!targets.length) return;
    const graphics = this.add.graphics().setDepth(20);
    graphics.lineStyle(5 + level, 0x8efcff, 0.95);
    let fromX = shooter.x;
    let fromY = shooter.y - 30;
    for (const target of targets) {
      graphics.lineBetween(fromX, fromY, target.x, target.y);
      this.dealDirectDamage(
        target,
        32 + level * 18 * ATTACK_BONUS_SCALE,
        target.x,
        target.y,
        true,
        owner
      );
      fromX = target.x;
      fromY = target.y;
    }
    this.tweens.add({ targets: graphics, alpha: 0, duration: 150, onComplete: () => graphics.destroy() });
  }

  updateBlades(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ul = this.upgradesOf(owner);
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite) return;
    const blades = isP2 ? this.blades2 : this.blades;
    const nextDamage = isP2 ? this.nextBladeDamage2 : this.nextBladeDamage;
    const desired = Math.min(5, 1 + (ul.blade ?? 0));
    while (blades.length < desired) {
      blades.push(this.add.image(shipSprite.x, shipSprite.y, "blade").setDepth(12));
    }
    // 等级回落时销毁多余对象,避免残影一直跟随
    while (blades.length > desired) blades.pop()?.destroy();
    blades.forEach((blade, index) => {
      const angle = time * 0.0022 + (Math.PI * 2 * index) / blades.length;
      const radius = 80 + (ul.blade ?? 0) * 5;
      blade.setPosition(
        shipSprite.x + Math.cos(angle) * radius,
        shipSprite.y + Math.sin(angle) * radius
      );
      blade.rotation = angle * 2;
    });
    if (time >= nextDamage) {
      const targets = [...this.enemies.getChildren(), ...this.bossParts.getChildren()] as Phaser.Physics.Arcade.Image[];
      for (const target of targets) {
        if (!target.active) continue;
        if (blades.some((blade) => Phaser.Math.Distance.Between(blade.x, blade.y, target.x, target.y) < 54)) {
          this.dealDirectDamage(
            target,
            18 + (ul.blade ?? 0) * 11 * ATTACK_BONUS_SCALE,
            target.x,
            target.y,
            true,
            owner
          );
        }
      }
      if (isP2) this.nextBladeDamage2 = time + 270;
      else this.nextBladeDamage = time + 270;
    }
  }

  // 玩家单次基础伤害 — 用于喷火/突刺/影分身等(owner 区分 P1/P2)
  computePlayerDamage(owner: 1 | 2 = 1): number {
    return 18 * this.statsOf(owner).damageMultiplier * (1 + this.level * 0.04);
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
    const skinBulletKey = achievementSkinBulletTextureKey(save.equippedSkin);
    const skinEligibleTexture =
      texture === "playerBullet" || texture === "agileOrb";
    const useAchievementSkinBullet =
      skinEligibleTexture &&
      Boolean(SKINS[save.equippedSkin]?.bulletAsset) &&
      this.textures.exists(skinBulletKey);
    const resolvedTexture = useAchievementSkinBullet ? skinBulletKey : texture;
    const bullet = this.playerBullets.get(x, y, resolvedTexture) as Phaser.Physics.Arcade.Image;
    bullet.enableBody(true, x, y, true, true);
    bullet
      .setTexture(resolvedTexture)
      .setActive(true)
      .setVisible(true)
      .setDepth(8)
      .setScale(1)
      .setAngle(0)
      .setAlpha(1)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .clearTint();
    if (useAchievementSkinBullet) {
      const size = achievementSkinBulletDisplaySize(save.equippedSkin);
      // 只放大尺寸提升显眼度,不加任何发光混合(用户要求不要发光)
      bullet.setDisplaySize(size.width, size.height);
    }
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    if (useAchievementSkinBullet) {
      // 品质只改变视觉，不改变基础机炮的碰撞面积与实战强度。
      body.setSize(
        12 / Math.max(0.001, Math.abs(bullet.scaleX)),
        32 / Math.max(0.001, Math.abs(bullet.scaleY)),
        true
      );
    } else {
      body.setSize(bullet.width, bullet.height, true);
    }
    bullet.setData("achievementSkinBullet", useAchievementSkinBullet);
    bullet.setData("damage", damage * this.currentDamageMultiplier((owner as 1 | 2) ?? 1));
    bullet.setData("weapon", weapon);
    bullet.setData("owner", owner);
    bullet.setData("pierce", 0);
    bullet.setVelocity(0, velocityY);
    return bullet;
  }

  clearPlayerBullets(): void {
    this.playerBullets.clear(true, true);
  }

  spawnAchievementSkinFx(time: number, shooter?: Phaser.Physics.Arcade.Image): void {
    const skin = SKINS[save.equippedSkin];
    if (!skin?.effect || time < this.nextAchievementSkinFx) return;
    const baseShooter = shooter ?? this.player;
    if (!baseShooter?.active) return;
    this.nextAchievementSkinFx = time + (save.settings.quality === "high" ? 80 : 120);
    const [primary, secondary] = skin.colors;
    const baseX = baseShooter.x;
    const baseY = baseShooter.y;
    let mark: Phaser.GameObjects.Shape;
    let targetX = baseX;
    let targetY = baseY + 44;
    let targetScale = 0.22;
    let duration = 360;

    if (skin.effect === "heartbeat") {
      mark = this.add.circle(baseX, baseY + 3, 9, primary, 0.22).setStrokeStyle(2, primary, 0.7);
      targetY = baseY + 3;
      targetScale = 1.75;
      duration = 300;
    } else if (skin.effect === "ember") {
      mark = this.add.rectangle(
        baseX + Phaser.Math.Between(-22, 22),
        baseY + 18,
        4,
        12,
        Math.random() > 0.35 ? primary : secondary,
        0.8
      ).setRotation(Phaser.Math.FloatBetween(-0.35, 0.35));
      targetX = mark.x + Phaser.Math.Between(-8, 8);
      targetY = mark.y + 48;
    } else if (skin.effect === "gravity") {
      const angle = time * 0.006 + Phaser.Math.FloatBetween(-0.5, 0.5);
      mark = this.add.circle(
        baseX + Math.cos(angle) * 34,
        baseY + Math.sin(angle) * 28,
        4,
        primary,
        0.72
      ).setStrokeStyle(1, secondary, 0.6);
      targetX = baseX;
      targetY = baseY + 4;
      targetScale = 0.08;
      duration = 330;
    } else if (skin.effect === "seal") {
      mark = this.add.rectangle(
        baseX + (Math.floor(time / 145) % 2 ? -24 : 24),
        baseY + 10,
        5,
        16,
        Math.floor(time / 290) % 2 ? primary : secondary,
        0.72
      );
      targetX = mark.x;
      targetY = mark.y + 42;
    } else if (skin.effect === "vessel") {
      const side = Math.floor(time / 145) % 2 ? -1 : 1;
      mark = this.add.ellipse(baseX + side * 18, baseY + 14, 6, 14, primary, 0.72)
        .setStrokeStyle(1, secondary, 0.55);
      targetX = mark.x + side * 11;
      targetY = mark.y + 40;
    } else if (skin.effect === "trophy") {
      const phase = Math.floor(time / 145) % 3;
      const trophyColors = [primary, secondary, 0xb95cff];
      mark = this.add.rectangle(
        baseX + [-21, 0, 21][phase],
        baseY + 18,
        5,
        12,
        trophyColors[phase],
        0.76
      ).setRotation((phase - 1) * 0.18);
      targetX = mark.x + (phase - 1) * 5;
      targetY = mark.y + 44;
    } else {
      const side = Math.floor(time / 95) % 2 ? -1 : 1;
      mark = this.add.ellipse(
        baseX + side * 13,
        baseY + 28,
        5,
        19,
        side > 0 ? primary : secondary,
        0.76
      );
      targetX = mark.x + side * 4;
      targetY = mark.y + 46;
      duration = 390;
    }

    mark.setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: mark,
      x: targetX,
      y: targetY,
      scale: targetScale,
      alpha: 0,
      duration,
      ease: "Sine.easeOut",
      onComplete: () => mark.destroy()
    });
  }

  currentDamageMultiplier(owner: 1 | 2 = 1): number {
    const ul = this.upgradesOf(owner);
    const passive =
      1 + (ul.damage ?? 0) * 0.08 * ATTACK_BONUS_SCALE;
    const balanced =
      this.shipOf(owner) === "balanced" && this.combo > 20
        ? 1 + 0.12 * ATTACK_BONUS_SCALE
        : 1;
    const devourLevel = this.doctrineLevels.devour_mastery ?? 0;
    const adaptiveDamage =
      1 +
      Math.min(
        0.45,
        Math.floor(this.kills / 12) * devourLevel * 0.02 * ATTACK_BONUS_SCALE
      );
    const spec = this.specOf(owner);
    const agileCritConversion =
      spec === "agile"
        ? 1 +
          agileCritRateAttackBonus(this.virtualDoctrineCritChance(owner)) *
            ATTACK_BONUS_SCALE
        : 1;
    const wheelchairHullAttack =
      spec === "wheelchair"
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
      this.statsOf(owner).damageMultiplier *
      passive *
      balanced *
      adaptiveDamage *
      agileCritConversion *
      wheelchairHullAttack *
      temporaryDamage *
      this.overdriveDamageMul
    );
  }

  virtualDoctrineCritChance(owner: 1 | 2 = 1): number {
    return Phaser.Math.Clamp(
      0.2 +
        Math.max(0, this.level - 1) * 0.05 * ATTACK_BONUS_SCALE +
        (this.upgradesOf(owner).luck ?? 0) * 0.05 * ATTACK_BONUS_SCALE,
      0,
      0.75
    );
  }

  doctrineCritEffect(owner: 1 | 2 = 1): number {
    return Math.min(
      3.5,
      2 +
        Math.max(0, this.level - 1) * 0.05 * ATTACK_BONUS_SCALE +
        (this.upgradesOf(owner).luck ?? 0) * 0.05 * ATTACK_BONUS_SCALE
    );
  }

  actualCritChance(owner: 1 | 2 = 1): number {
    const spec = this.specOf(owner);
    if (spec === "agile" || spec === "wheelchair") {
      return 0;
    }
    if (spec === "power") return this.virtualDoctrineCritChance(owner);
    return Phaser.Math.Clamp(
      this.statsOf(owner).critChance +
        (this.upgradesOf(owner).luck ?? 0) * 0.04 * ATTACK_BONUS_SCALE,
      0,
      0.75
    );
  }

  actualCritMultiplier(owner: 1 | 2 = 1): number {
    return this.specOf(owner) === "power"
      ? this.doctrineCritEffect(owner)
      : 1.75 * SPECIALIZATION_BASE_STAT_BOOST;
  }

  agileSpeedMultiplier(owner: 1 | 2 = 1): number {
    return agileCritEffectSpeedMultiplier(this.doctrineCritEffect(owner));
  }

  updateEnemyFreezeLifecycle(time: number): void {
    const frozen = time < this.enemyFreezeUntil;
    if (frozen) {
      if (this.enemyFreezeStartedAt <= 0) this.enemyFreezeStartedAt = time;
      return;
    }
    if (this.enemyFreezeStartedAt <= 0) return;
    const frozenDuration = Math.max(0, time - this.enemyFreezeStartedAt);
    this.enemyFreezeMotionOffset += frozenDuration;
    const restoreEntity = (entity: Phaser.Physics.Arcade.Image): void => {
      if (!entity.active) return;
      const values = entity.data?.values as Record<string, unknown> | undefined;
      if (values) {
        Object.entries(values).forEach(([key, value]) => {
          if (
            typeof value === "number" &&
            Number.isFinite(value) &&
            (key === "born" || key.startsWith("next") || key.endsWith("At") || key.endsWith("Until"))
          ) {
            entity.setData(key, value + frozenDuration);
          }
        });
      }
      const pausedTweens = entity.getData("freezePausedTweens") as Phaser.Tweens.Tween[] | undefined;
      pausedTweens?.forEach((tween) => {
        if (tween.isPaused()) tween.resume();
      });
      entity.setData("freezePausedTweens", undefined);
      entity.setData("freezeLockedX", undefined);
      entity.setData("freezeLockedY", undefined);
    };
    (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(restoreEntity);
    (this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(restoreEntity);
    (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(restoreEntity);
    if (this.darkAircraft?.active) restoreEntity(this.darkAircraft);
    this.darkAircraftClones.forEach(restoreEntity);
    const shiftTimer = (value: number): number =>
      Number.isFinite(value) && value > 0 ? value + frozenDuration : value;
    this.nextBossAttack = shiftTimer(this.nextBossAttack);
    this.nextBossMinionSummon = shiftTimer(this.nextBossMinionSummon);
    this.nextTrinityAttack = shiftTimer(this.nextTrinityAttack);
    this.nextUsurperDisableAt = shiftTimer(this.nextUsurperDisableAt);
    this.nextUsurperDrainAt = shiftTimer(this.nextUsurperDrainAt);
    this.darkAircraftNextAttack = shiftTimer(this.darkAircraftNextAttack);
    this.enemyFreezeStartedAt = 0;
  }

  lockFrozenHostiles(time: number): void {
    if (time >= this.enemyFreezeUntil) return;
    if (this.enemyFreezeStartedAt <= 0) this.enemyFreezeStartedAt = time;
    const lockEntity = (entity: Phaser.Physics.Arcade.Image): void => {
      if (!entity.active) return;
      if (entity.getData("freezeLockedX") === undefined) {
        entity.setData("freezeLockedX", entity.x);
        entity.setData("freezeLockedY", entity.y);
        const activeTweens = this.tweens.getTweensOf(entity).filter((tween) => tween.isPlaying());
        activeTweens.forEach((tween) => tween.pause());
        entity.setData("freezePausedTweens", activeTweens);
      }
      entity.setPosition(
        entity.getData("freezeLockedX") as number,
        entity.getData("freezeLockedY") as number
      );
      entity.setVelocity(0, 0);
    };
    (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(lockEntity);
    (this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(lockEntity);
    (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(lockEntity);
    if (this.darkAircraft?.active) lockEntity(this.darkAircraft);
    this.darkAircraftClones.forEach(lockEntity);
  }

  hostileMotionTime(time: number): number {
    return time - this.enemyFreezeMotionOffset;
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
        } else if (trajectory === "twin") {
          // 双子螺旋:左右两侧反向大摆幅螺旋交织
          bullet.x +=
            Math.sin(age * 0.017 + (bullet.getData("curvePhase") ?? 0)) *
            (bullet.getData("curveAmount") ?? 4.6) *
            1.5;
          body.velocity.y = Phaser.Math.Linear(body.velocity.y, -820, 0.004);
        }
        // 装备皮肤子弹贴图时不再自转,避免来回翻转影响视觉一致性
        if (!bullet.getData("achievementSkinBullet")) {
          bullet.rotation += 0.18;
        }
      }
      if (bullet.getData("weapon") === "agile-bloom") {
        const age = time - (bullet.getData("born") ?? time);
        if (!bullet.getData("achievementSkinBullet")) {
          bullet.rotation += 0.24;
        }
        if (age > 310) {
          const body = bullet.body as Phaser.Physics.Arcade.Body;
          bullet.setVelocity(
            Phaser.Math.Linear(body.velocity.x, 0, 0.045),
            Phaser.Math.Linear(body.velocity.y, -780, 0.075)
          );
        }
      }
      if (this.friendlyFireEnabled() && this.player2?.active) {
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
          if (weapon.includes("missile")) this.renderMissileExplosion(bullet.x, bullet.y);
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

  // 通用升级三选一:弹窗忙时稍后重试,不再静默丢弃(航线门奖励等使用)
  openUpgradePanel(onComplete?: () => void): void {
    if (this.ended) return;
    if (this.isModal || this.upgradePanelOpen) {
      this.time.delayedCall(120, () => {
        if (!this.ended && !this.isModal && !this.upgradePanelOpen) {
          showUpgrade(this, onComplete);
        }
      });
      return;
    }
    showUpgrade(this, onComplete);
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
    const weapon = String(bullet.getData("weapon") ?? "");
    if (weapon.includes("missile")) {
      // 命中小兵不渲染地面焦痕椭圆(避免"小兵死亡缓慢消失的椭圆"),只保留闪光/冲击波/碎片
      this.renderMissileExplosion(bullet.x, bullet.y, false);
    }
    if (weapon === "titan-authority") {
      this.renderBossPowerPulse("titan_meteor", bullet.x, bullet.y, 160, 460);
    }
    enemy.setData("lastOwner", bullet.getData("owner") ?? 1);
    // 影分身子弹:附加目标最大生命 0.21%→1.05% 的额外伤害
    const cloneMaxHpBonus =
      weapon === "shadow_clone_bullet"
        ? this.shadowCloneBonusDamage(enemy, ((bullet.getData("owner") as 1 | 2) ?? 1))
        : 0;
    // 敏捷万花弹环(圆圈弹幕):每颗子弹附加目标最大生命 0.1% 的额外伤害
    const bloomMaxHpBonus =
      weapon === "agile-bloom"
        ? Math.max(1, Math.ceil(((enemy.getData("maxHp") as number) ?? 0) * 0.001))
        : 0;
    // 无人机过载:命中爆炸,额外造成目标最大生命 0.5% 的伤害
    const droneExplosionBonus =
      weapon === "drone-overdrive"
        ? Math.max(1, Math.ceil(((enemy.getData("maxHp") as number) ?? 0) * 0.005))
        : 0;
    if (weapon === "drone-overdrive") {
      this.spawnDroneExplosionFx(enemy.x, enemy.y);
    }
    // 金龙炼狱(力量融合技):金龙火弹命中爆炸,附加目标最大生命 1% 伤害
    const fusionEmberBonus =
      weapon === "power_fusion"
        ? Math.max(1, Math.ceil(((enemy.getData("maxHp") as number) ?? 0) * 0.01))
        : 0;
    if (weapon === "power_fusion") {
      this.renderMissileExplosion(bullet.x, bullet.y, false);
    }
    // 导弹齐射(技能2):命中爆炸,额外造成目标最大生命 1% 的伤害
    const missileExplosionBonus =
      weapon === "active-missile"
        ? Math.max(1, Math.ceil(((enemy.getData("maxHp") as number) ?? 0) * 0.01))
        : 0;
    const bulletOwner = (bullet.getData("owner") as 1 | 2) ?? 1;
    this.dealDirectDamage(
      enemy,
      (bullet.getData("damage") as number) +
        cloneMaxHpBonus +
        bloomMaxHpBonus +
        droneExplosionBonus +
        fusionEmberBonus +
        missileExplosionBonus,
      bullet.x,
      bullet.y,
      // 敏捷流派只有 G 键(突刺/万象影袭)可暴击,子弹一律不吃暴击
      this.specOf(bulletOwner) !== "agile",
      bulletOwner
    );
    if (bulletOwner === 1) this.applyHitTrait();
    // === 吸血流派:子弹命中同帧生成 1 条虹吸链(上限 8 条) ===
    if (bulletOwner === 1) this.spawnSiphonChain(enemy);
    else if (this.specOf(2) === "vampire") this.spawnSiphonChain(enemy, 2);
    // === 敏捷流派:影分身子弹击杀 → MAX HP +1 + 回复 1% 最大生命 ===
    if (
      (bullet.getData("weapon") ?? "") === "shadow_clone_bullet" &&
      this.specOf(bulletOwner) === "agile" &&
      !enemy.active
    ) {
      enemy.setData("eliteKillWeapon", "shadow_clone_bullet");
      if (bulletOwner === 1) this.grantShadowCloneKillReward(enemy);
      else this.grantShadowCloneKillReward(enemy, 2);
    }
    const remainingPierce = bullet.getData("pierce") ?? 0;
    if (remainingPierce > 0) bullet.setData("pierce", remainingPierce - 1);
    else bullet.disableBody(true, true);
  }

  renderMissileExplosion(x: number, y: number, withScorch = true): void {
    const primary = 0xff8a38;
    const secondary = 0xffe49a;
    const flash = this.add.circle(x, y, 18, 0xffffff, 0.92)
      .setDepth(31)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shockwave = this.add.circle(x, y, 22, primary, 0.14)
      .setStrokeStyle(6, secondary, 0.94)
      .setDepth(30)
      .setBlendMode(Phaser.BlendModes.ADD);
    // 地面焦痕椭圆只用于 Boss 命中;命中小兵时渲染会留下"缓慢消失的椭圆",属于误报的特效残留
    if (withScorch) {
      const scorch = this.add.ellipse(x, y, 78, 28, 0x110807, 0.42)
        .setStrokeStyle(2, primary, 0.42)
        .setDepth(5);
      // 登记到 Boss 瞬态特效:即使 tween 被中断(Boss 死亡/清场)也不会残留椭圆焦痕
      this.trackBossEffect(scorch, 1150);
      this.tweens.add({ targets: scorch, scaleX: 1.45, alpha: 0, duration: 1050, onComplete: () => scorch.destroy() });
    }
    this.tweens.add({ targets: flash, scale: 3.2, alpha: 0, duration: 170, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: shockwave, scale: 5.4, alpha: 0, duration: 540, ease: "Cubic.Out", onComplete: () => shockwave.destroy() });
    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14 + Phaser.Math.FloatBetween(-0.12, 0.12);
      const distance = Phaser.Math.Between(58, 132);
      const shard = this.add.rectangle(
        x,
        y,
        Phaser.Math.Between(5, 11),
        Phaser.Math.Between(16, 32),
        index % 3 === 0 ? 0xffffff : primary,
        0.92
      ).setRotation(angle + Math.PI / 2).setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scaleY: 0.15,
        alpha: 0,
        duration: Phaser.Math.Between(320, 620),
        onComplete: () => shard.destroy()
      });
    }
    if (save.settings.screenShake) this.cameras.main.shake(90, 0.0035);
  }

  // 无人机过载命中爆炸:大号亮白核心 + 橙黄火球 + 冲击波 + 扩散碎片,明显可感知
  spawnDroneExplosionFx(x: number, y: number): void {
    const core = this.add
      .circle(x, y, 14, 0xfff6d8, 0.95)
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD);
    const fireball = this.add
      .circle(x, y, 22, 0xff8a3d, 0.85)
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD);
    const shockwave = this.add
      .circle(x, y, 24, 0xffd45a, 0.25)
      .setStrokeStyle(6, 0xffb84d, 0.95)
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: core, scale: 2.6, alpha: 0, duration: 200, onComplete: () => core.destroy() });
    this.tweens.add({ targets: fireball, scale: 3.2, alpha: 0, duration: 300, ease: "Cubic.Out", onComplete: () => fireball.destroy() });
    this.tweens.add({ targets: shockwave, scale: 4.2, alpha: 0, duration: 480, ease: "Cubic.Out", onComplete: () => shockwave.destroy() });
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10 + Phaser.Math.FloatBetween(-0.35, 0.35);
      const shard = this.add
        .rectangle(x, y, 6, 12, index % 3 === 0 ? 0xffffff : 0xffb84d, 0.95)
        .setRotation(angle + Math.PI / 2)
        .setDepth(26)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * Phaser.Math.Between(30, 60),
        y: y + Math.sin(angle) * Phaser.Math.Between(30, 60),
        scaleY: 0.15,
        alpha: 0,
        duration: Phaser.Math.Between(220, 400),
        onComplete: () => shard.destroy()
      });
    }
  }

  dealDirectDamage(
    target: Phaser.Physics.Arcade.Image,
    baseDamage: number,
    x: number,
    y: number,
    allowCrit = true,
    owner: 1 | 2 = 1
  ): void {
    if (!target.active) return;
    const critical = allowCrit && Math.random() < this.actualCritChance(owner);
    const damage = Math.round(baseDamage * (critical ? this.actualCritMultiplier(owner) : 1));
    if (this.bossParts.contains(target)) {
      this.damageBossPart(target, damage);
    } else {
      const hp = (target.getData("hp") ?? 1) - damage;
      target.setData("hp", hp);
      target.setData("lastHitCritical", critical);
      target.setTintFill(critical ? 0xffb4ef : 0xffffff);
      this.time.delayedCall(55, () => {
        if (!target.active) return;
        const mutation = target.getData("mutation") as EnemyMutation | null;
        if (target.getData("mutated") && mutation) target.setTint(MINION_MUTATION_COLORS[mutation]);
        else target.clearTint();
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
    if (enemy.getData("finalSwarm") === true) {
      this.finalSwarmRemaining = Math.max(0, this.finalSwarmRemaining - 1);
    }
    if (reward) {
      this.kills += 1;
      if (this.campaignInterludeActive) {
        this.campaignInterludeKills += 1;
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
      // 商店代币收益减半(升级阈值不变,代币获取减半 + 商店升级价格翻倍)
      const difficultyTokens = Math.max(
        0,
        Math.floor(
          (baseToken +
            Math.floor((LEVELS[selectedLevel - 1].danger - 1) / 2) +
            Math.floor(this.bossTier / 2) +
            (enemy.getData("eliteVariant") ? 3 : 0)) *
            0.5
        )
      );
      const killOwner = (enemy.getData("lastOwner") as 1 | 2 | undefined) ?? 1;
      const killIsP2 = killOwner === 2;
      if (this.specOf(killOwner) === "power" && enemy.getData("lastHitCritical") === true) {
        // 暴击处决 MAX HP +2 削弱 25% → +1.5
        if (killIsP2) this.player2MaxHp += 1.5;
        else this.stats.maxHp += 1.5;
        this.floatText(x, y - 48, "MAX HP +1.5", true);
      }
      if (this.specOf(killOwner) === "power") {
        const maxHp = killIsP2 ? this.player2MaxHp : this.stats.maxHp;
        const originalMaxHp = killIsP2 ? this.player2OriginalMaxHp : this.originalPlayerMaxHp;
        const extraMaxHp = Math.max(0, maxHp - originalMaxHp);
        if (extraMaxHp > 0) {
          // 力量回流 1%(P1/P2 同步)
          if (killIsP2) this.healPlayer2(extraMaxHp * 0.01, "力量回流");
          else this.healPlayer(extraMaxHp * 0.01, "力量回流");
        }
      }
      if (
        this.specOf(killOwner) === "wheelchair" &&
        enemy.getData("wheelchairRamKill") === true
      ) {
        // 撞击流派撞杀:最大生命 +2(残骸吞噬器每级额外 +1),
        // 回复削弱 1/9:2.2%→1.96% 额外生命值、2.8%→2.49% 已损生命值。
        const salvageBonus = this.upgradesOf(killOwner).ram_salvage ?? 0;
        if (killIsP2) {
          this.player2MaxHp += 2 + salvageBonus;
          const extraMaxHp = Math.max(0, this.player2MaxHp - this.player2OriginalMaxHp);
          const lostHp = Math.max(0, this.player2MaxHp - this.player2Hp);
          this.healPlayer2((extraMaxHp * 0.022 + lostHp * 0.028) * (8 / 9));
        } else {
          this.stats.maxHp += 2 + salvageBonus;
          const extraMaxHp = Math.max(0, this.stats.maxHp - this.originalPlayerMaxHp);
          const lostHp = Math.max(0, this.stats.maxHp - this.stats.hp);
          this.healPlayer((extraMaxHp * 0.022 + lostHp * 0.028) * (8 / 9));
        }
        this.floatText(
          x,
          y - 48,
          `撞击回收 · MAX HP +${2 + salvageBonus}`,
          true
        );
      }
      const eliteKill = Boolean(enemy.getData("elite"));
      // 敏捷流派技能击杀奖励已内置于突刺/影分身/联动/影分身子弹的击杀点:
      // 每次 +1 MAX HP + 回复 1% 最大生命,不再在此处按精英额外加成。
      if (eliteKill && Math.random() < 0.21) this.spawnSkillPickup(x, y);
      this.combo += 1;
      this.comboTimer = 2.5;
      this.rewardCombatStreak();
      const earned = Math.round((enemy.getData("score") ?? 50) * (1 + Math.min(2, this.combo / 100)));
      if (playVariant === "score_duel" && enemy.getData("lastOwner") === 2) this.score2 += earned;
      else this.score += earned;
      this.ultimate = Math.min(
        100,
        this.ultimate + (eliteKill ? 5 : 1)
      );
      this.spawnExperiencePickup(x, y, enemy.getData("xp") ?? 5);
      this.enemyPop(x, y, 0xff4d6d);
      // 商店代币加到 runTokens,左上角数字会自动刷新(按对局时间打折后入账,不再飘字)
      this.grantRunTokens(difficultyTokens);
      this.unlockAchievement("first_blood");
      if (Math.max(this.score, this.score2) >= 10000) this.unlockAchievement("score_10k");
    }
    enemy.disableBody(true, true);
  }

  rewardCombatStreak(): void {
    const milestones: Record<number, { title: string; tokens: number; ultimate: number }> = {
      8: { title: "猎杀连锁", tokens: 3, ultimate: 5 },
      20: { title: "火力狂潮", tokens: 7, ultimate: 10 },
      40: { title: "王牌时刻", tokens: 14, ultimate: 18 }
    };
    const milestone = milestones[this.combo];
    if (!milestone) return;
    const reward = milestone.tokens + selectedLevel;
    this.grantRunTokens(reward);
    this.ultimate = Math.min(100, this.ultimate + milestone.ultimate);
    this.showBanner(`${milestone.title} · ${this.combo} COMBO`, 760);
    this.burst(this.player.x, this.player.y, 0xffbd3e, 1.6);
    sfx("upgrade");
  }

  // 商店代币时间衰减:按对局进行时间对代币收益打折
  // (1 分钟内 -75%,1~2 分钟 -50%,2~3 分钟 -1/3,3~4 分钟 -15%,4 分钟后全额)
  tokenTimeMultiplier(): number {
    const t = this.elapsedSeconds;
    if (t < 60) return 0.25;
    if (t < 120) return 0.5;
    if (t < 180) return 2 / 3;
    if (t < 240) return 0.85;
    return 1;
  }

  // 按时间折扣发放商店代币,返回实际入账数量(展示文案用返回值,避免"显示全额实际打折")
  // (所有获得来源先统一减少 70% 再减少 20%:总入口 ×0.24,含敌人掉落/里程碑/Boss 奖励/关卡奖励/结局奖励等)
  grantRunTokens(raw: number): number {
    const granted = Math.round(raw * 0.24 * this.tokenTimeMultiplier());
    this.runTokens += granted;
    return granted;
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
    const healed = Math.max(0.15, (this.stats.maxHp - this.stats.hp) * 0.012);
    this.healPlayer(healed);
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
        `敏捷生命回响 ×${pulses} · 回复 ${formatRoundedNumberForDisplay(
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

  // 双人 P2 回血(吸血/撞击再生/反应装甲回流等 P2 专精被动使用)
  healPlayer2(amount: number, label?: string): void {
    if (!this.player2?.active) return;
    const before = this.player2Hp;
    this.player2Hp = roundHealth(this.player2Hp + amount, this.player2MaxHp);
    const healed = this.player2Hp - before;
    if (healed <= 0) return;
    this.burst(this.player2.x, this.player2.y, 0x43ff9a, 0.7);
    if (label) this.floatText(this.player2.x, this.player2.y - 48, `${label} +${Math.round(healed)}`, true);
  }

  currentBossEncounterAttackScale(): number {
    return isNineBattleMode()
      ? campaignEncounterAttackScale(this.campaignEncounterIndex)
      : 1;
  }

  damagePlayerDark(flatDamage: number, maxHpRatio: number, label: string): void {
    const now = this.time.now;
    if (now < this.invulnerableUntil || now < this.darkDeityInvulnUntil || this.ended) return;
    const armorScale = permanentArmorScale();
    const damageReduction = Phaser.Math.Clamp(
      this.stats.damageTakenMultiplier / Math.max(0.01, armorScale),
      0.25,
      1.4
    );
    const overdriveReduction =
      save.selectedSpecialization === "wheelchair" && now < this.wheelchairOverdriveUntil
        ? 0.7
        : 1;
    const ramArmorReduction = this.wheelchairRamArmorReduction();
    const preSkillDamage = Math.max(
      1,
      Math.ceil(
        (flatDamage + this.stats.maxHp * maxHpRatio) *
          this.currentBossEncounterAttackScale() *
          this.bossPassiveBossDamageTakenMultiplier *
          damageReduction *
          collisionBossDamageScale(
            this.stats.maxHp,
            save.selectedSpecialization === "wheelchair"
          ) *
          overdriveReduction *
          ramArmorReduction
      )
    );
    const damage = Math.max(
      1,
      Math.ceil(preSkillDamage * this.wheelchairActiveDefenseMultiplier(now))
    );
    this.recordWheelchairReactiveAbsorption(preSkillDamage, damage);
    this.stats.hp = Math.max(0, this.stats.hp - damage);
    this.playerWasHit = true;
    this.invulnerableUntil = now + 480;
    // === 防御流派:荆棘护甲 — 百分比伤害按 100 HP 反伤 ===
    this.applyThorns(damage, null);
    this.floatText(this.player.x, this.player.y - 56, `${label} -${damage}`, true);
    this.burst(this.player.x, this.player.y, 0x6d0b8f, 1.6);
    this.cameras.main.flash(95, 60, 0, 80);
    if (save.settings.screenShake) this.cameras.main.shake(180, 0.011);
    if (this.stats.hp <= 0) {
      this.playerExplosion(this.player.x, this.player.y);
      this.player.setVisible(false);
      if (playVariant === "single" || !this.player2?.active || this.coopHandoverDone) {
        this.time.delayedCall(750, () => this.endRun(false));
      } else {
        this.triggerP1HandOver();
      }
    } else {
      this.player.setTintFill(0x6d0b8f);
      this.time.delayedCall(90, () => {
        if (this.player.active) this.player.clearTint();
      });
    }
  }

  applyDarkDot(totalDamage: number, duration: number, label: string): void {
    const scaledTotalDamage =
      totalDamage * this.currentBossEncounterAttackScale();
    this.darkDotRemaining += scaledTotalDamage;
    this.darkDotPerSecond = Math.max(
      this.darkDotPerSecond,
      scaledTotalDamage / duration
    );
    this.darkDotUntil = Math.max(this.darkDotUntil, this.time.now + duration * 1000);
    this.darkHealLockUntil = Math.max(this.darkHealLockUntil, this.darkDotUntil);
    this.nextDarkDotTick = Math.min(this.nextDarkDotTick || this.time.now, this.time.now);
    this.showBanner(`${label} · ${formatRoundedNumberForDisplay(duration)} 秒禁止回血`, 900);
  }

  renderDarkEnergyEffect(x: number, y: number, intensity = 1): void {
    const core = this.add.circle(x, y, 22 * intensity, 0x030006, 0.82)
      .setStrokeStyle(5, 0xb316ff, 0.9)
      .setDepth(23);
    const rupture = this.add.circle(x, y, 56 * intensity, 0x24002f, 0.08)
      .setStrokeStyle(3, 0xff2d8f, 0.8)
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: core,
      scale: 1.7,
      alpha: 0,
      duration: 420,
      onComplete: () => core.destroy()
    });
    this.tweens.add({
      targets: rupture,
      rotation: Math.PI / 2,
      scale: 1.9,
      alpha: 0,
      duration: 560,
      onComplete: () => rupture.destroy()
    });
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6 + this.time.now * 0.002;
      const radius = 58 * intensity;
      const mote = this.add.circle(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        5 * intensity,
        index % 2 ? 0xff2d8f : 0x7b20ff,
        0.92
      ).setStrokeStyle(2, 0x050008, 1).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote,
        x,
        y,
        scale: 0.15,
        alpha: 0,
        duration: 380 + index * 30,
        onComplete: () => mote.destroy()
      });
    }
  }

  updateDarkEffects(time: number): void {
    if (this.darkDotRemaining > 0 && time < this.darkDotUntil && time >= this.nextDarkEnergyFxAt) {
      this.nextDarkEnergyFxAt = time + 180;
      this.renderDarkEnergyEffect(this.player.x, this.player.y, 0.72);
    }
    if (this.darkDotRemaining > 0 && time < this.darkDotUntil && time >= this.nextDarkDotTick) {
      this.nextDarkDotTick = time + 250;
      const tick = Math.min(this.darkDotRemaining, this.darkDotPerSecond * 0.25);
      this.darkDotRemaining -= tick;
      const armorScale = permanentArmorScale();
      const reduction = Phaser.Math.Clamp(
        this.stats.damageTakenMultiplier / Math.max(0.01, armorScale),
        0.25,
        1.4
      );
      const ramArmorReduction = this.wheelchairRamArmorReduction();
      const bossDamageScale = collisionBossDamageScale(
        this.stats.maxHp,
        save.selectedSpecialization === "wheelchair"
      );
      this.stats.hp = roundHealth(
        this.stats.hp - tick * reduction * bossDamageScale * ramArmorReduction,
        this.stats.maxHp
      );
      this.player.setTint(0x7f2d9f);
      this.time.delayedCall(90, () => {
        if (this.player.active) this.player.clearTint();
      });
      if (this.stats.hp <= 0) {
        this.playerExplosion(this.player.x, this.player.y);
        this.player.setVisible(false);
        if (playVariant === "single" || !this.player2?.active || this.coopHandoverDone) {
          this.time.delayedCall(750, () => this.endRun(false));
        } else {
          this.triggerP1HandOver();
        }
      }
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
        // 黑影大漩涡的拖拽减速减半：保留吸入感，但不再明显压制走位。
        this.player.x = Phaser.Math.Linear(this.player.x, centerX, 0.00225);
        this.player.y = Phaser.Math.Linear(this.player.y, centerY, 0.00225);
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

  wheelchairActiveDefenseMultiplier(now = this.time.now, owner: 1 | 2 = 1): number {
    if (this.specOf(owner) !== "wheelchair") return 1;
    const isP2 = owner === 2;
    return wheelchairActiveDamageTakenMultiplier(
      now < (isP2 ? this.wheelchairBreachUntil2 : this.wheelchairBreachUntil),
      now < (isP2 ? this.wheelchairReactiveArmorUntil2 : this.wheelchairReactiveArmorUntil),
      now < (isP2 ? this.wheelchairFortressUntil2 : this.wheelchairFortressUntil)
    );
  }

  // 撞击流派"撞角装甲"减伤系数(上限 -25%)
  wheelchairRamArmorReduction(owner: 1 | 2 = 1): number {
    return this.specOf(owner) === "wheelchair"
      ? 1 - Math.min(0.25, (this.upgradesOf(owner).ram_armor ?? 0) * 0.05)
      : 1;
  }

  recordWheelchairReactiveAbsorption(
    preSkillDamage: number,
    receivedDamage: number,
    owner: 1 | 2 = 1
  ): void {
    const isP2 = owner === 2;
    const armorUntil = isP2 ? this.wheelchairReactiveArmorUntil2 : this.wheelchairReactiveArmorUntil;
    const stored = isP2 ? this.wheelchairReactiveStoredDamage2 : this.wheelchairReactiveStoredDamage;
    if (this.specOf(owner) !== "wheelchair" || this.time.now >= armorUntil) {
      return;
    }
    const prevented = Math.max(0, preSkillDamage - receivedDamage);
    if (prevented <= 0) return;
    const nextStored = Math.min(this.maxHpOf(owner) * 0.5, stored + prevented);
    if (isP2) this.wheelchairReactiveStoredDamage2 = nextStored;
    else this.wheelchairReactiveStoredDamage = nextStored;
  }

  consumeWheelchairReactiveCharge(x: number, y: number, owner: 1 | 2 = 1): number {
    const isP2 = owner === 2;
    const stored = isP2 ? this.wheelchairReactiveStoredDamage2 : this.wheelchairReactiveStoredDamage;
    if (stored <= 0) return 0;
    const release = reactiveArmorRelease(stored);
    if (isP2) this.wheelchairReactiveStoredDamage2 = 0;
    else this.wheelchairReactiveStoredDamage = 0;
    if (owner === 1) this.healPlayer(release.healing, "反应装甲回流");
    else this.healPlayer2(release.healing, "反应装甲回流");
    const blast = this.add
      .circle(x, y, 92, 0xff8a22, 0.1)
      .setStrokeStyle(8, 0xffffff, 0.94)
      .setDepth(29)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: blast,
      scale: 3.4,
      rotation: Math.PI / 2,
      alpha: 0,
      duration: 520,
      ease: "Cubic.Out",
      onComplete: () => blast.destroy()
    });
    this.floatText(x, y - 44, `装甲释放 ${Math.round(release.damage)}`, true);
    if (save.settings.screenShake) this.cameras.main.shake(180, 0.009);
    return release.damage;
  }

  wheelchairSkillDirection(owner: 1 | 2 = 1): Phaser.Math.Vector2 {
    const sprite = owner === 2 ? this.player2 : this.player;
    if (!sprite?.active) return new Phaser.Math.Vector2(0, -1);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const direction = new Phaser.Math.Vector2(
      owner === 2
        ? Number(this.keyHeld("p2_move_right")) - Number(this.keyHeld("p2_move_left"))
        : Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
      owner === 2
        ? Number(this.keyHeld("p2_move_down")) - Number(this.keyHeld("p2_move_up"))
        : Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown)
    );
    if (owner === 1) {
      direction.x += Number(this.wasd.D.isDown) - Number(this.wasd.A.isDown);
      direction.y += Number(this.wasd.S.isDown) - Number(this.wasd.W.isDown);
    }
    if (direction.lengthSq() < 0.1) direction.set(body.velocity.x, body.velocity.y);
    if (direction.lengthSq() < 10) direction.set(0, -1);
    return direction.normalize();
  }

  wheelchairSkillAvailable(key: string, label: string, cooldownMs: number, owner: 1 | 2 = 1): boolean {
    if (this.ended || this.isModal || this.specOf(owner) !== "wheelchair") return false;
    if (this.skillsConfiscated) {
      showToast(`${label}被技能篡夺者封锁`);
      return false;
    }
    const readyAt = this.skillReadyAt[key] ?? 0;
    if (this.time.now < readyAt) {
      cooldownToast(label, readyAt, this.time.now);
      return false;
    }
    this.skillReadyAt[key] = this.time.now + cooldownMs * this.statsOf(owner).cooldownMultiplier;
    return true;
  }

  activateWheelchairBreachHorn(owner: 1 | 2 = 1): void {
    const skill = WHEELCHAIR_ACTIVE_SKILLS.breachHorn;
    const ownerSprite = owner === 2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    if (!this.wheelchairSkillAvailable(`wheelchair-breach-horn-${owner}`, "破阵冲角", skill.cooldownMs, owner)) {
      return;
    }
    const direction = this.wheelchairSkillDirection(owner);
    const startX = ownerSprite.x;
    const startY = ownerSprite.y;
    const endX = Phaser.Math.Clamp(startX + direction.x * skill.distance, 54, WORLD_WIDTH - 54);
    const endY = Phaser.Math.Clamp(startY + direction.y * skill.distance, 120, WORLD_HEIGHT - 68);
    const candidates = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter(
        (enemy) =>
          enemy.active &&
          distancePointToSegment(enemy.x, enemy.y, startX, startY, endX, endY) <=
            enemy.displayWidth * 0.34 + 64
      )
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(startX, startY, a.x, a.y) -
          Phaser.Math.Distance.Between(startX, startY, b.x, b.y)
      );
    // 群体穿刺:撞线内所有敌人全部受击,不再只打第一个
    let hitCount = 0;
    let lastHitX = startX;
    let lastHitY = startY;
    for (const target of candidates) {
      hitCount += 1;
      lastHitX = target.x;
      lastHitY = target.y;
      // 反应装甲存储伤害只消耗一次(首个命中的敌人)
      const reactiveBonus =
        hitCount === 1 ? this.consumeWheelchairReactiveCharge(target.x, target.y, owner) : 0;
      const ramDamage = this.wheelchairRamDamage(owner) * skill.ramDamageMultiplier + reactiveBonus;
      const hp = (target.getData("hp") as number) ?? 1;
      target.setData("lastOwner", owner).setData("wheelchairRamKill", hp <= ramDamage);
      this.renderBilliardChainImpact(ownerSprite, target);
      if (hp <= ramDamage) {
        this.destroyEnemy(target, true);
      } else {
        target.setData("hp", hp - ramDamage);
        target
          .setVelocity(direction.x * 1280, direction.y * 1280 - 50)
          .setData("wheelchairKnockedUntil", this.time.now + 1650)
          .setData("wheelchairKnockDamage", this.wheelchairRamDamage(owner) * 1.35)
          .setData("billiardBounceLeft", 6)
          .setTint(0xfff0a8);
        this.spawnKnockedFx(target, 0xff8a22, 0xfff0a8);
      }
    }
    if (hitCount > 0) {
      this.triggerRamShockwave(lastHitX, lastHitY, undefined, true, owner);
      this.floatText(lastHitX, lastHitY - 38, `冲角 ×${hitCount}`, true);
      // 命中 ≥3 个敌人:额外触发一次 3× 冲角范围冲击波
      if (hitCount >= 3) {
        const waveDamage = this.wheelchairRamDamage(owner) * 3;
        const waveRadius = 280;
        for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
          if (
            !enemy.active ||
            Phaser.Math.Distance.Between(lastHitX, lastHitY, enemy.x, enemy.y) > waveRadius
          ) {
            continue;
          }
          enemy.setData("lastOwner", owner);
          this.dealDirectDamage(enemy, waveDamage, enemy.x, enemy.y);
        }
        this.burst(lastHitX, lastHitY, 0xff7a22, 2.4);
        this.floatText(lastHitX, lastHitY - 40, `破军震荡 ${Math.round(waveDamage)}`, true);
      }
    } else {
      const bossCore = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[])
        .filter(
          (part) =>
            part.active &&
            ["core", "raid-core"].includes(part.getData("part")) &&
            distancePointToSegment(part.x, part.y, startX, startY, endX, endY) <=
              part.displayWidth * 0.2 + 60
        )
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(startX, startY, a.x, a.y) -
            Phaser.Math.Distance.Between(startX, startY, b.x, b.y)
        )[0];
      if (bossCore) {
        const bossMax =
          bossCore.getData("part") === "raid-core"
            ? (bossCore.getData("maxHp") as number) ?? this.bossMaxHp / 3
            : this.bossMaxHp;
        const damage =
          Math.max(
            this.wheelchairRamDamage(owner) * skill.ramDamageMultiplier,
            bossMax * 0.03 * this.wheelchairHullAttackMultiplier(owner)
          ) + this.consumeWheelchairReactiveCharge(bossCore.x, bossCore.y, owner);
        bossCore.setData("collisionFinisher", true);
        const phaseMultiplier = this.bossPhase === 1 ? 0.65 : 1.25;
        this.damageBossPart(
          bossCore,
          bossCore.getData("part") === "raid-core" ? damage : damage / phaseMultiplier
        );
        this.triggerRamShockwave(bossCore.x, bossCore.y, bossCore, true, owner);
        this.floatText(bossCore.x, bossCore.y + 42, `冲角 ${Math.round(damage)}`, true);
      }
    }
    const trail = this.add.graphics().setDepth(28);
    trail.lineStyle(64, 0xff7a22, 0.18);
    trail.lineBetween(startX, startY, endX, endY);
    trail.lineStyle(9, 0xfff3b0, 0.92);
    trail.lineBetween(startX, startY, endX, endY);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 420,
      onComplete: () => trail.destroy()
    });
    if (owner === 2) {
      ownerSprite.setPosition(endX, endY).setVelocity(direction.x * 520, direction.y * 520);
      this.player2CollisionReadyAt = this.time.now + 260;
      this.wheelchairBreachUntil2 = this.time.now + skill.protectionMs;
      this.showBanner("P2 · 1 · 破阵冲角 · 群体穿刺", 820);
    } else {
      this.player.setPosition(endX, endY).setVelocity(direction.x * 520, direction.y * 520);
      this.targetX = endX;
      this.targetY = endY;
      this.collisionReadyAt = this.time.now + 260;
      this.wheelchairBreachUntil = this.time.now + skill.protectionMs;
      this.showBanner("1 · 破阵冲角 · 群体穿刺", 820);
    }
    this.burst(startX, startY, 0xff7a22, 1.5);
    this.burst(endX, endY, 0xffd45a, 2.2);
  }

  activateWheelchairReactiveArmor(owner: 1 | 2 = 1): void {
    const skill = WHEELCHAIR_ACTIVE_SKILLS.reactiveArmor;
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    if (!this.wheelchairSkillAvailable(`wheelchair-reactive-armor-${owner}`, "反应装甲", skill.cooldownMs, owner)) {
      return;
    }
    const visual = isP2 ? this.wheelchairReactiveArmorVisual2 : this.wheelchairReactiveArmorVisual;
    visual?.destroy();
    const newVisual = this.add
      .circle(ownerSprite.x, ownerSprite.y, ownerSprite.displayWidth * 0.62, 0xff8a22, 0.08)
      .setStrokeStyle(9, 0xfff1a8, 0.9)
      .setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (isP2) this.wheelchairReactiveArmorVisual2 = newVisual;
    else this.wheelchairReactiveArmorVisual = newVisual;
    if (isP2) this.wheelchairReactiveArmorUntil2 = this.time.now + skill.durationMs;
    else this.wheelchairReactiveArmorUntil = this.time.now + skill.durationMs;
    this.burst(ownerSprite.x, ownerSprite.y, 0xff8a22, 2.2);
    this.showBanner(isP2 ? "P2 · 2 · 反应装甲 · 减伤 65% · 吸收转化" : "2 · 反应装甲 · 减伤 65% · 吸收转化", 1050);
  }

  activateWheelchairFortressStance(owner: 1 | 2 = 1): void {
    const skill = WHEELCHAIR_ACTIVE_SKILLS.fortressStance;
    // 天体碰撞(撞击融合技):3 键堡垒姿态变为蓄力后全屏天体坠落
    const fusionLevel = this.upgradesOf(owner).wheelchair_fusion ?? 0;
    if (fusionLevel > 0) {
      const isP2 = owner === 2;
      const ownerSprite = isP2 ? this.player2 : this.player;
      if (!ownerSprite?.active) return;
      if (this.time.now < this.celestialReadyAt[owner]) {
        showToast(
          `天体碰撞冷却 ${Math.ceil((this.celestialReadyAt[owner] - this.time.now) / 1000)}s`
        );
        return;
      }
      this.celestialReadyAt[owner] = this.time.now + (18 - fusionLevel) * 1000;
      this.celestialChargeUntil[owner] = this.time.now + 1400;
      // 蓄力期间主动技能无敌(可穿 Boss 预警大技能)
      if (isP2) this.player2InvulnUntil = Math.max(this.player2InvulnUntil, this.time.now + 1400);
      else this.activeInvulnerableUntil = Math.max(this.activeInvulnerableUntil, this.time.now + 1400);
      this.showBanner(
        isP2 ? "P2 ☄ 天体碰撞 · 蓄力 1.4s" : "☄ 天体碰撞 · 蓄力 1.4s",
        1100
      );
      this.cameras.main.flash(120, 255, 130, 50);
      sfx("boss");
      return;
    }
    if (!this.wheelchairSkillAvailable(`wheelchair-fortress-${owner}`, "堡垒姿态", skill.cooldownMs, owner)) {
      return;
    }
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    if (isP2) {
      this.wheelchairFortressUntil2 = this.time.now + skill.durationMs;
      this.wheelchairFortressApplied2 = true;
      ownerSprite.setDisplaySize(
        this.wheelchairFortressBaseWidth2 * skill.sizeMultiplier,
        this.wheelchairFortressBaseHeight2 * skill.sizeMultiplier
      );
      this.configurePlayerBody(ownerSprite, 42);
      this.wheelchairFortressVisual2?.destroy();
      this.wheelchairFortressVisual2 = this.add
        .circle(ownerSprite.x, ownerSprite.y, 104, 0xff7a22, 0.06)
        .setStrokeStyle(8, 0xffd45a, 0.86)
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD);
    } else {
      this.wheelchairFortressUntil = this.time.now + skill.durationMs;
      this.wheelchairFortressApplied = true;
      ownerSprite.setDisplaySize(
        this.wheelchairFortressBaseWidth * skill.sizeMultiplier,
        this.wheelchairFortressBaseHeight * skill.sizeMultiplier
      );
      this.configurePlayerBody(ownerSprite, 42);
      this.wheelchairFortressVisual?.destroy();
      this.wheelchairFortressVisual = this.add
        .circle(ownerSprite.x, ownerSprite.y, 104, 0xff7a22, 0.06)
        .setStrokeStyle(8, 0xffd45a, 0.86)
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    this.burst(ownerSprite.x, ownerSprite.y, 0xffd45a, 2.8);
    this.showBanner(isP2 ? "P2 · 3 · 堡垒姿态 · 体型 +50% · 减伤 50%" : "3 · 堡垒姿态 · 体型 +50% · 减伤 50%", 1050);
    if (save.settings.screenShake) this.cameras.main.shake(220, 0.01);
  }

  updateWheelchairActiveSkills(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (this.specOf(owner) !== "wheelchair" || !ownerSprite?.active) return;
    const armorVisual = isP2 ? this.wheelchairReactiveArmorVisual2 : this.wheelchairReactiveArmorVisual;
    const armorUntil = isP2 ? this.wheelchairReactiveArmorUntil2 : this.wheelchairReactiveArmorUntil;
    const storedDamage = isP2 ? this.wheelchairReactiveStoredDamage2 : this.wheelchairReactiveStoredDamage;
    if (armorVisual?.active) {
      if (time >= armorUntil) {
        armorVisual.destroy();
        if (isP2) this.wheelchairReactiveArmorVisual2 = undefined;
        else this.wheelchairReactiveArmorVisual = undefined;
      } else {
        const chargeRatio = Phaser.Math.Clamp(
          storedDamage / Math.max(1, this.maxHpOf(owner) * 0.5),
          0,
          1
        );
        armorVisual
          .setPosition(ownerSprite.x, ownerSprite.y)
          .setRadius(ownerSprite.displayWidth * (0.58 + chargeRatio * 0.12))
          .setAlpha(0.46 + chargeRatio * 0.36);
      }
    }
    const fortressApplied = isP2 ? this.wheelchairFortressApplied2 : this.wheelchairFortressApplied;
    const fortressUntil = isP2 ? this.wheelchairFortressUntil2 : this.wheelchairFortressUntil;
    const fortressVisual = isP2 ? this.wheelchairFortressVisual2 : this.wheelchairFortressVisual;
    if (fortressApplied && time >= fortressUntil) {
      if (isP2) {
        this.wheelchairFortressApplied2 = false;
        ownerSprite.setDisplaySize(
          this.wheelchairFortressBaseWidth2,
          this.wheelchairFortressBaseHeight2
        );
        this.wheelchairFortressVisual2?.destroy();
        this.wheelchairFortressVisual2 = undefined;
      } else {
        this.wheelchairFortressApplied = false;
        ownerSprite.setDisplaySize(
          this.wheelchairFortressBaseWidth,
          this.wheelchairFortressBaseHeight
        );
        this.wheelchairFortressVisual?.destroy();
        this.wheelchairFortressVisual = undefined;
      }
      this.configurePlayerBody(ownerSprite);
      this.burst(ownerSprite.x, ownerSprite.y, 0xffbd3e, 1.2);
    } else if (fortressVisual?.active) {
      fortressVisual
        .setPosition(ownerSprite.x, ownerSprite.y)
        .setRotation(time * 0.0012)
        .setAlpha(0.46 + Math.sin(time * 0.012) * 0.1);
    }
  }

  updateWheelchairRecovery(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    if (this.specOf(owner) !== "wheelchair") return;
    const nextHeal = isP2 ? this.nextWheelchairHeal2 : this.nextWheelchairHeal;
    if (time < nextHeal) return;
    if (isP2) this.nextWheelchairHeal2 = time + 5000;
    else this.nextWheelchairHeal = time + 5000;
    // 撞击流派回血能力 +100%:每 5s 的治疗量翻倍
    const healing =
      this.maxHpOf(owner) *
      (0.05 * SPECIALIZATION_BASE_STAT_BOOST +
        (this.upgradesOf(owner).ram_regen ?? 0) * 0.008) *
      2;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    if (owner === 1) this.healPlayer(healing, "撞击核心再生");
    else this.healPlayer2(healing, "撞击核心再生");
    const pulse = this.add
      .circle(ownerSprite.x, ownerSprite.y, 24, 0xffbd3e, 0.05)
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
      cooldownToast("破阵冲刺", this.skillReadyAt[key] ?? 0, this.time.now);
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
    const dashAngle = Math.atan2(endY - startY, endX - startX);
    for (let index = 1; index <= 5; index += 1) {
      const ratio = index / 6;
      const chevron = this.add.rectangle(
        Phaser.Math.Linear(startX, endX, ratio),
        Phaser.Math.Linear(startY, endY, ratio),
        36,
        8,
        index % 2 ? 0xffbd3e : 0xffffff,
        0.76
      ).setRotation(dashAngle).setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: chevron,
        scaleX: 2.2,
        alpha: 0,
        duration: 300 + index * 35,
        onComplete: () => chevron.destroy()
      });
    }
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

  activateWheelchairOverdrive(owner: 1 | 2 = 1): void {
    if (this.ended || this.isModal) return;
    const isP2 = owner === 2;
    if (this.specOf(owner) !== "wheelchair") {
      showToast("全速冲锋仅属于撞击流派");
      return;
    }
    if (owner === 1 && this.skillsConfiscated) {
      showToast("冲锋引擎被技能篡夺者封锁");
      return;
    }
    const key = isP2 ? "wheelchair-overdrive-2" : "wheelchair-overdrive";
    const cooldown = 16000 * this.statsOf(owner).cooldownMultiplier;
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      cooldownToast("全速冲锋", this.skillReadyAt[key] ?? 0, this.time.now);
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    if (isP2) this.wheelchairOverdriveUntil2 = this.time.now + 6000;
    else this.wheelchairOverdriveUntil = this.time.now + 6000;
    const shock = this.add
      .circle(ownerSprite.x, ownerSprite.y, 68, 0xffbd3e, 0.1)
      .setStrokeStyle(5, 0xffffff, 0.92)
      .setDepth(22);
    this.tweens.add({
      targets: shock,
      scale: 3.1,
      rotation: Math.PI / 3,
      alpha: 0,
      duration: 460,
      onComplete: () => shock.destroy()
    });
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const fin = this.add.rectangle(
        ownerSprite.x + Math.cos(angle) * 48,
        ownerSprite.y + Math.sin(angle) * 48,
        34,
        7,
        index % 2 ? 0xffffff : 0xffbd3e,
        0.82
      ).setRotation(angle).setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: fin,
        x: ownerSprite.x + Math.cos(angle) * 150,
        y: ownerSprite.y + Math.sin(angle) * 150,
        scaleX: 0.2,
        alpha: 0,
        duration: 520,
        onComplete: () => fin.destroy()
      });
    }
    this.burst(ownerSprite.x, ownerSprite.y, 0xffbd3e, 2);
    this.showBanner(`${isP2 ? "P2 · " : ""}全速冲锋 · 机动 ×1.9 · 受到伤害 -30%`, 1050);
    if (save.settings.screenShake) this.cameras.main.shake(190, 0.009);
  }

  spawnAnimatedVfx(
    texture: string,
    x: number,
    y: number,
    firstFrame: number,
    duration = 880,
    size: number | { width: number; height: number } = 250,
    trackedBossEffect = false,
    depth = 26,
    peakAlpha = 0.9,
    rotation = 0
  ): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(texture)) return undefined;
    const displayWidth = typeof size === "number" ? size : size.width;
    const displayHeight = typeof size === "number" ? size : size.height;
    const effect = this.add
      .image(x, y, texture, firstFrame)
      .setDisplaySize(displayWidth, displayHeight)
      .setRotation(rotation)
      .setDepth(depth)
      .setAlpha(peakAlpha)
      .setBlendMode(Phaser.BlendModes.ADD);
    const baseScaleX = effect.scaleX;
    const baseScaleY = effect.scaleY;
    const startedAt = this.time.now;
    const frameTimer = this.time.addEvent({
      delay: 82,
      loop: true,
      callback: () => {
        if (!effect.active) {
          frameTimer.remove(false);
          return;
        }
        const frame = Math.floor((this.time.now - startedAt) / 82) % 4;
        effect.setFrame(firstFrame + frame);
      }
    });
    effect.once("destroy", () => frameTimer.remove(false));
    this.tweens.add({
      targets: effect,
      // 保留 setDisplaySize 指定的真实判定范围尺寸。旧代码 tween `scale`
      // 会把宽高重置成贴图原始比例，导致大范围技能最后只剩中心一小块。
      scaleX: { from: baseScaleX * 0.92, to: baseScaleX * 1.08 },
      scaleY: { from: baseScaleY * 0.92, to: baseScaleY * 1.08 },
      rotation: rotation + 0.1,
      alpha: { from: peakAlpha, to: 0 },
      duration,
      ease: "Cubic.Out",
      onComplete: () => effect.destroy()
    });
    return trackedBossEffect
      ? this.trackBossEffect(effect, duration + 120)
      : effect;
  }

  bossSkillRangeColor(kind: BossKind | "dark_aircraft"): number {
    if (kind === "titan") return 0xff7a32;
    if (kind === "mirror") return 0x42efff;
    if (kind === "usurper") return 0xffd45a;
    if (kind === "shadow") return 0xff2d8f;
    if (kind === "dark_aircraft") return 0xff4da6;
    return 0xc13dff;
  }

  bossPowerRangeColor(power: BossPowerId): number {
    if (power === "titan_meteor") return 0xff9a45;
    if (power === "mirror_copy") return 0x8c7dff;
    if (power === "usurper_lock") return 0x52e6ff;
    if (power === "shadow_rift_blade") return 0xff2d8f;
    if (power === "absolute_freeze") return 0x79f4ff;
    return 0xd02b82;
  }

  renderSkillRangeBoundary(
    x: number,
    y: number,
    size: number | { width: number; height: number },
    color: number,
    duration: number,
    label: "危险范围" | "权柄范围",
    trackedBossEffect: boolean,
    rotation = 0
  ): void {
    const isCircle = typeof size === "number";
    const width = isCircle ? size : size.width;
    const height = isCircle ? size : size.height;
    // 斜向技能(如黑影爪痕/冲刺)的边界整体绕中心旋转,与实际伤害范围保持一致
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const rotX = (ox: number, oy: number) => x + ox * cosR - oy * sinR;
    const rotY = (ox: number, oy: number) => y + ox * sinR + oy * cosR;
    const outer = isCircle
      ? this.add.circle(x, y, Math.max(10, width / 2), color, 0.025)
      : this.add.rectangle(x, y, width, height, color, 0.025);
    const inner = isCircle
      ? this.add.circle(x, y, Math.max(6, width / 2 - 9), 0xffffff, 0)
      : this.add.rectangle(x, y, Math.max(8, width - 16), Math.max(8, height - 16), 0xffffff, 0);
    if (!isCircle && rotation) {
      outer.setRotation(rotation);
      inner.setRotation(rotation);
    }
    outer.setStrokeStyle(8, color, 0.98).setDepth(27);
    inner.setStrokeStyle(2, 0xffffff, 0.84).setDepth(27);
    const pulseRepeat = Math.max(1, Math.ceil(duration / 240) - 1);
    this.tweens.add({
      targets: [outer, inner],
      alpha: { from: 0.62, to: 1 },
      yoyo: true,
      repeat: pulseRepeat,
      duration: 120
    });
    const rangeObjects: Phaser.GameObjects.GameObject[] = [outer, inner];
    const entityMarkers: Phaser.GameObjects.Shape[] = [];
    if (isCircle) {
      const radius = Math.max(10, width / 2);
      const markerCount = Phaser.Math.Clamp(Math.round((Math.PI * 2 * radius) / 96), 8, 16);
      for (let index = 0; index < markerCount; index += 1) {
        const angle = (Math.PI * 2 * index) / markerCount;
        entityMarkers.push(
          this.add
            .circle(
              x + Math.cos(angle) * radius,
              y + Math.sin(angle) * radius,
              8,
              color,
              0.72
            )
            .setStrokeStyle(2, 0xffffff, 0.9)
            .setDepth(27)
        );
      }
    } else {
      const cornerLength = Math.max(24, Math.min(56, width * 0.22, height * 0.22));
      for (const sideX of [-1, 1]) {
        for (const sideY of [-1, 1]) {
          entityMarkers.push(
            this.add
              .rectangle(
                rotX(sideX * (width / 2 - cornerLength / 2), sideY * (height / 2 - 5)),
                rotY(sideX * (width / 2 - cornerLength / 2), sideY * (height / 2 - 5)),
                cornerLength,
                10,
                color,
                0.92
              )
              .setStrokeStyle(2, 0xffffff, 0.88)
              .setRotation(rotation)
              .setDepth(27),
            this.add
              .rectangle(
                rotX(sideX * (width / 2 - 5), sideY * (height / 2 - cornerLength / 2)),
                rotY(sideX * (width / 2 - 5), sideY * (height / 2 - cornerLength / 2)),
                10,
                cornerLength,
                color,
                0.92
              )
              .setStrokeStyle(2, 0xffffff, 0.88)
              .setRotation(rotation)
              .setDepth(27)
          );
        }
      }
      if (height > 300) {
        const nodeCount = Phaser.Math.Clamp(Math.floor(height / 190), 2, 7);
        for (let index = 1; index < nodeCount; index += 1) {
          const nodeY = y - height / 2 + (height * index) / nodeCount;
          for (const sideX of [-1, 1]) {
            entityMarkers.push(
              this.add
                .rectangle(
                  rotX(sideX * width / 2, nodeY - y),
                  rotY(sideX * width / 2, nodeY - y),
                  17,
                  17,
                  color,
                  0.9
                )
                .setStrokeStyle(2, 0xffffff, 0.9)
                .setRotation(Math.PI / 4 + rotation)
                .setDepth(27)
            );
          }
        }
      }
    }
    rangeObjects.push(...entityMarkers);
    this.tweens.add({
      targets: entityMarkers,
      alpha: { from: 0.72, to: 1 },
      yoyo: true,
      repeat: pulseRepeat,
      duration: 120
    });
    if (width >= 280 && height >= 240) {
      const labelX = Phaser.Math.Clamp(rotX(0, -height / 2 + 28), 100, WORLD_WIDTH - 100);
      const labelY = Phaser.Math.Clamp(rotY(0, -height / 2 + 28), 118, WORLD_HEIGHT - 90);
      rangeObjects.push(
        this.add
          .text(labelX, labelY, `⚠ ${label}`, {
            fontFamily: "Microsoft YaHei, sans-serif",
            fontSize: "18px",
            fontStyle: "bold",
            color: "#ffffff",
            backgroundColor: label === "危险范围" ? "#4b0719dd" : "#082b46dd"
          })
          .setPadding(8, 4)
          .setOrigin(0.5)
          .setDepth(28)
      );
    }
    if (trackedBossEffect) {
      rangeObjects.forEach((object) => this.trackBossEffect(object, duration + 80));
    } else {
      this.time.delayedCall(duration + 80, () => {
        rangeObjects.forEach((object) => {
          this.tweens.killTweensOf(object);
          if (object.active) object.destroy();
        });
      });
    }
  }

  renderBossSkillEntityCue(
    core: Phaser.Physics.Arcade.Image,
    kind: BossKind | "dark_aircraft",
    duration = 980
  ): void {
    const color = this.bossSkillRangeColor(kind);
    const cx = core.x;
    const cy = core.y + Math.min(80, core.displayHeight * 0.18);
    const entities: Phaser.GameObjects.GameObject[] = [];
    const armorRing = this.add
      .circle(cx, cy, kind === "dark_aircraft" ? 42 : 58, 0x05060c, 0.78)
      .setStrokeStyle(10, color, 0.98)
      .setDepth(28);
    const reactor = this.add
      .circle(cx, cy, kind === "mirror" ? 30 : 36, color, 0.76)
      .setStrokeStyle(3, 0xffffff, 0.96)
      .setDepth(29);
    entities.push(armorRing, reactor);
    if (kind === "titan") {
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        entities.push(
          this.add
            .rectangle(
              cx + Math.cos(angle) * 78,
              cy + Math.sin(angle) * 62,
              10,
              38,
              color,
              0.9
            )
            .setRotation(angle + Math.PI / 2)
            .setStrokeStyle(2, 0xffffff, 0.82)
            .setDepth(29)
        );
      }
    } else if (kind === "mirror") {
      for (const side of [-1, 1]) {
        entities.push(
          this.add
            .rectangle(cx + side * 70, cy, 42, 42, color, 0.78)
            .setStrokeStyle(5, 0xffffff, 0.92)
            .setRotation(Math.PI / 4)
            .setDepth(29)
        );
      }
    } else if (kind === "usurper") {
      for (let index = -2; index <= 2; index += 1) {
        entities.push(
          this.add
            .rectangle(cx + index * 22, cy, 9, 108 - Math.abs(index) * 12, index % 2 ? 0xffffff : color, 0.9)
            .setStrokeStyle(1, color, 0.9)
            .setDepth(29)
        );
      }
    } else if (kind === "shadow") {
      for (let index = -1; index <= 1; index += 1) {
        entities.push(
          this.add
            .rectangle(cx, cy + index * 24, 132, 11, index === 0 ? 0xffffff : color, 0.88)
            .setRotation(-0.38 + index * 0.16)
            .setDepth(29)
        );
      }
    } else if (kind === "dark_deity") {
      entities.push(
        this.add.circle(cx, cy, 31, 0x020005, 1).setStrokeStyle(8, color, 1).setDepth(30),
        this.add.ellipse(cx, cy, 154, 48, color, 0.42).setStrokeStyle(5, 0xffffff, 0.85).setDepth(29)
      );
    } else {
      for (const side of [-1, 1]) {
        entities.push(
          this.add
            .ellipse(cx + side * 48, cy, 36, 64, color, 0.68)
            .setRotation(side * 0.35)
            .setStrokeStyle(2, 0xffffff, 0.82)
            .setDepth(29)
        );
      }
    }
    entities.forEach((entity) => this.trackBossEffect(entity, duration));
    this.tweens.add({
      targets: armorRing,
      rotation: Math.PI / 2,
      duration,
      ease: "Sine.InOut"
    });
    this.tweens.add({
      targets: reactor,
      scale: { from: 0.88, to: 1.12 },
      yoyo: true,
      repeat: Math.max(1, Math.ceil(duration / 240) - 1),
      duration: 120
    });
  }

  renderBossSkillImpact(
    kind: BossKind | "dark_aircraft",
    type: string,
    x: number,
    y: number,
    size = 260,
    duration = 720,
    showRangeBoundary = false
  ): void {
    const definition = BOSS_SKILL_FX[`${kind}:${type}`];
    if (!definition) return;
    const largeVisual = size >= 280;
    if (showRangeBoundary) {
      this.renderSkillRangeBoundary(
        x,
        y,
        size,
        this.bossSkillRangeColor(kind),
        duration,
        "危险范围",
        true
      );
    }
    this.spawnAnimatedVfx(
      definition.texture,
      x,
      y,
      definition.row * 4,
      duration,
      size,
      true,
      largeVisual ? 7 : 26,
      largeVisual ? 0.4 : 0.8
    );
  }

  renderBossSkillArea(
    kind: BossKind | "dark_aircraft",
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    duration = 760,
    rotation = 0
  ): void {
    const definition = BOSS_SKILL_FX[`${kind}:${type}`];
    if (!definition) return;
    this.renderSkillRangeBoundary(
      x,
      y,
      { width, height },
      this.bossSkillRangeColor(kind),
      duration,
      "危险范围",
      true,
      rotation
    );
    this.spawnAnimatedVfx(
      definition.texture,
      x,
      y,
      definition.row * 4,
      duration,
      { width, height },
      true,
      7,
      0.4,
      rotation
    );
  }

  setBossPower(power: BossPowerId): void {
    if (!this.recoveredBossPowers.includes(power)) this.recoveredBossPowers.push(power);
    this.bossPower = power;
    this.bossPowerReadyAt = this.time.now + 1000;
    const definition = BOSS_POWER_OPTIONS.find((item) => item.id === power);
    this.showBanner(`V · ${definition?.name ?? "首领权柄"} 已获得`, 1200);
  }

  // V 权柄升阶:伤害 +50% / 持续 +35% 每级(上限 LV.3)
  upgradeBossPower(): void {
    if (!this.bossPower || this.bossPowerLevel >= 3) return;
    this.bossPowerLevel = Math.min(3, this.bossPowerLevel + 1);
    this.bossPowerDamageMultiplier = 1 + (this.bossPowerLevel - 1) * 0.5;
    this.bossPowerDurationMultiplier = 1 + (this.bossPowerLevel - 1) * 0.35;
    this.cameras.main.flash(150, 240, 200, 90);
    this.showBanner(
      `V 权柄升阶 · LV.${this.bossPowerLevel} · 伤害 +${(this.bossPowerLevel - 1) * 50}% · 持续 +${
        (this.bossPowerLevel - 1) * 35
      }%`,
      1300
    );
  }

  grantBossPassive(passiveId: BossPassiveId): void {
    const definition = BOSS_PASSIVE_OPTIONS.find((option) => option.id === passiveId);
    if (!definition) return;
    if (this.bossPassives.includes(passiveId)) {
      // 重复取得转为升级:生命与回血升级,被动本身强度保持(简化:不会浪费)
      const level = Math.min(5, (this.bossPassiveLevels[passiveId] ?? 1) + 1);
      this.bossPassiveLevels[passiveId] = level;
      const hpGain = 40 + level * 10;
      this.stats.maxHp += hpGain;
      this.healPlayer(this.stats.maxHp * 0.2, "被动升级");
      this.cameras.main.flash(150, 190, 110, 255);
      this.showBanner(`专属被动 · ${definition.name} 已升级 LV.${level} · 生命 +${hpGain}`, 1300);
      return;
    }
    this.bossPassives.push(passiveId);
    this.bossPassiveLevels[passiveId] = 1;
    definition.apply(this);
    this.cameras.main.flash(150, 190, 110, 255);
    this.showBanner(`专属被动 · ${definition.name} 已嵌入`, 1300);
    this.floatText(WORLD_WIDTH / 2, 340, `${definition.code} · 被动累计 ${this.bossPassives.length}`, true);
    this.burst(WORLD_WIDTH / 2, 340, 0xc16cff, 1.7);
  }

  renderBossPowerActivation(power: BossPowerId): void {
    const generated = this.spawnAnimatedVfx(
      BOSS_POWER_FX_KEYS[power],
      this.player.x,
      this.player.y - 20,
      0,
      power === "dark_deity_pact" ? 1100 : 900,
      power === "titan_meteor" ? 320 : 270
    );
    if (generated) return;
    const definitions: Record<BossPowerId, { color: number; sides: number }> = {
      titan_meteor: { color: 0xff7a32, sides: 8 },
      mirror_copy: { color: 0x9b7dff, sides: 4 },
      usurper_lock: { color: 0x52e6ff, sides: 6 },
      shadow_rift_blade: { color: 0xff2d8f, sides: 3 },
      dark_deity_pact: { color: 0xb01662, sides: 12 },
      absolute_freeze: { color: 0x79f4ff, sides: 6 },
      pulsar_railgun: { color: 0x9bd4ff, sides: 3 },
      gravity_well: { color: 0x7a6bff, sides: 8 },
      photon_barrage: { color: 0xfff0a8, sides: 5 }
    };
    const { color } = definitions[power];
    const sigil = this.add.circle(
      this.player.x,
      this.player.y,
      power === "dark_deity_pact" ? 105 : 82,
      color,
      power === "usurper_lock" ? 0.05 : 0.09
    ).setStrokeStyle(power === "shadow_rift_blade" ? 8 : 4, 0xffffff, 0.88)
      .setDepth(28)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: sigil,
      rotation: power === "mirror_copy" ? -Math.PI : Math.PI,
      scale: power === "titan_meteor" ? 4.2 : 2.6,
      alpha: 0,
      duration: power === "dark_deity_pact" ? 1100 : 760,
      onComplete: () => sigil.destroy()
    });
    if (power === "absolute_freeze") {
      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        const crystal = this.add.rectangle(
          this.player.x + Math.cos(angle) * 48,
          this.player.y + Math.sin(angle) * 48,
          8,
          40,
          index % 2 ? 0xffffff : color,
          0.9
        ).setRotation(angle + Math.PI / 2).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: crystal,
          x: this.player.x + Math.cos(angle) * 480,
          y: this.player.y + Math.sin(angle) * 480,
          scale: 2.2,
          alpha: 0,
          duration: 720,
          onComplete: () => crystal.destroy()
        });
      }
    } else if (power === "usurper_lock") {
      for (let index = -3; index <= 3; index += 1) {
        const gridLine = this.add.rectangle(
          this.player.x + index * 36,
          this.player.y,
          3,
          240,
          color,
          0.62
        ).setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: gridLine, scaleY: 4, alpha: 0, duration: 720, onComplete: () => gridLine.destroy() });
      }
    } else if (power === "shadow_rift_blade") {
      for (let index = -1; index <= 1; index += 1) {
        const slash = this.add.rectangle(
          this.player.x,
          this.player.y + index * 38,
          280,
          9,
          index === 0 ? 0xffffff : color,
          0.78
        ).setRotation(-0.28 + index * 0.14).setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: slash, scaleX: 4, alpha: 0, duration: 460 + index * 40, onComplete: () => slash.destroy() });
      }
    } else if (power === "mirror_copy") {
      [-1, 1].forEach((side) => {
        const mirror = this.add.rectangle(this.player.x + side * 92, this.player.y, 74, 74, color, 0.08)
          .setStrokeStyle(3, 0xffffff, 0.8).setRotation(Math.PI / 4).setDepth(27);
        this.tweens.add({ targets: mirror, x: this.player.x + side * 180, rotation: Math.PI * 1.25, alpha: 0, duration: 700, onComplete: () => mirror.destroy() });
      });
    }
  }

  renderBossPowerPulse(
    power: BossPowerId,
    x: number,
    y: number,
    size: number | { width: number; height: number } = 230,
    duration = 680,
    showRangeBoundary = false
  ): void {
    const scaledSize =
      typeof size === "number"
        ? size * this.bossPowerAreaMultiplier
        : {
            width: size.width * this.bossPowerAreaMultiplier,
            height: size.height * this.bossPowerAreaMultiplier
          };
    // 玩家权柄范围图放在敌弹下方，范围足够明显但不遮挡需要躲避的子弹。
    if (showRangeBoundary) {
      this.renderSkillRangeBoundary(
        x,
        y,
        scaledSize,
        this.bossPowerRangeColor(power),
        duration,
        "权柄范围",
        false
      );
    }
    this.spawnAnimatedVfx(
      BOSS_POWER_FX_KEYS[power],
      x,
      y,
      0,
      duration,
      scaledSize,
      false,
      15,
      showRangeBoundary ? 0.62 : 0.75
    );
  }

  activateBossPower(): void {
    if (!this.bossPower || this.ended || this.isModal) return;
    // 首领权柄可被「技能篡夺者」暂时封锁,也可被最终 boss(黑暗魔神)剥夺封锁
    if (this.skillsConfiscated) {
      showToast("首领权柄被篡夺 · 暂时封锁");
      return;
    }
    if (this.time.now < this.bossPowerReadyAt) {
      showToast(
        `首领权柄冷却 ${formatRoundedNumberForDisplay(
          (this.bossPowerReadyAt - this.time.now) / 1000
        )}s`
      );
      return;
    }
    const durationMultiplier = this.bossPowerDurationMultiplier;
    this.bossPowerReadyAt =
      this.time.now + Math.round(BOSS_POWER_COOLDOWN_MS * this.bossPowerCooldownMultiplier);
    this.bossPowerActiveUntil = this.time.now + Math.round(7000 * durationMultiplier);
    this.nextBossPowerPulse = 0;
    this.renderBossPowerActivation(this.bossPower);
    if (this.bossPowerHealRatio > 0) {
      this.healPlayer(this.stats.maxHp * this.bossPowerHealRatio, "权限回收");
    }
    if (this.bossPowerMissingHealRatio > 0) {
      this.healPlayer(
        (this.stats.maxHp - this.stats.hp) * this.bossPowerMissingHealRatio,
        "深渊饥渴"
      );
    }
    if (this.bossPowerInvulnMs > 0) {
      this.darkDeityInvulnUntil = Math.max(
        this.darkDeityInvulnUntil,
        this.time.now + this.bossPowerInvulnMs
      );
    }
    if (this.bossPower === "absolute_freeze") {
      this.bossPowerActiveUntil =
        this.time.now + Math.round(BOSS_POWER_FREEZE_MS * durationMultiplier);
      this.enemyFreezeUntil = Math.max(this.enemyFreezeUntil, this.bossPowerActiveUntil);
      this.cameras.main.flash(180, 120, 244, 255);
      this.showBanner("V · 绝对零度 · 全场冻结 5 秒", 1050);
    } else if (this.bossPower === "shadow_rift_blade") {
      this.bossPowerActiveUntil = this.time.now + Math.round(4000 * durationMultiplier);
      this.nextBossPowerPulse = 0;
      this.showBanner("V · 裂隙爪刀 · 横向切割", 1050);
      this.burst(this.player.x, this.player.y, 0x9b5cff, 2.6);
    } else if (this.bossPower === "dark_deity_pact") {
      this.bossPowerActiveUntil = this.time.now + Math.round(3000 * durationMultiplier);
      this.darkDeityInvulnUntil = Math.max(
        this.darkDeityInvulnUntil,
        this.bossPowerActiveUntil
      );
      this.showBanner("V · 黑暗契约 · 3 秒无敌 + 追踪弹幕", 1050);
      this.burst(this.player.x, this.player.y, 0xff2d8f, 3.0);
    } else if (this.bossPower === "usurper_lock") {
      this.enemyFreezeUntil = Math.max(this.enemyFreezeUntil, this.bossPowerActiveUntil);
      this.showBanner("V · 权限篡夺 · 敌方封锁 7 秒", 1050);
    } else if (this.bossPower === "mirror_copy") {
      this.bossPowerClones.forEach((clone) => clone.destroy());
      const cloneCount = 2 + this.bossPowerCloneBonus;
      this.bossPowerClones = Array.from({ length: cloneCount }, (_, index) => {
        const slot = index - (cloneCount - 1) / 2;
        return (
        this.add
          .image(this.player.x + slot * 88, this.player.y + 32, this.player.texture.key)
          .setDisplaySize(this.player.displayWidth * 0.58, this.player.displayHeight * 0.58)
          .setTint(0x9b7dff)
          .setAlpha(0.82)
          .setDepth(18)
        );
      });
      this.showBanner("V · 万象镜像 · 能力复制 7 秒", 1050);
    } else if (this.bossPower === "pulsar_railgun") {
      this.bossPowerActiveUntil = this.time.now + Math.round(1400 * durationMultiplier);
      this.nextBossPowerPulse = 0;
      this.showBanner("V · 脉冲星轨道炮 · 贯穿激光 1.4 秒", 1050);
    } else if (this.bossPower === "gravity_well") {
      this.bossPowerActiveUntil = this.time.now + Math.round(5000 * durationMultiplier);
      this.nextBossPowerPulse = 0;
      this.showBanner("V · 引力井风暴 · 牵引全场 5 秒", 1050);
    } else if (this.bossPower === "photon_barrage") {
      this.bossPowerActiveUntil = this.time.now + Math.round(3500 * durationMultiplier);
      this.nextBossPowerPulse = 0;
      this.showBanner("V · 光子弹幕阵 · 360° 穿透光弹 3.5 秒", 1050);
    } else {
      this.showBanner("V · 裂渊权柄 · 陨星轰炸 7 秒", 1050);
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
    const durationMultiplier = this.bossPowerDurationMultiplier;
    if (this.bossPower === "mirror_copy") {
      this.bossPowerClones.forEach((clone, index) => {
        const slot = index - (this.bossPowerClones.length - 1) / 2;
        clone.x = Phaser.Math.Linear(clone.x, this.player.x + slot * 92, 0.16);
        clone.y = Phaser.Math.Linear(clone.y, this.player.y + 28, 0.16);
      });
    }
    if (time < this.nextBossPowerPulse) return;
    if (this.bossPower === "titan_meteor") {
      for (let i = 0; i < 5; i += 1) {
        const meteorX = Phaser.Math.Between(70, WORLD_WIDTH - 70);
        const missile = this.spawnPlayerBullet(
          meteorX,
          WORLD_HEIGHT + 30,
          "missile",
          150 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier,
          -1180,
          "titan-authority"
        );
        missile.setTint(0xff8a3d).setData("pierce", 12);
      }
      this.nextBossPowerPulse = time + 560;
    } else if (this.bossPower === "mirror_copy") {
      for (const clone of this.bossPowerClones) {
        this.renderBossPowerPulse("mirror_copy", clone.x, clone.y - 35, 150, 620);
        if (save.selectedSpecialization === "wheelchair") {
          const missile = this.spawnPlayerBullet(
            clone.x,
            clone.y - 25,
            "missile",
            54 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier,
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
              34 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier,
              -980,
              "mirror-authority"
            );
            bullet.setVelocityX(offset * 180).setTint(0x9b7dff).setData("pierce", 3);
          }
        }
      }
      const activeSupport = Object.entries(this.airSupportLevels).find(([, level]) => (level ?? 0) > 0);
      if (activeSupport && Math.random() < 0.32) {
        this.triggerAirSupport(
          activeSupport[0] as AirSupportSkillId,
          true,
          BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier
        );
      }
      this.nextBossPowerPulse = time + 720;
    } else if (this.bossPower === "shadow_rift_blade") {
      // 5 道横向爪刀(0.5s/道 × 4 秒)
      this.renderBossPowerPulse(
        "shadow_rift_blade",
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2,
        { width: WORLD_WIDTH + 200, height: 120 },
        620,
        true
      );
      this.spawnShadowRiftBlade(this.player.x);
      for (let index = 0; index < this.shadowRiftBladeBonus; index += 1) {
        const laneY = WORLD_HEIGHT * ((index + 1) / (this.shadowRiftBladeBonus + 1));
        this.spawnShadowRiftBlade(this.player.x, laneY);
      }
      this.nextBossPowerPulse = time + 500;
    } else if (this.bossPower === "dark_deity_pact") {
      // 12 颗向四方释放的追踪暗影弹幕(每波 1s 一次 × 3 次)
      this.renderBossPowerPulse(
        "dark_deity_pact",
        this.player.x,
        this.player.y,
        300,
        840
      );
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        this.spawnPlayerBullet(
          this.player.x,
          this.player.y,
          "agileOrb",
          38 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier,
          720,
          "dark-deity-pact"
        ).setVelocity(Math.cos(angle) * 720, Math.sin(angle) * 720)
         .setTint(0xff2d8f)
         .setData("pierce", 6)
         .setData("target", this.nearestTarget(this.player.x, this.player.y));
      }
      this.nextBossPowerPulse = time + 1000;
    } else if (this.bossPower === "pulsar_railgun") {
      // 脉冲星轨道炮:贯穿全场的横向激光(1.4 秒),命中减速 0.6 秒
      const beamHeight = 150 * this.bossPowerAreaMultiplier;
      const beamY = this.player.y;
      this.renderBossPowerPulse(
        "pulsar_railgun",
        this.player.x,
        beamY,
        { width: WORLD_WIDTH + 200, height: beamHeight },
        240,
        true
      );
      const laser = this.add
        .rectangle(WORLD_WIDTH / 2, beamY, WORLD_WIDTH + 200, beamHeight, 0x9bd4ff, 0.08)
        .setStrokeStyle(7, 0xffffff, 0.92)
        .setDepth(27)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: laser,
        alpha: { from: 0.32, to: 0 },
        scaleY: { from: 1, to: 0.7 },
        duration: 230,
        onComplete: () => laser.destroy()
      });
      const beamDamage = Math.max(
        1,
        Math.round(46 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier)
      );
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Image;
        if (enemy.active && Math.abs(enemy.y - beamY) < beamHeight / 2) {
          enemy.setData("slowUntil", time + 600);
          this.dealDirectDamage(enemy, beamDamage, enemy.x, enemy.y, false);
        }
        return true;
      });
      this.bossParts.children.each((child) => {
        const part = child as Phaser.Physics.Arcade.Image;
        if (part.active && part.getData("part") === "core" && Math.abs(part.y - beamY) < beamHeight / 2) {
          this.damageBossPart(part, beamDamage);
        }
        return true;
      });
      this.nextBossPowerPulse = time + 170;
    } else if (this.bossPower === "gravity_well") {
      // 引力井风暴:玩家位置生成引力井,把全场敌机往中心拉并持续喷出追踪小爆弹
      const wellX = this.player.x;
      const wellY = this.player.y;
      this.spawnAnimatedVfx(BOSS_POWER_FX_KEYS.gravity_well, wellX, wellY, 0, 700, 240, false, 27, 0.85);
      this.renderBossPowerPulse("gravity_well", wellX, wellY, 280, 700);
      const pull = Math.round(150 * this.bossPowerAreaMultiplier);
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Image;
        if (!enemy.active) return true;
        const dx = wellX - enemy.x;
        const dy = wellY - enemy.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const step = Math.min(dist * 0.18, pull);
        // 重新锚定 x 摆动中心,保证横向牵引不被小兵正弦摆动覆盖
        enemy.setData("originX", Phaser.Math.Clamp(enemy.x + (dx / dist) * step, 60, WORLD_WIDTH - 60));
        enemy.y += (dy / dist) * step;
        return true;
      });
      for (let index = 0; index < 2; index += 1) {
        const bomb = this.spawnPlayerBullet(
          wellX,
          wellY,
          "missile",
          Math.max(1, Math.round(34 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier)),
          640,
          "gravity-bomb"
        );
        bomb.setTint(0x7a6bff).setData("target", this.nearestTarget(wellX, wellY));
      }
      this.nextBossPowerPulse = time + 640;
    } else if (this.bossPower === "photon_barrage") {
      // 光子弹幕阵:3.5 秒内 360° 高速射出 24 发穿透光弹(8 波 × 每波 3 发)
      this.renderBossPowerPulse("photon_barrage", this.player.x, this.player.y, 230, 420);
      const photonDamage = Math.max(
        1,
        Math.round(14 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier)
      );
      const totalDuration = 3500 * durationMultiplier;
      const elapsed = Math.max(0, totalDuration - Math.max(0, this.bossPowerActiveUntil - time));
      const shotsFired = Math.min(7, Math.floor(elapsed / (totalDuration / 8)));
      for (let index = 0; index < 3; index += 1) {
        const angle = (Math.PI * 2 * ((shotsFired * 3 + index) % 24)) / 24;
        this.spawnPlayerBullet(
          this.player.x,
          this.player.y,
          "agileOrb",
          photonDamage,
          720,
          "photon-barrage"
        )
          .setVelocity(Math.cos(angle) * 720, Math.sin(angle) * 720)
          .setTint(0xfff0a8)
          .setData("pierce", 6);
      }
      this.nextBossPowerPulse = time + 437;
    } else if (this.bossPower === "usurper_lock" || this.bossPower === "absolute_freeze") {
      this.enemyFreezeUntil = Math.max(this.enemyFreezeUntil, this.bossPowerActiveUntil);
      this.renderBossPowerPulse(
        this.bossPower,
        WORLD_WIDTH / 2,
        WORLD_HEIGHT * 0.48,
        {
          width: WORLD_WIDTH * 0.96,
          height: WORLD_HEIGHT * (this.bossPower === "absolute_freeze" ? 0.96 : 0.88)
        },
        760,
        true
      );
      this.nextBossPowerPulse = time + 500;
    }
  }

  spawnShadowRiftBlade(centerX: number, centerY = WORLD_HEIGHT / 2): void {
    // 玩家版横向暗影爪刀伤害为 Boss 原权柄的一半
    const dmg = Math.round(
      this.stats.maxHp * 0.18 * BOSS_POWER_DAMAGE_SCALE * this.bossPowerDamageMultiplier
    );
    const bladeHeight = 120 * this.bossPowerAreaMultiplier;
    const blade = this.add
      .rectangle(centerX, centerY, WORLD_WIDTH + 200, bladeHeight, 0x6c1a8f, 0.18)
      .setStrokeStyle(8, 0xff2d8f, 0.95)
      .setDepth(25);
    this.tweens.add({
      targets: blade,
      alpha: { from: 0.18, to: 0.85 },
      yoyo: true,
      duration: 220,
      onComplete: () => blade.destroy()
    });
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (enemy.active && Math.abs(enemy.y - centerY) < bladeHeight / 2) {
        this.dealDirectDamage(enemy, dmg, blade.x, blade.y);
        this.burst(enemy.x, enemy.y, 0xff2d8f, 0.9);
      }
      return true;
    });
    this.bossParts.children.each((child) => {
      const part = child as Phaser.Physics.Arcade.Image;
      if (part.active && part.getData("part") === "core" && Math.abs(part.y - centerY) < bladeHeight / 2) {
        this.damageBossPart(part, dmg);
      }
      return true;
    });
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
      if (pickup.getData("kind") === "boss_upgrade") {
        this.physics.moveToObject(pickup, this.player, 430);
        return true;
      }
      const distance = Phaser.Math.Distance.Between(pickup.x, pickup.y, this.player.x, this.player.y);
      if (distance < radius) this.physics.moveToObject(pickup, this.player, 540);
      if (pickup.y > WORLD_HEIGHT + 60) pickup.disableBody(true, true);
      return true;
    });
  }

  // 按倍率提升最大生命并立即补足差值,可选标记为本局敏捷最大生命收益
  private boostMaxHp(multiplier: number, recordGain = false): void {
    const oldMax = this.stats.maxHp;
    this.stats.maxHp = Math.round(this.stats.maxHp * multiplier);
    this.healPlayer(this.stats.maxHp - oldMax);
    if (recordGain) this.recordAgileMaxHpGain(this.stats.maxHp - oldMax);
  }

  applyUpgrade(id: string, owner: 1 | 2 = 1): void {
    // 支援协议并入了通用强化池,但等级存在 airSupportLevels 里,需要转交
    if (AIR_SUPPORT_SKILLS.some((skill) => skill.id === id)) {
      this.applyAirSupportUpgrade(id as AirSupportSkillId);
      return;
    }
    const ul = this.upgradesOf(owner);
    const isP2 = owner === 2;
    const previous = ul[id] ?? 0;
    // 万象影袭首抽即 Lv.2,后续每抽 +1(上限 5)
    ul[id] =
      id === "agile_shadow_lunge"
        ? Math.min(5, previous === 0 ? 2 : previous + 1)
        : Math.min(5, previous + 1);
    if (ul[id] === previous) return;
    const stats = this.statsOf(owner);
    // 双人:按 owner 提升各自的最大生命并立即补足差值
    const boostMaxHp = (multiplier: number, recordGain = false): void => {
      if (!isP2) {
        this.boostMaxHp(multiplier, recordGain);
        return;
      }
      const oldMax = this.player2MaxHp;
      this.player2MaxHp = Math.round(this.player2MaxHp * multiplier);
      this.player2Hp = roundHealth(
        this.player2Hp + (this.player2MaxHp - oldMax),
        this.player2MaxHp
      );
    };
    if (id === "armor") boostMaxHp(1.12, true);
    if (id === "ram_armor") boostMaxHp(1.1);
    if (id === "endurance") {
      boostMaxHp(1.08, true);
      stats.damageTakenMultiplier *= 0.98;
    }
    if (id === "devour_swallow") {
      const oldDefense =
        previous > 0
          ? DEVOUR_SWALLOW_LEVELS[Math.min(previous, DEVOUR_SWALLOW_LEVELS.length) - 1]
              .damageTakenMultiplier
          : 1;
      const newDefense =
        DEVOUR_SWALLOW_LEVELS[Math.min(ul[id], DEVOUR_SWALLOW_LEVELS.length) - 1]
          .damageTakenMultiplier;
      stats.damageTakenMultiplier *= newDefense / oldDefense;
    }
    if (id === "velocity") {
      stats.speed *= 1.04;
      stats.fireRateMultiplier *= 1.04;
    }
    if (id === "overcharge") {
      stats.damageMultiplier *= 1.06;
      stats.critChance += 0.02;
    }
    if (id === "magnetism") {
      // 拾取/经验是共享系统,无论谁选都全局生效
      this.stats.pickupRadius *= 1.12;
      this.xpMultiplier *= 1.06;
    }
    if (!isP2) {
      if (id === "drone") this.updateDrones(this.time.now);
      if (id === "blade") this.updateBlades(this.time.now);
    }
    if (id === "power_fusion") {
      // 金龙炼狱 = 龙息喷火 + 护航无人机:缺哪一半自动补 Lv.1,保证护航无人机立即显示
      if ((ul.power_flamethrower ?? 0) <= 0) ul.power_flamethrower = 1;
      if ((ul.drone ?? 0) <= 0) {
        ul.drone = 1;
        if (!isP2) this.updateDrones(this.time.now);
      }
    }
    if (id === "agile_shadow_clone") {
      // 选到影分身后立即出现，玩家无需等待初始计时。
      if (isP2) this.nextShadowCloneAt2 = this.time.now;
      else this.nextShadowCloneAt = this.time.now;
      this.spawnShadowClones(owner);
    }
    if (id === "agile_shadow_lunge") {
      // 万象影袭 = 突刺 + 影分身的融合升级:缺哪一半自动补 Lv.1,保证联动立即生效。
      if ((ul.agile_lunge ?? 0) <= 0) {
        ul.agile_lunge = 1;
      }
      if ((ul.agile_shadow_clone ?? 0) <= 0) {
        ul.agile_shadow_clone = 1;
      }
      // 融合技等级同步提升影分身数量/强度:每次升级立即刷新被动编队,保证多个影分身可见共存
      if (isP2) this.nextShadowCloneAt2 = this.time.now;
      else this.nextShadowCloneAt = this.time.now;
      this.spawnShadowClones(owner);
    }
    this.showBanner(
      `${isP2 ? "P2 · " : ""}${UPGRADES.find((upgrade) => upgrade.id === id)?.name} · Lv.${ul[id]}`,
      900
    );
  }

  applyDoctrineEvolution(id: string): void {
    const evolution = DOCTRINE_EVOLUTIONS.find((item) => item.id === id);
    if (!evolution) return;
    const previous = this.doctrineLevels[id] ?? 0;
    if (previous >= 5) return;
    this.doctrineLevels[id] = previous + 1;
    if (id === "echo_clone") this.ensureWingClones();
    if (id === "aegis_mastery") {
      this.boostMaxHp(1.12, true);
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

  triggerAirSupport(
    id: AirSupportSkillId,
    debugTrigger = false,
    damageScale = 1
  ): void {
    const skill = AIR_SUPPORT_SKILLS.find((item) => item.id === id);
    if (!skill || this.ended) return;
    const level = Math.max(1, this.airSupportLevels[id] ?? (debugTrigger ? 1 : 0));
    if (level <= 0) return;
    const formationCount = id === "hunter_sweep" ? 3 : id === "piercing_bombardment" ? 2 : 1;
    this.launchAirSupportFlyby(skill, formationCount);
    if (id === "piercing_bombardment") {
      this.time.delayedCall(180, () => {
        if (this.ended) return;
        const count = AIR_SUPPORT_VALUES.bombardmentCount(level);
        for (let i = 0; i < count; i += 1) {
          const x = ((i + 0.5) / count) * WORLD_WIDTH + Phaser.Math.Between(-28, 28);
          const shell = this.spawnPlayerBullet(
            x,
            WORLD_HEIGHT + 36,
            "missile",
            AIR_SUPPORT_VALUES.bombardmentDamage(level) * damageScale,
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
        this.time.now + AIR_SUPPORT_VALUES.stasisDuration(level)
      );
      this.showBanner(`引力滞空 · 敌军推进 -${AIR_SUPPORT_VALUES.stasisSlowPercent(level)}%`, 720);
    } else if (id === "phase_escort") {
      const duration = AIR_SUPPORT_VALUES.escortDuration(level);
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
        `相位护航 · 无敌 ${formatRoundedNumberForDisplay(duration / 1000)} 秒`,
        760
      );
    } else if (id === "repair_convoy") {
      this.healPlayer(this.stats.maxHp * AIR_SUPPORT_VALUES.repairRatio(level), "逆航维修");
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
      this.showBanner(
        `纳米维修纵队 · 舰体 +${Math.round(AIR_SUPPORT_VALUES.repairRatio(level) * 100)}%`,
        720
      );
    } else if (id === "hunter_sweep") {
      this.time.delayedCall(360, () => {
        if (this.ended) return;
        const damage = AIR_SUPPORT_VALUES.sweepDamage(level) * damageScale;
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
          this.damageBossPart(core, AIR_SUPPORT_VALUES.sweepBossDamage(level) * damageScale);
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
        .image(this.player.x, this.player.y + 38, this.player.texture.key)
        .setDisplaySize(this.player.displayWidth * 0.5, this.player.displayHeight * 0.5)
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
      if (!bullet.getData("achievementSkinBullet")) bullet.setTint(0x9b5cff);
      bullet.setData("pierce", level >= 3 ? 1 : 0);
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
    const summarize = (ul: Record<string, number>): string =>
      UPGRADES.filter((upgrade) => (ul[upgrade.id] ?? 0) > 0)
        .map((upgrade) => `${upgrade.name} Lv.${ul[upgrade.id]}`)
        .slice(0, 6)
        .join(" · ");
    if (playVariant === "single") return summarize(this.upgradeLevels);
    return `P1: ${summarize(this.upgradeLevels) || "无"} ｜ P2: ${
      summarize(this.upgradeLevels2) || "无"
    }`;
  }

  damagePlayer(
    amount: number,
    damageType: "projectile" | "collision" | "explosion" = "projectile",
    damageSource: EnemyDamageSource = this.bossActive ? "boss" : "minion",
    source?: Phaser.Physics.Arcade.Image | null
  ): void {
    const now = this.time.now;
    // 蓄力/主动技能无敌(activeInvulnerableUntil,如天体碰撞蓄力)与黑暗契约 3 秒无敌
    // (darkDeityInvulnUntil)对普通弹幕/碰撞同样生效,与 damagePlayerDark 口径一致;
    // 此前只查 invulnerableUntil,导致 P1 这两类"无敌"名存实亡(P2 走 player2InvulnUntil 正常)。
    if (
      now < this.invulnerableUntil ||
      now < this.activeInvulnerableUntil ||
      now < this.darkDeityInvulnUntil ||
      this.ended
    ) {
      return;
    }
    // 记录死亡来源(结算界面展示)
    if (damageType === "collision") this.lastDamageCause = "撞击";
    else if (damageSource === "boss") this.lastDamageCause = "首领攻击";
    else this.lastDamageCause = "敌方弹幕";
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
        ? Math.max(
            this.stats.maxHp * WHEELCHAIR_BOSS_COLLISION_MAX_HP_PERCENT,
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
    const ramArmorReduction = this.wheelchairRamArmorReduction();
    const preSkillDamage = Math.max(
      1,
      Math.ceil(
        baseFinalDamage *
          (damageSource === "boss"
            ? this.currentBossEncounterAttackScale() * this.bossPassiveBossDamageTakenMultiplier
            : 1) *
          overdriveReduction *
          ramArmorReduction
      )
    );
    const finalDamage = Math.max(
      1,
      Math.ceil(preSkillDamage * this.wheelchairActiveDefenseMultiplier(now))
    );
    this.recordWheelchairReactiveAbsorption(preSkillDamage, finalDamage);
    this.playerWasHit = true;
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);
    // === 防御流派:荆棘护甲 — 反伤 ===
    this.applyThorns(finalDamage, source ?? null);
    if (
      !this.emergencyUsed &&
      save.permanentUpgrades.emergency > 0 &&
      this.stats.hp > 0 &&
      this.stats.hp / this.stats.maxHp <= 0.2
    ) {
      this.emergencyUsed = true;
      this.healPlayer(
        8 + save.permanentUpgrades.emergency * 2,
        "紧急修复协议"
      );
    }
    this.invulnerableUntil =
      now + (save.selectedSpecialization === "wheelchair" ? 500 : 800);
    this.combo = Math.floor(this.combo * 0.7);
    sfx("hurt");
    this.burst(this.player.x, this.player.y, 0xff4d6d, 1.25);
    this.cameras.main.flash(75, 255, 34, 72);
    if (save.settings.screenShake) this.cameras.main.shake(120, 0.007);
    if (this.stats.hp <= 0) {
      this.playerExplosion(this.player.x, this.player.y);
      this.player.setVisible(false);
      if (playVariant === "single" || !this.player2?.active || this.coopHandoverDone) {
        this.time.delayedCall(750, () => this.endRun(false));
      } else {
        this.triggerP1HandOver();
      }
    }
  }

  // E 键:超载射击 — 6 秒 +60% 射速 +50% 伤害,不清屏不无敌
  activateOverdrive(owner: 1 | 2 = 1): void {
    if (owner === 1 && this.skillsConfiscated) {
      showToast("技能被篡夺：只能使用基础机炮与走位");
      return;
    }
    if (this.ultimate < 100 || this.ended || this.isModal) {
      showToast(this.ultimate >= 100 ? "当前无法启动" : `星核充能 ${Math.floor(this.ultimate)}%`);
      return;
    }
    // 星核超载是双人共享的火力爆发,释放特效落在触发者机体上
    const shipSprite = owner === 2 ? this.player2 : this.player;
    this.ultimate = 0;
    this.ultimateActive = 6;
    this.overdriveDamageMul = 1.5;
    this.showBanner("◆ 星核超载 · 6 秒火力爆发", 900);
    if (shipSprite?.active) this.burst(shipSprite.x, shipSprite.y, 0x2df4ff, 1.8);
    if (save.settings.screenShake) this.cameras.main.shake(140, 0.005);
  }

  // === 力量流派:龙息喷火(M 键/P2, G 键/P1) ===
  activateFlamethrower(owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const level = this.upgradesOf(owner).power_flamethrower ?? 0;
    const fusionLevel = this.upgradesOf(owner).power_fusion ?? 0;
    if (level <= 0) return;
    if (owner === 1 && this.skillsConfiscated) {
      showToast("技能被篡夺：只能使用基础机炮与走位");
      return;
    }
    // 金龙炼狱:无论龙息是否在冷却,按技能键都会尝试起飞小喷火无人机(独立 15s 冷却)
    if (fusionLevel > 0) this.trySummonFusionDrones(owner);
    const nextReadyAt = isP2 ? this.flamethrowerNextReadyAt2 : this.flamethrowerNextReadyAt;
    if (this.time.now < nextReadyAt) {
      showToast(`喷火冷却 ${((nextReadyAt - this.time.now) / 1000).toFixed(1)}s`);
      return;
    }
    const tier = Math.min(level, POWER_FLAME_LENGTHS.length) - 1;
    const duration = POWER_FLAME_DURATIONS[tier];
    const length = POWER_FLAME_LENGTHS[tier];
    const width = POWER_FLAME_WIDTHS[tier];
    const dmgPerFrame = POWER_FLAME_DAMAGE[tier];
    // 金龙炼狱(力量融合技):每级喷火冷却 -1s,保底 10s,与升级描述「冷却 -Xs」一致
    const cooldown = Math.max(10, POWER_FLAME_COOLDOWNS[tier] - fusionLevel);
    if (isP2) {
      this.flamethrowerActiveUntil2 = this.time.now + duration;
      this.flamethrowerNextReadyAt2 = this.time.now + cooldown * 1000;
      this.flamethrowerLength2 = length;
      this.flamethrowerWidth2 = width;
      this.flamethrowerDmgPerFrame2 = dmgPerFrame;
      this.nextFlamethrowerFxAt2 = 0;
    } else {
      this.flamethrowerActiveUntil = this.time.now + duration;
      this.flamethrowerNextReadyAt = this.time.now + cooldown * 1000;
      this.flamethrowerLength = length;
      this.flamethrowerWidth = width;
      this.flamethrowerDmgPerFrame = dmgPerFrame;
      this.nextFlamethrowerFxAt = 0;
    }
    // 火焰本体已经清楚表达攻击范围，不再叠加尺寸横幅和调试式几何提示。
    // 华丽特效:橙红火环爆发
    this.triggerSpecialtyFX(0xff7a2d, {
      ring: 0xfff200,
      style: "flame",
      flash: [120, 255, 140, 30],
      shake: 200,
      count: 40,
    });
  }

  updateFlamethrower(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const activeUntil = isP2 ? this.flamethrowerActiveUntil2 : this.flamethrowerActiveUntil;
    const visual = isP2 ? this.flamethrowerVisual2 : this.flamethrowerVisual;
    if (time >= activeUntil) {
      if (isP2) {
        this.flamethrowerVisual2?.destroy();
        this.flamethrowerVisual2 = undefined;
      } else {
        this.flamethrowerVisual?.destroy();
        this.flamethrowerVisual = undefined;
      }
      return;
    }
    // 金龙炼狱(力量融合技):龙息可暴击 + 伤害加成 + 金色火弹
    const fusionLevel = this.upgradesOf(owner).power_fusion ?? 0;
    const fusionDmgMul = fusionLevel > 0 ? 1.35 + fusionLevel * 0.15 : 1;
    const length = isP2
      ? (this.flamethrowerLength2 ?? POWER_FLAME_LENGTHS[0])
      : (this.flamethrowerLength ?? POWER_FLAME_LENGTHS[0]);
    const width = isP2
      ? (this.flamethrowerWidth2 ?? POWER_FLAME_WIDTHS[0])
      : (this.flamethrowerWidth ?? POWER_FLAME_WIDTHS[0]);
    const dmg = isP2
      ? (this.flamethrowerDmgPerFrame2 ?? 18)
      : (this.flamethrowerDmgPerFrame ?? 18);
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite?.active) return;
    const originY = ownerSprite.y - 26;
    const cx = ownerSprite.x;

    if (!visual?.active) {
      const newVisual = this.add
        .image(cx, originY - length * 0.5, "flamethrowerFx", 0)
        .setDepth(16)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.78);
      if (isP2) this.flamethrowerVisual2 = newVisual;
      else this.flamethrowerVisual = newVisual;
    }
    const activeVisual = isP2 ? this.flamethrowerVisual2 : this.flamethrowerVisual;
    const flamePulse = 1 + Math.sin(time * 0.031) * 0.035;
    if (activeVisual) {
      activeVisual
        .setFrame(Math.floor(time / 72) % 4)
        .setPosition(cx, originY - length * 0.5)
        .setDisplaySize(width * 1.08 * flamePulse, length * 1.06)
        .setAlpha(0.72 + Math.sin(time * 0.024) * 0.08);
      if (fusionLevel > 0) activeVisual.setTint(0xffd66b);
      else activeVisual.clearTint();
    }
    // 金龙炼狱:喷口每 0.22s 射出一发金龙火弹(金色大弹,命中爆炸)
    if (fusionLevel > 0 && time >= this.nextGoldenEmberAt[owner]) {
      this.nextGoldenEmberAt[owner] = time + 220;
      const ember = this.spawnPlayerBullet(
        cx,
        originY - 10,
        "playerBullet",
        90 * fusionLevel,
        -900,
        "power_fusion",
        owner
      );
      ember.setTint(0xffd66b).setScale(1.7);
    }

    const nextFxAt = isP2 ? this.nextFlamethrowerFxAt2 : this.nextFlamethrowerFxAt;
    if (time >= nextFxAt) {
      if (isP2) this.nextFlamethrowerFxAt2 = time + (save.settings.quality === "high" ? 90 : 150);
      else this.nextFlamethrowerFxAt = time + (save.settings.quality === "high" ? 90 : 150);
      const progress = Phaser.Math.FloatBetween(0.25, 0.94);
      const halfAtProgress = 22 + (width * 0.45 - 22) * progress;
      const spark = this.add.circle(
        cx + Phaser.Math.FloatBetween(-halfAtProgress, halfAtProgress),
        originY - length * progress,
        Phaser.Math.FloatBetween(2, 4.5),
        0xffd25a,
        0.8
      ).setDepth(17).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-22, 22),
        y: spark.y - Phaser.Math.Between(24, 55),
        scale: 0.15,
        alpha: 0,
        duration: 240,
        onComplete: () => spark.destroy()
      });
    }

    const insideFlameCone = (x: number, y: number, padding = 0): boolean => {
      const distance = originY - y;
      if (distance < -padding || distance > length + padding) return false;
      const progress = Phaser.Math.Clamp(distance / length, 0, 1);
      const halfWidthAtDistance = 38 + (width * 0.5 - 38) * progress + padding;
      return Math.abs(x - cx) <= halfWidthAtDistance;
    };
    const targets = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
      (enemy) => enemy.active && insideFlameCone(enemy.x, enemy.y, enemy.displayWidth * 0.18)
    );
    for (const enemy of targets) {
      enemy.setData("lastOwner", owner);
      // 龙息喷火默认不吃暴击;金龙炼狱融合后化作可暴击的金色炼狱
      this.dealDirectDamage(
        enemy,
        Math.round(dmg * fusionDmgMul),
        enemy.x,
        enemy.y,
        fusionLevel > 0,
        owner
      );
    }
    for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (
        part.active &&
        ["core", "raid-core"].includes(part.getData("part")) &&
        insideFlameCone(part.x, part.y, part.displayWidth * 0.18)
      ) {
        this.damageBossPart(part, Math.round(dmg * fusionDmgMul));
      }
    }
    // 特殊机制:火焰锥形范围内的敌方弹幕被焚毁(仅限火焰内)
    for (const bullet of this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (bullet.active && insideFlameCone(bullet.x, bullet.y)) {
        const spark = this.add
          .circle(bullet.x, bullet.y, 5, 0xffb84d, 0.9)
          .setDepth(17)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: spark,
          scale: 0.1,
          alpha: 0,
          duration: 160,
          onComplete: () => spark.destroy()
        });
        bullet.disableBody(true, true);
      }
    }
  }

  // === 金龙炼狱:小喷火无人机编队(G/M 键召唤,最多 4 个,独立 15s 冷却) ===
  trySummonFusionDrones(owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const droneReadyAt = isP2
      ? this.fusionDroneNextReadyAt[2]
      : this.fusionDroneNextReadyAt[1];
    if (this.time.now >= droneReadyAt) {
      this.spawnFusionDrones(owner);
      if (isP2) this.fusionDroneNextReadyAt[2] = this.time.now + 15000;
      else this.fusionDroneNextReadyAt[1] = this.time.now + 15000;
    } else {
      showToast(
        `无人机集群充能 ${((droneReadyAt - this.time.now) / 1000).toFixed(1)}s`
      );
    }
  }

  spawnFusionDrones(owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite?.active) return;
    const fusionLevel = this.upgradesOf(owner).power_fusion ?? 0;
    const count = Math.min(4, Math.max(1, fusionLevel));
    this.clearFusionDrones(owner);
    this.fusionDroneUntil[owner] = this.time.now + 8000;
    for (let i = 0; i < count; i += 1) {
      // 金色无人机实体 + 背后光晕,确保醒目可见
      const glow = this.add
        .circle(shipSprite.x, shipSprite.y - 60, 34, 0xffd66b, 0.18)
        .setDepth(8)
        .setBlendMode(Phaser.BlendModes.ADD);
      glow.setData("fusionGlow", true);
      const drone = this.add
        .image(shipSprite.x, shipSprite.y - 60, "fusionDrone")
        .setDepth(9)
        .setScale(1.15);
      drone.setData("fusionGlow", glow);
      this.fusionDrones[owner].push(drone);
      const flame = this.add
        .image(drone.x, drone.y, "flamethrowerFx", 0)
        .setDepth(8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.7)
        .setVisible(false);
      flame.setTint(0xffd66b);
      this.fusionDroneFlames[owner].push(flame);
    }
    this.burst(shipSprite.x, shipSprite.y, 0xffd66b, 1.5);
    this.showBanner(isP2 ? "P2 ◆ 金龙无人机集群" : "◆ 金龙无人机集群", 800);
  }

  clearFusionDrones(owner: 1 | 2 = 1): void {
    for (const drone of this.fusionDrones[owner]) {
      (drone.getData("fusionGlow") as Phaser.GameObjects.Arc | undefined)?.destroy();
      drone?.destroy();
    }
    for (const flame of this.fusionDroneFlames[owner]) flame?.destroy();
    this.fusionDrones[owner] = [];
    this.fusionDroneFlames[owner] = [];
  }

  updateFusionDrones(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const list = this.fusionDrones[owner];
    if (!list.length) return;
    if (time >= this.fusionDroneUntil[owner]) {
      this.clearFusionDrones(owner);
      return;
    }
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite?.active) {
      this.clearFusionDrones(owner);
      return;
    }
    const fusionLevel = Math.min(5, this.upgradesOf(owner).power_fusion ?? 0);
    // 小型喷火基础伤害:1/2/3/4/5(按融合技等级),另加敌人最大生命 0.04% 额外伤害
    const baseDmg = Math.max(1, fusionLevel);
    // 无人机编队整体优先攻击绝对血量最少的敌人(Boss 核心也纳入候选)
    const candidates = [
      ...(this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]),
      ...(this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[])
    ].filter((e) => e.active);
    const target = candidates.reduce<Phaser.Physics.Arcade.Image | null>(
      (best, e) => {
        const hp = (e.getData("hp") as number) ?? Number.MAX_SAFE_INTEGER;
        const bestHp = best
          ? (best.getData("hp") as number) ?? Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER;
        return hp < bestHp ? e : best;
      },
      null
    );
    const flames = this.fusionDroneFlames[owner];
    list.forEach((drone, index) => {
      // 无人机围绕目标小幅悬浮
      const orbit = time * 0.0022 + (Math.PI * 2 * index) / list.length;
      const anchorX = target ? target.x : shipSprite.x;
      const anchorY = target ? target.y - 30 : shipSprite.y - 260;
      drone.x = Phaser.Math.Linear(drone.x, anchorX + Math.cos(orbit) * 46, 0.12);
      drone.y = Phaser.Math.Linear(drone.y, anchorY + Math.sin(orbit) * 26, 0.12);
      drone.rotation = orbit;
      const glow = drone.getData("fusionGlow") as Phaser.GameObjects.Arc | undefined;
      if (glow?.active) {
        glow.setPosition(drone.x, drone.y);
        glow.setAlpha(0.16 + Math.sin(time * 0.02 + index) * 0.06);
      }
      const aimX = target ? target.x : shipSprite.x;
      const aimY = target ? target.y : shipSprite.y - 320;
      const dx = aimX - drone.x;
      const dy = aimY - drone.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const FLAME_LEN = 150;
      const flame = flames[index];
      if (flame) {
        flame
          .setVisible(true)
          .setFrame(Math.floor(time / 72) % 4)
          .setPosition(drone.x + ux * FLAME_LEN * 0.5, drone.y + uy * FLAME_LEN * 0.5)
          .setRotation(Math.atan2(ux, -uy))
          .setDisplaySize(92 + Math.sin(time * 0.03 + index) * 8, FLAME_LEN)
          .setAlpha(0.7 + Math.sin(time * 0.026 + index) * 0.12);
      }
      // 小型喷火判定:朝向目标的短锥体
      const insideCone = (x: number, y: number): boolean => {
        const rx = x - drone.x;
        const ry = y - drone.y;
        const proj = rx * ux + ry * uy;
        if (proj < 10 || proj > FLAME_LEN) return false;
        const perp = Math.abs(rx * uy - ry * ux);
        return perp <= 46;
      };
      let hitTarget: Phaser.Physics.Arcade.Image | null = null;
      for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (!enemy.active || !insideCone(enemy.x, enemy.y)) continue;
        enemy.setData("lastOwner", owner);
        const maxHp = Number(enemy.getData("maxHp")) || 1;
        // 无人机喷火不可暴击
        const dmg = Math.max(1, baseDmg + Math.round(maxHp * 0.0004));
        this.dealDirectDamage(enemy, dmg, enemy.x, enemy.y, false, owner);
        if (!hitTarget) hitTarget = enemy;
      }
      for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (
          part.active &&
          ["core", "raid-core"].includes(part.getData("part")) &&
          insideCone(part.x, part.y)
        ) {
          const maxHp = Number(part.getData("maxHp")) || 1;
          this.damageBossPart(part, Math.max(1, baseDmg + Math.round(maxHp * 0.0004)));
          if (!hitTarget) hitTarget = part;
        }
      }
      // 命中反馈:金色火花 + 伤害飘字,让技能效果清晰可见
      if (hitTarget) {
        const lastSpark = (drone.getData("fusionSparkAt") as number) ?? 0;
        if (time - lastSpark >= 140) {
          drone.setData("fusionSparkAt", time);
          const spark = this.add
            .circle(
              hitTarget.x + Phaser.Math.FloatBetween(-14, 14),
              hitTarget.y + Phaser.Math.FloatBetween(-14, 14),
              Phaser.Math.FloatBetween(2.5, 5),
              0xffd66b,
              0.9
            )
            .setDepth(17)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: spark,
            scale: 0.15,
            alpha: 0,
            duration: 180,
            onComplete: () => spark.destroy()
          });
        }
        const lastFloat = (drone.getData("fusionFloatAt") as number) ?? 0;
        if (save.settings.damageNumbers && time - lastFloat >= 420) {
          drone.setData("fusionFloatAt", time);
          const maxHp = Number(hitTarget.getData("maxHp")) || 1;
          this.floatText(
            hitTarget.x,
            hitTarget.y - 8,
            `${Math.max(1, baseDmg + Math.round(maxHp * 0.0004))}`,
            false
          );
        }
      }
      // 小型喷火同样焚毁范围内敌方弹幕
      for (const bullet of this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (bullet.active && insideCone(bullet.x, bullet.y)) {
          const spark = this.add
            .circle(bullet.x, bullet.y, 4, 0xffd66b, 0.85)
            .setDepth(17)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: spark,
            scale: 0.1,
            alpha: 0,
            duration: 150,
            onComplete: () => spark.destroy()
          });
          bullet.disableBody(true, true);
        }
      }
    });
  }

  // === 敏捷流派:影步突刺(M 键/P2, G 键/P1) ===
  activateLunge(owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ul = this.upgradesOf(owner);
    const level = ul.agile_lunge ?? 0;
    if (level <= 0) return;
    if (owner === 1 && this.skillsConfiscated) {
      showToast("技能被篡夺：只能使用基础机炮与走位");
      return;
    }
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite?.active) return;
    const readyAt = isP2 ? this.lungingReadyAt2 : this.lungingReadyAt;
    const lungingUntil = isP2 ? this.lungingUntil2 : this.lungingUntil;
    if (this.time.now < readyAt) {
      showToast(`突刺冷却 ${((readyAt - this.time.now) / 1000).toFixed(1)}s`);
      return;
    }
    if (this.time.now < lungingUntil) return; // 正在突刺中
    // 方向:P1 用 WASD(+单人方向键),P2 用 p2_move_* 绑定键
    const body = shipSprite.body as Phaser.Physics.Arcade.Body;
    const direction = new Phaser.Math.Vector2(
      owner === 2
        ? Number(this.keyHeld("p2_move_right")) - Number(this.keyHeld("p2_move_left"))
        : Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
      owner === 2
        ? Number(this.keyHeld("p2_move_down")) - Number(this.keyHeld("p2_move_up"))
        : Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown)
    );
    if (owner === 1) {
      direction.x += Number(this.wasd.D.isDown) - Number(this.wasd.A.isDown);
      direction.y += Number(this.wasd.S.isDown) - Number(this.wasd.W.isDown);
    }
    if (direction.lengthSq() < 0.1) direction.set(body.velocity.x, body.velocity.y);
    if (direction.lengthSq() < 10) direction.set(0, -1);
    direction.normalize();
    // 距离强制使用当前等级的上限,不再受鼠标位置影响
    let reach = AGILE_LUNGE_REACHES[level - 1] ?? AGILE_LUNGE_REACH;
    // 万象影袭(融合技)突刺距离全等级提高 20%
    if ((ul.agile_shadow_lunge ?? 0) > 0) reach *= 1.2;
    const tx = Phaser.Math.Clamp(shipSprite.x + direction.x * reach, 50, WORLD_WIDTH - 50);
    const ty = Phaser.Math.Clamp(shipSprite.y + direction.y * reach, 100, WORLD_HEIGHT - 60);
    if (isP2) {
      this.lungingFromX2 = shipSprite.x;
      this.lungingFromY2 = shipSprite.y;
      this.lungingToX2 = tx;
      this.lungingToY2 = ty;
      this.lungingDuration2 = AGILE_LUNGE_DURATION;
      this.lungingStartedAt2 = this.time.now;
      this.lungingUntil2 = this.time.now + this.lungingDuration2;
    } else {
      this.lungingFromX = shipSprite.x;
      this.lungingFromY = shipSprite.y;
      this.lungingToX = tx;
      this.lungingToY = ty;
      this.lungingDuration = AGILE_LUNGE_DURATION;
      this.lungingStartedAt = this.time.now;
      this.lungingUntil = this.time.now + this.lungingDuration;
    }
    const fusionLevel = ul.agile_shadow_lunge ?? 0;
    // 主动无敌:突刺全程 + 万象影袭结束时额外 0.5 秒(Boss 大技能不会穿透)
    if (isP2) {
      this.player2InvulnUntil = Math.max(
        this.player2InvulnUntil,
        this.lungingUntil2 + (fusionLevel > 0 ? 500 : 0)
      );
    } else {
      this.activeInvulnerableUntil = this.lungingUntil + (fusionLevel > 0 ? 500 : 0);
    }
    // G/M 键冷却减半:基础 30/25/20s → 15/12.5/10s,联动减冷却同步减半,下限 5s
    const cooldown = Math.max(5, (([30, 25, 20][level - 1] ?? 20) - fusionLevel * 1.5) * 0.5);
    if (isP2) this.lungingReadyAt2 = this.time.now + cooldown * 1000;
    else this.lungingReadyAt = this.time.now + cooldown * 1000;
    if (isP2) this.lungingHits2 = 0;
    else this.lungingHits = 0;
    // 每次突刺都是一次独立的扫掠,清除上一次留下的命中标记
    // 万象影袭 5.6% 附加:本体扫掠(由 lungeHit 限一次)与联动影分身(由 lungeShadowHit 限一次)各自独立结算
    for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
      enemy.setData("lungeHit", false);
      enemy.setData("lungeShadowHit", false);
    }
    for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
      part.setData("lungeHit", false);
      part.setData("lungeShadowHit", false);
    }
    this.showBanner(isP2 ? "P2 ◆ 影步突刺" : "◆ 影步突刺", 500);
    // 影步特效:紫电切面 + 青白相位残影
    this.triggerSpecialtyFX(0x9b5cff, {
      ring: 0x7ffcff,
      style: "slash",
      flash: [140, 255, 220, 110],
      shake: 220,
      count: 32,
    });
    this.spawnLungeTrail(
      isP2 ? this.lungingFromX2 : this.lungingFromX,
      isP2 ? this.lungingFromY2 : this.lungingFromY,
      tx,
      ty,
      AGILE_LUNGE_HIT_WIDTH[level - 1] ?? AGILE_LUNGE_HIT_WIDTH[AGILE_LUNGE_HIT_WIDTH.length - 1],
      owner
    );
    // === 突刺联动:已有影分身与本体沿相同方向同步突刺 ===
    if ((ul.agile_shadow_clone ?? 0) > 0) {
      this.spawnLungeShadowCombo(owner);
    }
  }

  // === 突刺联动:影分身从当前编队位置复制本体位移 ===
  spawnLungeShadowCombo(owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ul = this.upgradesOf(owner);
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite?.active) return;
    // 清理旧的突刺分身
    for (const c of (isP2 ? this.lungingShadowClones2 : this.lungingShadowClones)) c.destroy();
    if (isP2) this.lungingShadowClones2 = [];
    else this.lungingShadowClones = [];
    const clones = isP2 ? this.shadowClones2 : this.shadowClones;
    if (!clones.some((clone) => clone.active)) this.spawnShadowClones(owner);
    const sources = clones.filter((clone) => clone.active);
    if (!sources.length) return;
    const texture = shipSprite.texture.key;
    const maxHp = Math.max(1, this.maxHpOf(owner) * 0.4);
    const fusionLevel = ul.agile_shadow_lunge ?? 0;
    // 万象影袭伤害整体提高 2 倍(影分身突刺联动倍率 ×2),再提高 100%(整体 ×4)
    const dmgMul =
      (2.4 +
        ((ul.agile_shadow_clone ?? 1) - 1) * 0.4 +
        fusionLevel * 0.55) *
      4;
    const now = this.time.now;
    // 影分身与本体突刺时长一致(400ms → 550ms),并排突进清晰可见
    const duration = isP2 ? this.lungingDuration2 : this.lungingDuration;
    const fromX = isP2 ? this.lungingFromX2 : this.lungingFromX;
    const fromY = isP2 ? this.lungingFromY2 : this.lungingFromY;
    const toX = isP2 ? this.lungingToX2 : this.lungingToX;
    const toY = isP2 ? this.lungingToY2 : this.lungingToY;
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    if (isP2) this.lungingShadowUntil2 = now + duration;
    else this.lungingShadowUntil = now + duration;
    // 万象影袭固定释放 4 个影分身同步突刺
    const comboCount = 4;
    // 万象影袭范围系数:基础(Lv.2)为 1 倍,随等级提升,满级(Lv.5)为基础 1.9 倍
    const rangeScale = Math.max(
      1,
      1 + (((ul.agile_shadow_lunge ?? 0) - 2) / 3) * 0.9
    );
    // 万象影袭等级越高,分身横向展开越宽(范围随等级变大,最高为基础 1.9 倍)
    const fanGap = Math.round(110 * rangeScale);
    // 影分身以玩家为中心向两侧对称展开:与玩家并排、间隔明显、绝不复用玩家中心
    const fanSlots: number[] = [];
    for (let k = 1; fanSlots.length < comboCount; k += 1) {
      if (fanSlots.length < comboCount) fanSlots.push(-k * fanGap);
      if (fanSlots.length < comboCount) fanSlots.push(k * fanGap);
    }
    for (let i = 0; i < comboCount; i += 1) {
      const startX = Phaser.Math.Clamp(shipSprite.x + (fanSlots[i] ?? 0), 42, WORLD_WIDTH - 42);
      const startY = shipSprite.y;
      const endX = Phaser.Math.Clamp(startX + deltaX, 42, WORLD_WIDTH - 42);
      const endY = Phaser.Math.Clamp(startY + deltaY, 80, WORLD_HEIGHT - 42);
      const clone = this.physics.add
        .image(startX, startY, texture)
        .setDisplaySize(shipSprite.displayWidth, shipSprite.displayHeight)
        .setTint(0x8c25ff)
        .setAlpha(0.92)
        .setDepth(11);
      clone.setData("owner", owner);
      clone.setData("lungeShadow", true);
      clone.setData("hp", maxHp);
      clone.setData("maxHp", maxHp);
      clone.setData("dmgMul", dmgMul);
      clone.setData("bornAt", now);
      clone.setData("duration", duration);
      clone.setData("startX", startX);
      clone.setData("startY", startY);
      clone.setData("endX", endX);
      clone.setData("endY", endY);
      clone.setData("previousX", startX);
      clone.setData("previousY", startY);
      if (isP2) this.lungingShadowClones2.push(clone);
      else this.lungingShadowClones.push(clone);
    }
    this.showBanner(isP2 ? `P2 ◆ 万象影袭 · ${comboCount} 重同步突刺` : `◆ 万象影袭 · ${comboCount} 重同步突刺`, 650);
    this.triggerSpecialtyFX(0x9b5cff, {
      ring: 0xc16cff,
      style: "slash",
      flash: [120, 60, 220, 200],
      shake: 240,
      count: 50,
    });
  }

  // === 镜像残响:HP < 30% 召唤镜像 ===
  checkMirrorEcho(): void {
    if (!this.mirrorEchoArmed || this.mirrorEchoTriggered) return;
    if (this.stats.hp <= 0 || this.stats.hp / this.stats.maxHp >= 0.3) return;
    if (!this.player?.active) return;
    this.mirrorEchoTriggered = true;
    this.mirrorEchoArmed = false;
    const ship = SHIPS[save.selectedShip];
    const texture = this.textures.exists(ship.asset) ? ship.asset : "player";
    const echo = this.physics.add
      .image(this.player.x - 80, this.player.y, texture)
      .setDisplaySize(this.player.displayWidth, this.player.displayHeight)
      .setTint(0xb56cff)
      .setAlpha(0.9)
      .setDepth(11);
    echo.setData("owner", 1);
    echo.setData("mirrorEcho", true);
    // 持续 8 秒,无敌,跟着玩家
    this.time.delayedCall(8000, () => {
      if (echo.active) {
        this.burst(echo.x, echo.y, 0xb56cff, 1.2);
        echo.destroy();
      }
    });
    // 跟随玩家
    const follow = (): void => {
      if (!echo.active) return;
      echo.setPosition(
        Phaser.Math.Linear(echo.x, this.player.x - 90, 0.15),
        Phaser.Math.Linear(echo.y, this.player.y, 0.15)
      );
      this.time.delayedCall(33, follow);
    };
    follow();
    this.showBanner("◆ 镜像残响 · 召唤镜像", 1500);
    this.burst(this.player.x, this.player.y, 0xb56cff, 1.5);
  }

  // === 突刺联动:每帧更新影分身突刺位置 + 命中 ===
  updateLungeShadowClones(_time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const lungingShadowClones = isP2 ? this.lungingShadowClones2 : this.lungingShadowClones;
    const lungingShadowUntil = isP2 ? this.lungingShadowUntil2 : this.lungingShadowUntil;
    if (lungingShadowUntil === 0) return;
    const ul = this.upgradesOf(owner);
    const now = this.time.now;
    // 安全网:突刺时间已过但仍有残留影分身 → 强制全部销毁并爆炸,保证融合技释放的影分身必定消失
    if (now >= lungingShadowUntil) {
      for (const c of lungingShadowClones) {
        if (c.active) {
          this.bigExplosion(c.x, c.y, 0x9b5cff, 0.9);
          c.destroy();
        }
      }
      if (isP2) this.lungingShadowClones2 = [];
      else this.lungingShadowClones = [];
      if (isP2) this.lungingShadowUntil2 = 0;
      else this.lungingShadowUntil = 0;
      return;
    }
    for (let i = lungingShadowClones.length - 1; i >= 0; i -= 1) {
      const c = lungingShadowClones[i];
      if (!c.active) {
        lungingShadowClones.splice(i, 1);
        continue;
      }
      const born = c.getData("bornAt") as number;
      const dur = c.getData("duration") as number;
      const startX = c.getData("startX") as number;
      const startY = c.getData("startY") as number;
      const endX = c.getData("endX") as number;
      const endY = c.getData("endY") as number;
      const t = Math.min(1, Math.max(0, (now - born) / dur));
      const previousX = (c.getData("previousX") as number) ?? c.x;
      const previousY = (c.getData("previousY") as number) ?? c.y;
      const xNow = Phaser.Math.Linear(startX, endX, t);
      const yNow = Phaser.Math.Linear(startY, endY, t);
      c.setPosition(xNow, yNow);
      c.setData("previousX", xNow);
      c.setData("previousY", yNow);
      // 命中敌人
      const dmgMul = c.getData("dmgMul") as number;
      const dmg = this.computePlayerDamage(owner) * dmgMul;
      const fusionLevel = ul.agile_shadow_lunge ?? 0;
      // 万象影袭范围系数:基础(Lv.2)为 1 倍,满级(Lv.5)为基础 1.9 倍
      const rangeScale = Math.max(1, 1 + ((fusionLevel - 2) / 3) * 0.9);
      // 万象影袭:影分身突刺路径清除敌方弹幕(宽度与联动扫掠一致)
      const sweepWidth = Math.round(81.2 * rangeScale);
      for (const bullet of this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (
          bullet.active &&
          distancePointToSegment(bullet.x, bullet.y, previousX, previousY, c.x, c.y) <= sweepWidth
        ) {
          this.vaporizeEnemyBullet(bullet);
        }
      }
      const hit = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (e) =>
          e.active &&
          // 联动扫掠宽度随万象影袭等级提升而增大(满级为基础 2.4 倍)
          distancePointToSegment(e.x, e.y, previousX, previousY, c.x, c.y) <
            Math.round(81.2 * rangeScale)
      );
      if (hit && !hit.getData("lungeShadowHit")) {
        hit.setData("lungeShadowHit", true);
        hit.setData("lastOwner", owner);
        const before = hit.getData("hp") ?? 1;
        // 万象影袭(联动)同样可暴击
        const critical = Math.random() < this.actualCritChance(owner);
        const critAppliedDamage = critical
          ? dmg * this.actualCritMultiplier(owner)
          : dmg;
        // 万象影袭联动影分身:命中附加目标最大生命 5.6% 的额外伤害(lungeShadowHit 保证一次激活一次)
        const maxHpBonus = this.fusionLungeActive(owner)
          ? Math.ceil(((hit.getData("maxHp") as number) ?? before) * 0.056)
          : 0;
        const totalDamage = critAppliedDamage + maxHpBonus;
        if (before - totalDamage <= 0) {
          hit.setData("wheelchairRamKill", true);
          hit.setData("eliteKillWeapon", "lunge_shadow");
          this.destroyEnemy(hit, true);
          // 联动击杀奖励(敏捷流派):MAX HP +1 + 回复 1% 最大生命
          if (isP2) {
            this.player2MaxHp += 1;
            this.healPlayer2(this.player2MaxHp * 0.01);
          } else {
            this.stats.maxHp += 1;
            this.healPlayer(this.stats.maxHp * 0.01);
            this.recordAgileMaxHpGain(1);
          }
          this.floatText(hit.x, hit.y - 52, "万象影袭击杀 · MAX HP +1 · 回复1%", true);
        } else {
          hit.setData("hp", before - totalDamage);
        }
        this.impactBurst(hit.x, hit.y, 0x9b5cff);
      }
      // 命中首领
      for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (
          part.active &&
          ["core", "raid-core"].includes(part.getData("part")) &&
          !part.getData("lungeShadowHit") &&
          // 联动首领扫掠宽度随万象影袭等级提升而增大(满级为基础 2.4 倍)
          distancePointToSegment(part.x, part.y, previousX, previousY, c.x, c.y) <
            Math.round(140 * rangeScale)
        ) {
          part.setData("lungeShadowHit", true);
          const critical = Math.random() < this.actualCritChance(owner);
          const critAppliedDamage = critical
            ? dmg * this.actualCritMultiplier(owner)
            : dmg;
          // 万象影袭联动影分身:命中 Boss 部位附加最大生命 5.6% 的额外伤害(lungeShadowHit 保证一次激活一次)
          const maxHpBonus = this.fusionLungeActive(owner)
            ? Math.ceil(((part.getData("maxHp") as number) ?? (part.getData("hp") as number) ?? 0) * 0.056)
            : 0;
          this.damageBossPart(part, critAppliedDamage + maxHpBonus);
          this.impactBurst(part.x, part.y, 0x9b5cff);
        }
      }
      // 突刺结束 → 影分身消失并爆炸
      if (t >= 1) {
        this.bigExplosion(c.x, c.y, 0x9b5cff, 0.9);
        c.destroy();
        lungingShadowClones.splice(i, 1);
      }
    }
    if (lungingShadowClones.length === 0) {
      if (isP2) this.lungingShadowUntil2 = 0;
      else this.lungingShadowUntil = 0;
    }
  }

  // 万象影袭:清除单个敌方弹幕(紫色火花焚毁特效)
  vaporizeEnemyBullet(bullet: Phaser.Physics.Arcade.Image): void {
    const spark = this.add
      .circle(bullet.x, bullet.y, 5, 0xb56cff, 0.9)
      .setDepth(17)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: spark,
      scale: 0.1,
      alpha: 0,
      duration: 160,
      onComplete: () => spark.destroy()
    });
    bullet.disableBody(true, true);
  }

  // 万象影袭释放中:本体与影分身全部无敌且都是实体,本体扫掠与联动影分身命中目标时各附加最大生命 5.6% 的额外伤害(普通影分身不参与)
  fusionLungeActive(owner: 1 | 2 = 1): boolean {
    return (this.upgradesOf(owner).agile_shadow_lunge ?? 0) > 0 &&
      (owner === 2 ? this.lungingUntil2 : this.lungingUntil) > 0;
  }

  updateLunge(_time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const ul = this.upgradesOf(owner);
    const shipSprite = isP2 ? this.player2 : this.player;
    const lungingUntil = isP2 ? this.lungingUntil2 : this.lungingUntil;
    if (lungingUntil === 0 || !shipSprite) return;
    if (this.time.now >= lungingUntil) {
      if (isP2) this.lungingUntil2 = 0;
      else this.lungingUntil = 0;
      this.showBanner(isP2 ? "P2 ◆ 突刺结束" : "◆ 突刺结束", 400);
      return;
    }
    // 强制无敌(同时 invulnerableUntil 设到 lunging 结束)
    // 拥有万象影袭(融合技)时,突刺结束后额外保持 0.5 秒无敌
    const fusionBonus = (ul.agile_shadow_lunge ?? 0) > 0 ? 500 : 0;
    if (isP2) {
      this.player2InvulnUntil = Math.max(this.player2InvulnUntil, lungingUntil + fusionBonus);
    } else {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, lungingUntil + fusionBonus);
    }
    // 沿直线按已经过时间比例插值
    const progress = Phaser.Math.Clamp(
      (this.time.now - (isP2 ? this.lungingStartedAt2 : this.lungingStartedAt)) /
        Math.max(1, isP2 ? this.lungingDuration2 : this.lungingDuration),
      0,
      1
    );
    const prevX = shipSprite.x;
    const prevY = shipSprite.y;
    shipSprite.setPosition(
      Phaser.Math.Linear(isP2 ? this.lungingFromX2 : this.lungingFromX, isP2 ? this.lungingToX2 : this.lungingToX, progress),
      Phaser.Math.Linear(isP2 ? this.lungingFromY2 : this.lungingFromY, isP2 ? this.lungingToY2 : this.lungingToY, progress)
    );
    if (!isP2) {
      this.targetX = shipSprite.x;
      this.targetY = shipSprite.y;
    }
    // 命中判定:对本帧走过的线段做扫掠检测,避免高速穿过敌人时漏判
    const level = ul.agile_lunge ?? 1;
    const dmgMul = [1.1, 1.4, 1.7][level - 1] ?? 1.7;
    const hitWidth =
      AGILE_LUNGE_HIT_WIDTH[level - 1] ?? AGILE_LUNGE_HIT_WIDTH[AGILE_LUNGE_HIT_WIDTH.length - 1];
    const baseDamage = this.computePlayerDamage(owner) * dmgMul;
    // 万象影袭:本体突刺路径清除敌方弹幕
    if ((ul.agile_shadow_lunge ?? 0) > 0) {
      for (const bullet of this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (
          bullet.active &&
          distancePointToSegment(bullet.x, bullet.y, prevX, prevY, shipSprite.x, shipSprite.y) <=
            hitWidth
        ) {
          this.vaporizeEnemyBullet(bullet);
        }
      }
    }
    for (const enemy of this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!enemy.active || enemy.getData("lungeHit")) continue;
      if (
        distancePointToSegment(enemy.x, enemy.y, prevX, prevY, shipSprite.x, shipSprite.y) >
        hitWidth
      ) {
        continue;
      }
      enemy.setData("lungeHit", true);
      enemy.setData("lastOwner", owner);
      const before = enemy.getData("hp") ?? 1;
      // 突刺可暴击:享受暴击率与暴击伤害加成(敏捷流派唯一可暴击来源)
      const critical = Math.random() < this.actualCritChance(owner);
      const critAppliedDamage = critical
        ? baseDamage * this.actualCritMultiplier(owner)
        : baseDamage;
      // 万象影袭本体:命中附加目标最大生命 5.6% 的额外伤害(lungeHit 保证一次激活一次)
      const maxHpBonus = this.fusionLungeActive(owner)
        ? Math.ceil(((enemy.getData("maxHp") as number) ?? before) * 0.056)
        : 0;
      const totalDamage = critAppliedDamage + maxHpBonus;
      if (before - totalDamage <= 0) {
        enemy.setData("wheelchairRamKill", true);
        enemy.setData("eliteKillWeapon", "lunge");
        this.destroyEnemy(enemy, true);
        // 突刺击杀奖励(敏捷流派):MAX HP +1 + 回复 1% 最大生命
        if (isP2) {
          this.player2MaxHp += 1;
          this.healPlayer2(this.player2MaxHp * 0.01);
        } else {
          this.stats.maxHp += 1;
          this.healPlayer(this.stats.maxHp * 0.01);
          this.recordAgileMaxHpGain(1);
        }
        this.floatText(enemy.x, enemy.y - 52, "突刺击杀 · MAX HP +1 · 回复1%", true);
      } else {
        enemy.setData("hp", before - totalDamage);
        // 暴击静默:只加伤害,不飘字也不显示暴击效果
        if (!critical) this.floatText(enemy.x, enemy.y, `突刺 ${Math.round(totalDamage)}`, true);
      }
      // 回复 2% 最大生命(万象影袭激活时增强 60% → 3.2%),单次突刺最多累计 5 次
      const healRatio = this.fusionLungeActive(owner) ? 0.032 : 0.02;
      const lungingHits = isP2 ? this.lungingHits2 : this.lungingHits;
      if (lungingHits < AGILE_LUNGE_MAX_HEAL_HITS) {
        if (isP2) {
          this.lungingHits2 += 1;
          this.healPlayer2(this.player2MaxHp * healRatio);
        } else {
          this.lungingHits += 1;
          this.healPlayer(this.stats.maxHp * healRatio);
        }
      }
      this.impactBurst(enemy.x, enemy.y, 0x7ffcff);
    }
    // 命中首领
    for (const part of this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!part.active || !["core", "raid-core"].includes(part.getData("part")) || part.getData("lungeHit")) continue;
      if (
        distancePointToSegment(part.x, part.y, prevX, prevY, shipSprite.x, shipSprite.y) >
        hitWidth + 40
      ) {
        continue;
      }
      part.setData("lungeHit", true);
      // 突刺对 Boss 同样可暴击
      const critical = Math.random() < this.actualCritChance(owner);
      const critAppliedDamage = critical
        ? baseDamage * this.actualCritMultiplier(owner)
        : baseDamage;
      // 万象影袭本体:命中 Boss 部位附加最大生命 5.6% 的额外伤害(lungeHit 保证一次激活一次)
      const maxHpBonus = this.fusionLungeActive(owner)
        ? Math.ceil(((part.getData("maxHp") as number) ?? (part.getData("hp") as number) ?? 0) * 0.056)
        : 0;
      this.damageBossPart(part, critAppliedDamage + maxHpBonus);
      this.impactBurst(part.x, part.y, 0x7ffcff);
    }
  }

  // === 影步突刺:沿轨迹绘制紫电相位残影与青白切面 ===
  spawnLungeTrail(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    width: number,
    owner: 1 | 2 = 1
  ): void {
    const shipSprite = owner === 2 ? this.player2 : this.player;
    const texture = shipSprite?.texture.key ?? this.player.texture.key;
    const ghostSizeW = shipSprite?.displayWidth ?? this.player.displayWidth;
    const ghostSizeH = shipSprite?.displayHeight ?? this.player.displayHeight;
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    // 主体光带:沿突刺方向的细长矩形
    const beam = this.add
      .rectangle((fromX + toX) / 2, (fromY + toY) / 2, distance, width * 0.62, 0x7b28ff, 0.48)
      .setRotation(angle)
      .setDepth(19)
      .setBlendMode(Phaser.BlendModes.ADD);
    const edge = this.add
      .rectangle((fromX + toX) / 2, (fromY + toY) / 2, distance * 1.04, 6, 0xdfffff, 0.92)
      .setRotation(angle)
      .setDepth(20)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      scaleY: 0.2,
      duration: 320,
      ease: "Sine.easeOut",
      onComplete: () => beam.destroy()
    });
    this.tweens.add({
      targets: edge,
      scaleX: 1.15,
      scaleY: 0.1,
      alpha: 0,
      duration: 250,
      onComplete: () => edge.destroy()
    });
    // 沿路径分布的战机残影
    const ghostCount = Phaser.Math.Clamp(Math.round(distance / 70), 3, 8);
    for (let i = 1; i <= ghostCount; i += 1) {
      const ratio = i / (ghostCount + 1);
      const ghost = this.add
        .image(
          Phaser.Math.Linear(fromX, toX, ratio),
          Phaser.Math.Linear(fromY, toY, ratio),
          texture
        )
        .setDisplaySize(ghostSizeW, ghostSizeH)
        .setTint(i % 2 ? 0x9b5cff : 0x7ffcff)
        .setAlpha(0.5 * (1 - ratio) + 0.15)
        .setDepth(18)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: ghost.scale * 0.7,
        duration: 260 + i * 24,
        ease: "Sine.easeOut",
        onComplete: () => ghost.destroy()
      });
    }
    // 终点冲击环
    const impact = this.add
      .circle(toX, toY, width * 0.52, 0x9b5cff, 0.08)
      .setStrokeStyle(3, 0x7ffcff, 0.92)
      .setDepth(20)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: impact,
      scale: 2.7,
      rotation: Math.PI / 2,
      alpha: 0,
      duration: 380,
      ease: "Sine.easeOut",
      onComplete: () => impact.destroy()
    });
  }

  // === 流派专属强化:统一华丽特效触发器 ===
  triggerSpecialtyFX(
    color: number,
    opts: {
      ring?: number;
      flash?: [number, number, number, number];
      shake?: number;
      count?: number;
      style?: "burst" | "vortex" | "thorns" | "siphon" | "flame" | "slash";
    } = {}
  ): void {
    const flashRgb = opts.flash;
    const shake = opts.shake ?? 180;
    // 通用几何启动层已移除，只保留短促镜头反馈；真正的技能实体由各技能绘制。
    if (flashRgb) {
      this.cameras.main.flash(flashRgb[0], flashRgb[1], flashRgb[2], flashRgb[3] ?? 60);
    } else {
      const rgb = Phaser.Display.Color.IntegerToColor(color);
      this.cameras.main.flash(60, rgb.red, rgb.green, rgb.blue);
    }
    if (save.settings.screenShake) this.cameras.main.shake(shake, 0.006);
  }

  // === 敏捷流派:影分身 ===
  spawnShadowClones(owner: 1 | 2 = 1): void {
    const ul = this.upgradesOf(owner);
    const level = ul.agile_shadow_clone ?? 0;
    if (level <= 0) return;
    if (owner === 2 && !this.player2?.active) return;
    const isP2 = owner === 2;
    const ownerSprite = isP2 ? this.player2! : this.player;
    const clones = isP2 ? this.shadowClones2 : this.shadowClones;
    // 万象影袭等级同步提升分身数量/攻击/血量档位:有效等级取被动与融合技的较高者
    const fusionLevel = ul.agile_shadow_lunge ?? 0;
    const effectiveLevel = Math.max(level, fusionLevel);
    const tier = Math.min(effectiveLevel, AGILE_CLONE_MAX_COUNT) - 1;
    // 数量最多 4 个,继续升级只提升血量与攻击
    const count = AGILE_CLONE_COUNTS[tier] ?? AGILE_CLONE_MAX_COUNT;
    const dmgMul = AGILE_CLONE_DAMAGE_RATIOS[tier] ?? 1;
    // 分身血量 = 被动基础占比 + 融合技(万象影袭)每级额外加成,融合技等级越高分身越抗揍
    const hpRatio = (AGILE_CLONE_HP_RATIOS[tier] ?? 0.4) + AGILE_CLONE_FUSION_HP_BONUS * fusionLevel;
    // 清理死亡
    for (let i = clones.length - 1; i >= 0; i -= 1) {
      if (!clones[i].active) clones.splice(i, 1);
    }
    // 被动影分身随召唤间隔逐个产生(与融合技"释放后消失"区分开),死亡后同样逐个补充
    const interval = AGILE_CLONE_INTERVALS[tier] ?? AGILE_CLONE_INTERVALS[AGILE_CLONE_MAX_COUNT - 1];
    if (isP2) this.nextShadowCloneAt2 = this.time.now + interval * 1000;
    else this.nextShadowCloneAt = this.time.now + interval * 1000;
    if (clones.length >= count) return;
    const texture = ownerSprite.texture.key;
    const cloneMaxHp = this.shadowCloneMaxHp(hpRatio, owner);
    // 影分身继承当前完整模型，以紫色区分本体。
    // 生成时直接落在编队槽位左右两侧(±170px),避免先出现在玩家身上造成"重合看不到"
    const spawnSide = clones.length % 2 === 0 ? 170 : -170;
    const clone = this.physics.add
      .image(
        Phaser.Math.Clamp(ownerSprite.x + spawnSide, 42, WORLD_WIDTH - 42),
        ownerSprite.y,
        texture
      )
      .setDisplaySize(ownerSprite.displayWidth, ownerSprite.displayHeight)
      .setTint(0x9b5cff)  // 中紫色,便于与本体区分
      .setAlpha(0.92)
      .setDepth(11);
    clone.setData("owner", owner);
    clone.setData("shadowClone", true);
    clone.setData("shadowCloneDmgMul", dmgMul);
    clone.setData("shadowCloneHpRatio", hpRatio);
    clone.setData("hp", cloneMaxHp);
    clone.setData("maxHp", cloneMaxHp);
    clone.setData("lastShotAt", 0);
    clone.setData("phaseOffset", Phaser.Math.FloatBetween(0, Math.PI * 2));
    clone.setData("nextAfterimageAt", this.time.now);
    clones.push(clone);
    this.burst(clone.x, clone.y, 0x9b5cff, 1.0);
  }

  // 影分身击杀奖励(提高 50% 后):在场活跃分身不足 2 个时 MAX HP +3,2 个及以上时 +2;
  // 回复 = 1.5% 最大生命 + 3% 已损生命(owner 区分 P1/P2)
  grantShadowCloneKillReward(enemy: Phaser.Physics.Arcade.Image, owner: 1 | 2 = 1): void {
    const clones = owner === 2 ? this.shadowClones2 : this.shadowClones;
    const activeCloneCount = clones.filter((clone) => clone.active).length;
    // 击杀奖励提高 50%:在场分身 <2 → MAX HP +3,≥2 → +2;回复 1.5% 最大 + 3% 已损
    const gain = Math.round((activeCloneCount >= 2 ? 1 : 2) * 1.5);
    if (owner === 1) {
      this.stats.maxHp += gain;
      const missingHp = Math.max(0, this.stats.maxHp - this.stats.hp);
      this.healPlayer(this.stats.maxHp * 0.015 + missingHp * 0.03);
      this.recordAgileMaxHpGain(gain);
    } else {
      this.player2MaxHp += gain;
      const missingHp = Math.max(0, this.player2MaxHp - this.player2Hp);
      this.healPlayer2(this.player2MaxHp * 0.015 + missingHp * 0.03);
    }
    this.floatText(
      enemy.x,
      enemy.y - 52,
      `影分身击杀 · MAX HP +${gain} · 回复1.5%+3%`,
      true
    );
  }

  // 分身最大生命:按本体当前最大生命的比例动态换算,最低 4 点避免被任意弹幕一碰即死
  shadowCloneMaxHp(hpRatio: number, owner: 1 | 2 = 1): number {
    return Math.max(4, Math.round(this.maxHpOf(owner) * Math.max(0, hpRatio)));
  }

  // 影分身额外伤害比例:基础 0.1%(Lv.1)→0.5%(满级)再提高 110%(×2.1):Lv.1 约 0.21%,满级 1.05%
  shadowCloneMaxHpBonusRatio(owner: 1 | 2 = 1): number {
    const ul = this.upgradesOf(owner);
    const effectiveLevel = Math.max(
      ul.agile_shadow_clone ?? 0,
      ul.agile_shadow_lunge ?? 0
    );
    const tier = Math.max(0, Math.min(effectiveLevel, AGILE_CLONE_MAX_COUNT) - 1);
    return (0.001 + tier * (0.004 / (AGILE_CLONE_MAX_COUNT - 1))) * 2.1;
  }

  // 影分身额外伤害数值:目标最大生命 × 档位比例(至少 1 点)
  shadowCloneBonusDamage(enemy: Phaser.Physics.Arcade.Image, owner: 1 | 2 = 1): number {
    const maxHp = (enemy.getData("maxHp") as number) ?? (enemy.getData("hp") as number) ?? 0;
    return Math.max(1, Math.ceil(maxHp * this.shadowCloneMaxHpBonusRatio(owner)));
  }

  // 玩家主炮每射击一次,影分身同步射击一次(fireCannon 内调用)
  shadowClonesSyncFire(owner: 1 | 2 = 1): void {
    if ((this.upgradesOf(owner).agile_shadow_clone ?? 0) <= 0) return;
    const clones = owner === 2 ? this.shadowClones2 : this.shadowClones;
    // 影分身与玩家主炮同向射击(正上方),不再优先锁定血量最少的目标
    for (const clone of clones) {
      if (!clone.active) continue;
      const dmg = this.computePlayerDamage(owner) * ((clone.getData("shadowCloneDmgMul") as number) ?? 1);
      // 每分身每次射击 2 颗子弹(原 1 颗):横向错开 ±9px 形成小散射
      for (const side of [-1, 1] as const) {
        const bx = clone.x + side * 9;
        const b = this.spawnPlayerBullet(
          bx,
          clone.y - 10,
          "playerBullet",
          dmg,
          0,
          "shadow_clone_bullet",
          owner
        );
        if (!b) continue;
        if (!b.getData("achievementSkinBullet")) b.setDisplaySize(10, 18).setTint(0x8c25ff);
        // 标记为"影分身子弹",击杀敌方给敏捷 MAX HP 奖励
        b.setData("kind", "player-bullet");
        b.setVelocity(0, -660);
      }
    }
  }

  updateShadowClones(time: number, owner: 1 | 2 = 1): void {
    const isP2 = owner === 2;
    const clones = isP2 ? this.shadowClones2 : this.shadowClones;
    const ownerSprite = isP2 ? this.player2 : this.player;
    if (!ownerSprite) return;
    for (let i = clones.length - 1; i >= 0; i -= 1) {
      const clone = clones[i];
      if (!clone.active) {
        clones.splice(i, 1);
        continue;
      }
      // === 站位:分身与本体拉开明显间距,本体占据正中心,分身绝不复用 0 槽位 ===
      const n = clones.length;
      const spacing = 170; // 分身间隔(原 110,拉大以便明显可见)
      let slot: number;
      if (n === 1) {
        // 单分身放在玩家未贴边的一侧,避免边缘 clamp 后与本体重合
        slot = ownerSprite.x < WORLD_WIDTH / 2 ? spacing : -spacing;
      } else {
        // 按 1,2,3,... 对称展开:-170,+170,-340,+340,...(跳过中心 0,本体专属)
        const slots: number[] = [];
        for (let k = 1; slots.length < n; k += 1) {
          if (slots.length < n) slots.push(-k * spacing);
          if (slots.length < n) slots.push(k * spacing);
        }
        slot = slots[i] ?? 0;
      }
      const tx = Phaser.Math.Clamp(ownerSprite.x + slot, 42, WORLD_WIDTH - 42);
      clone.setPosition(
        Phaser.Math.Linear(clone.x, tx, 0.18),
        Phaser.Math.Linear(clone.y, ownerSprite.y, 0.18)
      );
      const phaseOffset = (clone.getData("phaseOffset") as number) ?? 0;
      clone.setAlpha(0.85 + Math.sin(time * 0.008 + phaseOffset) * 0.1);
      clone.setScale(ownerSprite.scaleX * (0.96 + Math.sin(time * 0.006 + phaseOffset) * 0.04));
      if (time >= ((clone.getData("nextAfterimageAt") as number) ?? 0)) {
        clone.setData("nextAfterimageAt", time + 190);
        const echo = this.add.image(clone.x, clone.y + 12, clone.texture.key)
          .setDisplaySize(clone.displayWidth, clone.displayHeight)
          .setTint(0x5b18aa)
          .setAlpha(0.3)
          .setDepth(9)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: echo,
          y: echo.y + 42,
          scale: echo.scale * 0.78,
          alpha: 0,
          duration: 310,
          onComplete: () => echo.destroy()
        });
      }
      // === 血量动态平衡:本体最大生命变化时,按比例同步分身上下限 ===
      const hpRatio = (clone.getData("shadowCloneHpRatio") as number) ?? 0;
      const desiredMaxHp = this.shadowCloneMaxHp(hpRatio, owner);
      const currentMaxHp = (clone.getData("maxHp") as number) ?? desiredMaxHp;
      if (desiredMaxHp !== currentMaxHp) {
        // 按当前血量百分比迁移,避免本体成长时分身被治疗或被削
        const healthPercent = Phaser.Math.Clamp(
          ((clone.getData("hp") as number) ?? currentMaxHp) / Math.max(1, currentMaxHp),
          0,
          1
        );
        clone.setData("maxHp", desiredMaxHp);
        clone.setData("hp", Math.max(1, Math.round(desiredMaxHp * healthPercent)));
      }
      // === 撞到敌人/Boss 部位:造成伤害并按分身自身血量结算存亡 ===
      // 撞击判定覆盖小兵与 Boss 部位(Boss 体型巨大,按自身宽度比例判定;原 24px 太苛刻,
      // 小兵/黑影撞过来几乎触发不了,导致"只有子弹能打到影分身")
      const enemyArr = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
      const bossArr = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
        (part) => part.active && part.getData("hittable") !== false
      );
      const collided = [...enemyArr, ...bossArr].find((target) => {
        if (!target.active) return false;
        const isBoss = this.bossParts.contains(target);
        const contactRange = isBoss ? Math.max(48, target.displayWidth * 0.3) : 40;
        return Phaser.Math.Distance.Between(clone.x, clone.y, target.x, target.y) < contactRange;
      });
      if (collided) {
        // 撞击受击带 400ms 冷却:避免贴住 Boss/小兵时每帧触发(对目标的伤害与分身自身受击都按此节奏结算)
        const collisionCooldownUntil = (clone.getData("lastCollisionAt") as number) ?? 0;
        const collisionReady = time >= collisionCooldownUntil;
        if (collisionReady) clone.setData("lastCollisionAt", time + 400);
        const isBoss = this.bossParts.contains(collided);
        if (collisionReady && !isBoss) {
          // 普通影分身只对非 Boss 目标造成撞击伤害;撞到 Boss 部位不结算伤害(分身不参与对 Boss 的计算),
          // 仅用于"Boss 能物理撞到分身"的受击判定
          // 分身撞击伤害 = 继承伤害 + 目标最大生命 0.1%→0.5% 额外伤害
          const dmg =
            this.computePlayerDamage(owner) * (clone.getData("shadowCloneDmgMul") as number ?? 1) +
            this.shadowCloneBonusDamage(collided, owner);
          collided.setData("lastOwner", owner);
          const before = collided.getData("hp") ?? 1;
          // 影分身不触发万象影袭的最大生命附加伤害(仅玩家本体扫掠触发)
          const totalDamage = dmg;
          if (before - totalDamage <= 0) {
            collided.setData("wheelchairRamKill", true);
            collided.setData("eliteKillWeapon", "shadow_clone");
            this.destroyEnemy(collided, true);
            // 影分身击杀奖励:在场分身 <2 → MAX HP +2;≥2 → +1;回复 1% 最大 + 2% 已损
            this.grantShadowCloneKillReward(collided, owner);
          } else {
            collided.setData("hp", before - totalDamage);
          }
        }
        // 万象影袭期间分身无敌:撞击不扣血(按 owner 判定,P2 拥有融合技同样生效)
        if (collisionReady && !this.fusionLungeActive(owner)) {
          // 分身按敌人/Boss 真实撞击伤害扣血(无免伤、无特殊减免),血量耗尽才消散
          const collidedType = collided.getData("type");
          const collidedElite = Boolean(collided.getData("elite"));
          const contactDamage = isBoss
            ? 26
            : collidedElite || collidedType === "gunship" || collidedType === "bomber"
              ? 24
              : collidedType === "striker" ||
                  collidedType === "suppressor" ||
                  collidedType === "mine_layer"
                ? 18
                : 14;
          const cloneHp = ((clone.getData("hp") as number) ?? 1) - contactDamage;
          if (cloneHp <= 0) {
            clone.setData("hp", 0);
            clone.disableBody(true, true);
            clone.destroy();
            this.burst(clone.x, clone.y, 0x9b5cff, 1.2);
            clones.splice(i, 1);
            continue;
          }
          clone.setData("hp", cloneHp);
          this.impactBurst(clone.x, clone.y, 0x9b5cff);
        }
      }
      // === 敌方子弹命中分身:分身是实体,会挡下子弹并受伤,血量耗尽才消散 ===
      const enemyBulletHit = (this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]).find(
        (b) => b.active && Phaser.Math.Distance.Between(clone.x, clone.y, b.x, b.y) < 26
      );
      if (enemyBulletHit) {
        // 子弹被分身挡下
        enemyBulletHit.disableBody(true, true);
        // 万象影袭期间分身无敌:只挡子弹不受伤害(按 owner 判定,P2 同样生效)
        if (this.fusionLungeActive(owner)) {
          this.impactBurst(clone.x, clone.y, 0x9b5cff);
        } else {
          const bulletDamage = (enemyBulletHit.getData("damage") as number) ?? 10;
          // 单发弹幕对分身伤害设上限:无融合技时最多 1/3 最大生命(保底 1 点),满血分身至少扛 3 发;
          // 拥有万象影袭后最多 1/5 最大生命(保底 1 点),满血分身至少扛 5 发
          const cloneMaxHp = Math.max(1, (clone.getData("maxHp") as number) ?? 1);
          const fusionOwned = (this.upgradesOf(owner).agile_shadow_lunge ?? 0) > 0;
          const cappedDamage = fusionOwned
            ? Math.min(bulletDamage, Math.max(1, Math.floor((cloneMaxHp - 1) / 5)))
            : Math.min(bulletDamage, Math.max(1, Math.floor((cloneMaxHp - 1) / 3)));
          const cloneHp = ((clone.getData("hp") as number) ?? 1) - cappedDamage;
          if (cloneHp <= 0) {
            clone.setData("hp", 0);
            clone.disableBody(true, true);
            clone.destroy();
            this.burst(clone.x, clone.y, 0x9b5cff, 1.2);
            clones.splice(i, 1);
            continue;
          }
          clone.setData("hp", cloneHp);
          // 受击闪白反馈,增强"实体感";结束后恢复紫色标识而非清除
          clone.setTintFill(0xffe6ff);
          this.time.delayedCall(60, () => clone.active && clone.setTint(0x9b5cff));
          this.impactBurst(clone.x, clone.y, 0x9b5cff);
        }
      }
      // 射击节奏已改为与玩家主炮同步(fireCannon → shadowClonesSyncFire),此处不再周期射击
    }
  }
  activateSkill(kind: "laser" | "missile" | "drone", owner: 1 | 2): void {
    if (this.ended || this.isModal) return;
    if (this.specOf(owner) === "wheelchair") {
      if (kind === "laser") this.activateWheelchairBreachHorn(owner);
      else if (kind === "missile") this.activateWheelchairReactiveArmor(owner);
      else this.activateWheelchairFortressStance(owner);
      return;
    }
    if (owner === 1 && this.skillsConfiscated) {
      showToast("技能被篡夺：只能使用基础机炮与走位");
      return;
    }
    const key = `${kind}-${owner}`;
    const cooldownBase = { laser: 10000, missile: 9000, drone: 9800 }[kind];
    const cooldown =
      cooldownBase *
      this.statsOf(owner).cooldownMultiplier *
      (this.shipOf(owner) === "lightning" ? 0.82 : 1);
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      cooldownToast(kind.toUpperCase(), this.skillReadyAt[key] ?? 0, this.time.now);
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
      const count = this.shipOf(owner) === "bomber" ? 9 : 7;
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
        // 无人机过载不穿透:命中即爆炸并结束(命中爆炸特效与 0.3% 额外伤害见 hitEnemy)
        bullet.setVelocityX(i * 95).setData("pierce", 0);
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
      this.statsOf(owner).cooldownMultiplier *
      (this.shipOf(owner) === "lightning" ? 0.82 : 1);
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      cooldownToast("EMP", this.skillReadyAt[key] ?? 0, this.time.now);
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
          (save.selectedShip === "bomber" && owner === 1 ? 248 : 200) *
            ATTACK_BONUS_SCALE,
          enemy.x,
          enemy.y
        );
      }
    });
    if (this.bossActive) {
      const totalBossDamage = 520 * ATTACK_BONUS_SCALE;
      const raidCores = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
        (part) =>
          part.active &&
          part.getData("part") === "raid-core" &&
          part.getData("defeated") !== true
      );
      if (raidCores.length) {
        // 全屏 EMP 同时命中三神，但总伤害不因目标数量翻倍。
        raidCores.forEach((core) => this.damageBossPart(core, totalBossDamage / raidCores.length));
      } else {
        const target = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
          (part) =>
            part.active &&
            ["core", "dark-aircraft"].includes(part.getData("part")) &&
            part.getData("hittable") !== false
        );
        if (target) {
          // 相位倍率由 damageBossPart 的 core 分支统一乘算(相位1=0.65/2/3=1.25),
          // 这里不再预除,否则与内部倍率互相抵消,导致 EMP 对核心相位 1 不减伤、2/3 不增伤。
          this.damageBossPart(target, totalBossDamage);
        }
      }
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
    if (this.friendlyFireEnabled() && this.player2?.active) {
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

  activatePhaseDash(owner: 1 | 2 = 1): void {
    if (this.ended || this.isModal) return;
    const isP2 = owner === 2;
    if (owner === 1 && this.skillsConfiscated) {
      showToast("相位引擎被暂时封锁");
      return;
    }
    const key = isP2 ? "phase-dash-2" : "phase-dash";
    const cooldown = 8200 * this.statsOf(owner).cooldownMultiplier;
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      cooldownToast("相位闪避", this.skillReadyAt[key] ?? 0, this.time.now);
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite?.active) return;
    const body = shipSprite.body as Phaser.Physics.Arcade.Body;
    const direction = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y);
    if (direction.lengthSq() < 10) direction.set(0, -1);
    direction.normalize().scale(170);
    const startX = shipSprite.x;
    const startY = shipSprite.y;
    shipSprite.setPosition(
      Phaser.Math.Clamp(shipSprite.x + direction.x, 55, WORLD_WIDTH - 55),
      Phaser.Math.Clamp(shipSprite.y + direction.y, 150, WORLD_HEIGHT - 90)
    );
    if (isP2) {
      this.player2InvulnUntil = Math.max(this.player2InvulnUntil, this.time.now + 1250);
    } else {
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 1250);
    }
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (
        bullet.active &&
        Phaser.Math.Distance.Between(bullet.x, bullet.y, shipSprite.x, shipSprite.y) < 180
      ) {
        bullet.disableBody(true, true);
      }
      return true;
    });
    const trail = this.add.graphics().setDepth(18);
    trail.lineStyle(18, 0x2df4ff, 0.28);
    trail.lineBetween(startX, startY, shipSprite.x, shipSprite.y);
    this.tweens.add({ targets: trail, alpha: 0, duration: 320, onComplete: () => trail.destroy() });
    this.burst(shipSprite.x, shipSprite.y, 0x2df4ff, 1.7);
    this.showBanner(`${isP2 ? "P2 · " : ""}相位闪避 · 无敌 1.25 秒`, 650);
  }

  activateNanoRepair(owner: 1 | 2 = 1): void {
    if (this.ended || this.isModal) return;
    const isP2 = owner === 2;
    if (owner === 1 && this.skillsConfiscated) {
      showToast("纳米修复被暂时封锁");
      return;
    }
    const key = isP2 ? "nano-repair-2" : "nano-repair";
    const cooldown = 19000 * this.statsOf(owner).cooldownMultiplier;
    if (this.time.now < (this.skillReadyAt[key] ?? 0)) {
      cooldownToast("纳米修复", this.skillReadyAt[key] ?? 0, this.time.now);
      return;
    }
    this.skillReadyAt[key] = this.time.now + cooldown;
    const shipSprite = isP2 ? this.player2 : this.player;
    if (!shipSprite?.active) return;
    if (isP2) {
      this.healPlayer2(this.player2MaxHp * 0.18, "纳米修复");
      this.player2InvulnUntil = Math.max(this.player2InvulnUntil, this.time.now + 650);
    } else {
      this.healPlayer(this.stats.maxHp * 0.18, "纳米修复");
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 650);
    }
    const shield = this.add
      .circle(shipSprite.x, shipSprite.y, shipSprite.displayWidth * 0.62, 0x43ff9a, 0.08)
      .setStrokeStyle(4, 0x43ff9a, 0.8)
      .setDepth(19);
    this.tweens.add({
      targets: shield,
      scale: 1.4,
      alpha: 0,
      duration: 720,
      onComplete: () => shield.destroy()
    });
    this.showBanner(`${isP2 ? "P2 · " : ""}纳米蜂群 · 舰体修复 18%`, 750);
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
    if (!this.friendlyFireEnabled()) return;
    const now = this.time.now;
    if (
      this.ended ||
      now < this.invulnerableUntil
    ) {
      return;
    }
    const reduction =
      this.stats.damageTakenMultiplier *
      (explosion ? this.stats.explosionTakenMultiplier : 1) *
      (save.selectedSpecialization === "wheelchair" ? this.wheelchairRamArmorReduction() : 1);
    const preSkillDamage = Math.max(1, Math.ceil(amount * reduction));
    const finalDamage = Math.max(
      1,
      Math.ceil(preSkillDamage * this.wheelchairActiveDefenseMultiplier(now))
    );
    this.recordWheelchairReactiveAbsorption(preSkillDamage, finalDamage);
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);
    this.invulnerableUntil = now + 360;
    this.player.setTintFill(0xff9b4d);
    this.time.delayedCall(
      90,
      () => {
        if (this.player.active) this.player.clearTint();
      }
    );
    this.floatText(this.player.x, this.player.y - 50, `友军爆破 -${finalDamage}`, true);
    if (this.stats.hp <= 0) {
      this.playerExplosion(this.player.x, this.player.y);
      this.player.setVisible(false);
      if (playVariant === "single" || !this.player2?.active || this.coopHandoverDone) {
        this.time.delayedCall(750, () => this.endRun(false));
      } else {
        this.triggerP1HandOver();
      }
    }
  }

  damagePlayer2Friendly(amount: number, explosion: boolean): void {
    if (!this.friendlyFireEnabled()) return;
    const now = this.time.now;
    if (
      !this.player2?.active ||
      this.ended ||
      now < this.player2FriendlyInvulnerableUntil ||
      now < this.player2InvulnUntil
    ) {
      return;
    }
    const specialization = SPECIALIZATIONS[this.specOf(2)];
    const armorReduction = permanentArmorScale();
    const ramArmorReduction = this.wheelchairRamArmorReduction(2);
    const finalDamage = Math.max(
      1,
      Math.ceil(
        amount *
          specialization.damageTaken *
          armorReduction *
          ramArmorReduction *
          (explosion ? specialization.explosionTaken : 1) *
          this.wheelchairActiveDefenseMultiplier(now, 2)
      )
    );
    this.player2Hp = Math.max(0, this.player2Hp - finalDamage);
    this.player2FriendlyInvulnerableUntil = now + 360;
    this.player2.setTintFill(0xff9b4d);
    this.time.delayedCall(
      90,
      () => {
        if (this.player2?.active) this.player2.clearTint();
      }
    );
    this.floatText(this.player2.x, this.player2.y - 50, `友军爆破 -${finalDamage}`, true);
    if (this.player2Hp <= 0) {
      this.playerExplosion(this.player2.x, this.player2.y);
      this.showBanner("P2 被友军火力击落", 900);
      this.player2.disableBody(true, true);
      // 与敌伤路径一致:P2 阵亡 → P1 接管继续
      if (playVariant !== "single" && this.player?.active && !this.coopHandoverDone) {
        this.triggerP2HandOver();
      } else if (playVariant !== "single") {
        this.time.delayedCall(750, () => this.endRun(false));
      }
    }
  }

  damagePlayer2(
    amount: number,
    damageType: "projectile" | "collision" | "explosion" = "projectile",
    damageSource: EnemyDamageSource = this.bossActive ? "boss" : "minion"
  ): void {
    const now = this.time.now;
    if (!this.player2 || !this.player2.active || this.ended) return;
    if (now < this.player2InvulnUntil) return; // P2 相位闪避/突刺/纳米修复的无敌窗口
    const reduction = this.shipOf(2) === "guardian" ? 0.8 : 1;
    const p2Spec = this.specOf(2);
    const specializationReduction = SPECIALIZATIONS[p2Spec].damageTaken;
    const armorReduction = permanentArmorScale();
    const ramArmorReduction = this.wheelchairRamArmorReduction(2);
    const explosionReduction =
      damageType === "explosion" ? SPECIALIZATIONS[p2Spec].explosionTaken : 1;
    const normalDamage =
      amount *
      enemyUpgradeScale() *
      reduction *
      specializationReduction *
      armorReduction *
      explosionReduction;
    const baseDamage =
      damageSource === "boss" && this.player2MaxHp > 1000
        ? this.player2MaxHp *
          0.125 *
          collisionBossDamageScale(
            this.player2MaxHp,
            p2Spec === "wheelchair"
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
    const finalDamage = Math.max(
      1,
      Math.ceil(
        baseDamage *
          (damageSource === "boss"
            ? this.currentBossEncounterAttackScale()
            : 1) *
          ramArmorReduction *
          this.wheelchairActiveDefenseMultiplier(this.time.now, 2)
      )
    );
    this.player2Hp = Math.max(0, this.player2Hp - finalDamage);
    // === 防御流派:P2 荆棘护甲反伤 ===
    this.applyThorns(finalDamage, null, 2);
    this.player2.setTintFill(0xff4d6d);
    this.time.delayedCall(
      100,
      () => {
        if (this.player2?.active) this.player2.clearTint();
      }
    );
    this.burst(this.player2.x, this.player2.y, 0xff4d6d, 1.3);
    if (save.settings.screenShake) this.cameras.main.shake(85, 0.004);
    if (this.player2Hp <= 0) {
      this.playerExplosion(this.player2.x, this.player2.y);
      this.player2.setVisible(false);
      this.showBanner("P2 战机被击落", 900);
      this.player2.disableBody(true, true);
      // 双人模式 P2 死亡时:把 P2 数值迁移给 P1,接管 P2 战机继续游戏
      if (playVariant !== "single" && this.player?.active && !this.coopHandoverDone) {
        this.triggerP2HandOver();
      } else if (playVariant !== "single") {
        // 接管已发生或 P1 已阵亡:P2 再阵亡则本局结束
        this.time.delayedCall(750, () => this.endRun(false));
      }
    }
  }

  // 双人模式:把 P2 的血条 / 数值复制到 P1,P1 接管 P2 战机继续战斗
  triggerP2HandOver(): void {
    if (this.ended || this.coopHandoverDone) return;
    this.coopHandoverDone = true;
    this.showBanner("◆ P2 阵亡 · P1 接管 P2 战机继续战斗", 1800);
    this.burst(this.player.x, this.player.y, 0x9b5cff, 1.6);
    this.cameras.main.flash(220, 160, 80, 220);
    // 幸存者 P1 满血接管 P2 的机体(原代码复制的是 P2 归零后的血量,导致幸存者血条变 0)
    this.stats.maxHp = Math.max(1, Math.round(this.player2MaxHp));
    this.stats.hp = roundHealth(this.stats.maxHp, this.stats.maxHp);
    this.stats.damageTakenMultiplier = 1;
    this.invulnerableUntil = this.time.now + 1500;
    // 把 P2 战机"还给"P1 玩家:P2 视觉上已 disable,这里把 P2 的位置/贴图给 P1
    const p2X = this.player2?.x ?? this.player.x;
    const p2Y = this.player2?.y ?? this.player.y;
    this.player.setPosition(p2X, p2Y);
    this.player2?.disableBody(true, true);
    // P2 血条置空
    this.player2Hp = 0;
    this.player2MaxHp = 0;
  }

  // 双人模式:P1 死亡时把 P1 的血条 / 数值复制给 P2,P2 接管 P1 战机
  triggerP1HandOver(): void {
    if (this.ended || !this.player2 || this.coopHandoverDone) return;
    this.coopHandoverDone = true;
    this.showBanner("◆ P1 阵亡 · P2 接管 P1 战机继续战斗", 1800);
    this.burst(this.player2.x, this.player2.y, 0x2df4ff, 1.6);
    this.cameras.main.flash(220, 80, 160, 220);
    // 幸存者 P2 满血接管 P1 的机体(原代码复制的是 P1 归零后的血量,导致幸存者血条变 0)
    this.player2MaxHp = Math.max(1, Math.round(this.stats.maxHp));
    this.player2Hp = roundHealth(this.player2MaxHp, this.player2MaxHp);
    this.player2FriendlyInvulnerableUntil = this.time.now + 1500;
    const p1X = this.player.x;
    const p1Y = this.player.y;
    this.player2.setPosition(p1X, p1Y);
    // P1 已阵亡:禁用心智体,防止隐形机体继续受击重复触发接管
    this.player.disableBody(true, true);
    this.stats.hp = 0;
    this.stats.maxHp = 0;
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
    // === 成就 → 自动解锁皮肤 ===
    const skinReward: Record<string, SkinId> = {
      boss_slayer: "boss_slayer_skin",
      ending_shattered_vessel: SHADOW_ENDING_SKIN_REWARDS.destroyed_fallen,
      ending_total_eclipse: SHADOW_ENDING_SKIN_REWARDS.destroyed_consumed,
      ending_willing_host: SHADOW_ENDING_SKIN_REWARDS.destroyed_embraced,
      ending_hollow_custody: SHADOW_ENDING_SKIN_REWARDS.kept_fallen,
      ending_perfect_vessel: SHADOW_ENDING_SKIN_REWARDS.kept_possessed,
      boss_campaign_legend: BOSS_SEQUENCE_LEGENDARY_SKIN
    };
    const rewardSkin = skinReward[id];
    if (rewardSkin && !save.unlockedSkins.includes(rewardSkin)) {
      save.unlockedSkins.push(rewardSkin);
      showToast(`🏅 解锁皮肤 · ${SKINS[rewardSkin].name}`);
    }
    persist();
    showToast(`🏅 获得勋章：${achievement.name}`);
    sfx("upgrade");
  }

  clearBossEntities(): void {
    this.clearBossAttackEffects();
    this.bossParts.children.each((child) => {
      const part = child as Phaser.Physics.Arcade.Image;
      const raidAura = part.getData("raidAura") as Phaser.GameObjects.Arc | undefined;
      if (raidAura) {
        this.tweens.killTweensOf(raidAura);
        raidAura.destroy();
      }
      // 对象池复用前必须复位:上一场的 tween 会继续改坐标,
      // 炮台残留的 alpha 0 会让复用者完全不可见;隐身阶段的 hittable false
      // 若残留,下一场 Boss 会"打不着"。一并复位 scale。
      this.tweens.killTweensOf(part);
      part
        .setAlpha(1)
        .setScale(1)
        .setAngle(0)
        .setData("hittable", true)
        .clearTint();
      // 必须无条件禁用并隐藏。Phaser 渲染只看 visible 不看 active:
      // 若先 setVisible(true) 再只禁用 active 部件,被上一场 defeatBoss /
      // 炮台被毁 / 黑暗飞机击毁 提前 disableBody 的部件(active=false)会
      // 变成 visible=true 的"幽灵 Boss 图",叠在下一场战斗上挡住弹幕。
      part.disableBody(true, true);
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    if (this.bossEliteAura) {
      // 光环上的 tween 是 repeat:-1 永久循环,Phaser 不会因目标销毁而自动停止,
      // 必须先 killTweensOf 再 destroy,否则逐场累积悬挂 tween。
      this.tweens.killTweensOf(this.bossEliteAura);
      this.bossEliteAura.destroy();
    }
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
    if (!this.bossActive || !isNineBattleMode()) return;
    const encounter = BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex];
    if (encounter?.kind !== "chase") return;
    const escapedAfterDamage = Math.round((encounter.chaseDamageTarget ?? 0) * 100);
    // 按 encounters 里第几次「追逐黑影」动态编号,不再硬编码索引 [1,3,5]
    const chaseNumber =
      BOSS_CAMPAIGN_ENCOUNTERS.slice(0, this.campaignEncounterIndex).filter(
        (encounter) => encounter.kind === "chase"
      ).length + 1;
    const reward =
      Math.round(
        (70 + chaseNumber * 55) *
          campaignDifficultyForLevel(selectedLevel).rewardMultiplier
      );
    this.grantRunTokens(reward);
    this.score += 5200 + chaseNumber * 1800;
    this.nextSpawn = this.time.now + 999999;
    const stolenBossKind = (["titan", "mirror", "usurper"] as BossKind[])[
      chaseNumber - 1
    ];
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    const escapeX = core?.x ?? WORLD_WIDTH / 2;
    const escapeY = core?.y ?? 230;
    const escapeWidth = core?.displayWidth ?? 350;
    const escapeHeight = core?.displayHeight ?? 525;
    // 先清理 Boss 实体,再创建退场残影;残影必须登记进
    // bossTransientVisuals,否则退场 tween 一旦被中断就会残留在背景上。
    this.clearBossEntities();
    this.campaignEncounterIndex += 1;
    this.showBanner(`黑影受创 ${escapedAfterDamage}% · 正在向上隐退`, 1500);
    const continueAfterUpgrade = () => {
      if (selectedMode === "campaign") {
        this.startCampaignInterlude(this.campaignEncounterIndex, chaseNumber);
      } else {
        this.startCampaignEncounter(this.campaignEncounterIndex);
      }
    };
    const dropUpgrade = () =>
      this.spawnBossUpgradePickup(
        escapeX,
        Phaser.Math.Clamp(escapeY, 150, WORLD_HEIGHT - 260),
        stolenBossKind,
        continueAfterUpgrade
      );
    const afterimage: Phaser.GameObjects.Image | null = this.trackBossVisual(
      this.add
        .image(
          escapeX,
          escapeY,
          shadowTextureForAbsorbedPowers(this.campaignBossesDefeated)
        )
        .setDisplaySize(escapeWidth, escapeHeight)
        .setDepth(35)
        .setAlpha(0.94)
    );
    this.tweens.add({
      targets: afterimage,
      y: -430,
      alpha: 0,
      duration: 820,
      ease: "Sine.In",
      onComplete: () => {
        afterimage?.destroy();
        dropUpgrade();
      }
    });
  }

  defeatTrinityRaid(): void {
    if (
      !this.bossActive ||
      !isNineBattleMode() ||
      BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]?.kind !== "trinity"
    ) {
      return;
    }
    this.bossActive = false;
    this.nextSpawn = this.time.now + 999999;
    const reward = Math.round(
      560 * campaignDifficultyForLevel(selectedLevel).rewardMultiplier
    );
    this.grantRunTokens(reward);
    this.score += 36000;
    this.bossTier += 1;
    this.ultimate = 100;
    this.healPlayer(this.stats.maxHp * 0.35, "三神核心回收");
    // === 三神全灭 — 三个核心各爆一次 ===
    (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter((p) => p.active && p.getData("part") === "raid-core")
      .forEach((p, i) => {
        this.time.delayedCall(i * 180, () =>
          this.bigExplosion(p.x, p.y, [0xff3dbb, 0x9b5cff, 0x54f4ff][i % 3], 1.2)
        );
      });
    this.clearBossEntities();
    this.cameras.main.flash(260, 255, 240, 255);
    if (save.settings.screenShake) this.cameras.main.shake(900, 0.023);
    this.showBanner(`三神共斗终结 · 主动与专属被动各选一项`, 1800);
    // 三神共斗：三个本源主动进入一次三选一，随后从三神未取得的专属被动中再选一项。
    const raidKinds = this.trinityDefeatedKinds.length
      ? this.trinityDefeatedKinds
      : (["titan", "mirror", "usurper"] as BossKind[]);
    this.time.delayedCall(1200, () => {
      // 三神共斗:主动 + 被动放在同一个面板里同时选择,选完后再走一次普通强化
      showTrinityCombinedChoice(this, raidKinds, () => {
        // 三神共斗后再加一次普通强化三选一,让中段奖励更厚
        showUpgrade(this, () => {
          if (selectedMode === "campaign") {
            this.startCampaignInterlude(7, 4);
          } else {
            this.startCampaignEncounter(7);
          }
        });
      });
    });
  }

  startCampaignInterlude(nextEncounterIndex = 0, waveNumber = 0): void {
    if (this.ended || selectedMode !== "campaign") return;
    this.clearBossEntities();
    this.campaignEncounterIndex = Phaser.Math.Clamp(
      nextEncounterIndex,
      0,
      BOSS_CAMPAIGN_ENCOUNTERS.length - 1
    );
    this.campaignInterludeNextEncounter = this.campaignEncounterIndex;
    this.campaignInterludeWave = Phaser.Math.Clamp(waveNumber, 0, 4);
    this.campaignInterludeKills = 0;
    this.campaignMysteryStage = 0;
    this.campaignMysteryVariant = Phaser.Math.Between(0, 2);
    this.campaignInterludeStartScore = this.score + this.score2;
    this.campaignInterludeTarget = campaignClearScoreRequirement(
      this.campaignInterludeWave,
      selectedLevel
    );
    this.campaignInterludeActive = true;
    this.levelCompleteTriggered = false;
    this.campaignHalfGateDone = false;
    this.nextSpawn = 0;
    const entryMessages = [
      "未知航道开放 · 保持火力",
      "深空回波失真 · 自由推进",
      "星图暂时失去目标 · 注意异常掉落"
    ];
    this.showBanner(
      entryMessages[(this.campaignMysteryVariant + this.campaignInterludeWave) % entryMessages.length],
      1100
    );
  }

  // === 普通战役航线门:清兵达标并清场后出现红/蓝/绿三扇随机航线门 ===
  spawnCampaignGates(time: number): void {
    if (this.campaignGatesOpen || this.campaignGates.length > 0) return;
    this.campaignGatesOpen = true;
    this.campaignGateUntil = time + 12000;
    const kinds = (["red", "blue", "green"] as const).slice().sort(() => Math.random() - 0.5);
    const xs = [WORLD_WIDTH * 0.22, WORLD_WIDTH * 0.5, WORLD_WIDTH * 0.78];
    this.campaignGates = kinds.map((kind, index) =>
      this.buildCampaignGate(kind, xs[index], 300, index)
    );
    this.showBanner("◆ 三扇随机航线门开启 · 选择航线获取奖励后继续推进", 1500);
  }

  buildCampaignGate(
    kind: "red" | "blue" | "green",
    x: number,
    y: number,
    index: number
  ): Phaser.GameObjects.Container {
    const colors = { red: 0xff3d5a, blue: 0x3d8bff, green: 0x43ff9a } as const;
    const names = {
      red: "赤红航线 · 强敌与攻击",
      blue: "深蓝航线 · 异常事件",
      green: "翠绿航线 · 修复护盾"
    } as const;
    const color = colors[kind];
    const glow = this.add.circle(0, 0, 84, color, 0.14);
    const ring = this.add
      .circle(0, 0, 60, 0x000000, 0.4)
      .setStrokeStyle(5, color, 0.95);
    const core = this.add
      .circle(0, 0, 28, color, 0.85)
      .setStrokeStyle(3, 0xffffff, 0.7);
    const label = this.add
      .text(0, 96, names[kind], {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "15px",
        color: "#eaffff",
        backgroundColor: "#0a1622cc",
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [glow, ring, core, label]).setDepth(60);
    container.setData("kind", kind);
    container.setData("index", index);
    this.tweens.add({
      targets: [glow, ring, core],
      alpha: 0.5,
      duration: 520,
      yoyo: true,
      repeat: -1
    });
    return container;
  }

  clearCampaignGates(): void {
    this.campaignGates.forEach((gate) => {
      // 门的脉冲 tween 是 repeat:-1,必须随门销毁一起清理,否则常驻运行
      this.tweens.killTweensOf(gate.list);
      gate.destroy();
    });
    this.campaignGates = [];
    this.campaignGateUntil = 0;
  }

  checkCampaignGateCollision(): void {
    const targets: Array<{ x: number; y: number }> = [{ x: this.player.x, y: this.player.y }];
    if (this.player2?.active) targets.push({ x: this.player2.x, y: this.player2.y });
    for (let i = 0; i < this.campaignGates.length; i += 1) {
      const gate = this.campaignGates[i];
      for (const target of targets) {
        if (Math.hypot(gate.x - target.x, gate.y - target.y) < 72) {
          const kind = gate.getData("kind") as "red" | "blue" | "green";
          this.tweens.killTweensOf(gate.list);
          gate.destroy();
          this.campaignGates.splice(i, 1);
          this.campaignGateUntil = 0;
          this.enterCampaignGate(kind, gate.x, gate.y);
          return;
        }
      }
    }
  }

  enterCampaignGate(kind: "red" | "blue" | "green", x: number, y: number): void {
    this.burst(x, y, 0xffffff, 1.7);
    this.cameras.main.flash(120, 200, 255, 255);
    const finishGate = (): void => this.completeCampaignGate();
    if (kind === "red") {
      // 红门:敌人强化,必得攻击奖励
      this.showBanner("赤红航线 · 强敌迫近 · 战术升级锁定", 1300);
      this.spawnEnemy(this.time.now, "elite_gunship");
      this.time.delayedCall(450, () => {
        if (!this.ended) this.spawnEnemy(this.time.now, "elite_bomber");
      });
      this.time.delayedCall(900, () => this.openUpgradePanel(finishGate));
    } else if (kind === "blue") {
      // 蓝门:异常事件,高随机高收益(小概率风险)
      const roll = Phaser.Math.Between(0, 5);
      if (roll <= 1) {
        // 经验爆发
        this.spawnExperiencePickup(x, y - 70, 40);
        this.spawnExperiencePickup(x + 56, y - 24, 40);
        this.spawnExperiencePickup(x - 56, y - 24, 40);
        this.showBanner("深蓝航线 · 经验爆发", 1300);
        this.time.delayedCall(900, finishGate);
      } else if (roll === 2) {
        // 模块注入:随机构筑
        this.showBanner("深蓝航线 · 模块注入", 1300);
        this.time.delayedCall(700, () => this.openUpgradePanel(finishGate));
      } else if (roll === 3) {
        // 星渊遗物:代币
        const granted = this.grantRunTokens(60);
        this.showBanner(`深蓝航线 · 星渊遗物 ◆ +${granted}`, 1300);
        this.time.delayedCall(900, finishGate);
      } else if (roll === 4) {
        // 修复爆发
        this.healPlayer(this.stats.maxHp * 0.25, "深蓝航线 · 治愈回响");
        this.showBanner("深蓝航线 · 治愈回响 +25%", 1300);
        this.time.delayedCall(900, finishGate);
      } else {
        // 危险回响:损失生命换后续构筑
        this.stats.hp = roundHealth(this.stats.hp - this.stats.maxHp * 0.08, this.stats.maxHp);
        this.floatText(x, y, "危险回响 · 损失 8% 生命", true);
        this.cameras.main.flash(160, 255, 40, 60);
        this.showBanner("深蓝航线 · 危险回响 · 受损后强制构筑", 1400);
        this.time.delayedCall(800, () => this.openUpgradePanel(finishGate));
      }
    } else {
      // 绿门:修复、护盾、经验、稳定强化
      this.healPlayer(this.stats.maxHp * 0.3, "翠绿航线 · 修复");
      this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 2500);
      this.spawnExperiencePickup(x, y - 70, 25);
      this.showBanner("翠绿航线 · 修复 30% + 护盾 2.5s + 经验", 1400);
      this.time.delayedCall(800, () => this.openUpgradePanel(finishGate));
    }
  }

  // 门流程结束(选门奖励/门超时):
  // 半程航线门 → 关闭后继续刷兵推进;整程已达标 → 完成清兵整备并召唤 Boss
  completeCampaignGate(): void {
    if (this.ended || this.bossActive || !this.campaignInterludeActive) return;
    this.clearCampaignGates();
    this.campaignGatesOpen = false;
    if (this.levelCompleteTriggered) {
      this.completeCampaignInterlude();
    } else {
      // 半程门奖励已领取:恢复刷兵,继续推进到完整阈值
      this.nextSpawn = 0;
      this.showBanner("◆ 航线已定 · 继续推进直至首领降临", 900);
    }
  }

  completeCampaignInterlude(): void {
    if (!this.campaignInterludeActive || this.ended) return;
    const nextEncounterIndex = this.campaignInterludeNextEncounter;
    const completedWave = this.campaignInterludeWave;
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
    this.score += 3500 + completedWave * 1200;
    this.healPlayer(this.stats.maxHp * 0.18, "清兵整备完成");
    this.cameras.main.flash(90, 4, 9, 18);
    this.time.delayedCall(700, () => {
      this.startCampaignEncounter(nextEncounterIndex);
    });
  }

  triggerShadowRupture(): void {
    if (
      !this.bossActive ||
      !isNineBattleMode() ||
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
    this.grantRunTokens(reward);
    this.bossTier += 1;
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    const ruptureX = core?.x ?? WORLD_WIDTH / 2;
    const ruptureY = core?.y ?? 220;
    // === 完全体黑影自爆 — 双爆 (核心 + 偏移) ===
    this.bigExplosion(ruptureX, ruptureY, 0x8c25ff, 1.6);
    this.time.delayedCall(140, () =>
      this.bigExplosion(ruptureX + 60, ruptureY - 40, 0x6c1a8f, 1.2)
    );
    this.time.delayedCall(280, () =>
      this.bigExplosion(ruptureX - 60, ruptureY + 30, 0x4a0070, 1.0)
    );
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
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Image;
      if (enemy.active) {
        this.burst(enemy.x, enemy.y, 0x6d0b8f, 1.25);
        enemy.disableBody(true, true);
      }
      return true;
    });
    this.clearBossEntities();
    this.darkAircraftMaxHpBeforeLock = this.stats.maxHp;
    this.stats.maxHp = Math.min(this.stats.maxHp, 3000);
    this.stats.hp = roundHealth(this.stats.hp, this.stats.maxHp);
    this.darkHealingScale = 0.5;
    this.darkHealLockUntil = 0;
    this.darkDotRemaining = 0;
    this.darkDotPerSecond = 0;
    this.darkDotUntil = 0;
    this.campaignEncounterIndex = 8;
    this.showBanner(`黑暗爆炸 · 生命上限封锁至 3000 · 回血效率 -50%`, 2200);
    this.time.delayedCall(1500, () => {
      this.startCampaignEncounter(8);
    });
  }

  finishFinalCampaignVictory(): void {
    const completionBonus = finalCampaignReward(
      save.permanentUpgrades,
      save.unlockedSkins
    );
    this.grantRunTokens(completionBonus);
    this.bossTier = Math.max(this.bossTier, 9);
    this.showBanner(`终局核心回收 · 永久强化预算`, 2200);
    this.time.delayedCall(1100, () => this.endRun(true));
  }

  // 最终 boss 击破后：残党大波涌入(8 波 × 12 只 = 96 只精英/突变小兵)
  startFinalMinionSwarm(): void {
    this.finalSwarmActive = true;
    this.finalSwarmRemaining = 96;
    this.finalSwarmWaveIndex = 0;
    this.finalSwarmNextWaveAt = this.time.now + 600;
    this.nextSpawn = 0;
    // === 终局魔神陨落 — 4 段大爆,中央+四向偏移 ===
    const cx = WORLD_WIDTH / 2;
    const cy = 300;
    this.bigExplosion(cx, cy, 0x8c25ff, 2.0);
    this.time.delayedCall(120, () => this.bigExplosion(cx + 130, cy - 60, 0xff2d8f, 1.4));
    this.time.delayedCall(240, () => this.bigExplosion(cx - 130, cy + 60, 0x4a0070, 1.4));
    this.time.delayedCall(360, () => this.bigExplosion(cx, cy - 110, 0x9b5cff, 1.2));
    this.showBanner("◆ 黑暗残党涌入 · 击破全部 96 只后航线净空", 1800);
    this.cameras.main.flash(140, 80, 0, 110);
    if (save.settings.screenShake) this.cameras.main.shake(420, 0.012);
  }

  // 每帧检查是否该出下一波 + 当剩余为 0 时通关
  updateFinalSwarm(time: number): void {
    if (!this.finalSwarmActive) return;
    if (time < this.finalSwarmNextWaveAt) return;
    if (this.finalSwarmRemaining <= 0) {
      // 待生成数为 0 还不够,场上残党也必须全部清掉才算清空
      const aliveSwarm = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).some(
        (e) => e.active && e.getData("finalSwarm") === true
      );
      if (aliveSwarm) {
        this.finalSwarmNextWaveAt = time + 500;
        return;
      }
      this.finalSwarmActive = false;
      this.unlockAchievement("after_storm");
      // 摧毁核心:在侵蚀满之前清空残党 → 活着,但主动接下了这份黑暗
      if (this.darkCoreChoice === "destroyed") {
        this.triggerShadowEnding("destroyed_embraced");
        return;
      }
      // 保留核心并清空残党:核心已自我修复,反过来占据玩家
      if (this.darkCoreChoice === "kept") {
        this.triggerShadowEnding("kept_possessed");
        return;
      }
      this.showBanner("◆ 残党清空 · 终局航线净空", 1500);
      this.cameras.main.flash(220, 200, 240, 255);
      if (save.settings.screenShake) this.cameras.main.shake(560, 0.014);
      this.time.delayedCall(1500, () => this.finishFinalCampaignVictory());
      return;
    }
    this.finalSwarmWaveIndex += 1;
    const perWave = 12;
    const spawnCount = Math.min(perWave, this.finalSwarmRemaining);
    // 上一波生成小兵
    const eliteSet = Math.random() < 0.5;
    let spawnedCount = 0;
    for (let i = 0; i < spawnCount; i += 1) {
      const typePool = ["gunship", "bomber", "suppressor", "striker", "courier"];
      const type = Phaser.Utils.Array.GetRandom(typePool);
      const finalType = eliteSet ? (`elite_${type}` as const) : type;
      const enemy = this.spawnEnemy(time, finalType);
      if (!enemy.active) continue;
      spawnedCount += 1;
      const spreadX = ((i + 0.5) / spawnCount) * WORLD_WIDTH;
      enemy.setPosition(
        Phaser.Math.Clamp(spreadX + Phaser.Math.Between(-40, 40), 50, WORLD_WIDTH - 50),
        -60
      );
      enemy.setData("finalSwarm", true);
      // 2 段 HP 提升,让冲杀有挑战
      let hpScale = 1.4 + this.finalSwarmWaveIndex * 0.12;
      // 残党小兵生命与攻击力都 ×2(无论是否摧毁核心)
      hpScale *= 2;
      enemy.setData("damage", (enemy.getData("damage") ?? 10) * 2);
      // 摧毁核心:黑暗能量灌入残党,血量与伤害再次提升
      if (this.darkCoreChoice === "destroyed") {
        hpScale *= DARK_SWARM_HP_SCALE;
        enemy.setData(
          "damage",
          (enemy.getData("damage") ?? 10) * DARK_SWARM_DAMAGE_SCALE
        );
        enemy.setTint(0x8c25ff);
      }
      const currentHp = enemy.getData("hp") ?? 1;
      enemy.setData("hp", currentHp * hpScale);
      enemy.setData("maxHp", (enemy.getData("maxHp") ?? 1) * hpScale);
    }
    // 只扣实际生成成功的数量,否则敌人池饱和时会虚减,导致不足 96 只就判定清空
    this.finalSwarmRemaining -= spawnedCount;
    // 整波都没生成出来(池被占满)时缩短重试间隔,避免卡在同一波
    this.finalSwarmNextWaveAt = time + (spawnedCount === 0 ? 800 : 2400);
    if (spawnedCount === 0) {
      // 波次号回退,否则重试会让血量倍率虚涨
      this.finalSwarmWaveIndex -= 1;
      return;
    }
    this.showBanner(
      `残党第 ${this.finalSwarmWaveIndex} 波 · 剩余 ${this.finalSwarmRemaining} 只`,
      550
    );
  }

  // 摧毁核心后:黑暗能量持续侵蚀玩家(掉血 + 侵蚀值累积)
  updateDarkCorruption(time: number): void {
    if (this.darkCoreChoice !== "destroyed" || this.ended) return;
    if (!this.finalSwarmActive) return;
    if (time < this.nextCorruptionTick) return;
    this.nextCorruptionTick = time + DARK_CORRUPTION_TICK_MS;
    this.darkCorruption = Math.min(100, this.darkCorruption + DARK_CORRUPTION_PER_TICK);
    // 侵蚀掉血不触发无敌判定,直接扣
    this.stats.hp = roundHealth(
      this.stats.hp - this.stats.maxHp * DARK_CORRUPTION_HP_DRAIN,
      this.stats.maxHp
    );
    this.player.setTint(0x8c25ff);
    this.renderDarkEnergyEffect(this.player.x, this.player.y, 1.35);
    this.time.delayedCall(180, () => this.player.active && this.player.clearTint());
    if (this.darkCorruption % 20 === 0) {
      const alive = (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
        (e) => e.active
      ).length;
      this.showBanner(
        `◆ 黑暗侵蚀 ${this.darkCorruption}% · 场上 ${alive} · 待出 ${this.finalSwarmRemaining}`,
        900
      );
      this.cameras.main.flash(120, 90, 0, 130);
    }
    // 侵蚀满 100% → 被黑暗吞没;或先被侵蚀扣到没血
    if (this.darkCorruption >= 100 || this.stats.hp <= 0) {
      this.finalSwarmActive = false;
      // 双人模式:侵蚀杀死 P1 之前给 P2 一次接管机会,失败才走吞没演出
      if (
        playVariant !== "single" &&
        !this.coopHandoverDone &&
        this.player2?.active &&
        this.player2Hp > 0 &&
        this.stats.hp <= 0 &&
        this.darkCorruption < 100
      ) {
        this.triggerP1HandOver();
        // 接管后幸存者 P2 以 85% 血继续(原行写 stats 是 bug,幸存者是 player2)
        this.player2Hp = Math.round(this.player2MaxHp * 0.85);
        this.darkCorruption = Math.max(0, this.darkCorruption - 40);
        return;
      }
      // 双人模式:接管已发生,幸存者 P2 仍存活且侵蚀未满 → 继续承受侵蚀,满 100% 才吞没
      if (
        playVariant !== "single" &&
        this.coopHandoverDone &&
        this.player2Hp > 0 &&
        this.darkCorruption < 100
      ) {
        return;
      }
      this.triggerShadowEnding("destroyed_consumed");
    }
  }

  // 触发黑影结局:五条路都算失败结算；Boss 专属模式额外记为九战通关
  triggerShadowEnding(ending: ShadowEnding): void {
    if (this.ended || this.shadowEnding) return;
    this.shadowEnding = ending;
    this.finalSwarmActive = false;
    this.unlockAchievement(SHADOW_ENDING_ACHIEVEMENTS[ending]);
    if (selectedMode === "boss") this.unlockAchievement("boss_campaign_legend");
    const info = SHADOW_ENDINGS[ending];
    // === 黑影结局专属演出界面:全屏黑影主题 CG ===
    this.isModal = true;
    this.physics.world.pause();
    setAdaptiveMusic(0);
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
    const backdrop = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x0a0016, 0.97)
      .setDepth(118);
    const topBar = this.add.rectangle(WORLD_WIDTH / 2, 46, WORLD_WIDTH, 92, 0x000000, 0.94).setDepth(120);
    const bottomBar = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 46, WORLD_WIDTH, 92, 0x000000, 0.94)
      .setDepth(120);
    const auraRing = this.add
      .circle(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.32, 250, 0x14002a, 0)
      .setStrokeStyle(16, 0x8c25ff, 0.55)
      .setDepth(119);
    // 黑影本体图:从玩家所在位置幻化而生,升到中央
    const shadowFig = this.add
      .image(this.player.x, this.player.y, shadowTextureForAbsorbedPowers(3))
      .setDisplaySize(320, 480)
      .setTint(0x9b5cff)
      .setAlpha(0)
      .setDepth(119);
    this.tweens.add({
      targets: shadowFig,
      alpha: 0.95,
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT * 0.32,
      scale: 1.12,
      duration: 1500,
      ease: "Cubic.Out"
    });
    const codeText = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.6, info.code, {
        fontFamily: "Consolas, monospace",
        fontSize: "20px",
        color: "#c678ff",
        stroke: "#2a0a44",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(122)
      .setAlpha(0);
    const titleText = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.67, info.title, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "44px",
        fontStyle: "bold",
        color: "#e6d4ff",
        stroke: "#3a0a5e",
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(122)
      .setAlpha(0);
    const detailText = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.67 + 78, info.detail, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "16px",
        color: "#b3a3cc",
        stroke: "#1c0430",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: WORLD_WIDTH * 0.62 }
      })
      .setOrigin(0.5)
      .setDepth(122)
      .setAlpha(0);
    this.tweens.add({ targets: codeText, alpha: 1, duration: 500, delay: 900 });
    this.tweens.add({ targets: titleText, alpha: 1, duration: 600, delay: 1150 });
    this.tweens.add({ targets: detailText, alpha: 1, duration: 600, delay: 1450 });
    // 玩家战机被黑暗吞没
    this.player.setTint(0x2a0040);
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      scale: this.player.scale * 1.3,
      duration: 1300,
      ease: "Cubic.In",
      onComplete: () => this.player.setVisible(false)
    });
    for (let i = 0; i < 12; i += 1) {
      this.time.delayedCall(i * 120, () =>
        this.burst(
          Phaser.Math.Between(0, WORLD_WIDTH),
          Phaser.Math.Between(0, WORLD_HEIGHT),
          i % 2 ? 0x8c25ff : 0x2a0040,
          Phaser.Math.FloatBetween(1.2, 2.2)
        )
      );
    }
    this.cameras.main.flash(500, 30, 0, 60);
    if (save.settings.screenShake) this.cameras.main.shake(700, 0.018);
    this.time.delayedCall(2900, () => {
      this.tweens.add({
        targets: [backdrop, topBar, bottomBar, auraRing, shadowFig, codeText, titleText, detailText],
        alpha: 0,
        duration: 450,
        onComplete: () => {
          [backdrop, topBar, bottomBar, auraRing, shadowFig, codeText, titleText, detailText].forEach(
            (item) => item.destroy()
          );
          this.isModal = false;
          this.endRun(false);
        }
      });
    });
  }

  startCampaignEncounter(index: number, skipStory = false): void {
    if (this.ended) return;
    this.campaignEncounterIndex = Phaser.Math.Clamp(index, 0, BOSS_CAMPAIGN_ENCOUNTERS.length - 1);
    const encounter = BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex];
    this.clearBossEntities();
    this.campaignInterludeActive = false;
    if (selectedMode === "campaign") {
      this.nextSpawn = this.time.now + 999999;
    }
    this.bossKind = encounter.bossKind;
    this.bossElite = rollCampaignElite(selectedLevel);
    // Boss 突变只从 Boss 池抽取,不会混入任何小兵突变能力
    this.bossMutated = rollCampaignMutation(selectedLevel);
    this.bossMutationKind = this.bossMutated
      ? rollBossMutationKind(this.bossKind)
      : null;
    this.showBanner(
      selectedMode === "campaign"
        ? `⚠ 未知威胁现身 · ${encounter.title}`
        : `终局战役 ${this.campaignEncounterIndex + 1}/9 · ${encounter.title}`,
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
    this.clearWaveForBossArrival();
    const campaignEncounter =
      isNineBattleMode()
        ? BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]
        : null;
    const incomingKind = campaignEncounter
      ? campaignEncounter.bossKind
      : selectedMode === "campaign" && this.bossTier >= 2
        ? "dark_deity"
        : (["titan", "mirror", "usurper"] as BossKind[])[this.bossTier % 3];
    const incomingElite =
      campaignEncounter?.kind === "trinity"
        ? false
        : campaignEncounter
          ? this.bossElite
          : this.bossTier >= 3;
    const incomingTitle = campaignEncounter?.title ?? BOSS_NAMES[incomingKind];
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
        `⚠ ${incomingElite ? "ELITE " : ""}${incomingTitle} // ${
          campaignEncounter
            ? selectedMode === "campaign"
              ? "SIGNAL IDENTIFIED"
              : `ENCOUNTER ${this.campaignEncounterIndex + 1}/9`
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
        campaignEncounter?.kind === "trinity"
          ? "扩展战区已开启 · 三个不完全体将在同一水平线同步降临"
          : campaignEncounter?.kind === "chase"
            ? `黑影携带已盗取的 ${this.campaignBossesDefeated} 股首领力量向上逃逸`
          : incomingKind === "dark_deity"
            ? "三枚首领印记已全部点亮 · 黑暗魔神真身降临"
          : incomingKind === "shadow"
            ? "它已吸收三首领核心 · 这一次不能再让它逃走"
          : incomingKind === "mirror"
          ? `${incomingElite ? "精英超频：" : "镜像协议："}它读取了你的机体与开火习惯`
          : incomingKind === "usurper"
            ? `${incomingElite ? "精英篡夺：" : "篡夺协议："}战术技能即将被敌方接管`
            : isNineBattleMode()
              ? `${incomingElite ? "精英炼狱：" : "炼狱协议："}从基础形态迎战`
              : incomingElite
                ? "精英裂隙开启 · 全武装泰坦跃迁"
                : "未知信号撕开航道 · 裂渊泰坦跃迁",
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
      if (campaignEncounter?.kind === "trinity") this.spawnTrinityBosses();
      else this.spawnBoss(incomingKind);
    });
  }

  spawnBoss(kindOverride?: BossKind): void {
    if (this.bossActive || this.ended) return;
    this.clearWaveForBossArrival();
    this.bossKind =
      kindOverride ??
      (["titan", "mirror", "usurper"] as BossKind[])[this.bossTier % 3];
    if (!isNineBattleMode()) {
      this.bossElite = this.bossTier >= 3;
      this.bossMutated = false;
      this.bossMutationKind = null;
    }
    this.bossAttackIndex = -1;
    this.bossKilledByCollision = false;
    this.skillsConfiscated = false;
    this.skillsConfiscatedUntil = 0;
    this.bossActive = true;
    this.bossPhase = 1;
    // Boss 技能种类无上限:不限制技能池(普通战役同样全部技能可用,突变会额外附加能力)。
    // 场上同时存在的技能效果不超过 4 个,由 startBossAttackType 的并发上限保证。
    this.bossActiveSkillTypes = [];
    const threatScale = 1 + Math.max(0, selectedLevel - 3) * 0.18;
    const endlessScale = 1 + this.bossTier * 0.52;
    const modeScale = isNineBattleMode() ? 1.45 : 1;
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
      isNineBattleMode()
        ? campaignDifficultyForLevel(selectedLevel).id === "nightmare"
          ? 1.5
          : campaignDifficultyForLevel(selectedLevel).id === "hard"
            ? 1.22
            : 1
        : 1;
    const openingEncounterScale =
      isNineBattleMode() && this.campaignEncounterIndex <= 5
        ? campaignEncounterPowerScale(this.campaignEncounterIndex)
        : kindScale;
    const campaignProgressionScale =
      isNineBattleMode() && this.campaignEncounterIndex <= 5
        ? 1
        : 1 + this.campaignBossesDefeated * 0.16;
    this.bossMaxHpBeforeFinalBalance =
      (isNineBattleMode() ? 10500 : 7600 + selectedLevel * 950) *
      threatScale *
      (isNineBattleMode() ? campaignProgressionScale : endlessScale) *
      modeScale *
      openingEncounterScale *
      1.22 *
      (this.bossElite ? 1.7 : 1) *
      (this.bossMutated ? 1.25 : 1) *
      campaignScale *
      enemyUpgradeScale();
    this.bossMaxHp =
      this.bossMaxHpBeforeFinalBalance *
      (isNineBattleMode()
        ? campaignFinalBossStatScale(this.campaignEncounterIndex)
        : 1);
    this.bossHp = this.bossMaxHp;
    this.showBanner(
      this.skillsConfiscated
        ? `⚠ ${this.bossElite ? "精英 " : ""}${BOSS_NAMES[this.bossKind]} · 技能已被暂时篡夺`
        : `⚠ ${this.bossElite ? "精英 " : ""}${this.bossMutated ? "突变 " : ""}${
            BOSS_NAMES[this.bossKind]
          }${this.bossMutationKind ? ` · 继承 ${BOSS_NAMES[this.bossMutationKind]}` : ""} · ${
            selectedMode === "campaign"
              ? "信号已识别"
              : isNineBattleMode()
                ? `九渊 ${this.campaignEncounterIndex + 1}/9`
              : `战役阶 ${this.bossTier + 1}`
          }`,
      1900
    );
    sfx("boss");
    if (save.settings.screenShake) this.cameras.main.shake(420, 0.009);
    const coreTexture =
      this.bossKind === "mirror"
        ? SHIPS[save.selectedShip].asset
        : this.bossKind === "shadow"
          ? isNineBattleMode()
            ? this.campaignEncounterIndex === 7
              ? "bossShadowComplete"
              : shadowTextureForAbsorbedPowers(this.campaignBossesDefeated)
            : "bossShadow"
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
              ? { width: 720, height: 720 }
          : { width: 570, height: 570 };
    core
      .setTexture(this.textures.exists(coreTexture) ? coreTexture : "bossCore")
      .setDisplaySize(displaySize.width, displaySize.height)
      .setAlpha(1)
      .setAngle(0)
      .setTint(this.bossElite ? 0xffd29a : 0xffffff)
      .setData({
        part: "core",
        hp: this.bossMaxHp,
        maxHp: this.bossMaxHp,
        elite: this.bossElite,
        mutated: this.bossMutated,
        mutationKind: this.bossMutationKind,
        // 复用旧对象时必须显式可命中,否则黑暗飞机阶段的 hittable false 残留会让 Boss 打不着
        hittable: true
      })
      .setDepth(14);
    // 复用对象的 body 尺寸是旧纹理的,必须同步到显示尺寸,否则子弹会"穿模"没伤害
    core.body?.setSize(displaySize.width, displaySize.height);
    // 精英/突变体型放大,百分比与小兵一致:精英 ×1.12,突变 ×1.06(叠加)
    const bossSizeScale = (this.bossElite ? 1.12 : 1) * (this.bossMutated ? 1.06 : 1);
    if (bossSizeScale !== 1) {
      core.setDisplaySize(core.displayWidth * bossSizeScale, core.displayHeight * bossSizeScale);
      core.body?.setSize(core.displayWidth, core.displayHeight);
    }
    if (this.bossEliteAura) {
      // 光环上的 tween 是 repeat:-1 永久循环,Phaser 不会因目标销毁而自动停止,
      // 必须先 killTweensOf 再 destroy,否则逐场累积悬挂 tween。
      this.tweens.killTweensOf(this.bossEliteAura);
      this.bossEliteAura.destroy();
    }
    this.bossEliteAura = undefined;
    if (this.bossElite || this.bossMutated) {
      const auraColor = this.bossMutated ? 0xb541ff : 0xffbd3e;
      this.bossEliteAura = this.add
        .circle(core.x, core.y, Math.max(120, core.displayWidth * 0.54), auraColor, 0.035)
        .setStrokeStyle(this.bossMutated ? 13 : 10, auraColor, 0.76)
        .setDepth(13);
      this.tweens.add({
        targets: this.bossEliteAura,
        scale: { from: 0.9, to: 1.08 },
        alpha: { from: 0.35, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 620
      });
      if (this.bossMutated && this.bossMutationKind) {
        this.time.delayedCall(1450, () => {
          if (!core.active) return;
          this.floatText(
            core.x,
            core.y + displaySize.height * 0.42,
            `BOSS MUTATION // ${BOSS_NAMES[this.bossMutationKind!]}`,
            true
          );
        });
      }
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
    // 防御:若上一场战斗被中断,池里可能残留未被本次 get() 复用的活跃部件
    // (黑暗飞机/影分身/三神核心等),它们会带着旧贴图残留在背景上,必须显式禁用。
    // 注意:不只处理 active 部件——已 disableBody 的部件若 visible 残留
    // 同样会以"幽灵图"叠在场上,所以一律无条件禁用隐藏。
    this.bossParts.children.each((child) => {
      const part = child as Phaser.Physics.Arcade.Image;
      if (part !== core && part !== left && part !== right) {
        this.tweens.killTweensOf(part);
        part.disableBody(true, true);
      }
      return true;
    });
    const bossEntryY =
      this.bossKind === "dark_deity"
        ? 370
        : this.bossKind === "shadow" && this.campaignEncounterIndex === 7
          ? 390
          : 190;
    this.tweens.add({
      targets: this.bossEliteAura ? [core, this.bossEliteAura] : [core],
      y: bossEntryY,
      duration: 1400,
      ease: "Cubic.Out"
    });
    this.tweens.add({ targets: [left, right], y: 220, duration: 1400, ease: "Cubic.Out" });
    this.nextBossAttack = this.time.now + 2300;
    this.nextBossMinionSummon =
      this.bossKind === "shadow" || this.bossKind === "dark_deity"
        ? this.time.now + 3200
        : Number.POSITIVE_INFINITY;
    if (this.bossKind === "usurper") this.nextUsurperDisableAt = this.time.now + 2500;
    if (this.bossKind === "shadow") this.shadowRuptureTriggered = false;
    this.shadowChargingUntil = 0;
  }

  spawnTrinityBosses(): void {
    if (this.bossActive || this.ended) return;
    this.clearWaveForBossArrival();
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
    this.cameras.main.setZoom(0.75);
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
        tint: 0xffffff
      },
      { kind: "usurper", texture: "bossUsurper", x: WORLD_WIDTH - 155, width: 260, height: 260, tint: 0xffffff }
    ];
    const difficulty = campaignDifficultyForLevel(selectedLevel);
    const threatScale = 1 + Math.max(0, selectedLevel - 3) * 0.18;
    const campaignScale =
      difficulty.id === "nightmare" ? 1.5 : difficulty.id === "hard" ? 1.22 : 1;
    let totalHp = 0;
    let totalHpBeforeIncompleteBalance = 0;
    let anyElite = false;
    configs.forEach((config, index) => {
      const elite = rollCampaignElite(selectedLevel);
      const mutated = rollCampaignMutation(selectedLevel);
      anyElite ||= elite;
      const mutationKind = mutated ? rollBossMutationKind(config.kind) : null;
      const originalEncounterIndex =
        config.kind === "mirror" ? 2 : config.kind === "usurper" ? 4 : 0;
      const maxHpBeforeIncompleteBalance =
        10500 *
        threatScale *
        1.45 *
        campaignEncounterPowerScale(originalEncounterIndex) *
        1.22 *
        (elite ? 1.7 : 1) *
        (mutated ? 1.25 : 1) *
        campaignScale *
        enemyUpgradeScale();
      const maxHp =
        maxHpBeforeIncompleteBalance * INCOMPLETE_TRINITY_STAT_SCALE;
      totalHpBeforeIncompleteBalance += maxHpBeforeIncompleteBalance;
      totalHp += maxHp;
      const safeTexture = this.textures.exists(config.texture) ? config.texture : "bossCore";
      const core = this.bossParts.get(config.x, -180, safeTexture) as Phaser.Physics.Arcade.Image;
      this.tweens.killTweensOf(core);
      core.enableBody(true, config.x, -180, true, true);
      const initialOffset = config.kind === "titan" ? 800 : config.kind === "mirror" ? 1500 : 2200;
      core.setData("nextAttackAt", this.time.now + initialOffset);
      core
        .setTexture(safeTexture)
        .setActive(true)
        .setVisible(true)
        .setDisplaySize(config.width, config.height)
        .setAlpha(1)
        .setScale(1)
        .setAngle(0)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .clearTint()
        .setTint(elite ? 0xffd29a : config.tint)
        .setDepth(14)
        .setData({
          part: "raid-core",
          raidKind: config.kind,
          hp: maxHp,
          maxHp,
          individualMaxHp: maxHp,
          raidTexture: safeTexture,
          raidWidth: config.width,
          raidHeight: config.height,
          homeX: config.x,
          homeY: 190,
          hittable: true,
          defeated: false,
          elite,
          mutated,
          mutationKind,
          raidAura: undefined,
          nextSpecialAt: this.time.now + (config.kind === "usurper" ? 2500 : 0)
        });
      // 复用对象的 body 尺寸是旧纹理的,必须同步到显示尺寸,否则子弹会"穿模"没伤害
      core.body?.setSize(config.width, config.height);
      // 精英/突变体型放大,百分比与小兵一致:精英 ×1.12,突变 ×1.06(叠加)
      const raidSizeScale = (elite ? 1.12 : 1) * (mutated ? 1.06 : 1);
      if (raidSizeScale !== 1) {
        core.setDisplaySize(core.displayWidth * raidSizeScale, core.displayHeight * raidSizeScale);
        core.body?.setSize(core.displayWidth, core.displayHeight);
        core.setData("raidWidth", core.displayWidth).setData("raidHeight", core.displayHeight);
      }
      this.tweens.add({
        targets: core,
        y: 190,
        duration: 1350 + index * 100,
        ease: "Cubic.Out"
      });
      if (elite || mutated) {
        const aura = this.add
          .circle(config.x, 200, Math.max(core.displayWidth, core.displayHeight) * 0.54, mutated ? 0x9b5cff : 0xffbd3e, 0.025)
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
        if (mutated && mutationKind) {
          this.floatText(
            config.x,
            290,
            `BOSS MUTATION // ${BOSS_NAMES[mutationKind]}`,
            true
          );
        }
      }
    });
    this.bossElite = anyElite;
    this.bossMaxHpBeforeFinalBalance = totalHpBeforeIncompleteBalance;
    this.bossMaxHp = totalHp;
    this.bossHp = totalHp;
    // 三只 Boss 各自拥有共享总血量的 1/3；顶部共享条仅显示三条独立血量之和。
    const individualHp = totalHp / 3;
    (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter((part) => part.active && part.getData("part") === "raid-core")
      .forEach((part) =>
        part
          .setData("hp", individualHp)
          .setData("maxHp", individualHp)
          .setData("individualMaxHp", individualHp)
          .setData("defeated", false)
      );
    this.nextTrinityAttack = this.time.now + 2300;
    this.nextUsurperDisableAt = this.time.now + 2800;
    this.showBanner("三神共斗 · 三条独立生命各占总量 33.33% · 击破谁就炸毁谁", 1800);
    if (save.settings.screenShake) this.cameras.main.shake(650, 0.012);
  }

  hitBossPart(bullet: Phaser.Physics.Arcade.Image, part: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active || !part.active) return;
    if (part.getData("hittable") === false) {
      bullet.disableBody(true, true);
      return;
    }
    const weapon = String(bullet.getData("weapon") ?? "");
    if (weapon.includes("missile")) {
      // Boss 命中同样不渲染地面焦痕椭圆,与 hitEnemy 口径一致(避免误报的椭圆残留)
      this.renderMissileExplosion(bullet.x, bullet.y, false);
    }
    if (weapon === "titan-authority") {
      this.renderBossPowerPulse("titan_meteor", bullet.x, bullet.y, 160, 460);
    }
    const bossHitOwner = (bullet.getData("owner") as 1 | 2) ?? 1;
    if (bossHitOwner === 1) this.spawnSiphonChain(part);
    else if (this.specOf(2) === "vampire") this.spawnSiphonChain(part, 2);
    this.damageBossPart(part, bullet.getData("damage") ?? 10);
    if ((bullet.getData("owner") ?? 1) === 1) this.applyHitTrait();
    const remainingPierce = bullet.getData("pierce") ?? 0;
    if (remainingPierce > 0) bullet.setData("pierce", remainingPierce - 1);
    else bullet.disableBody(true, true);
  }

  damageBossPart(part: Phaser.Physics.Arcade.Image, rawDamage: number): void {
    if (!this.bossActive || !part.active) return;
    if (part.getData("hittable") === false) return;
    // === 难度 Boss 免伤:困难 Boss 受伤 ×0.95(5% 免伤),噩梦 ×0.85(15% 免伤) ===
    const difficulty = campaignDifficultyForLevel(selectedLevel);
    if (difficulty.id === "hard") rawDamage *= 0.95;
    else if (difficulty.id === "nightmare") rawDamage *= 0.85;
    // === Boss 版荆棘反伤(防御流派反击被篡夺):玩家攻击 Boss 时按比例反弹(削弱版) ===
    if (this.time.now < this.bossThornCounterUntil) {
      this.damagePlayerDark(0, 0.015, "敌方荆棘反伤");
    }
    // === 权柄污染:对 Boss 伤害 +10%(usurper 护符) ===
    if (this.usurperBlight) rawDamage *= 1.1;
    const partName = part.getData("part");
    if (partName === "raid-core") {
      const collisionFinisher = part.getData("collisionFinisher") === true;
      part.setData("collisionFinisher", false);
      const previousHp = Number(part.getData("hp") ?? 0);
      const currentHp = independentBossHealthAfterDamage(previousHp, rawDamage);
      part.setData("hp", currentHp);
      const allCores = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
        (core) => core.getData("part") === "raid-core"
      );
      this.bossHp = allCores.reduce(
        (sum, core) => sum + Math.max(0, Number(core.getData("hp") ?? 0)),
        0
      );
      part.setTintFill(0xffc9ec);
      this.time.delayedCall(45, () => part.active && part.clearTint());
      if (previousHp > 0 && currentHp <= 0) {
        if (collisionFinisher) this.grantCollisionBossKillGrowth(true);
        const defeatedKind = part.getData("raidKind") as BossKind;
        if (!this.trinityDefeatedKinds.includes(defeatedKind)) {
          this.trinityDefeatedKinds.push(defeatedKind);
        }
        this.trinityAlive = Math.max(0, this.trinityAlive - 1);
        part.setData("defeated", true);
        const aura = part.getData("raidAura") as Phaser.GameObjects.Arc | undefined;
        if (aura) {
          this.tweens.killTweensOf(aura);
          aura.destroy();
        }
        part.setData("raidAura", undefined);
        this.bigExplosion(part.x, part.y, 0xff3dbb, 1.7);
        this.showBanner(`${BOSS_NAMES[defeatedKind]}独立核心归零 · 剩余 ${this.trinityAlive}`, 1050);
        part.disableBody(true, true);
        if (this.trinityAlive <= 0 || this.bossHp <= 0) this.defeatTrinityRaid();
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
      const encounter =
        isNineBattleMode()
          ? BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]
          : null;
      const remainingRatio = this.bossHp / Math.max(1, this.bossMaxHp);
      const chaseThreshold = encounter?.kind === "chase"
        ? chaseRemainingHpRatio(this.campaignEncounterIndex)
        : null;
      if (
        encounter?.kind === "chase" &&
        chaseThreshold !== null &&
        remainingRatio <= chaseThreshold + 0.000001
      ) {
        this.completeShadowChase();
        return;
      }
      if (
        encounter?.kind === "shadow_final" &&
        remainingRatio <= 0.125 + 0.000001
      ) {
        this.triggerShadowRupture();
        return;
      }
      if (this.bossHp <= 0) {
        if (collisionFinisher) this.grantCollisionBossKillGrowth();
        this.defeatBoss();
      }
    } else if (partName === "dark-aircraft" || partName === "dark-aircraft-clone") {
      // 隐身状态不可打
      if (part.getData("hittable") === false) return;
      const damageMul = partName === "dark-aircraft-clone" ? 3 : 1;
      const totalDmg = rawDamage * damageMul;
      const hp = (part.getData("hp") ?? 0) - totalDmg;
      part.setData("hp", hp);
      if (partName === "dark-aircraft") this.darkAircraftHp = Math.max(0, hp);
      part.setTintFill(0xff3da6);
      this.time.delayedCall(40, () => part.active && part.clearTint());
      this.darkAircraftDamageWindow.push(this.time.now);
      if (partName === "dark-aircraft-clone") {
        this.burst(part.x, part.y, 0x7a18cf, 0.6);
      } else {
        this.burst(part.x, part.y, 0xff3da6, 0.5);
      }
      if (hp <= 0) {
        part.disableBody(true, true);
        if (partName === "dark-aircraft") {
          this.darkAircraftHp = 0;
          this.score += 4800;
          // === 突破黑暗限制：完全恢复被侵蚀前状态 ===
          this.breakDarkLimitations();
          this.showBanner("◆ 黑暗僚机被击毁 · 突破黑暗限制 · 魔神解除隐退", 1700);
          this.bigExplosion(part.x, part.y, 0xff2d8f, 1.4);
          if (save.settings.screenShake) this.cameras.main.shake(420, 0.014);
        } else {
          this.bigExplosion(part.x, part.y, 0x7a18cf, 0.7);
        }
      }
    } else {
      const hp = (part.getData("hp") ?? 0) - rawDamage;
      part.setData("hp", hp);
      part.setTintFill(0xffffff);
      this.time.delayedCall(45, () => part.active && part.clearTint());
      if (hp <= 0) {
        part.disableBody(true, true);
        this.bossHp = Math.max(0, this.bossHp - this.bossMaxHp * 0.08);
        this.ultimate = Math.min(100, this.ultimate + 20);
        this.score += 1800;
        this.showBanner(`${partName === "left" ? "左侧" : "右侧"}炮台已摧毁`, 1000);
        this.burst(part.x, part.y, 0xff3dbb, 2);
      }
    }
  }

  // 击败黑暗飞机后：完全突破黑暗能量对玩家的封锁
  breakDarkLimitations(): void {
    // 1. 解除回血锁定
    this.darkHealLockUntil = 0;
    // 2. 解除 -50% 回血效率
    this.darkHealingScale = 1;
    // 3. 解除 3000 血量上限 → 还原 lock 前的真实上限 + 突破奖励
    const beforeMax = this.stats.maxHp;
    const restored = Math.max(this.darkAircraftMaxHpBeforeLock, 3000);
    this.stats.maxHp = restored + 250;
    // 4. 立即满血
    this.stats.hp = roundHealth(this.stats.maxHp, this.stats.maxHp);
    this.darkDotRemaining = 0;
    this.darkDotPerSecond = 0;
    this.darkDotUntil = 0;
    this.skillsConfiscated = false;
    this.skillsConfiscatedUntil = 0;
    this.enemyFreezeUntil = 0;
    this.enemySlowUntil = 0;
    this.recordAgileMaxHpGain(this.stats.maxHp - beforeMax);
    this.burst(this.player.x, this.player.y, 0x43ff9a, 3.4);
    this.burst(this.player.x, this.player.y, 0xffd54a, 2.6);
    if (save.settings.screenShake) this.cameras.main.shake(360, 0.014);
  }

  // 最终 boss 10% 血量触发「支离破碎」: 释放法阵, 玩家血量锁回初始, 攻击 -60%, 回血效率 -50%
  triggerBossShattered(core: Phaser.Physics.Arcade.Image): void {
    if (this.bossShattered) return;
    this.bossShattered = true;
    // 1. 记录玩家当前真实值
    this.shatteredPlayerMaxHpOriginal = this.stats.maxHp;
    this.shatteredPlayerDamageOriginal = this.stats.damageMultiplier;
    // 2. 玩家血量锁回初始(开局 ship.hp * specialization.hp * hpBoost)
    this.stats.maxHp = Math.max(this.originalPlayerMaxHp, 200);
    if (this.stats.hp > this.stats.maxHp) {
      this.stats.hp = roundHealth(this.stats.maxHp, this.stats.maxHp);
    }
    // 3. 攻击能力降低到 40%(原 ×0.4)
    this.stats.damageMultiplier = this.shatteredPlayerDamageOriginal * 0.4;
    // 4. 回血效率回到 -50%(等效 darkHealingScale=0.5)
    this.darkHealingScale = 0.5;
    // 5. 回血锁定短暂开启(4 秒不能回血 → 表现「封锁回血」)
    this.darkHealLockUntil = this.time.now + 4000;
    // 6. 视觉：超大紫黑色法阵
    const array = this.add.circle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      80,
      0x1a0033,
      0.0
    ).setStrokeStyle(20, 0x8c25ff, 0.95).setDepth(28);
    this.tweens.add({
      targets: array,
      scale: { from: 0.3, to: 9 },
      alpha: { from: 0.0, to: 0.55 },
      duration: 1100,
      ease: "Cubic.Out",
      onComplete: () => {
        this.tweens.add({
          targets: array,
          rotation: Math.PI * 2,
          alpha: { from: 0.55, to: 0.18 },
          duration: 2000,
          yoyo: true,
          repeat: 1,
          onComplete: () => array.destroy()
        });
      }
    });
    // 7. 黑暗法阵柱状光线
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      this.time.delayedCall(150 + i * 80, () => {
        const beam = this.add
          .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 80, WORLD_HEIGHT * 1.2, 0x6c1a8f, 0.0)
          .setStrokeStyle(3, 0xff2d8f, 0.8)
          .setAngle(Phaser.Math.RadToDeg(angle))
          .setDepth(27);
        this.tweens.add({
          targets: beam,
          alpha: { from: 0.0, to: 0.45 },
          yoyo: true,
          repeat: 1,
          duration: 350,
          onComplete: () => beam.destroy()
        });
      });
    }
    this.burst(core.x, core.y, 0x8c25ff, 3.6);
    this.burst(this.player.x, this.player.y, 0xff2d8f, 2.8);
    this.cameras.main.flash(280, 40, 0, 80);
    if (save.settings.screenShake) this.cameras.main.shake(720, 0.024);
    this.showBanner(
      `◆ 黑暗魔神 · 支离破碎 · 你的血量封锁至 ${this.stats.maxHp} · 攻击 -60% · 回血 -50%`,
      1900
    );
  }

  checkBossPhase(): void {
    const ratio = this.bossHp / this.bossMaxHp;
    const nextPhase = ratio <= 0.35 ? 3 : ratio <= 0.7 ? 2 : 1;
    if (nextPhase <= this.bossPhase) return;
    this.bossPhase = nextPhase;
    this.clearBossAttackEffects();
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
    const campaignEncounter =
      isNineBattleMode()
        ? BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]
        : null;
    if (campaignEncounter?.kind === "trinity") {
      this.updateTrinityBosses(time);
      return;
    }
    if (this.bossKind === "shadow") {
      this.updateShadowBoss(time, campaignEncounter?.kind === "chase");
      return;
    }
    if (this.bossKind === "dark_deity") {
      this.updateDarkDeityBoss(time);
      return;
    }
    const parts = this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[];
    const core = parts.find((part) => part.active && part.getData("part") === "core");
    if (core && core.y >= 178) {
      const sway = Math.sin(
        this.hostileMotionTime(time) * (this.bossKind === "mirror" ? 0.0012 : 0.0008)
      ) * (this.bossKind === "titan" ? 150 : 115);
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
    if (this.bossKind === "titan") {
      const extras = [
        { type: "spiral", run: () => {
          this.bossSpiralAttack(core);
        } },
        { type: "rage", run: () => {
          this.bossRageAttack(core);
        } }
      ];
      const extra = Phaser.Utils.Array.GetRandom(extras);
      this.startBossAttackType(`titan:${extra.type}`, extra.run);
      this.executeBossKindAttack(core, "titan");
    } else if (this.bossKind === "mirror") {
      this.executeBossKindAttack(core, "mirror");
    } else {
      this.executeBossKindAttack(core, "usurper");
    }
    this.castBorrowedBossMutation(core);
    const base =
      this.bossKind === "mirror"
        ? 1580
        : this.bossKind === "usurper"
          ? 1750
          : isNineBattleMode()
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

  renderBossSignatureCue(core: Phaser.Physics.Arcade.Image, kind: BossKind): void {
    const colors: Record<BossKind, [number, number]> = {
      titan: [0xff6a32, 0xffd15c],
      mirror: [0x39eaff, 0x9b6cff],
      usurper: [0xffbd3e, 0x7b4dff],
      shadow: [0xff2d8f, 0x310043],
      dark_deity: [0xff174f, 0x050008]
    };
    const [primary, secondary] = colors[kind];
    const warningField = this.add.ellipse(
      core.x,
      core.y + core.displayHeight * 0.14,
      Math.max(240, core.displayWidth * 0.82),
      Math.max(82, core.displayHeight * 0.22),
      secondary,
      0.1
    ).setStrokeStyle(7, primary, 0.82).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    const outerSigil = this.add.circle(
      core.x,
      core.y + core.displayHeight * 0.1,
      Math.max(122, core.displayWidth * 0.34),
      primary,
      0.04
    ).setStrokeStyle(3, secondary, 0.72).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: warningField,
      scaleX: 1.75,
      scaleY: 1.35,
      alpha: 0,
      duration: 920,
      ease: "Cubic.Out",
      onComplete: () => warningField.destroy()
    });
    this.tweens.add({
      targets: outerSigil,
      rotation: kind === "mirror" ? -Math.PI / 2 : Math.PI / 2,
      scale: 1.5,
      alpha: 0,
      duration: 820,
      onComplete: () => outerSigil.destroy()
    });
    const shardCount = save.settings.quality === "high" ? 12 : 7;
    for (let index = 0; index < shardCount; index += 1) {
      const angle = (Math.PI * 2 * index) / shardCount;
      const shard = this.add.rectangle(
        core.x + Math.cos(angle) * 48,
        core.y + core.displayHeight * 0.1 + Math.sin(angle) * 32,
        9,
        38,
        index % 3 === 0 ? 0xffffff : primary,
        0.82
      ).setRotation(angle + Math.PI / 2).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shard,
        x: core.x + Math.cos(angle) * Math.max(170, core.displayWidth * 0.48),
        y: core.y + core.displayHeight * 0.1 + Math.sin(angle) * Math.max(120, core.displayHeight * 0.34),
        scale: 1.7,
        alpha: 0,
        duration: 520 + index * 22,
        onComplete: () => shard.destroy()
      });
    }
    if (save.settings.screenShake) this.cameras.main.shake(90, 0.0025);
    if (kind === "titan") {
      const crown = this.add.circle(core.x, core.y + 40, 92, primary, 0.05)
        .setStrokeStyle(5, secondary, 0.9).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: crown, scale: 2.2, rotation: Math.PI / 4, alpha: 0, duration: 620, onComplete: () => crown.destroy() });
    } else if (kind === "mirror") {
      [-1, 1].forEach((side) => {
        const pane = this.add.rectangle(core.x + side * 82, core.y + 30, 78, 78, primary, 0.08)
          .setStrokeStyle(4, side < 0 ? primary : secondary, 0.9).setRotation(Math.PI / 4).setDepth(25);
        this.tweens.add({ targets: pane, x: core.x + side * 190, rotation: side * Math.PI, scale: 1.6, alpha: 0, duration: 720, onComplete: () => pane.destroy() });
      });
    } else if (kind === "usurper") {
      for (let index = -2; index <= 2; index += 1) {
        const bar = this.add.rectangle(core.x + index * 32, core.y + 35, 7, 120, index % 2 ? primary : secondary, 0.72)
          .setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: bar, scaleY: 2.4, alpha: 0, delay: Math.abs(index) * 35, duration: 560, onComplete: () => bar.destroy() });
      }
    } else if (kind === "shadow") {
      for (let index = -1; index <= 1; index += 1) {
        const claw = this.add.rectangle(core.x, core.y + 45 + index * 28, 230, 8, index === 0 ? primary : secondary, 0.86)
          .setRotation(-0.34 + index * 0.14).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: claw, scaleX: 2.8, x: core.x - 90, alpha: 0, duration: 480, onComplete: () => claw.destroy() });
      }
    } else {
      const eclipse = this.add.circle(core.x, core.y + 35, 58, secondary, 0.82)
        .setStrokeStyle(9, primary, 0.92).setDepth(25);
      const halo = this.add.ellipse(core.x, core.y + 35, 190, 42, primary, 0.08)
        .setStrokeStyle(4, 0xffffff, 0.72).setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: eclipse, scale: 2.5, alpha: 0, duration: 850, onComplete: () => eclipse.destroy() });
      this.tweens.add({ targets: halo, rotation: Math.PI, scaleX: 1.7, alpha: 0, duration: 850, onComplete: () => halo.destroy() });
    }
  }

  executeBossKindAttack(
    core: Phaser.Physics.Arcade.Image,
    kind: BossKind,
    excludePlayerMimic = false
  ): void {
    let choices: Array<{ type: string; run: () => void }>;
    if (kind === "titan") {
      choices = [
        { type: "meteor", run: () => this.titanMeteorField(core) },
        { type: "lane", run: () => this.titanLaneSweep(core) },
        { type: "fan", run: () => this.bossFanAttack(core) },
        { type: "gravity", run: () => this.titanGravityWell(core) }
      ];
    } else if (kind === "mirror") {
      choices = [
        { type: "petal", run: () => this.mirrorPetalAttack(core) },
        { type: "lance", run: () => this.mirrorLanceAttack(core) },
        {
          type: "homing",
          run: () => this.bossHomingSwarm(core, 7 + this.bossPhase * 2, 0x2df4ff)
        },
        { type: "copy_g", run: () => this.mirrorSpecializationAttack(core) },
        { type: "copy_1", run: () => this.mirrorLoadoutSkill(core, 1) },
        { type: "copy_2", run: () => this.mirrorLoadoutSkill(core, 2) },
        { type: "copy_3", run: () => this.mirrorLoadoutSkill(core, 3) }
      ];
    } else if (kind === "usurper") {
      choices = [
        { type: "grid", run: () => this.usurperLaserGrid(core) },
        { type: "emp", run: () => this.usurperEMP(core) },
        { type: "lattice", run: () => this.usurperDroneLattice(core) },
        { type: "drain", run: () => this.usurperPowerDrain(core) }
      ];
    } else if (kind === "shadow") {
      choices = [
        { type: "claw", run: () => this.shadowClawAttack(false) },
        { type: "delayed", run: () => this.shadowDelayedExplosion(false) },
        { type: "drain", run: () => this.shadowDrainWave(core, false) }
      ];
    } else {
      choices = [
        { type: "barrage", run: () => this.darkDeityBarrage(core) },
        { type: "storm", run: () => this.darkDeityStorm(core) },
        { type: "charge", run: () => this.shadowChargeAttack(core) }
      ];
    }
    // 最终 boss 融合镜像时排除"模仿玩家技能"(copy_*),只保留镜像原生招式
    if (excludePlayerMimic && kind === "mirror") {
      choices = choices.filter((item) => !item.type.startsWith("copy_"));
    }
    // 普通战役难度限制:boss 只能从已选定的技能池里挑
    if (this.bossActiveSkillTypes.length) {
      const filtered = choices.filter((c) => this.bossActiveSkillTypes.includes(c.type));
      if (filtered.length) choices = filtered;
    }
    let choice: { type: string; run: () => void };
    if (kind === "mirror") {
      const mimicChoices = choices.filter((item) => item.type.startsWith("copy_"));
      const nativeChoices = choices.filter((item) => !item.type.startsWith("copy_"));
      const mimicTurn = this.mirrorMimicIndex % 2 === 0;
      // 兜底:若当前回合对应的技能组为空(例如技能池恰好全是 copy_*),
      // 退回在全部技能里挑,避免取到 undefined 导致技能"释放不出来"
      const turnPool = mimicTurn
        ? mimicChoices.length
          ? mimicChoices
          : choices
        : nativeChoices.length
          ? nativeChoices
          : choices;
      choice = turnPool[Math.floor(this.mirrorMimicIndex / 2) % turnPool.length];
      this.mirrorMimicIndex += 1;
    } else {
      choice = Phaser.Utils.Array.GetRandom(choices);
    }
    const isPlayerMimic = kind === "mirror" && choice.type.startsWith("copy_");
    // 镜像模仿玩家的技能属于招牌招式:force=true 绕过 4 类并发上限,保证必出
    this.startBossAttackType(
      `${kind}:${choice.type}`,
      () => {
        choice.run();
      },
      7000,
      isPlayerMimic
    );
    // 篡夺者已偷取的玩家技能:独立于本次攻击施放,同样不受 4 类并发上限限制,
    // 否则同时存在 4 个攻击时偷到的技能会整体"释放不出来"
    if (
      kind === "usurper" &&
      this.usurperStolenSkill &&
      this.time.now < this.usurperStolenUntil
    ) {
      this.castStolenSkill(core);
    }
  }

  castBorrowedBossMutation(core: Phaser.Physics.Arcade.Image): void {
    const borrowedKind = this.bossMutationKind;
    if (!this.bossMutated || !borrowedKind) return;
    this.time.delayedCall(360, () => {
      if (!this.bossActive || !core.active) return;
      this.showBanner(
        `突变能力发动 · ${BOSS_NAMES[this.bossKind]} → ${BOSS_NAMES[borrowedKind]}`,
        850
      );
      this.floatText(core.x, core.y + 105, `MUTATION // ${BOSS_NAMES[borrowedKind]}`, true);
      this.executeBossKindAttack(core, borrowedKind);
    });
  }

  ensureTrinityCoreEntities(): Phaser.Physics.Arcade.Image[] {
    // 已炸毁的核心会被 disableBody；绝不能在更新循环里重新启用，
    // 也不能把每只 Boss 的独立血量覆盖成顶部共享血量。
    const survivingCores = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
      (part) =>
        part.getData("part") === "raid-core" &&
        part.getData("defeated") !== true &&
        Number(part.getData("hp") ?? 0) > 0
    );
    // 只修复“仍有独立生命”的异常隐藏实体；死亡核心因 defeated=true/hp=0
    // 永远不会走到这里，因此不会发生炸毁后复活或无实体继续攻击。
    survivingCores.forEach((core) => {
      if (core.active && core.visible) {
        core.setData("hittable", true);
        return;
      }
      const texture = (core.getData("raidTexture") as string | undefined) ?? "bossCore";
      const width = (core.getData("raidWidth") as number | undefined) ?? 240;
      const height = (core.getData("raidHeight") as number | undefined) ?? 240;
      const homeX = (core.getData("homeX") as number | undefined) ?? core.x;
      const homeY = (core.getData("homeY") as number | undefined) ?? 190;
      this.tweens.killTweensOf(core);
      core.enableBody(true, homeX, homeY, true, true);
      core
        .setTexture(this.textures.exists(texture) ? texture : "bossCore")
        .setDisplaySize(width, height)
        .setAlpha(1)
        .setAngle(0)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setDepth(14)
        .setData("hittable", true);
      const body = core.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      body.setSize(core.width * 0.62, core.height * 0.62, true);
    });
    return survivingCores;
  }

  updateTrinityBosses(time: number): void {
    const cores = this.ensureTrinityCoreEntities();
    cores.forEach((core, index) => {
      const homeX = core.getData("homeX") ?? core.x;
      if (core.getData("homeX") === undefined) core.setData("homeX", core.x);
      core.x = homeX + Math.sin(this.hostileMotionTime(time) * 0.0011 + index * 2.1) * 42;
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
    if (!cores.length) return;
    // 每个 boss 各自有独立攻击周期 → 弹道分散、玩家有走位窗口
    cores.forEach((core) => {
      const nextAt = (core.getData("nextAttackAt") as number) ?? 0;
      if (time < nextAt) return;
      const kind = core.getData("raidKind") as BossKind;
      if (kind === "mirror") {
        this.executeBossKindAttack(core, "mirror");
        this.floatText(core.x, core.y + 90, "复制玩家流派与键位", true);
      } else {
        this.executeBossKindAttack(core, kind);
      }
      const mutationKind = core.getData("mutationKind") as BossKind | null;
      if (core.getData("mutated") && mutationKind) {
        this.time.delayedCall(340, () => {
          if (core.active && this.bossActive) this.executeBossKindAttack(core, mutationKind);
        });
      }
      // 给每个 boss 一个不同的冷却错开节奏
      const baseCooldown = this.bossElite ? 1500 : 1900;
      const kindOffset = kind === "titan" ? 0 : kind === "mirror" ? 380 : 760;
      core.setData("nextAttackAt", time + baseCooldown + kindOffset + Phaser.Math.Between(-180, 180));
    });
  }

  // 镜像分身生命周期：移动 + 开火 + 寿命管理
  updateMirrorClones(time: number): void {
    const clones = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).filter(
      (part) => part.active && part.getData("part") === "shadow-clone"
    );
    clones.forEach((clone) => {
      const bornAt = (clone.getData("bornAt") as number) ?? time;
      const lifetime = (clone.getData("lifetimeMs") as number) ?? 5000;
      const age = time - bornAt;
      // 寿命到：爆掉
      if (age >= lifetime) {
        this.burst(clone.x, clone.y, 0x9b5cff, 1.6);
        clone.disableBody(true, true);
        return;
      }
      // 缓慢漂向玩家（半速）
      const homeX = (clone.getData("homeX") as number) ?? clone.x;
      const homeY = (clone.getData("homeY") as number) ?? clone.y;
      const targetX = homeX + (this.player.x - homeX) * 0.45;
      const targetY = homeY + (this.player.y - 80 - homeY) * 0.35;
      clone.x = Phaser.Math.Linear(clone.x, targetX, 0.06);
      clone.y = Phaser.Math.Linear(clone.y, targetY, 0.06);
      // 周期开火：5 颗窄扇
      const nextFireAt = (clone.getData("nextFireAt") as number) ?? 0;
      if (time >= nextFireAt) {
        clone.setData("nextFireAt", time + 850);
        for (let i = -2; i <= 2; i += 1) {
          if (i === 0) continue;
          this.fireEnemyAngle(
            clone.x,
            clone.y + 20,
            Math.PI / 2 + i * 0.18,
            240,
            12 + this.bossTier,
            "projectile",
            "boss"
          ).setTint(0x9b5cff);
        }
      }
    });
  }

  updateShadowBoss(time: number, pursuit: boolean): void {
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    if (!core) return;
    const motionTime = this.hostileMotionTime(time);
    const parts = this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[];
    const left = parts.find((part) => part.active && part.getData("part") === "left");
    const right = parts.find((part) => part.active && part.getData("part") === "right");
    // 冲刺期间:核心位置由冲刺 tween 接管,不再漂移
    if (time >= this.shadowChargingUntil) {
      const targetY = pursuit ? 82 + Math.sin(motionTime * 0.0017) * 22 : 390;
      const targetX =
        WORLD_WIDTH / 2 +
        Math.sin(motionTime * (pursuit ? 0.00155 : 0.00092)) * (pursuit ? 270 : 185);
      core.y = Phaser.Math.Linear(core.y, targetY, pursuit ? 0.05 : 0.018);
      // x 同样用插值而非直接赋值:突刺期间漂移被冻结,恢复时若直接赋值,
      // 正弦相位已前进 ~1.6rad,core.x 会从返回位置瞬间跳到新漂移位置(最大 ~270px,表现为瞬移)
      core.x = Phaser.Math.Linear(core.x, targetX, 0.1);
    }
    if (left) left.setPosition(core.x - 205, core.y + 30);
    if (right) right.setPosition(core.x + 205, core.y + 30);
    this.bossEliteAura?.setPosition(core.x, core.y);
    if (!pursuit && time >= this.nextBossMinionSummon) {
      this.startBossAttackType("shadow:portal", () => {
        this.shadowPortalAttack(core);
      });
      this.nextBossMinionSummon = time + (this.bossElite ? 6800 : 8200);
      this.showBanner("完全体黑影 · 召唤裂隙增援", 900);
    }
    if (time < this.nextBossAttack) return;
    const attacks: Array<{ type: string; run: () => void }> = [
      { type: "barrage", run: () => this.shadowBulletBarrage(core, pursuit) },
      { type: "delayed", run: () => this.shadowDelayedExplosion(pursuit) },
      { type: "claw", run: () => this.shadowClawAttack(pursuit) },
      { type: "charge", run: () => this.shadowChargeAttack(core) },
      { type: "drain", run: () => this.shadowDrainWave(core, pursuit) },
      { type: "cage", run: () => this.shadowCage(core, pursuit) },
      { type: "maw", run: () => this.shadowHomingMaw(core, pursuit) }
    ];
    if (this.campaignBossesDefeated >= 1) {
      attacks.push({ type: "stolen_titan", run: () => {
        this.floatText(core.x, core.y + 90, "盗取 · 裂渊泰坦", true);
        this.executeBossKindAttack(core, "titan");
      }});
    }
    if (this.campaignBossesDefeated >= 2) {
      attacks.push({ type: "stolen_mirror", run: () => {
        this.floatText(core.x, core.y + 90, "盗取 · 镜像猎手", true);
        this.executeBossKindAttack(core, "mirror");
      }});
    }
    if (this.campaignBossesDefeated >= 3) {
      attacks.push({ type: "stolen_usurper", run: () => {
        this.floatText(core.x, core.y + 90, "盗取 · 技能篡夺者", true);
        this.executeBossKindAttack(core, "usurper");
      }});
    }
    let attackIndex = Phaser.Math.Between(0, attacks.length - 1);
    if (attackIndex === this.bossAttackIndex) attackIndex = (attackIndex + 1) % attacks.length;
    this.bossAttackIndex = attackIndex;
    const attack = attacks[attackIndex];
    this.startBossAttackType(`shadow:${attack.type}`, () => {
      attack.run();
    });
    this.castBorrowedBossMutation(core);
    this.nextBossAttack = time + (pursuit ? 1180 : this.bossElite ? 980 : 1320);
  }

  shadowBulletBarrage(core: Phaser.Physics.Arcade.Image, pursuit: boolean): void {
    const finalScale =
      pursuit || !isNineBattleMode()
        ? 1
        : campaignFinalBossStatScale(this.campaignEncounterIndex);
    const count = pursuit ? 18 : Math.max(9, Math.round(30 * finalScale));
    const safeGap = Phaser.Math.Between(2, count - 3);
    // 0.5s 暗色聚气预警：从 core 下方画一片扇形阴影渐变实
    const chargeFan = this.add.circle(core.x, core.y + 30, 230, 0x4a0a8c, 0.0).setDepth(20);
    this.tweens.add({
      targets: chargeFan,
      alpha: { from: 0.0, to: 0.42 },
      scale: { from: 0.6, to: 1 },
      duration: 520,
      onComplete: () => {
        chargeFan.destroy();
        if (!this.bossActive) return;
        for (let index = 0; index < count; index += 1) {
          if (Math.abs(index - safeGap) <= (pursuit ? 1 : 2)) continue;
          const angle = 0.16 + ((Math.PI - 0.32) * index) / (count - 1);
          const bullet = this.fireEnemyAngle(
            core.x,
            core.y + 45,
            angle,
            pursuit ? 255 : 285 * finalScale,
            pursuit ? 18 : 24,
            "projectile",
            "boss"
          );
          bullet
            .setTint(index % 2 ? 0x7e1fff : 0xff2d8f)
            .setScale(index % 3 === 0 ? 1.2 : 0.92);
        }
        // 视觉反馈：释放瞬间一道粉紫闪光
        const flash = this.add.circle(core.x, core.y + 45, 60, 0xff2d8f, 0.55).setDepth(24);
        this.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
        if (save.settings.screenShake) this.cameras.main.shake(140, 0.004);
      }
    });
  }

  shadowDelayedExplosion(pursuit: boolean): void {
    const radius = pursuit ? 110 : 155;
    // 四连爆：4 个不重叠位置（玩家初始点 + 三次随机偏移）
    const anchors: Array<{ x: number; y: number }> = [];
    anchors.push({ x: this.player.x, y: this.player.y });
    for (let i = 1; i < 4; i += 1) {
      const ox = Phaser.Math.Between(-180, 180);
      const oy = Phaser.Math.Between(-90, 90);
      const nx = Phaser.Math.Clamp(anchors[0].x + ox, 80, WORLD_WIDTH - 80);
      const ny = Phaser.Math.Clamp(anchors[0].y + oy, 120, WORLD_HEIGHT - 160);
      anchors.push({ x: nx, y: ny });
    }
    anchors.forEach((a, i) => {
      this.time.delayedCall(i * 420, () => {
        if (!this.bossActive) return;
        const warning = this.add
          .circle(a.x, a.y, radius, 0x260033, 0.12)
          .setStrokeStyle(6, 0xb626ff, 0.92)
          .setDepth(22);
        this.tweens.add({
          targets: warning,
          scale: { from: 0.35, to: 1 },
          // 预警由浅到深:整个预警期持续加深,最深处才释放爆炸
          alpha: { from: 0.15, to: 0.9 },
          duration: 780,
          ease: "Quad.easeIn",
          onComplete: () => {
            warning.destroy();
            if (!this.bossActive) return;
            this.renderBossSkillImpact(
              this.bossKind === "dark_deity" ? "dark_deity" : "shadow",
              "delayed",
              a.x,
              a.y,
              radius * 2,
              620,
              true
            );
            const blast = this.add.circle(a.x, a.y, radius * 1.08, 0x5a0874, 0.82).setDepth(31);
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) < radius) {
              this.damagePlayerDark(0, pursuit ? 0.1 : 0.16, "延迟黑暗爆炸");
            }
            this.tweens.add({ targets: blast, scale: 1.35, alpha: 0, duration: 420, onComplete: () => blast.destroy() });
            if (save.settings.screenShake) this.cameras.main.shake(120, 0.0035);
          }
        });
      });
    });
  }

  shadowClawAttack(pursuit: boolean): void {
    const damageWidth = pursuit ? 144 : 190;
    // 双爪：玩家头顶 + 偏移 200px 的位置同时落下
    const offsetX = Phaser.Math.Between(-220, 220);
    const anchors = [
      { x: this.player.x, y: WORLD_HEIGHT / 2 },
      { x: Phaser.Math.Clamp(this.player.x + offsetX, 70, WORLD_WIDTH - 70), y: WORLD_HEIGHT / 2 }
    ];
    // 爪痕预警颜色通道插值:浅(亮紫/亮粉) → 深(暗紫/洋红),让深浅两阶段更加分明
    const mixColor = (c1: number, c2: number, t: number): number => {
      const r1 = (c1 >> 16) & 0xff;
      const g1 = (c1 >> 8) & 0xff;
      const b1 = c1 & 0xff;
      const r2 = (c2 >> 16) & 0xff;
      const g2 = (c2 >> 8) & 0xff;
      const b2 = c2 & 0xff;
      return (
        (Math.round(r1 + (r2 - r1) * t) << 16) |
        (Math.round(g1 + (g2 - g1) * t) << 8) |
        Math.round(b1 + (b2 - b1) * t)
      );
    };
    const FILL_SHALLOW = 0xd073ff; // 浅:亮紫
    const FILL_DEEP = 0x4a0870; // 深:暗紫
    const STROKE_SHALLOW = 0xff9fe0; // 浅:亮粉
    const STROKE_DEEP = 0xff2d8f; // 深:洋红
    anchors.forEach((a) => {
      const clawAngle = Phaser.Math.Between(-12, 12);
      const claw = this.trackBossEffect(this.add
        .rectangle(a.x, a.y, damageWidth, WORLD_HEIGHT, FILL_SHALLOW, 0.08)
        .setStrokeStyle(4, STROKE_SHALLOW, 0.84)
        .setAngle(clawAngle)
        .setDepth(20), 1800);
      // 顶部紫色光柱提示位置
      const pillar = this.trackBossEffect(
        this.add.rectangle(a.x, 60, 24, 120, 0xff2d8f, 0.0).setDepth(21),
        1500
      );
      this.tweens.add({
        targets: pillar,
        alpha: { from: 0, to: 0.7 },
        yoyo: true,
        repeat: 2,
        duration: 140,
        onComplete: () => pillar.destroy()
      });
      this.tweens.add({
        targets: claw,
        alpha: { from: 0.1, to: 0.68 },
        yoyo: true,
        repeat: 2,
        duration: 180,
        onUpdate: () => {
          // 随预警脉冲由浅到深:浅阶段亮色,深阶段暗色,颜色过渡明显
          const p = Phaser.Math.Clamp((claw.alpha - 0.1) / 0.58, 0, 1);
          claw.setFillStyle(mixColor(FILL_SHALLOW, FILL_DEEP, p), 0.08);
          claw.setStrokeStyle(4, mixColor(STROKE_SHALLOW, STROKE_DEEP, p), 0.84);
        },
        onComplete: () => {
          // 实际伤害范围与斜向预警一致:按旋转后的矩形做命中判定
          const rad = Phaser.Math.DegToRad(clawAngle);
          const dx = this.player.x - a.x;
          const dy = this.player.y - WORLD_HEIGHT / 2;
          const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
          const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
          const hit = Math.abs(localX) < damageWidth / 2 && Math.abs(localY) < WORLD_HEIGHT / 2;
          this.renderBossSkillArea(
            "shadow",
            "claw",
            a.x,
            WORLD_HEIGHT / 2,
            damageWidth,
            WORLD_HEIGHT,
            620,
            Phaser.Math.DegToRad(clawAngle)
          );
          claw.destroy();
          if (!this.bossActive || !hit) return;
          this.damagePlayerDark(0, pursuit ? 0.08 : 0.12, "黑暗爪痕");
          this.applyDarkDot(this.stats.maxHp * (pursuit ? 0.06 : 0.1), 5.5, "流血侵蚀");
        }
      });
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
        this.renderBossSkillImpact(
          this.bossKind === "dark_deity" ? "dark_deity" : "shadow",
          "portal",
          core.x,
          core.y + 115,
          310,
          960
        );
        const roster = campaignEnemyRoster(Math.max(1, this.campaignBossesDefeated));
        const finalScale =
          isNineBattleMode()
            ? campaignFinalBossStatScale(this.campaignEncounterIndex)
            : 1;
        const count = Math.max(
          2,
          Math.round((3 + this.campaignBossesDefeated * 2) * finalScale)
        );
        for (let index = 0; index < count; index += 1) {
          const type = Phaser.Utils.Array.GetRandom(roster) as EnemyType;
          const enemy = this.spawnEnemy(this.time.now, this.bossElite ? `elite_${type}` : type);
          enemy
            .setPosition(
              Phaser.Math.Clamp(core.x + (index - (count - 1) / 2) * 78, 65, WORLD_WIDTH - 65),
              core.y + 110 + Math.abs(index - count / 2) * 15
            )
            .setData("bossSummoned", true);
        }
        if (this.bossElite) {
          const echo = this.spawnEnemy(this.time.now, "elite_bomber");
          echo
            .setPosition(core.x, core.y + 165)
            .setDisplaySize(230, 230)
            .setData("hp", (echo.getData("hp") ?? 1) * 4 * finalScale)
            .setData("maxHp", (echo.getData("maxHp") ?? 1) * 4 * finalScale)
            .setData("bossSummoned", true)
            .setData("portalBoss", true);
          this.floatText(echo.x, echo.y, "ELITE BOSS ECHO", true);
        }
      }
    });
  }

  shadowChargeAttack(core: Phaser.Physics.Arcade.Image): void {
    // 防并发:上一次突刺(含 1.1s 预警期)还没结束时直接跳过本次触发。
    // 否则 nextBossAttack 间隔(约 1s)短于突刺总耗时(~1.76s),同一条 core 会被
    // 第二条突刺的 core.setPosition(startX,startY) 从返回位置瞬移到旧的起始坐标。
    if (this.time.now < this.shadowChargingUntil) return;
    const startX = core.x;
    const startY = core.y;
    const targetX = this.player.x;
    // 目标点需覆盖玩家可达的最底部区域(玩家可到 WORLD_HEIGHT-70),否则贴底走位时冲刺打不到
    const targetY = Math.min(WORLD_HEIGHT - 70, this.player.y);
    // 从预警一开始就冻结核心漂移:否则 1.1s 预警期间核心会左右漂移,
    // 冲刺从漂移后的位置出发,方向会与斜向预警相反
    this.shadowChargingUntil = this.time.now + 2000;
    // 第一阶段：0.6s 红色细线预警
    const warning = this.trackBossEffect(this.add
      .line(0, 0, startX, startY, targetX, targetY, 0xff2244, 0.0)
      .setOrigin(0)
      .setLineWidth(8, 2)
      .setDepth(24), 2200);
    this.tweens.add({
      targets: warning,
      alpha: { from: 0.0, to: 0.85 },
      duration: 600,
      onComplete: () => {
        // 第二阶段：粗红线 + 冲撞轨迹
        warning.destroy();
        const warning2 = this.trackBossEffect(this.add
          .line(0, 0, startX, startY, targetX, targetY, 0xff2d8f, 0.5)
          .setOrigin(0)
          .setLineWidth(28, 6)
          .setDepth(25), 1600);
        // 路径拖影：8 个渐隐的圆点
        const ghosts: Phaser.GameObjects.Arc[] = [];
        const steps = 10;
        for (let i = 0; i < steps; i += 1) {
          const t = i / (steps - 1);
          const gx = startX + (targetX - startX) * t;
          const gy = startY + (targetY - startY) * t;
          const ghost = this.trackBossEffect(
            this.add.circle(gx, gy, 18, 0x7c22ff, 0.45).setDepth(23),
            1400
          );
          this.tweens.add({
            targets: ghost,
            alpha: { from: 0.45, to: 0 },
            scale: { from: 1, to: 0.4 },
            duration: 380,
            onComplete: () => ghost.destroy()
          });
          ghosts.push(ghost);
        }
        this.tweens.add({
          targets: warning2,
          // 预警由浅到深:最深处才释放冲撞
          alpha: { from: 0.4, to: 0.95 },
          duration: 520,
          ease: "Quad.easeIn",
          onComplete: () => {
            warning2.destroy();
            ghosts.forEach((g) => g.destroy());
            if (!core.active || !this.bossActive) return;
            // 冲刺起点强制回到预警起点,保证位移方向与斜向预警完全一致
            core.setPosition(startX, startY);
            // 冲刺期间暂停核心漂移:让冲刺 tween 完全接管,沿斜向预警线冲撞
            this.shadowChargingUntil = this.time.now + 800;
            this.tweens.add({
              targets: core,
              x: targetX,
              y: targetY,
              duration: 280,
              ease: "Cubic.In",
              yoyo: true,
              hold: 80,
              onYoyo: () => {
                // 斜向冲击:沿预警线段的走廊形范围,与实际命中判定一致
                const lineDX = targetX - startX;
                const lineDY = targetY - startY;
                const lineLen = Math.hypot(lineDX, lineDY) || 1;
                const lineAngle = Math.atan2(lineDY, lineDX);
                this.renderBossSkillArea(
                  this.bossKind === "dark_deity" ? "dark_deity" : "shadow",
                  "charge",
                  startX + lineDX / 2,
                  startY + lineDY / 2,
                  lineLen,
                  290,
                  620,
                  lineAngle
                );
                // 命中判定:玩家在斜向走廊内(沿线段投影在 [-0.12, 1.12],垂直距离 < 半宽 145)
                const px = this.player.x - startX;
                const py = this.player.y - startY;
                const along = (px * lineDX + py * lineDY) / (lineLen * lineLen);
                const perp = Math.abs(px * lineDY - py * lineDX) / lineLen;
                if (along >= -0.12 && along <= 1.12 && perp < 145) {
                  this.damagePlayerDark(0, 0.12, "黑影冲撞");
                  this.applyDarkDot(1000, 5.5, "黑暗能量灼烧");
                }
              },
              onComplete: () => {
                core.setPosition(startX, startY);
                this.shadowChargingUntil = 0;
              }
            });
          }
        });
      }
    });
  }

  // 独有招式：灵魂抽离 - 玩家脚下环形吸取场 → 0.6s 后向中心收缩 3 次，命中持续扣血
  shadowDrainWave(_core: Phaser.Physics.Arcade.Image, pursuit: boolean): void {
    const cx = this.player.x;
    const cy = Math.min(this.player.y + 40, WORLD_HEIGHT - 70);
    const innerR = pursuit ? 75 : 110;
    const damageRadius = innerR + 12;
    // 外环预警（空心圆 + 描边）
    const ring = this.add.circle(cx, cy, damageRadius, 0x7c22ff, 0.04).setStrokeStyle(8, 0xff2d8f, 0.98).setDepth(22);
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.0, to: 0.6 },
      duration: 600,
      onComplete: () => {
        if (!this.bossActive) {
          ring.destroy();
          return;
        }
        this.renderBossSkillImpact(
          this.bossKind === "dark_deity" ? "dark_deity" : "shadow",
          "drain",
          cx,
          cy,
          damageRadius * 2,
          1050,
          true
        );
        // 3 波向心收缩
        for (let wave = 0; wave < 3; wave += 1) {
          this.time.delayedCall(wave * 220, () => {
            if (!this.bossActive) return;
            const spike = this.add.circle(cx, cy, damageRadius, 0x7c22ff, 0.08).setStrokeStyle(6, 0xff2d8f, 0.95).setDepth(25);
            this.tweens.add({
              targets: spike,
              scale: { from: 1.08, to: 0.28 },
              alpha: { from: 0.9, to: 0.0 },
              duration: 380,
              ease: "Cubic.Out",
              onComplete: () => {
                spike.destroy();
                // 命中检测：玩家在内环范围内
                if (Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy) < damageRadius) {
                  this.damagePlayerDark(0, pursuit ? 0.07 : 0.11, "灵魂抽离");
                  this.applyDarkDot(this.stats.maxHp * 0.04, 4, "灵魂侵蚀");
                }
              }
            });
          });
        }
        // 中心能量柱
        const pillar = this.add.rectangle(cx, cy, 30, damageRadius * 2, 0x7c22ff, 0.0).setDepth(24);
        this.tweens.add({
          targets: pillar,
          alpha: { from: 0.0, to: 0.6 },
          yoyo: true,
          repeat: 2,
          duration: 300,
          onComplete: () => pillar.destroy()
        });
        this.tweens.add({
          targets: ring,
          alpha: 0,
          scale: 0.5,
          duration: 600,
          onComplete: () => ring.destroy()
        });
        if (save.settings.screenShake) this.cameras.main.shake(180, 0.0045);
      }
    });
  }

  // 独有招式：暗影牢笼 - 10 道暗影柱从四周同时逼近中心，留 2 个缺口让玩家走位
  shadowCage(_core: Phaser.Physics.Arcade.Image, pursuit: boolean): void {
    const count = 10;
    const cx = this.player.x;
    const cy = Math.min(this.player.y + 30, WORLD_HEIGHT - 70);
    const outerR = pursuit ? 390 : 500;
    const innerR = pursuit ? 105 : 140;
    // 选 2 个安全缺口（隔开至少 2 个柱位）
    const gap1 = Phaser.Math.Between(0, count - 1);
    const gap2 = (gap1 + 3 + Phaser.Math.Between(0, count - 4)) % count;
    for (let i = 0; i < count; i += 1) {
      if (i === gap1 || i === gap2) continue;
      const angle = (Math.PI * 2 * i) / count;
      const sx = cx + Math.cos(angle) * outerR;
      const sy = cy + Math.sin(angle) * outerR;
      const ex = cx + Math.cos(angle) * innerR;
      const ey = cy + Math.sin(angle) * innerR;
      // 只标记真正会结算伤害的终点半径，柱子起点不再伪装成伤害区。
      const warn = this.add.circle(ex, ey, 70, 0x6c1a8f, 0.04).setStrokeStyle(8, 0xb626ff, 0.98).setDepth(22);
      this.tweens.add({
        targets: warn,
        alpha: { from: 0.0, to: 0.7 },
        duration: 650,
        onComplete: () => {
          warn.destroy();
          if (!this.bossActive) return;
          // 暗影柱从外向内移动
          const pillar = this.add.rectangle(sx, sy, 36, 110, 0x2b0040, 0.7).setStrokeStyle(4, 0xff2d8f, 0.95).setDepth(25);
          this.tweens.add({
            targets: pillar,
            x: ex,
            y: ey,
            duration: 360,
            ease: "Cubic.In",
            onComplete: () => {
              this.renderBossSkillImpact(
                this.bossKind === "dark_deity" ? "dark_deity" : "shadow",
                "cage",
                ex,
                ey,
                140,
                520
              );
              if (Phaser.Math.Distance.Between(this.player.x, this.player.y, ex, ey) < 70) {
                this.damagePlayerDark(0, pursuit ? 0.09 : 0.14, "暗影柱贯穿");
                this.applyDarkDot(this.stats.maxHp * 0.05, 5, "牢笼侵蚀");
              }
              this.tweens.add({
                targets: pillar,
                alpha: 0,
                scale: 1.4,
                duration: 380,
                onComplete: () => pillar.destroy()
              });
            }
          });
        }
      });
    }
  }

  // 独有招式：暗影巨口 - 巨口从核心飞向玩家位置，1.2s 后张开喷射 12 颗扇形弹幕
  shadowHomingMaw(core: Phaser.Physics.Arcade.Image, pursuit: boolean): void {
    const targetX = this.player.x;
    const targetY = Math.min(this.player.y + 30, WORLD_HEIGHT - 70);
    const maw = this.add.circle(core.x, core.y, 38, 0x1a0033, 0.85).setStrokeStyle(6, 0xff2d8f, 0.95).setDepth(24);
    // 嘴内径渐变
    const inner = this.add.circle(core.x, core.y, 20, 0xff2d8f, 0.0).setDepth(24);
    this.tweens.add({
      targets: inner,
      alpha: { from: 0.0, to: 0.7 },
      yoyo: true,
      repeat: 3,
      duration: 280,
      onComplete: () => inner.destroy()
    });
    this.tweens.add({
      targets: maw,
      x: targetX,
      y: targetY,
      duration: 1200,
      ease: "Cubic.In",
      onComplete: () => {
        maw.destroy();
        if (!this.bossActive) return;
        this.renderBossSkillImpact(
          this.bossKind === "dark_deity" ? "dark_deity" : "shadow",
          "maw",
          targetX,
          targetY,
          330,
          820
        );
        // 巨口张开：放大 + 喷射 15 颗扇形
        const open = this.add.circle(targetX, targetY, 30, 0x1a0033, 0.8).setStrokeStyle(8, 0xff2d8f, 1).setDepth(25);
        const count = 15;
        for (let i = 0; i < count; i += 1) {
          const angle = Math.PI / 2 - 0.8 + (1.6 * i) / (count - 1);
          const bullet = this.fireEnemyAngle(
            targetX,
            targetY,
            angle,
            pursuit ? 260 : 320,
            pursuit ? 16 : 22,
            "projectile",
            "boss"
          );
          bullet.setTint(0x6c1a8f).setScale(1.15);
        }
        this.tweens.add({
          targets: open,
          scale: 1.6,
          alpha: 0,
          duration: 320,
          onComplete: () => open.destroy()
        });
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY) < 100) {
          this.damagePlayerDark(0, pursuit ? 0.1 : 0.15, "暗影巨口");
          this.applyDarkDot(this.stats.maxHp * 0.06, 5, "巨口腐蚀");
        }
        if (save.settings.screenShake) this.cameras.main.shake(160, 0.0045);
      }
    });
  }

  updateDarkDeityBoss(time: number): void {
    const core = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]).find(
      (part) => part.active && part.getData("part") === "core"
    );
    if (!core) return;
    // 冲刺期间:核心位置由冲刺 tween 接管,不再漂移
    if (time >= this.shadowChargingUntil) {
      const targetX = WORLD_WIDTH / 2 + Math.sin(this.hostileMotionTime(time) * 0.00072) * 135;
      // 隐退时核心缓慢上移退场(0.02 每帧),配合 alpha 渐变实现"渐渐隐退"而非瞬间切换
      core.y = Phaser.Math.Linear(core.y, this.darkAircraftRetreating ? -260 : 370, this.darkAircraftRetreating ? 0.02 : 0.02);
      // x 用插值避免突刺返回后瞬移(与 updateShadowBoss 同理)
      core.x = Phaser.Math.Linear(core.x, targetX, 0.1);
    }
    this.bossEliteAura?.setPosition(core.x, core.y);

    // === 阶段 1：血量首次到 50% 召唤一次黑暗飞机 ===
    const hpRatio = this.bossHp / Math.max(1, this.bossMaxHp);
    if (!this.darkAircraftSpawned && hpRatio <= 0.5) {
      this.darkAircraftSpawned = true;
      this.darkAircraftRetreating = true;
      this.darkAircraftNextHealAt = time + 5000;
      this.darkAircraftNextAttack = time + 1200;
      // 原先为主 Boss 最大生命的 25%；按要求提高 50%，现为 37.5%。
      this.darkAircraftMaxHp = Math.round(this.bossMaxHp * 0.375);
      this.darkAircraftHp = this.darkAircraftMaxHp;
      const ax = WORLD_WIDTH / 2;
      const ay = 260;
      // 黑暗飞机使用完全体黑影素材(与黑影同源,不再染色成紫色),保持黑影本相
      this.darkAircraft = this.bossParts.create(ax, ay, "bossShadowComplete")
        .setDepth(31)
        .setDisplaySize(430, 645)
        .setAlpha(1)
        .setData("part", "dark-aircraft")
        .setData("maxHp", this.darkAircraftMaxHp)
        .setData("hp", this.darkAircraftMaxHp)
        .setData("hittable", true)
        .setData("stealthing", false)
        .setData("clonedFrom", null);
      this.physics.world.enable(this.darkAircraft!);
      const acBody = (this.darkAircraft as Phaser.Physics.Arcade.Image).body;
      if (acBody && "setSize" in acBody) {
        (acBody as Phaser.Physics.Arcade.Body).setSize(270, 400, true);
      }
      // 渐渐隐退:alpha 渐变 + 上移退场,不再瞬间切换
      core.setData("hittable", false);
      this.tweens.killTweensOf(core);
      this.tweens.add({
        targets: core,
        alpha: 0.22,
        duration: 1600,
        ease: "Sine.easeInOut"
      });
      this.bossEliteAura?.setAlpha(0.15);
      this.clearBossAttackEffects();
      this.enemyBullets.children.each((child) => {
        const bullet = child as Phaser.Physics.Arcade.Image;
        if (bullet.active) bullet.disableBody(true, true);
        return true;
      });
      this.burst(core.x, core.y, 0x4a0070, 2.2);
      this.burst(ax, ay, 0x9b5cff, 1.8);
      this.showBanner("◆ 黑暗魔神半血 · 无敌隐退回血 · 黑暗飞机接管战斗", 1800);
      if (save.settings.screenShake) this.cameras.main.shake(420, 0.014);
    }

    // === 阶段 1.5：血量跌到 10% 触发「支离破碎」同归于尽 ===
    if (!this.bossShattered && !this.darkAircraftRetreating && hpRatio <= 0.1 && core.active) {
      this.triggerBossShattered(core);
    }

    // === 阶段 2：狂暴检测(只对 darkAircraft 在场时) ===
    if (this.darkAircraft && this.darkAircraft.active) {
      // 每帧 filter 会新建数组;只有最旧记录过期时才裁剪(约每秒一次),其余帧零分配
      if (
        this.darkAircraftDamageWindow.length > 0 &&
        time - this.darkAircraftDamageWindow[0] >= 1000
      ) {
        this.darkAircraftDamageWindow = this.darkAircraftDamageWindow.filter(
          (t) => time - t < 1000
        );
      }
      if (!this.darkAircraftEnraged) {
        if (hpRatio <= 0.4) {
          this.triggerDarkAircraftEnrage();
        }
      } else if (time >= this.darkAircraftEnrageUntil) {
        // 狂暴可由 27.5% 持续刷新
        const dmgSum = this.darkAircraftDamageWindow.length
          ? this.darkAircraftDamageWindow.length * (this.bossMaxHp * 0.04)
          : 0;
        if (dmgSum >= this.bossMaxHp * 0.275) {
          this.triggerDarkAircraftEnrage();
        }
      }
    }

    // === 阶段 3：隐退模式(黑暗飞机在场时) ===
    if (this.darkAircraftRetreating && this.darkAircraft && this.darkAircraft.active) {
      // 隐退期间主 Boss 完全不可命中并退出画面，只保留回血；黑暗飞机单独接战。
      core.setData("hittable", false).setAlpha(0.22);
      this.bossEliteAura?.setAlpha(0.15);
      if (time >= this.darkAircraftNextHealAt) {
        const heal = this.bossMaxHp * 0.01;
        this.bossHp = Math.min(this.bossMaxHp, this.bossHp + heal);
        this.darkAircraftNextHealAt = time + 5000;
        this.floatText(core.x, core.y - 70, `+1% 隐退回血`, true);
        this.burst(core.x, core.y, 0x4a0070, 0.7);
      }
      // 仍在跑黑暗飞机 AI
      this.updateDarkAircraft(time);
      return;
    } else if (this.darkAircraftRetreating && (!this.darkAircraft || !this.darkAircraft.active)) {
      // 黑暗飞机(黑影形态)被消灭:黑暗能量爆炸 + 支离破碎 debuff(血量封锁/攻击-60%/回血-50%)
      this.darkAircraftRetreating = false;
      this.darkAircraft = undefined;
      this.darkAircraftClones.forEach((c) => c.disableBody(true, true));
      this.darkAircraftClones = [];
      if (!this.bossShattered) {
        this.triggerBossShattered(core);
      }
      // 黑暗能量爆炸演出
      this.burst(core.x, core.y, 0xff2d8f, 3.2);
      this.burst(this.player.x, this.player.y, 0x8c25ff, 2.4);
      this.cameras.main.flash(300, 40, 0, 90);
      if (save.settings.screenShake) this.cameras.main.shake(640, 0.018);
      core.setData("hittable", true).setAlpha(1);
      this.bossEliteAura?.setAlpha(1);
      // 给一个缓冲
      this.nextBossAttack = time + 800;
    }

    // === 最终 boss 剥夺:定期夺取玩家的技能(含 V 键权柄),使其无法使用 ===
    if (time >= this.nextDarkDeityDisableAt) {
      this.skillsConfiscated = true;
      this.skillsConfiscatedUntil = time + 20000;
      this.nextDarkDeityDisableAt = time + 40000;
      this.showBanner("黑暗魔神 · 剥夺技能 20 秒 · 冷却 40 秒", 1150);
      if (save.settings.screenShake) this.cameras.main.shake(200, 0.008);
      // 按玩家流派与已解锁强化,黑暗魔神夺取专属技能并立即以放大版释放
      const stolenUl = this.upgradeLevels;
      if (save.selectedSpecialization === "agile" && (stolenUl.agile_shadow_lunge ?? 0) > 0) {
        this.time.delayedCall(600, () => {
          if (this.bossActive && core.active) this.castBossAgileFusion(core);
        });
      }
      if (save.selectedSpecialization === "agile" && (stolenUl.agile_shadow_clone ?? 0) > 0) {
        this.time.delayedCall(900, () => {
          if (this.bossActive && core.active) this.castBossAgileClones(core);
        });
      }
      if (save.selectedSpecialization === "defender" && (stolenUl.defender_thorns ?? 0) > 0) {
        this.time.delayedCall(1200, () => {
          if (this.bossActive && core.active) this.castBossDefenderCounter(core);
        });
      }
      if (save.selectedSpecialization === "vampire" && (stolenUl.vampire_siphon ?? 0) > 0) {
        this.time.delayedCall(800, () => {
          if (this.bossActive && core.active) this.castBossVampireSiphon(core);
        });
      }
    }

    // === 阶段 4：狂暴期间主 boss 也加快节奏 + 附加黑暗效果 ===
    const isEnraged = this.darkAircraftEnraged && time < this.darkAircraftEnrageUntil;
    const baseCooldown = isEnraged
      ? (this.bossElite ? 820 : 1080) * 0.7
      : this.bossElite
        ? 820
        : 1080;

    if (time >= this.nextBossMinionSummon) {
      this.startBossAttackType("dark_deity:portal", () => {
        this.shadowPortalAttack(core);
      });
      this.nextBossMinionSummon = time + (this.bossElite ? 5600 : 7000);
      this.showBanner("黑暗魔神 · 召唤首领印记增援", 900);
    }
    if (time < this.nextBossAttack) return;
    const attacks: Array<{ type: string; run: () => void }> = [
      { type: "barrage", run: () => this.darkDeityBarrage(core) },
      { type: "storm", run: () => this.darkDeityStorm(core) },
      { type: "delayed", run: () => this.shadowDelayedExplosion(false) },
      { type: "charge", run: () => this.shadowChargeAttack(core) },
      { type: "drain", run: () => this.shadowDrainWave(core, false) },
      { type: "cage", run: () => this.shadowCage(core, false) },
      { type: "maw", run: () => this.shadowHomingMaw(core, false) },
      // 最终 boss 会释放全部 Boss 的技能,但不会模仿玩家的技能(mirror 融合时排除 copy_*)
      { type: "fused_titan", run: () => {
        this.floatText(core.x, core.y + 90, "融合 · 裂渊泰坦", true);
        this.executeBossKindAttack(core, "titan");
      }},
      { type: "fused_mirror", run: () => {
        this.floatText(core.x, core.y + 90, "融合 · 镜像猎手(不模仿玩家)", true);
        this.executeBossKindAttack(core, "mirror", true);
      }},
      { type: "fused_usurper", run: () => {
        this.floatText(core.x, core.y + 90, "融合 · 技能篡夺者", true);
        this.executeBossKindAttack(core, "usurper");
      }}
    ];
    let index = Phaser.Math.Between(0, attacks.length - 1);
    if (index === this.bossAttackIndex) index = (index + 1) % attacks.length;
    this.bossAttackIndex = index;
    const attack = attacks[index];
    this.startBossAttackType(`dark_deity:${attack.type}`, () => {
      attack.run();
    });
    this.castBorrowedBossMutation(core);
    if (isEnraged) this.applyDarkDot(this.stats.maxHp * 0.03, 3, "狂暴黑暗侵蚀");
    this.nextBossAttack = time + baseCooldown;
    // 持续更新狂暴时间
    if (isEnraged) this.darkAircraftEnrageUntil = Math.max(this.darkAircraftEnrageUntil, time + 1500);
  }

  triggerDarkAircraftEnrage(): void {
    if (this.darkAircraftEnraged && this.time.now < this.darkAircraftEnrageUntil) return;
    this.darkAircraftEnraged = true;
    this.darkAircraftEnrageUntil = this.time.now + 8000;
    this.showBanner("◆ 黑暗能力泄露 · 狂暴模式启动 · 攻速+30%", 1500);
    if (save.settings.screenShake) this.cameras.main.shake(260, 0.012);
    this.burst(this.player.x, this.player.y, 0xff2244, 2.0);
  }

  // === 黑暗飞机 AI:4 个技能轮换 + 隐身 + 影分身 ===
  updateDarkAircraft(time: number): void {
    const ac = this.darkAircraft;
    if (!ac || !ac.active) return;
    // 移动逻辑：水平 sine 漂移
    ac.x = WORLD_WIDTH / 2 + Math.sin(this.hostileMotionTime(time) * 0.0014) * 200;
    ac.y = Phaser.Math.Linear(ac.y, 260, 0.02);

    // 常态始终是 Boss 级可见实体；只有主动释放“隐身突袭”时短暂不可命中。
    const stealthing = ac.getData("stealthing") === true;
    ac.setAlpha(stealthing ? 0.18 : 1);
    ac.setData("hittable", !stealthing);

    // 4 个技能轮换
    if (time < this.darkAircraftNextAttack) return;
    const attackRoll = Phaser.Math.Between(0, 3);
    const isEnraged = this.darkAircraftEnraged && time < this.darkAircraftEnrageUntil;
    const speedMult = isEnraged ? 0.7 : 1.0;
    if (attackRoll === 0) {
      this.startBossAttackType("dark_aircraft:firework", () => {
        this.darkAircraftFirework(ac);
      });
    } else if (attackRoll === 1) {
      this.startBossAttackType("dark_aircraft:clone", () => {
        this.darkAircraftClone(ac);
      });
    } else if (attackRoll === 2) {
      this.startBossAttackType("dark_aircraft:missile", () => {
        this.darkAircraftMissile(ac);
      });
    } else {
      this.startBossAttackType("dark_aircraft:stealth", () => {
        this.darkAircraftStealth(ac);
      });
    }
    this.darkAircraftNextAttack = time + 1800 * speedMult;
  }

  // 技能 0:普通攻击 - 烟花式散射
  darkAircraftFirework(ac: Phaser.Physics.Arcade.Image): void {
    this.showBanner("◆ 黑暗僚机 · 烟花散射", 700);
    const baseAngle = Math.atan2(this.player.y - ac.y, this.player.x - ac.x);
    const arms = 8;
    const ringWaves = this.darkAircraftEnraged ? 4 : 3;
    for (let w = 0; w < ringWaves; w += 1) {
      this.time.delayedCall(w * 160, () => {
        if (!ac.active) return;
        for (let i = 0; i < arms; i += 1) {
          const angle = baseAngle + (Math.PI * 2 * i) / arms + w * 0.2;
          const bullet = this.fireEnemyAngle(
            ac.x,
            ac.y + 20,
            angle,
            250 + w * 20,
            1,
            "projectile",
            "boss"
          );
          bullet
            .setTint(0xff3da6)
            .setScale(1.0 + w * 0.08)
            .setData("darkFlat", 140)
            .setData("darkDotRatio", 0.05);
        }
        this.burst(ac.x, ac.y + 20, 0xff3da6, 0.7);
      });
    }
  }

  // 技能 1:影分身 - 幻化 3 个并排小飞机,打中扣 3 倍血
  darkAircraftClone(ac: Phaser.Physics.Arcade.Image): void {
    this.showBanner("◆ 黑暗影分身 · 真假难辨", 900);
    // 清除旧分身
    this.darkAircraftClones.forEach((c) => c.active && c.disableBody(true, true));
    this.darkAircraftClones = [];
    const cx = ac.x;
    const cy = ac.y;
    // 闪烁 3 个
    for (let i = 0; i < 3; i += 1) {
      this.time.delayedCall(i * 80, () => {
        if (!ac.active) return;
        this.renderBossSkillImpact(
          "dark_aircraft",
          "clone",
          cx + (i - 1) * 90,
          cy,
          170,
          660
        );
        // 影分身与黑暗飞机同素材、按比例缩放(430×645 的约 0.55 倍),明确可见可命中
        const c = this.bossParts
          .create(cx + (i - 1) * 90, cy, "bossShadowComplete")
          .setDepth(30)
          .setDisplaySize(240, 360)
          .setActive(true)
          .setVisible(true)
          .setAlpha(1)
          .setData("part", "dark-aircraft-clone")
          .setData("linkedTo", ac)
          .setData("hittable", true);
        this.physics.world.enable(c);
        (c as Phaser.Physics.Arcade.Image).body!.setSize(160, 240, true);
        this.darkAircraftClones.push(c as Phaser.Physics.Arcade.Image);
        this.burst(cx + (i - 1) * 90, cy, 0x7a18cf, 0.6);
      });
    }
    // 1.6s 后合并(给玩家时间打)
    this.time.delayedCall(1600, () => {
      this.darkAircraftClones.forEach((c) => c.active && c.disableBody(true, true));
      this.darkAircraftClones = [];
      this.burst(ac.x, ac.y, 0x7a18cf, 1.0);
    });
  }

  // 技能 2:烟花黑暗导弹 - 10 颗依次发射,弱跟踪,右移可躲
  darkAircraftMissile(ac: Phaser.Physics.Arcade.Image): void {
    this.showBanner("◆ 烟花黑暗导弹 · 散射追踪", 800);
    const count = 10;
    const armDelay = 180;
    for (let i = 0; i < count; i += 1) {
      this.time.delayedCall(i * armDelay, () => {
        if (!ac.active) return;
        if (i % 3 === 0) {
          this.renderBossSkillImpact("dark_aircraft", "missile", ac.x, ac.y + 30, 210, 620);
        }
        // 弱跟踪:朝向玩家方向加 5% 偏转
        const angle = Math.atan2(this.player.y - ac.y, this.player.x - ac.x) + Phaser.Math.FloatBetween(-0.25, 0.25);
        const missile = this.fireEnemyAngle(
          ac.x + Phaser.Math.Between(-25, 25),
          ac.y + 30,
          angle,
          280,
          1,
          "projectile",
          "boss"
        );
        missile
          .setTint(0xffa022)
          .setScale(1.15)
          .setData("darkFlat", 160)
          .setData("darkDotRatio", 0.06)
          .setData("weakHoming", true);
        this.burst(ac.x, ac.y + 30, 0xffa022, 0.5);
      });
    }
  }

  // 技能 3:隐身 - 藏匿于黑暗,每次攻击前显现一会儿
  darkAircraftStealth(ac: Phaser.Physics.Arcade.Image): void {
    this.showBanner("◆ 黑暗僚机 · 隐身突袭", 700);
    // 短暂隐身 200ms，随后完整显现并保持可命中。
    ac.setData("stealthing", true).setData("hittable", false).setAlpha(0.18);
    this.time.delayedCall(200, () => {
      if (!ac.active) return;
      ac.setData("stealthing", false).setData("hittable", true).setAlpha(1);
      this.burst(ac.x, ac.y, 0xff2d8f, 0.9);
      // 显现时放一道横向爪刀
      this.time.delayedCall(250, () => {
        if (!ac.active) return;
        const damageWidth = 190;
        this.renderBossSkillArea(
          "dark_aircraft",
          "stealth",
          this.player.x,
          WORLD_HEIGHT / 2,
          damageWidth,
          WORLD_HEIGHT,
          820
        );
        const beam = this.add
          .rectangle(this.player.x, WORLD_HEIGHT / 2, damageWidth, WORLD_HEIGHT, 0x6c1a8f, 0.18)
          .setStrokeStyle(5, 0xff2d8f, 0.95)
          .setDepth(25);
        this.tweens.add({
          targets: beam,
          alpha: { from: 0.18, to: 0.78 },
          yoyo: true,
          repeat: 1,
          duration: 140,
          onComplete: () => {
            if (Math.abs(this.player.x - beam.x) < damageWidth / 2) {
              this.damagePlayerDark(0, 0.13, "黑暗爪刀");
              this.applyDarkDot(this.stats.maxHp * 0.04, 4, "爪刀侵蚀");
            }
            beam.destroy();
          }
        });
      });
    });
  }

  darkDeityBarrage(core: Phaser.Physics.Arcade.Image): void {
    const finalScale =
      isNineBattleMode()
        ? campaignFinalBossStatScale(this.campaignEncounterIndex)
        : 1;
    const count = Math.max(7, Math.round(19 * finalScale));
    const safeGap = Phaser.Math.Between(2, count - 3);
    for (let index = 0; index < count; index += 1) {
      if (Math.abs(index - safeGap) <= 2) continue;
      const angle = 0.08 + ((Math.PI - 0.16) * index) / (count - 1);
      this.fireEnemyAngle(
        core.x,
        core.y + 65,
        angle,
        310 * finalScale,
        1,
        "projectile",
        "boss"
      )
        .setTint(index % 3 === 0 ? 0xff7a22 : index % 2 ? 0x4cdfff : 0xc018ff)
        .setScale(1.3)
        .setData("darkFlat", 200)
        .setData("darkDotRatio", 0.15);
    }
  }

  darkDeityStorm(core: Phaser.Physics.Arcade.Image): void {
    this.darkStormUntil = this.time.now + 7000;
    this.nextDarkStormTick = this.time.now + 700;
    this.renderBossSkillImpact(
      "dark_deity",
      "storm",
      WORLD_WIDTH / 2,
      WORLD_HEIGHT * 0.42,
      570,
      7000,
      true
    );
    const storm = this.add
      .circle(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.42, 70, 0x09000f, 0.42)
      .setStrokeStyle(14, 0x9a18cf, 0.86)
      .setDepth(17);
    this.tweens.add({
      targets: storm,
      radius: 285,
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
        22 + this.bossTier * 1.5,
        "projectile",
        "boss"
      );
    }
    this.time.delayedCall(350, () => {
      if (!this.bossActive) return;
      for (let i = -4; i <= 4; i += 1) {
        if (i === -1 || i === 2) continue;
        this.fireEnemyAngle(
          core.x,
          core.y + 30,
          Math.PI / 2 + 0.06 + i * 0.14,
          270 + this.bossTier * 10,
          22 + this.bossTier * 1.5,
          "projectile",
          "boss"
        );
      }
    });
    if (Math.random() > 0.45) this.telegraphStrike(this.player.x);
  }

  // 独有招式：裂渊坍缩 - 玩家附近引力场，1.2s 后发射向心收缩弹幕
  titanGravityWell(core?: Phaser.Physics.Arcade.Image): void {
    const centerX = core ? core.x : this.player.x;
    const centerY = core ? core.y + 60 : this.player.y - 80;
    const ring = this.add
      .circle(centerX, centerY, 100, 0x6c2fff, 0.05)
      .setStrokeStyle(8, 0xff3dbb, 0.85)
      .setDepth(15);
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.25, to: 0.6 },
      yoyo: false,
      duration: 1200,
      onComplete: () => {
        // Boss 已败时同样销毁预警环,避免视觉残留到下一场战斗
        if (!this.bossActive) {
          ring.destroy();
          return;
        }
        ring.destroy();
        this.renderBossSkillImpact("titan", "gravity", centerX, centerY, 200, 720, true);
        // 5 圈向心收缩弹幕，每圈间隔 200ms
        for (let wave = 0; wave < 5; wave += 1) {
          this.time.delayedCall(wave * 200, () => {
            if (!this.bossActive) return;
            const count = 18 + this.bossPhase * 2;
            const startRadius = 520;
            for (let i = 0; i < count; i += 1) {
              const angle = (Math.PI * 2 * i) / count;
              const bx = centerX + Math.cos(angle) * startRadius;
              const by = centerY + Math.sin(angle) * startRadius;
              const bullet = this.fireEnemyAngle(
                bx,
                by,
                Math.atan2(centerY - by, centerX - bx),
                260,
                18 + this.bossTier,
                "projectile",
                "boss"
              );
              bullet.setTint(0x6c2fff).setScale(1.05);
            }
          });
        }
        // 中央爆炸
        const blast = this.add
          .circle(centerX, centerY, 60, 0xff3dbb, 0.6)
          .setStrokeStyle(10, 0x6c2fff, 0.9)
          .setDepth(24);
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, centerX, centerY) < 100) {
          this.damageBossHazard(40, "explosion");
        }
        this.tweens.add({ targets: blast, scale: 1.6, alpha: 0, duration: 380, onComplete: () => blast.destroy() });
      }
    });
  }

  titanMeteorField(core?: Phaser.Physics.Arcade.Image): void {
    const count = 6 + this.bossPhase * 2;
    // 共同战时陨石以 core 位置为锚点向外扩散；单 boss 模式保持原全屏随机
    const centerX = core ? core.x : WORLD_WIDTH / 2;
    const centerY = core ? core.y : WORLD_HEIGHT * 0.45;
    const impactPoints = Array.from({ length: count }, () => {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(120, 320);
      return {
        x: Phaser.Math.Clamp(centerX + Math.cos(angle) * distance, 110, WORLD_WIDTH - 110),
        y: Phaser.Math.Clamp(centerY + Math.sin(angle) * distance, 340, WORLD_HEIGHT - 130)
      };
    });
    impactPoints.forEach((point, index) => {
      const delay = index * 45;
      const warning = this.add
        .circle(point.x, point.y, 80, 0xff4d6d, 0.09)
        .setStrokeStyle(8, 0xffbd3e, 0.98)
        .setDepth(15);
      // 坠落陨石:从屏幕上方坠向落点(带火尾),与预警同步,让陨石攻击一目了然
      const meteor = this.add
        .circle(point.x, -90 - index * 55, 12, 0xffc46b, 0.95)
        .setStrokeStyle(4, 0xff5a3d, 1)
        .setDepth(22)
        .setBlendMode(Phaser.BlendModes.ADD);
      const meteorTail = this.add
        .circle(point.x, -90 - index * 55 - 18, 7, 0xff8a3d, 0.5)
        .setDepth(21)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: [meteor, meteorTail],
        y: point.y,
        duration: 1520,
        ease: "Quad.easeIn",
        delay
      });
      this.tweens.add({ targets: meteorTail, scaleY: 2.6, yoyo: true, repeat: 3, duration: 180, delay });
      this.tweens.add({
        targets: warning,
        scale: { from: 0.35, to: 1 },
        // 预警由浅到深:最深处才释放陨石坠落
        alpha: { from: 0.2, to: 0.9 },
        duration: 1520,
        ease: "Quad.easeIn",
        delay,
        onComplete: () => {
          warning.destroy();
          meteor.destroy();
          meteorTail.destroy();
          if (!this.bossActive) return;
          this.renderBossSkillImpact("titan", "meteor", point.x, point.y, 160, 680, true);
          // 命中大爆炸:白核/火球/冲击波/碎片,让陨石落地更有冲击力
          this.spawnDroneExplosionFx(point.x, point.y);
          const impact = this.add.circle(point.x, point.y, 82, 0xff5a3d, 0.76).setDepth(23);
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) < 80) {
            this.damageBossHazard(38, "explosion");
          }
          this.burst(point.x, point.y, 0xffbd3e, 1.4);
          this.tweens.add({ targets: impact, scale: 1.5, alpha: 0, duration: 340, onComplete: () => impact.destroy() });
        }
      });
    });
  }

  titanLaneSweep(core?: Phaser.Physics.Arcade.Image): void {
    // 共同战时只在 core 所在一侧的半屏发预警；单 boss 模式全屏
    if (core) {
      const laneWidth = WORLD_WIDTH / 4;
      const baseX = core.x < WORLD_WIDTH / 2 ? WORLD_WIDTH / 4 : WORLD_WIDTH * 0.75;
      const safeLanes = [Phaser.Math.Between(0, 3), (Phaser.Math.Between(0, 3) + 1) % 4];
      for (let lane = 0; lane < 4; lane += 1) {
        if (safeLanes.includes(lane)) continue;
        const x = baseX + (lane - 1.5) * laneWidth;
        this.addLaneTelegraph(x, 40, 0xff3dbb, 190, { kind: "titan", type: "lane" });
      }
    } else {
      // 8 车道 2 个安全格，预警 0.75s
      const safeA = Phaser.Math.Between(0, 7);
      const safeB = (safeA + Phaser.Math.Between(1, 6)) % 8;
      this.telegraphBossLanes(
        8,
        [safeA, safeB],
        40,
        0xff3dbb,
        190,
        { kind: "titan", type: "lane" }
      );
    }
  }

  addLaneTelegraph(
    x: number,
    damage: number,
    color: number,
    duration = 130,
    skillFx?: { kind: BossKind; type: string }
  ): void {
    const width = WORLD_WIDTH / 4;
    const damageWidth = width - 18;
    const warning = this.trackBossEffect(this.add
      .rectangle(x, WORLD_HEIGHT / 2, damageWidth, WORLD_HEIGHT, color, 0.08)
      .setStrokeStyle(8, color, 0.98)
      .setDepth(12), 2200);
    this.tweens.add({
      targets: warning,
      alpha: { from: 0.18, to: 0.7 },
      yoyo: true,
      repeat: 3,
      duration,
      onComplete: () => {
        if (!this.bossActive) return;
        if (skillFx) {
          this.renderBossSkillArea(
            skillFx.kind,
            skillFx.type,
            x,
            WORLD_HEIGHT / 2,
            damageWidth,
            WORLD_HEIGHT,
            680
          );
        }
        if (Math.abs(this.player.x - x) < damageWidth / 2) {
          this.damageBossHazard(damage, "explosion");
        }
        warning.destroy();
      }
    });
  }

  mirrorSpecializationAttack(core: Phaser.Physics.Arcade.Image): void {
    const specialization = save.selectedSpecialization;
    const names: Record<SpecializationId, string> = {
      power: "力量流派 · 龙息喷火",
      agile: "敏捷流派 · 影步突刺",
      defender: "防御流派 · 反射壁垒",
      vampire: "吸血流派 · 虹吸夺取",
      devour: "吞噬流派 · 深渊巨口",
      wheelchair: "撞击流派 · 破阵冲角"
    };
    this.showBanner(`镜像模仿 G · ${names[specialization]}`, 1000);
    if (specialization === "power") {
      this.mirrorFlamethrowerAttack(core);
    } else if (specialization === "agile") {
      this.mirrorDashMimic(core, 0x9b5cff, 24, "影步突刺");
    } else if (specialization === "defender") {
      // 玩家技能的"范围加强、伤害降低、弹速较慢"版:反射壁垒半径 120→150,
      // 弹幕伤害降低,弹速 235→190
      const shield = this.trackBossEffect(
        this.add.circle(core.x, core.y, 150, 0x6f5cff, 0.12)
          .setStrokeStyle(9, 0xe8deff, 0.9)
          .setDepth(22),
        1400
      );
      for (let index = 0; index < 20; index += 1) {
        const angle = (Math.PI * 2 * index) / 20;
        this.fireEnemyAngle(core.x, core.y, angle, 190, 10 + this.bossTier * 0.6, "projectile", "boss")
          .setTint(index % 2 ? 0x9b5cff : 0xe8deff);
      }
      this.tweens.add({ targets: shield, scale: 1.35, alpha: 0, duration: 850, onComplete: () => shield.destroy() });
    } else if (specialization === "vampire") {
      // 玩家技能的"范围加强、伤害降低"版:虹吸线束加粗,吸取伤害 26→20
      const beam = this.trackBossEffect(
        this.add.line(0, 0, core.x, core.y, this.player.x, this.player.y, 0xff2d77, 0.72)
          .setLineWidth(20, 6)
          .setDepth(23),
        1100
      );
      this.damageBossHazard(20, "projectile");
      if (core.getData("part") === "raid-core") {
        const coreMaxHp = Math.max(1, Number(core.getData("maxHp") ?? 1));
        core.setData(
          "hp",
          Math.min(coreMaxHp, Number(core.getData("hp") ?? 0) + coreMaxHp * 0.02)
        );
        this.bossHp = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[])
          .filter((part) => part.getData("part") === "raid-core")
          .reduce((sum, part) => sum + Math.max(0, Number(part.getData("hp") ?? 0)), 0);
      } else {
        this.bossHp = Math.min(this.bossMaxHp, this.bossHp + this.bossMaxHp * 0.02);
      }
      this.tweens.add({ targets: beam, alpha: 0, duration: 620, onComplete: () => beam.destroy() });
    } else if (specialization === "devour") {
      const x = this.player.x;
      const y = this.player.y;
      // 玩家技能的"范围加强、伤害降低"版:深渊巨口半径 170→210,撕咬伤害降低
      const maw = this.trackBossEffect(
        this.add.circle(x, y, 210, 0x180020, 0.22)
          .setStrokeStyle(11, 0xb51cff, 0.94)
          .setDepth(20),
        1800
      );
      this.tweens.add({
        targets: maw,
        scale: { from: 0.72, to: 1 },
        alpha: { from: 0.18, to: 0.62 },
        yoyo: true,
        repeat: 2,
        duration: 190,
        onComplete: () => {
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= 210) {
            this.damageBossHazard(26, "explosion");
          }
          maw.destroy();
        }
      });
    } else {
      this.mirrorDashMimic(core, 0xffbd3e, 28, "破阵冲角");
    }
  }

  mirrorLoadoutSkill(core: Phaser.Physics.Arcade.Image, slot: 1 | 2 | 3): void {
    const level = Math.max(
      1,
      slot === 1
        ? this.upgradeLevels.laser ?? 1
        : slot === 2
          ? this.upgradeLevels.missile ?? 1
          : this.upgradeLevels.drone ?? 1
    );
    if (slot === 1) {
      this.showBanner(`镜像模仿 1 · 极光贯穿 Lv.${level}`, 850);
      const laneX = Phaser.Math.Clamp(this.player.x, 70, WORLD_WIDTH - 70);
      // 玩家技能的"范围加强、伤害降低"版:激光道宽 84→150,伤害 32→24
      this.telegraphStrike(laneX, 155, { kind: "mirror", type: "copy_1" }, 150, 24);
      if (level >= 3) {
        this.time.delayedCall(180, () => {
          if (this.bossActive) this.telegraphStrike(
            Phaser.Math.Clamp(laneX + (laneX < WORLD_WIDTH / 2 ? 130 : -130), 70, WORLD_WIDTH - 70),
            155,
            { kind: "mirror", type: "copy_1" },
            150,
            24
          );
        });
      }
    } else if (slot === 2) {
      this.showBanner(`镜像模仿 2 · 追踪导弹 Lv.${level}`, 850);
      // 玩家技能的"范围加强、伤害降低、弹速较慢"版:弹数 8+2L 更多、散布更宽,
      // 单发伤害降低,弹速 185→140 / 追踪速度 255→205
      this.bossHomingSwarm(core, 8 + level * 2, 0xff7a32, 10 + this.bossTier * 0.6, 0.2, 140, 205);
    } else {
      this.showBanner(`镜像模仿 3 · 护航无人机 Lv.${level}`, 850);
      const waves = Math.min(4, 2 + level);
      for (let wave = 0; wave < waves; wave += 1) {
        this.time.delayedCall(wave * 240, () => {
          if (!this.bossActive || !core.active) return;
          // 玩家技能的"范围加强、伤害降低、弹速较慢"版:每侧 5 条更宽的散射,
          // 单发伤害降低,弹速 230+12L → 185+10L
          for (const side of [-1, 1]) {
            for (let offset = -2; offset <= 2; offset += 1) {
              this.fireEnemyAngle(
                core.x + side * 105,
                core.y + 28,
                Math.PI / 2 + offset * 0.18,
                185 + level * 10,
                9 + level * 2,
                "projectile",
                "boss"
              ).setTint(side < 0 ? 0x2df4ff : 0x9b5cff);
            }
          }
        });
      }
    }
  }

  mirrorDashMimic(
    core: Phaser.Physics.Arcade.Image,
    color: number,
    damage: number,
    label: string
  ): void {
    const startX = core.x;
    const startY = core.y;
    const targetX = this.player.x;
    const targetY = this.player.y;
    // 玩家技能的"范围加强、伤害降低"版:冲击线宽 52→72,判定范围同步加宽
    const line = this.trackBossEffect(
      this.add.line(0, 0, startX, startY, targetX, targetY, color, 0.22)
        .setLineWidth(72, 12)
        .setDepth(17),
      1800
    );
    this.tweens.add({
      targets: line,
      alpha: { from: 0.16, to: 0.68 },
      yoyo: true,
      repeat: 2,
      duration: 170,
      onComplete: () => {
        const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
        const nearestPoint = Phaser.Geom.Line.GetNearestPoint(
          new Phaser.Geom.Line(startX, startY, targetX, targetY),
          new Phaser.Math.Vector2(this.player.x, this.player.y)
        );
        const distanceToLine = Phaser.Math.Distance.Between(
          nearestPoint.x,
          nearestPoint.y,
          this.player.x,
          this.player.y
        );
        if (distance > 0 && distanceToLine <= 72) this.damageBossHazard(damage, "collision");
        this.showBanner(`镜像 ${label} · 冲击完成`, 520);
        line.destroy();
      }
    });
  }

  mirrorFlamethrowerAttack(core: Phaser.Physics.Arcade.Image): void {
    const originX = core.x;
    const originY = core.y + Math.max(46, core.displayHeight * 0.2);
    const length = Math.min(WORLD_HEIGHT - originY + 120, 920 + this.bossPhase * 70);
    // 玩家技能的"范围加强、伤害降低"版:火锥宽 650→780,单次完整命中占比 36%(原 28%,已提高)
    const width = 780 + this.bossPhase * 60;
    // 喷火预警:一整块矩形覆盖喷火锥最大范围(喷火口到末端),整块由浅到深,不再叠加推进横线
    const warningRect = this.trackBossEffect(
      this.add
        .rectangle(originX, originY + length / 2, width, length, 0xff5a18, 0.12)
        .setStrokeStyle(6, 0xffd15a, 0.95)
        .setDepth(16),
      3400
    );
    const warningGroup: Phaser.GameObjects.GameObject[] = [warningRect];
    this.showBanner("镜像强化龙息 · 三重喷流 · 金色矩形内为危险范围", 1050);
    this.tweens.add({
      targets: warningGroup,
      // 预警由浅到深:最深处才释放三重喷流
      alpha: { from: 0.35, to: 0.95 },
      duration: 1520,
      ease: "Quad.easeIn",
      onComplete: () => {
        warningGroup.forEach((obj) => obj.destroy());
        if (!this.bossActive || !core.active) return;
        const outer = this.spawnAnimatedVfx(
          "flamethrowerFx",
          originX,
          originY + length * 0.5,
          0,
          1250,
          { width: width * 1.08, height: length * 1.05 },
          true,
          21,
          0.72
        );
        if (outer) outer.setFlipY(true);
        [-0.22, 0, 0.22].forEach((offset, index) => {
          const streamWidth = width * 0.46;
          const stream = this.spawnAnimatedVfx(
            "flamethrowerFx",
            originX + offset * width,
            originY + length * 0.52,
            index % 4,
            1250,
            { width: streamWidth, height: length },
            true,
            22 + index,
            index === 1 ? 0.88 : 0.68
          );
          if (stream) stream.setFlipY(true);
        });
        let playerHit = false;
        const insideVisibleCone = (): boolean => {
          const distance = this.player.y - originY;
          if (distance < 0 || distance > length) return false;
          const progress = Phaser.Math.Clamp(distance / length, 0, 1);
          const halfWidth = 46 + (width / 2 - 46) * progress;
          return Math.abs(this.player.x - originX) <= halfWidth;
        };
        for (const delay of [0, 300, 600, 900]) {
          this.time.delayedCall(delay, () => {
            if (playerHit || !this.bossActive || !insideVisibleCone()) return;
            playerHit = true;
            // 归一化遭遇倍率后,单次完整命中最多约 36% 最大生命;满血可连续承受两次多一点。
            const survivableRatio = 0.36 / Math.max(1, this.currentBossEncounterAttackScale());
            this.damagePlayerDark(0, survivableRatio, "镜像强化龙息");
          });
        }
      }
    });
  }

  mirrorPetalAttack(core: Phaser.Physics.Arcade.Image): void {
    const count = 20 + this.bossPhase * 3;
    const gapStart = Phaser.Math.Between(0, count - 1);
    for (let i = 0; i < count; i += 1) {
      const gapDistance = Math.min((i - gapStart + count) % count, (gapStart - i + count) % count);
      if (gapDistance <= 3) continue;
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

  mirrorLanceAttack(core?: Phaser.Physics.Arcade.Image): void {
    const laneWidth = WORLD_WIDTH / 8;
    const playerLane = Phaser.Math.Clamp(Math.floor(this.player.x / laneWidth), 1, 6);
    // 共同战时只在 core 所在半边（4 条车道）发预警；单 boss 全屏
    const usableLanes = core
      ? playerLane < 4
        ? [0, 1, 2, 3]
        : [4, 5, 6, 7]
      : [0, 1, 2, 3, 4, 5, 6, 7];
    // 危险车道从 3 减到 2，给玩家留出更多反应空间
    const dangerLanes = new Set<number>([
      playerLane,
      ...(usableLanes.includes((playerLane + 3) % 8) ? [(playerLane + 3) % 8] : [])
    ]);
    dangerLanes.forEach((lane) => {
      const laneX = laneWidth * (lane + 0.5);
      this.telegraphStrike(laneX, 200, { kind: "mirror", type: "lance" });
    });
  }

  bossHomingSwarm(
    core: Phaser.Physics.Arcade.Image,
    count: number,
    tint: number,
    damage = 16 + this.bossTier,
    spread = 0.16,
    speed = 185,
    homingSpeed = 255 + this.bossPhase * 15
  ): void {
    for (let i = 0; i < count; i += 1) {
      this.time.delayedCall(i * 75, () => {
        if (!this.bossActive || !core.active) return;
        const angle = Math.PI / 2 + (i - (count - 1) / 2) * spread;
        const bullet = this.fireEnemyAngle(
          core.x + (i - (count - 1) / 2) * 80,
          core.y + 30,
          angle,
          speed,
          damage,
          "projectile",
          "boss"
        );
        bullet
          .setTint(tint)
          .setScale(1.2)
          .setData("homingUntil", this.time.now + 1100)
          .setData("homingSpeed", homingSpeed);
      });
    }
  }

  usurperLaserGrid(core?: Phaser.Physics.Arcade.Image): void {
    if (core) {
      // 共同战时只在 core 所在半边 4 条车道发预警，2 个安全格
      const laneWidth = WORLD_WIDTH / 4;
      const baseX = core.x < WORLD_WIDTH / 2 ? WORLD_WIDTH / 4 : WORLD_WIDTH * 0.75;
      const safeA = Phaser.Math.Between(0, 2);
      const safeB = (safeA + Phaser.Math.Between(1, 2)) % 4;
      for (let lane = 0; lane < 4; lane += 1) {
        if (lane === safeA || lane === safeB) continue;
        const x = baseX + (lane - 1.5) * laneWidth;
        this.addLaneTelegraph(x, 46, 0xffbd3e, 210, { kind: "usurper", type: "grid" });
      }
    } else {
      // 8 车道 3 个安全格（5 个危险），预警 0.85s
      const safeA = Phaser.Math.Between(0, 7);
      const safeB = (safeA + Phaser.Math.Between(1, 7)) % 8;
      const safeC = (safeA + Phaser.Math.Between(2, 6)) % 8;
      this.telegraphBossLanes(
        8,
        [safeA, safeB, safeC],
        46,
        0xffbd3e,
        210,
        { kind: "usurper", type: "grid" }
      );
    }
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
      duration: 190,
      onComplete: () => {
        warning.destroy();
        if (!this.bossActive || !core.active) return;
        this.renderBossSkillImpact("usurper", "emp", core.x, core.y, radius * 2, 780, true);
        const shock = this.add
          .circle(core.x, core.y, radius, 0xffbd3e, 0.36)
          .setStrokeStyle(12, 0x9b5cff, 0.9)
          .setDepth(24);
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, core.x, core.y) < radius) {
          this.damageBossHazard(52, "explosion");
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

  // 偷取期内发射被偷技能（同款弹道，方向从 core 朝玩家）
  castStolenSkill(core: Phaser.Physics.Arcade.Image): void {
    const stolen = this.usurperStolenSkill;
    if (!stolen) return;
    if (this.time.now >= this.usurperStolenUntil) {
      this.showBanner("◆ 技能篡夺结束 · 玩家能力已归还", 1000);
      this.usurperStolenSkill = null;
      this.usurperStolenUntil = 0;
      return;
    }
    const aimX = this.player.x;
    const aimY = this.player.y;
    const angle = Math.atan2(aimY - core.y, aimX - core.x);
    if (stolen === "laser") {
      // 玩家技能的"范围加强、伤害降低、弹速较慢"版:7 束更宽散射,
      // 单束伤害降低,弹速 560→420
      for (let i = -3; i <= 3; i += 1) {
        const beam = this.fireEnemyAngle(
          core.x + i * 22,
          core.y + 18,
          angle + i * 0.09,
          420,
          10 + this.bossTier * 0.6,
          "projectile",
          "boss"
        );
        beam.setTint(0x6c2fff);
      }
    } else if (stolen === "missile") {
      // 玩家技能的"范围加强、伤害降低、弹速较慢"版:7 枚更宽散布,
      // 单发伤害降低,弹速 380→300
      for (let i = 0; i < 7; i += 1) {
        const missile = this.fireEnemyAngle(
          core.x + Phaser.Math.Between(-36, 36),
          core.y + 12,
          angle + Phaser.Math.FloatBetween(-0.22, 0.22),
          300,
          12 + this.bossTier * 0.6,
          "projectile",
          "boss"
        );
        missile.setTint(0x9b5cff);
      }
    } else if (stolen === "drone") {
      // 玩家技能的"范围加强、伤害降低、弹速较慢"版:6 架更宽散射,
      // 单发伤害降低,弹速 230→185
      for (let i = 0; i < 6; i += 1) {
        const drone = this.fireEnemyAngle(
          core.x,
          core.y - 20,
          Math.PI / 2 + i * 0.26,
          185,
          9 + this.bossTier * 0.6,
          "projectile",
          "boss"
        );
        drone.setTint(0xb15cff);
      }
    } else if (stolen === "emp") {
      // 玩家技能的"范围加强、伤害降低"版:EMP 半径 220→300,伤害 30→22
      const radius = 300;
      const blast = this.add.circle(core.x, core.y, radius, 0x6c2fff, 0.42).setStrokeStyle(8, 0x9b5cff, 0.9).setDepth(24);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, core.x, core.y) < radius) {
        this.damageBossHazard(22, "explosion");
      }
      this.tweens.add({ targets: blast, scale: 1.3, alpha: 0, duration: 320, onComplete: () => blast.destroy() });
    } else if (stolen === "agile_fusion") {
      // 篡夺的万象影袭:放大范围、削弱伤害、花哨光影(5 道突刺扫掠)
      this.castBossAgileFusion(core);
    } else if (stolen === "agile_clone") {
      // 篡夺的影分身:4 个紫色影分身散射削弱弹幕
      this.castBossAgileClones(core);
    } else if (stolen === "defender_counter") {
      // 篡夺的荆棘反击:玩家攻击 Boss 时按比例反弹伤害
      this.castBossDefenderCounter(core);
    } else if (stolen === "vampire_siphon") {
      // 篡夺的虹吸链:持续抽取玩家生命并回复 Boss
      this.castBossVampireSiphon(core);
    }
  }

  // Boss 版万象影袭:玩家融合技被篡夺/夺取后,Boss 以放大范围、削弱伤害、花哨光影的形式释放
  castBossAgileFusion(core: Phaser.Physics.Arcade.Image): void {
    const aimX = this.player.x;
    const aimY = this.player.y;
    const angle = Math.atan2(aimY - core.y, aimX - core.x);
    const sweepCount = 5;
    const sweepLength = 980;
    const hitHalfWidth = 115;
    let playerHit = false;
    // 花哨:核心紫色爆发 + 突刺残影
    this.burst(core.x, core.y, 0x9b5cff, 2.4);
    for (let i = 0; i < sweepCount; i += 1) {
      const offset = (i - (sweepCount - 1) / 2) * 100;
      const perpX = Math.cos(angle + Math.PI / 2);
      const perpY = Math.sin(angle + Math.PI / 2);
      const startX = core.x + perpX * offset;
      const startY = core.y + perpY * offset;
      const endX = startX + Math.cos(angle) * sweepLength;
      const endY = startY + Math.sin(angle) * sweepLength;
      // 放大版突刺扫掠:紫色光影带由浅到深,与命中判定走廊一致
      const band = this.trackBossEffect(
        this.add
          .line(0, 0, startX, startY, endX, endY, 0x9b5cff, 0)
          .setOrigin(0)
          .setLineWidth(42, 10)
          .setDepth(24),
        1700
      );
      this.tweens.add({
        targets: band,
        alpha: { from: 0, to: 0.92 },
        duration: 460,
        ease: "Quad.easeIn",
        delay: i * 70,
        onComplete: () => {
          band.destroy();
          if (!this.bossActive || playerHit) return;
          // 命中判定:玩家在扫掠走廊内
          const lineDX = endX - startX;
          const lineDY = endY - startY;
          const lineLen = Math.hypot(lineDX, lineDY) || 1;
          const px = this.player.x - startX;
          const py = this.player.y - startY;
          const along = (px * lineDX + py * lineDY) / (lineLen * lineLen);
          const perp = Math.abs(px * lineDY - py * lineDX) / lineLen;
          if (along >= -0.05 && along <= 1.05 && perp < hitHalfWidth) {
            playerHit = true;
            // 削弱版伤害:单次完整命中约 10% 最大生命(玩家版被命中则更痛)
            const survivableRatio = 0.1 / Math.max(1, this.currentBossEncounterAttackScale());
            this.damagePlayerDark(0, survivableRatio, "篡夺万象影袭");
            this.showBanner("◆ 万象影袭被敌方夺取 · 突刺扫掠", 700);
          }
          // 清除扫掠路径上的玩家子弹(Boss 用玩家的技能反制玩家火力)
          this.playerBullets.children.each((child) => {
            const bullet = child as Phaser.Physics.Arcade.Image;
            if (!bullet.active) return true;
            const bx = bullet.x - startX;
            const by = bullet.y - startY;
            const bAlong = (bx * lineDX + by * lineDY) / (lineLen * lineLen);
            const bPerp = Math.abs(bx * lineDY - by * lineDX) / lineLen;
            if (bAlong >= 0 && bAlong <= 1 && bPerp < hitHalfWidth + 8) {
              bullet.disableBody(true, true);
              this.burst(bullet.x, bullet.y, 0x9b5cff, 0.8);
            }
            return true;
          });
          this.impactBurst(startX, startY, 0x9b5cff);
        }
      });
    }
  }

  // Boss 版影分身:敏捷影分身被篡夺/夺取后,召唤 4 个紫色影分身向玩家散射削弱弹幕
  castBossAgileClones(core: Phaser.Physics.Arcade.Image): void {
    const cloneCount = 4;
    const clones: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < cloneCount; i += 1) {
      const angle = -Math.PI / 2 + (i / (cloneCount - 1)) * Math.PI;
      const clone = this.add
        .image(core.x + Math.cos(angle) * 130, core.y + Math.sin(angle) * 130, "bossShadow")
        .setDisplaySize(120, 180)
        .setTint(0x9b5cff)
        .setAlpha(0.85)
        .setDepth(20);
      clones.push(clone);
    }
    let shot = 0;
    const interval = this.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => {
        shot += 1;
        if (shot > 11) {
          interval.remove(false);
          clones.forEach((c) => {
            if (c.active) {
              this.burst(c.x, c.y, 0x9b5cff, 1.0);
              c.destroy();
            }
          });
          return;
        }
        clones.forEach((clone) => {
          if (!clone.active) return;
          const angleToPlayer = Phaser.Math.Angle.Between(clone.x, clone.y, this.player.x, this.player.y);
          for (const spread of [-0.12, 0.12]) {
            this.fireEnemyAngle(
              clone.x,
              clone.y,
              angleToPlayer + spread,
              300,
              8 + this.bossTier * 0.4,
              "projectile",
              "boss"
            ).setTint(0x9b5cff);
          }
          // 花哨:紫色残影
          const echo = this.add
            .image(clone.x, clone.y, "bossShadow")
            .setDisplaySize(120, 180)
            .setTint(0x5b18aa)
            .setAlpha(0.35)
            .setDepth(19);
          this.tweens.add({
            targets: echo,
            alpha: 0,
            y: echo.y + 40,
            duration: 320,
            onComplete: () => echo.destroy()
          });
        });
      }
    });
    this.showBanner("◆ 敌方影分身 · 紫色散射弹幕", 900);
  }

  // Boss 版荆棘反击:防御流派反击被篡夺/夺取后,玩家攻击 Boss 时按比例反弹伤害(削弱版)
  castBossDefenderCounter(core: Phaser.Physics.Arcade.Image): void {
    const until = this.time.now + 8000;
    this.bossThornCounterUntil = Math.max(this.bossThornCounterUntil, until);
    // 放大版荆棘环(花哨)
    const ring = this.add
      .circle(core.x, core.y, 180, 0x9b5cff, 0.06)
      .setStrokeStyle(10, 0xc86cff, 0.9)
      .setDepth(20);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.6, to: 1.35 },
      alpha: { from: 0.5, to: 0.9 },
      yoyo: true,
      repeat: 5,
      duration: 700,
      onComplete: () => ring.destroy()
    });
    this.showBanner("◆ 敌方荆棘反伤 · 攻击即被反噬", 1000);
  }

  // Boss 版虹吸链:吸血流派虹吸被篡夺/夺取后,从玩家身上持续吸血(削弱伤害)并回复 Boss
  castBossVampireSiphon(core: Phaser.Physics.Arcade.Image): void {
    const chain = this.add
      .image(this.player.x, this.player.y, "siphonChainFx")
      .setOrigin(0.5)
      .setDepth(21)
      .setTint(0xff2d8f)
      .setAlpha(0.9);
    let tick = 0;
    const maxTicks = 6;
    const ticker = this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        tick += 1;
        if (tick > maxTicks || !this.bossActive || !core.active) {
          ticker.remove(false);
          chain.destroy();
          return;
        }
        const dx = core.x - this.player.x;
        const dy = core.y - this.player.y;
        chain.setPosition(this.player.x, this.player.y);
        chain.setRotation(Math.atan2(dy, dx));
        chain.setDisplaySize(Math.max(60, Math.hypot(dx, dy)), 26);
        // 吸取:每次 2.5% 最大生命(削弱版),Boss 回复一半
        this.damagePlayerDark(0, 0.025, "敌方虹吸");
        const heal = Math.max(6, Math.round(this.stats.maxHp * 0.0125));
        this.bossHp = Math.min(this.bossMaxHp, this.bossHp + heal);
        this.burst(this.player.x, this.player.y, 0xff2d8f, 0.9);
      }
    });
    this.showBanner("◆ 敌方虹吸链 · 生命被抽取", 1000);
  }

  // 独有招式：技能掠夺 - 0.5s 吸取环 → 随机偷 1 个玩家技能，5 秒内 usurper 会用同款
  usurperPowerDrain(core: Phaser.Physics.Arcade.Image): void {
    const targetX = this.player.x;
    const targetY = this.player.y - 40;
    const drain = this.add
      .circle(targetX, targetY, 70, 0x6c2fff, 0.08)
      .setStrokeStyle(6, 0x9b5cff, 0.9)
      .setDepth(18);
    this.tweens.add({
      targets: drain,
      scale: { from: 0.4, to: 1.4 },
      alpha: { from: 0.2, to: 0.55 },
      yoyo: true,
      repeat: 2,
      duration: 180,
      onComplete: () => {
        if (!this.bossActive || !core.active) {
          drain.destroy();
          return;
        }
        drain.destroy();
        this.renderBossSkillImpact("usurper", "drain", targetX, targetY, 310, 820);
        // 偷取玩家 1 个技能（随机）;按玩家流派与已解锁强化加入可被偷取的专属技能
        const pool: Array<
          | "laser"
          | "missile"
          | "drone"
          | "emp"
          | "agile_fusion"
          | "agile_clone"
          | "defender_counter"
          | "vampire_siphon"
        > = ["laser", "missile", "drone", "emp"];
        const ul = this.upgradeLevels;
        if (
          save.selectedSpecialization === "agile" &&
          (ul.agile_shadow_lunge ?? 0) > 0
        ) {
          pool.push("agile_fusion");
        }
        if (
          save.selectedSpecialization === "agile" &&
          (ul.agile_shadow_clone ?? 0) > 0
        ) {
          pool.push("agile_clone");
        }
        if (
          save.selectedSpecialization === "defender" &&
          (ul.defender_thorns ?? 0) > 0
        ) {
          pool.push("defender_counter");
        }
        if (
          save.selectedSpecialization === "vampire" &&
          (ul.vampire_siphon ?? 0) > 0
        ) {
          pool.push("vampire_siphon");
        }
        const stolen = Phaser.Utils.Array.GetRandom(pool);
        this.usurperStolenSkill = stolen;
        this.usurperStolenUntil = this.time.now + 5000;
        this.renderBossSkillImpact("usurper", "steal", targetX, targetY, 440, 980);
        const stolenNames: Record<typeof stolen, string> = {
          laser: "激光切割",
          missile: "导弹齐射",
          drone: "无人机过载",
          emp: "EMP",
          agile_fusion: "万象影袭",
          agile_clone: "影分身",
          defender_counter: "荆棘反击",
          vampire_siphon: "虹吸链"
        };
        this.showBanner(`◆ 技能篡夺 · 窃取「${stolenNames[stolen]}」持续 5 秒`, 1300);
        // 从 core 拉一条紫色光线表示"吸过来"
        this.burst(core.x, core.y, 0x9b5cff, 1.4);
        this.burst(targetX, targetY, 0xff3dbb, 1.2);
        if (save.settings.screenShake) this.cameras.main.shake(220, 0.006);
      }
    });
  }

  usurperDroneLattice(core?: Phaser.Physics.Arcade.Image): void {
    const columns = 10;
    const safeColumn = Phaser.Math.Between(1, columns - 3);
    // 共同战时只覆盖 core 所在半边 5 列
    const colOffset = core ? (core.x < WORLD_WIDTH / 2 ? 0 : 5) : 0;
    const colCount = core ? 5 : columns;
    for (let row = 0; row < 3; row += 1) {
      this.time.delayedCall(row * 260, () => {
        if (!this.bossActive) return;
        for (let column = 0; column < colCount; column += 1) {
          // 安全区保持 2 列(与注释一致):只跳过两列安全中心本身
          if (column === safeColumn || column === safeColumn + 1) continue;
          const bullet = this.fireEnemyAngle(
            ((column + colOffset + 0.5) / columns) * WORLD_WIDTH,
            110 + row * 42,
            Math.PI / 2,
            245 + row * 25,
            19 + this.bossTier,
            "projectile",
            "boss"
          );
          bullet.setTint(row % 2 ? 0xffbd3e : 0x9b5cff).setScale(1.15);
        }
      });
    }
  }

  telegraphBossLanes(
    laneCount: number,
    safeLanes: number[],
    damage: number,
    color: number,
    duration = 125,
    skillFx?: { kind: BossKind; type: string }
  ): void {
    const width = WORLD_WIDTH / laneCount;
    for (let lane = 0; lane < laneCount; lane += 1) {
      if (safeLanes.includes(lane)) continue;
      const x = width * (lane + 0.5);
      const damageWidth = width - 30;
      const warning = this.add
        .rectangle(x, WORLD_HEIGHT / 2, damageWidth, WORLD_HEIGHT, color, 0.08)
        .setStrokeStyle(8, color, 0.98)
        .setDepth(12);
      this.trackBossEffect(warning, 2600);
      this.tweens.add({
        targets: warning,
        // 预警由浅到深:整个预警期持续加深,最深处才释放攻击
        alpha: { from: 0.09, to: 0.9 },
        duration: duration * 8,
        ease: "Quad.easeIn",
        onComplete: () => {
          warning.destroy();
          if (!this.bossActive) return;
          if (skillFx) {
            this.renderBossSkillArea(
              skillFx.kind,
              skillFx.type,
              x,
              WORLD_HEIGHT / 2,
              damageWidth,
              WORLD_HEIGHT,
              680
            );
          }
          const beam = this.trackBossEffect(this.add
            .rectangle(x, WORLD_HEIGHT / 2, damageWidth, WORLD_HEIGHT, color, 0.68)
            .setDepth(22), 1200);
          if (Math.abs(this.player.x - x) < damageWidth / 2) {
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
    // 大型预警技能命中时不应被此前普通子弹残留的无敌帧吞掉,
    // 但玩家正处于主动技能无敌(突刺/万象影袭)期间时不穿透
    if (this.ultimateActive <= 0 && now >= this.activeInvulnerableUntil) {
      this.invulnerableUntil = Math.min(this.invulnerableUntil, now);
    }
    this.damagePlayer(amount, damageType, "boss");
  }

  telegraphStrike(
    x: number,
    duration = 110,
    skillFx?: { kind: BossKind; type: string },
    damageWidth = 84,
    damage = 32
  ): void {
    const warning = this.trackBossEffect(
      this.add.rectangle(x, WORLD_HEIGHT / 2, damageWidth, WORLD_HEIGHT, 0xff3dbb, 0.11).setDepth(6),
      2200
    );
    warning.setStrokeStyle(8, 0xff4d6d, 0.98);
    this.tweens.add({
      targets: warning,
      // 预警由浅到深:整个预警期持续加深,最深处才释放攻击
      alpha: { from: 0.15, to: 0.9 },
      duration: duration * 8,
      ease: "Quad.easeIn",
      onComplete: () => {
        warning.destroy();
        if (!this.bossActive) return;
        if (skillFx) {
          this.renderBossSkillArea(
            skillFx.kind,
            skillFx.type,
            x,
            WORLD_HEIGHT / 2,
            damageWidth,
            WORLD_HEIGHT,
            560
          );
        }
        const beam = this.trackBossEffect(
          this.add.rectangle(x, WORLD_HEIGHT / 2, damageWidth, WORLD_HEIGHT, 0xff3dbb, 0.74).setDepth(18),
          1200
        );
        if (Math.abs(this.player.x - x) < damageWidth / 2) this.damageBossHazard(damage, "explosion");
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

  playShadowPowerTheft(
    defeatedKind: BossKind,
    x: number,
    y: number
  ): void {
    const shadow = this.trackBossVisual(
      this.add
        .image(
          WORLD_WIDTH / 2,
          -340,
          shadowTextureForAbsorbedPowers(this.campaignBossesDefeated)
        )
        .setDisplaySize(260, 390)
        .setTint(0x9b5cff)
        .setAlpha(0.9)
        .setDepth(72)
    );
    const stolenCore = this.add
      .circle(x, y, 28, 0xffbd3e, 0.9)
      .setStrokeStyle(9, 0xff3dbb, 0.86)
      .setDepth(73);
    this.tweens.add({
      targets: stolenCore,
      scale: { from: 0.7, to: 1.35 },
      alpha: { from: 0.9, to: 0.45 },
      yoyo: true,
      repeat: 3,
      duration: 130
    });
    this.tweens.add({
      targets: shadow,
      x,
      y: Math.max(80, y - 55),
      duration: 620,
      ease: "Cubic.Out",
      onComplete: () => {
        this.burst(x, y, 0x9b5cff, 2.5);
        this.cameras.main.flash(110, 95, 0, 130);
        stolenCore.destroy();
        this.tweens.add({
          targets: shadow,
          y: -430,
          alpha: 0,
          scale: 0.68,
          duration: 720,
          ease: "Cubic.In",
          onComplete: () => {
            shadow.destroy();
            this.showBanner(
              `黑影夺走${BOSS_NAMES[defeatedKind]}专属强化核心 · 主动权柄已保留`,
              1500
            );
            this.startCampaignEncounter(this.campaignEncounterIndex);
          }
        });
      }
    });
  }

  defeatBoss(): void {
    if (!this.bossActive) return;
    const campaignEncounter =
      isNineBattleMode()
        ? BOSS_CAMPAIGN_ENCOUNTERS[this.campaignEncounterIndex]
        : null;
    const defeatedKind = this.bossKind;
    const defeatedElite = this.bossElite;
    const defeatedCore = (
      this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[]
    ).find((part) => part.active && part.getData("part") === "core");
    const defeatedX = defeatedCore?.x ?? WORLD_WIDTH / 2;
    const defeatedY = defeatedCore?.y ?? 190;
    this.bossActive = false;
    this.clearBossAttackEffects();
    this.skillsConfiscated = false;
    const defeatedTier = this.bossTier + 1;
    const bossScore = Math.round((9000 + defeatedTier * 4200) * (defeatedElite ? 1.5 : 1));
    this.score += bossScore;
    const baseBossTokens =
      isNineBattleMode()
        ? 95 + defeatedTier * 65 + selectedLevel * 15
        : 32 + defeatedTier * 20 + selectedLevel * 9;
    // === 削弱:boss 给的数值奖励砍 30%(空中支援 / 教义进化 / boss 护符为主奖励) ===
    const bossTokens = Math.round(baseBossTokens * 0.7 * (defeatedElite ? 1.5 : 1));
    this.grantRunTokens(bossTokens);
    this.floatText(
      WORLD_WIDTH / 2,
      300,
      `${defeatedElite ? "精英 " : ""}${BOSS_NAMES[defeatedKind]} ${defeatedTier} 击破`,
      true
    );
    this.bossParts.children.each((child) => {
      const part = child as Phaser.Physics.Arcade.Image;
      if (part.active) {
        if (part.getData("part") === "core") {
          this.bigExplosion(part.x, part.y, 0xff3dbb, 1.4);
        } else {
          this.bigExplosion(part.x, part.y, 0xff8a3d, 0.7);
        }
        part.disableBody(true, true);
      }
      return true;
    });
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) bullet.disableBody(true, true);
      return true;
    });
    if (this.bossEliteAura) {
      // 光环上的 tween 是 repeat:-1 永久循环,Phaser 不会因目标销毁而自动停止,
      // 必须先 killTweensOf 再 destroy,否则逐场累积悬挂 tween。
      this.tweens.killTweensOf(this.bossEliteAura);
      this.bossEliteAura.destroy();
    }
    this.bossEliteAura = undefined;
    // 当前 Boss 的主动权柄当场进入三选一；九战前三场的专属被动会被黑影夺走，
    // 只有打跑随后的黑影才会以独立三选一掉落。
    const activePowerChoices = bossPowerDropChoices(
      defeatedKind,
      this.bossPower
    );
    this.cameras.main.flash(160, 230, 255, 255);
    if (save.settings.screenShake) this.cameras.main.shake(600, 0.018);
    this.unlockAchievement("boss_slayer");
    this.bossTier = defeatedTier;
    this.levelCompleteTriggered = false;
    // 刷兵恢复放在奖励链全部结束后(showDoctrineEvolution onComplete),
    // 避免奖励选择期间被新刷小兵打死。
    const totalScore = this.score + this.score2;
    this.nextBossScore =
      selectedMode === "endless"
        ? totalScore + 36000 + this.bossTier * 16800 + selectedLevel * 2160
        : 0;
    this.ultimate = Math.min(100, this.ultimate + 20);
    this.healPlayer(this.stats.maxHp * (isNineBattleMode() ? 0.12 : 0.06), "首领能量回收");
    this.showBanner(
      `${defeatedElite ? "精英 " : ""}${BOSS_NAMES[defeatedKind]}击破 · 技能权限恢复`,
      1500
    );
    if (campaignEncounter?.kind === "boss") {
      this.nextSpawn = this.time.now + 999999;
      this.campaignBossesDefeated = Math.min(
        3,
        this.campaignBossesDefeated + 1
      );
      this.campaignEncounterIndex = Math.min(
        BOSS_CAMPAIGN_ENCOUNTERS.length - 1,
        this.campaignEncounterIndex + 1
      );
      // 规矩:打完 boss 不掉 boss 强化(主动/被动),统一在打跑黑影后给
      this.time.delayedCall(620, () => {
        this.playShadowPowerTheft(defeatedKind, defeatedX, defeatedY);
      });
      return;
    }
    // 终局黑暗魔神:普通战役黑暗核心抉择 → 残党阶段 → 结局
    if (campaignEncounter?.kind === "dark_deity") {
      this.nextSpawn = this.time.now + 999999;
      // 解除支离破碎：把玩家攻击 / 血量 / 回血效率还原(如果中途触发了)
      if (this.bossShattered) {
        this.stats.damageMultiplier = this.shatteredPlayerDamageOriginal;
        this.darkHealingScale = 1;
        this.darkHealLockUntil = 0;
        if (this.shatteredPlayerMaxHpOriginal > this.stats.maxHp) {
          this.stats.maxHp = this.shatteredPlayerMaxHpOriginal;
          this.stats.hp = roundHealth(this.stats.hp, this.stats.maxHp);
          this.recordAgileMaxHpGain(this.stats.maxHp - this.originalPlayerMaxHp);
        }
        this.bossShattered = false;
      }
      this.showBanner("◆ 黑暗魔神击破 · 残骸中留下一枚损坏的黑暗核心", 2200);
      // 终局抉择:摧毁 or 保留损坏的黑暗核心,再进入残党阶段
      this.time.delayedCall(1900, () => {
        const continueToCoreChoice = () => showDarkCoreChoice(this, (choice) => {
          this.darkCoreChoice = choice;
          if (choice === "destroyed") {
            this.darkCorruption = 0;
            this.nextCorruptionTick = this.time.now + DARK_CORRUPTION_TICK_MS;
            this.showBanner("◆ 核心已碎裂 · 黑暗能量灌入残党 · 你也开始被侵蚀", 2000);
            this.cameras.main.flash(320, 120, 0, 160);
            if (save.settings.screenShake) this.cameras.main.shake(700, 0.02);
          } else {
            this.showBanner("◆ 核心已封存于货舱 · 残党涌入 · 冲杀出去", 2000);
          }
          this.time.delayedCall(1200, () => this.startFinalMinionSwarm());
        });
        showBossPowerChoice(
          this,
          activePowerChoices,
          () => showBossPassiveChoice(this, [defeatedKind], continueToCoreChoice),
          BOSS_KIND_TO_POWER[defeatedKind]
        );
      });
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
      const continueRewards = () => {
        showBossPassiveChoice(this, [defeatedKind], () => {
          showUpgrade(this, () => {
            showDoctrineEvolution(this, () => {
              this.bossPhase = 0;
              this.showBanner(
                `${
                  selectedMode === "campaign" ? "普通战役推进" : "无尽航线继续"
                } · 下一阈值 ${this.nextBossScore}`,
                1100
              );
              // 奖励链全部结束后再恢复刷兵(无尽模式 nextSpawn 在首领波前被冻结)
              if (selectedMode === "endless") this.nextSpawn = this.time.now + 800;
            });
          });
        });
      };
      showBossPowerChoice(
        this,
        activePowerChoices,
        continueRewards,
        BOSS_KIND_TO_POWER[defeatedKind]
      );
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
    this.time.timeScale = 1; // 恢复(可能正处于升级选择弹窗)
    this.physics.world.timeScale = 1;
    this.physics.world.pause();
    // 魔神契约:玩家死亡时 25% 概率复活并保留 50% HP(黑影结局已触发则不再复活)
    if (!victory && this.deityPactArmed && !this.deityPactTriggered && !this.shadowEnding) {
      if (Math.random() < 0.25) {
        this.deityPactTriggered = true;
        this.deityPactArmed = false;
        this.ended = false;
        this.physics.world.resume();
        this.stats.hp = roundHealth(this.stats.maxHp * 0.5, this.stats.maxHp);
        this.player.setVisible(true);
        this.player.setAlpha(1);
        this.showBanner("◆ 魔神契约 · 强行复活", 2000);
        this.burst(this.player.x, this.player.y, 0xb56cff, 2.0);
        this.cameras.main.flash(200, 180, 60, 220);
        this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 3000);
        return;
      } else {
        this.deityPactTriggered = true;  // 本局不再触发
        showToast("魔神契约 · 契约已耗尽");
      }
    }
    // 终局残党阶段阵亡:按黑暗核心的抉择走对应的黑影结局
    if (!victory && this.finalSwarmActive && this.darkCoreChoice && !this.shadowEnding) {
      this.unlockAchievement("fell_short");
      this.ended = false;
      this.physics.world.resume();
      this.triggerShadowEnding(
        this.darkCoreChoice === "destroyed" ? "destroyed_fallen" : "kept_fallen"
      );
      return;
    }
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
        missionLevel: selectedLevel,
        shadowEnding: this.shadowEnding
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
    // 双人 P2 血条:在 P1 血条下方留一空行,左对齐(数字在上方)
    if (this.player2) {
      g.lineStyle(1, 0x9b5cff, 0.4);
      g.strokeRoundedRect(28, 106, 190, 12, 5);
      g.fillStyle(0x071827, 0.88);
      g.fillRoundedRect(28, 106, 190, 12, 5);
      g.fillStyle(this.player2Hp / this.player2MaxHp < 0.3 ? 0xff4d6d : 0x9b5cff, 1);
      g.fillRoundedRect(
        28,
        106,
        190 * (this.player2Hp / this.player2MaxHp),
        12,
        5
      );
      g.fillStyle(0x9b5cff, 0.9);
      g.fillRect(20, 106, 4, 12);
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
      const trinityCores = (this.bossParts.getChildren() as Phaser.Physics.Arcade.Image[])
        .filter((part) => part.getData("part") === "raid-core")
        .sort(
          (a, b) =>
            ["titan", "mirror", "usurper"].indexOf(a.getData("raidKind")) -
            ["titan", "mirror", "usurper"].indexOf(b.getData("raidKind"))
        );
      if (trinityCores.length === 3) {
        const barGap = 8;
        const totalWidth = WORLD_WIDTH - 156;
        const barWidth = (totalWidth - barGap * 2) / 3;
        const barColors = [0xff8b42, 0x7ce8ff, 0xc45cff];
        trinityCores.forEach((core, index) => {
          const hp = Math.max(0, Number(core.getData("hp") ?? 0));
          const maxHp = Math.max(1, Number(core.getData("maxHp") ?? 1));
          const x = 78 + index * (barWidth + barGap);
          g.fillStyle(0x120c22, 0.94);
          g.fillRoundedRect(x, 152, barWidth, 8, 3);
          if (hp > 0) {
            g.fillStyle(barColors[index], 1);
            g.fillRoundedRect(x, 152, barWidth * (hp / maxHp), 8, 3);
          }
          g.lineStyle(1, barColors[index], 0.75);
          g.strokeRoundedRect(x, 152, barWidth, 8, 3);
        });
      } else if (this.darkAircraft?.active) {
        const aircraftRatio = this.darkAircraftHp / Math.max(1, this.darkAircraftMaxHp);
        g.fillStyle(0x120c22, 0.94);
        g.fillRoundedRect(78, 152, WORLD_WIDTH - 156, 8, 3);
        g.fillStyle(0xa52fff, 1);
        g.fillRoundedRect(78, 152, (WORLD_WIDTH - 156) * aircraftRatio, 8, 3);
        g.lineStyle(1, 0xe2a6ff, 0.8);
        g.strokeRoundedRect(78, 152, WORLD_WIDTH - 156, 8, 3);
      }
      const trinityStatus = trinityCores.length === 3
        ? ` // ${trinityCores
            .map((core) => {
              const kind = core.getData("raidKind") as BossKind;
              const hp = Math.max(0, Number(core.getData("hp") ?? 0));
              const maxHp = Math.max(1, Number(core.getData("maxHp") ?? 1));
              return `${BOSS_NAMES[kind]} ${Math.ceil((hp / maxHp) * 100)}%`;
            })
            .join(" · ")}`
        : this.darkAircraft?.active
          ? ` // 黑暗飞机 ${Math.ceil(
              (this.darkAircraftHp / Math.max(1, this.darkAircraftMaxHp)) * 100
            )}%`
          : "";
      this.hud.bossName.setText(
        `${this.bossElite ? "ELITE // " : ""}${this.bossMutated ? "MUTATED // " : ""}${
          trinityCores.length === 3 ? "三神共斗" : BOSS_NAMES[this.bossKind]
        } // ${
          selectedMode === "campaign"
            ? "HOSTILE SIGNAL"
            : isNineBattleMode()
              ? `ENCOUNTER ${this.campaignEncounterIndex + 1}/9`
            : `TIER ${this.bossTier + 1}`
        } // PHASE ${this.bossPhase}${
          this.skillsConfiscated ? " // SKILLS STOLEN" : ""
        }${trinityStatus}`
      );
    } else {
      this.hud.bossName.setText("");
    }
    this.hud.hp.setText(`P1 ${Math.round(this.stats.hp)} / ${Math.round(this.stats.maxHp)}`);
    if (this.player2) {
      this.hud.p2.setText(
        `P2 ${Math.round(this.player2Hp)} / ${Math.round(this.player2MaxHp)}`
      );
      this.hud.score.setText(`${this.score} : ${this.score2}`);
    } else {
      this.hud.p2.setText("");
      this.hud.score.setText(this.score.toString().padStart(7, "0"));
    }
    this.hud.time.setText(formatTime(this.elapsedSeconds));
    const campaignStatus =
      selectedMode === "campaign"
        ? this.campaignInterludeActive
          ? "DEEP SPACE // SIGNAL UNKNOWN"
          : "HOSTILE SIGNAL"
        : isNineBattleMode()
          ? `BOSS ENCOUNTER ${this.campaignEncounterIndex + 1}/9`
          : `NEXT BOSS ${Math.max(0, this.nextBossScore - this.score - this.score2)}`;
    const wheelchairActiveStatus: string[] = [];
    if (save.selectedSpecialization === "wheelchair") {
      if (this.time.now < this.wheelchairBreachUntil) wheelchairActiveStatus.push("破阵防护");
      if (this.time.now < this.wheelchairReactiveArmorUntil) {
        wheelchairActiveStatus.push(
          `反应装甲 ${Math.round(this.wheelchairReactiveStoredDamage)}`
        );
      } else if (this.wheelchairReactiveStoredDamage > 0) {
        wheelchairActiveStatus.push(
          `装甲蓄能 ${Math.round(this.wheelchairReactiveStoredDamage)}`
        );
      }
      if (this.time.now < this.wheelchairFortressUntil) wheelchairActiveStatus.push("堡垒姿态");
    }
    this.hud.level.setText(
      `${SPECIALIZATIONS[save.selectedSpecialization].code} · LV.${this.level}/100  //  ◆ ${
        this.runTokens
      }${
        save.selectedSpecialization === "wheelchair" && this.time.now < this.wheelchairOverdriveUntil
          ? "  //  FULL SPEED"
          : ""
      }${wheelchairActiveStatus.map((status) => `  //  ${status}`).join("")
      }  //  ${campaignStatus}${
        this.bossPower ? `  //  V ${BOSS_POWER_OPTIONS.find((item) => item.id === this.bossPower)?.name}` : ""
      }${
        save.selectedSpecialization === "devour" && (this.upgradeLevels.devour_swallow ?? 0) > 0
          ? `  //  ▼ 吞噬 ${this.devourKillCount}/10`
          : ""
      }${
        save.selectedSpecialization === "devour"
          ? `  //  体型 ×${this.devourSizeMul.toFixed(2)}`
          : ""
      }${
        save.selectedSpecialization === "vampire" && (this.upgradeLevels.vampire_siphon ?? 0) > 0
          ? `  //  ⌇ 虹吸 ×${this.siphonedEnemies.length}`
          : ""
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
        if (!child.active || child.getData("hittable") === false) continue;
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
      .filter((target) => target.active && target.getData("hittable") !== false)
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

  // 通用爆炸(单环 + 散射火星) — 所有画质都显示
  burst(x: number, y: number, color: number, scale = 1): void {
    // 1. 内层亮闪(0.15s)
    const flash = this.add
      .circle(x, y, 6 * scale, 0xffffff, 0.95)
      .setDepth(31);
    this.tweens.add({
      targets: flash,
      scale: { from: 0.6, to: 1.8 },
      alpha: { from: 0.95, to: 0 },
      duration: 140,
      onComplete: () => flash.destroy()
    });
    // 2. 外环冲击波
    const ring = this.add
      .circle(x, y, 10, color, 0.55)
      .setStrokeStyle(3, color, 0.9)
      .setDepth(30);
    this.tweens.add({
      targets: ring,
      radius: 42 * scale,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy()
    });
    // 3. 散射火星 — 8 颗(原 7),带大小衰减 + 颜色渐变
    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i += 1) {
      const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.2;
      const speed = (45 + Math.random() * 30) * scale;
      const length = 14 + Math.random() * 6;
      // 火星用 color + 白心双层叠加,显得有温度
      const spark = this.add
        .rectangle(x, y, 4, length, color, 1)
        .setRotation(angle)
        .setDepth(29);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: { from: 1, to: 0.2 },
        rotation: angle + Math.random() * 0.8,
        duration: 320 + Math.random() * 100,
        onComplete: () => spark.destroy()
      });
    }
  }

  // (impactBurst 已在前面实现,带屏震)

  // 大型爆炸(首领级)— 多环 + 烟雾 + 火光闪烁
  bigExplosion(x: number, y: number, color: number, scale = 1): void {
    // 1. 三圈错时扩散
    const ringColors = [color, 0xffffff, color];
    ringColors.forEach((c, idx) => {
      this.time.delayedCall(idx * 90, () => {
        if (!this.scene.isActive()) return;
        const r = this.add
          .circle(x, y, 14, c, 0)
          .setStrokeStyle(6 - idx, c, 0.85)
          .setDepth(31 + idx);
        this.tweens.add({
          targets: r,
          radius: 80 * scale + idx * 18,
          alpha: 0,
          duration: 480 + idx * 100,
          onComplete: () => r.destroy()
        });
      });
    });
    // 2. 中央白闪
    const flash = this.add.circle(x, y, 22 * scale, 0xffffff, 1).setDepth(33);
    this.tweens.add({
      targets: flash,
      scale: { from: 0.4, to: 2.2 },
      alpha: { from: 1, to: 0 },
      duration: 260,
      onComplete: () => flash.destroy()
    });
    // 3. 16 颗大火星 + 颜色褪色
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.15;
      const speed = (70 + Math.random() * 50) * scale;
      const length = 20 + Math.random() * 10;
      const spark = this.add
        .rectangle(x, y, 6, length, i % 2 ? 0xffffff : color, 1)
        .setRotation(angle)
        .setDepth(32);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: { from: 1, to: 0.3 },
        rotation: angle + Math.random() * 1.2,
        duration: 480 + Math.random() * 200,
        onComplete: () => spark.destroy()
      });
    }
    // 4. 8 颗灰烟圈(灰色,慢上飘 + 淡出)
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const speed = 30 + Math.random() * 25;
      const smoke = this.add
        .circle(x, y, 8 + Math.random() * 4, 0x1a1a1a, 0.55)
        .setDepth(28);
      this.tweens.add({
        targets: smoke,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 18,
        scale: { from: 1, to: 3.4 },
        alpha: 0,
        duration: 800,
        onComplete: () => smoke.destroy()
      });
    }
  }

  // 小兵普通击破 — 简洁版,代替高频 burst
  enemyPop(x: number, y: number, color: number): void {
    // 单环 + 4 火星(轻量)
    const ring = this.add
      .circle(x, y, 6, color, 0.6)
      .setStrokeStyle(2, color, 0.85)
      .setDepth(30);
    this.tweens.add({
      targets: ring,
      radius: 22,
      alpha: 0,
      duration: 240,
      onComplete: () => ring.destroy()
    });
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.3;
      const speed = 32 + Math.random() * 16;
      const spark = this.add
        .rectangle(x, y, 3, 9, color, 1)
        .setRotation(angle)
        .setDepth(29);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: { from: 1, to: 0.25 },
        rotation: angle,
        duration: 220,
        onComplete: () => spark.destroy()
      });
    }
  }

  // 玩家死亡爆炸 — 多次连环 + 烟柱
  playerExplosion(x: number, y: number): void {
    // 三段延迟连环爆
    for (let wave = 0; wave < 3; wave += 1) {
      this.time.delayedCall(wave * 220, () => {
        if (!this.scene.isActive()) return;
        const ox = (Math.random() - 0.5) * 60;
        const oy = (Math.random() - 0.5) * 40;
        this.bigExplosion(x + ox, y + oy, 0xff8a3d, 0.9);
      });
    }
    // 烟柱
    for (let i = 0; i < 12; i += 1) {
      this.time.delayedCall(i * 80, () => {
        if (!this.scene.isActive()) return;
        const sx = x + (Math.random() - 0.5) * 40;
        const sy = y + (Math.random() - 0.5) * 30;
        const smoke = this.add
          .circle(sx, sy, 10 + Math.random() * 6, 0x0a0a0a, 0.7)
          .setDepth(28);
        this.tweens.add({
          targets: smoke,
          y: sy - 60 - Math.random() * 40,
          scale: { from: 1, to: 4 },
          alpha: 0,
          duration: 900,
          onComplete: () => smoke.destroy()
        });
      });
    }
  }

  showBanner(text: string, duration = 1200): void {
    this.lastBannerText = text;
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
// 将 main.ts 的升级弹窗注入 upgrade-system(避免循环依赖)
setShowUpgrade((scene) => showUpgrade(scene));
// 将 main.ts 的页面导航注入 run-settlement(避免循环依赖)
setSettlementNavigation({ destroyGame, startRun, showMenu, showHangar });
window.addEventListener("beforeunload", () => {
  activeScene?.archivePendingRun();
});
const bootParams = new URLSearchParams(location.search);
const autoStartMode = bootParams.get("autostart");
const requestedLevel = Number(bootParams.get("level"));
if (requestedLevel >= 1 && requestedLevel <= 5) setSelectedLevel(requestedLevel);
const requestedVariant = bootParams.get("variant");
if (requestedVariant === "coop" || requestedVariant === "score_duel") setPlayVariant(requestedVariant);
const requestedSpecialization = bootParams.get("specialization") as SpecializationId | null;
if (requestedSpecialization && requestedSpecialization in SPECIALIZATIONS) {
  save.selectedSpecialization = requestedSpecialization;
}
if (autoStartMode === "campaign" || autoStartMode === "boss" || autoStartMode === "endless") {
  setSelectedMode(autoStartMode);
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
