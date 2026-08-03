// === 单局随机种子(mulberry32 PRNG) ===
// 即时肉鸽的所有随机抽取(构筑卡/航线门/异常事件/洗牌袋)都走这个 RNG,
// 由单局种子控制,可复现同种子挑战;dailySeed 提供每日种子。
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** 返回 [0,1) 均匀随机数 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 概率判断,返回 true 的概率为 p(0~1) */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 等概率抽取一项;空数组返回 undefined */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[Math.floor(this.next() * items.length)];
  }

  /** Fisher–Yates 洗牌(返回新数组,不改原数组) */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** 从字符串派生种子(同种子挑战用) */
  static fromString(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /** 按本地日期生成每日种子(YYYYMMDD) */
  static daily(): number {
    const now = new Date();
    const key =
      now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    return SeededRng.fromString(`daily:${key}`);
  }
}
