// 运行时共享状态：存档、模式选择、音频、全局 UI 根节点。
// 独立成模块，供 spawn-director / upgrade-system / run-settlement
// 等拆分模块引用，避免与 main.ts 形成运行时循环依赖。
import Phaser from "phaser";
import {
  formatRoundedNumberForDisplay,
  formatTime,
  loadSave,
  type GameMode,
  type SaveData,
  type SkinId
} from "./game-logic";
import {
  ACHIEVEMENT_SKIN_IDS,
  PERFORMANCE_MIGRATION_KEY,
  type PlayVariant,
  SAVE_KEY,
  SHIPS,
  SPECIALIZATIONS
} from "./data";
import type { BattleScene } from "./main";

// === 永久加点统计(依赖运行时存档) ===
export function totalPermanentLevels(): number {
  return Object.values(save.permanentUpgrades).reduce((sum, level) => sum + Math.max(0, level), 0);
}

export function enemyUpgradeScale(): number {
  const playerUpgradeRatio =
    (save.permanentUpgrades.hull ?? 0) * 0.04 +
    (save.permanentUpgrades.firepower ?? 0) * 0.03 +
    (save.permanentUpgrades.engine ?? 0) * 0.025 +
    (save.permanentUpgrades.armor ?? 0) * 0.015;
  return 1 + playerUpgradeRatio * 0.2;
}

export function permanentArmorScale(): number {
  return 1 - Math.min(0.3, (save.permanentUpgrades.armor ?? 0) * 0.015);
}

// 可变会话状态：导出 setter 供 main.ts 重新赋值（import 绑定只读）
export let save: SaveData = loadSave(localStorage.getItem(SAVE_KEY));
// 本地测试页向制作人开放全部成就皮肤，方便逐款检查商店与实战效果；生产包仍按成就解锁。
if (import.meta.env.DEV) {
  const localPreviewSkins: SkinId[] = ["standard", ...ACHIEVEMENT_SKIN_IDS];
  if (localPreviewSkins.some((id) => !save.unlockedSkins.includes(id))) {
    save.unlockedSkins = localPreviewSkins;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }
}
if (localStorage.getItem(PERFORMANCE_MIGRATION_KEY) !== "1") {
  save.settings.quality = "low";
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  localStorage.setItem(PERFORMANCE_MIGRATION_KEY, "1");
}
export function setSave(next: SaveData): void {
  save = next;
}

export let selectedMode: GameMode = save.lastMode;
export let selectedLevel = save.lastLevel;
export let playVariant: PlayVariant = save.lastVariant;
export let game: Phaser.Game | null = null;
export let persistFailed = false;

export function isNineBattleMode(): boolean {
  return selectedMode === "campaign" || selectedMode === "boss";
}

export let activeScene: BattleScene | null = null;
export function setSelectedMode(mode: GameMode): void {
  selectedMode = mode;
}
export function setSelectedLevel(level: number): void {
  selectedLevel = level;
}
export function setPlayVariant(variant: PlayVariant): void {
  playVariant = variant;
}
export function setGame(g: Phaser.Game | null): void {
  game = g;
}
export function setActiveScene(scene: BattleScene | null): void {
  activeScene = scene;
}
export function setPersistFailed(value: boolean): void {
  persistFailed = value;
}

// === 音频(WebAudio 合成,不依赖外部资源) ===
export let audioContext: AudioContext | null = null;
export let toastTimer = 0;
export let achievementToastTimer = 0;

// 成就解锁提示:显示在游戏画面下方(金色勋章条),title 为勋章名,subtitle 为附加奖励(如皮肤)
export function showAchievementToast(title: string, subtitle = ""): void {
  const element = document.querySelector<HTMLDivElement>("#achievement-toast");
  if (!element) return;
  element.innerHTML = `<b>🏅 ${title}</b>${subtitle ? `<small>${subtitle}</small>` : ""}`;
  element.classList.add("show");
  window.clearTimeout(achievementToastTimer);
  achievementToastTimer = window.setTimeout(() => element.classList.remove("show"), 2600);
}
export let musicTimer = 0;
export let musicStage = -1;

export function showToast(message: string): void {
  const element = document.querySelector<HTMLDivElement>("#toast")!;
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove("show"), 1800);
}

// 统一的"技能冷却中"提示
export function cooldownToast(label: string, readyAt: number, now: number): void {
  showToast(`${label} 冷却 ${formatRoundedNumberForDisplay(Math.max(0, readyAt - now) / 1000)}s`);
}

export function ensureAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
}

export function sfx(kind: "click" | "shoot" | "hit" | "upgrade" | "hurt" | "boss" | "victory"): void {
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

export function stopAdaptiveMusic(): void {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  musicStage = -1;
}

export function setAdaptiveMusic(stage: number): void {
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

// === 存档持久化与顶栏信息 ===
export function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    setPersistFailed(false);
  } catch (error) {
    // 写入失败(隐私模式、配额耗尽、浏览器策略)时必须让玩家知道,否则进度静默丢失
    if (!persistFailed) {
      console.error("[存档] 写入 localStorage 失败", error);
      showToast("⚠ 存档写入失败：进度无法保存，请检查浏览器隐私设置");
    }
    setPersistFailed(true);
  }
  refreshRails();
}

export function refreshRails(): void {
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

