import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/seeded-rng";

describe("SeededRng", () => {
  it("同种子产生相同序列,不同种子不同", () => {
    const a = new SeededRng(12345);
    const b = new SeededRng(12345);
    const c = new SeededRng(54321);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    const seqC = [c.next(), c.next(), c.next()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it("next 落在 [0,1) 且 int 落在闭区间", () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 100; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    for (let i = 0; i < 100; i++) {
      const value = rng.int(3, 8);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(8);
    }
  });

  it("chance 边界:0 恒 false,1 恒 true", () => {
    const rng = new SeededRng(9);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it("shuffle 保留全部元素且不改原数组", () => {
    const rng = new SeededRng(42);
    const source = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(source);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });

  it("pick 空数组返回 undefined", () => {
    const rng = new SeededRng(1);
    expect(rng.pick<string>([])).toBeUndefined();
    expect(rng.pick(["a", "b"])).toBeDefined();
  });

  it("fromString 确定性,同字符串同种子", () => {
    expect(SeededRng.fromString("challenge-abc")).toBe(
      SeededRng.fromString("challenge-abc")
    );
    expect(SeededRng.fromString("challenge-abc")).not.toBe(
      SeededRng.fromString("challenge-abd")
    );
  });

  it("daily 同一天内稳定(不跨午夜可复现)", () => {
    const today1 = SeededRng.daily();
    const today2 = SeededRng.daily();
    expect(today1).toBe(today2);
  });
});
