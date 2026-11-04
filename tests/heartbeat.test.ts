import { describe, expect, it } from "vitest";
import { beatSlot } from "../lib/heartbeat.ts";

const at = (iso: string) => Date.parse(iso);
const time = (slot: number) => new Date(slot * 300_000).toISOString().slice(11, 16);

describe("heartbeat pacing", () => {
  it("beats on the next 5-minute slot while work is due", () => {
    expect(time(beatSlot(at("2026-11-04T12:02:10Z"), at("2026-11-04T12:02:10Z")))).toBe("12:05");
  });

  it("skips a slot that is under 20 seconds away", () => {
    expect(time(beatSlot(at("2026-11-04T12:04:50Z"), at("2026-11-04T12:04:50Z")))).toBe("12:10");
  });

  it("wakes for a deadline inside the idle gap", () => {
    expect(time(beatSlot(at("2026-11-04T10:31:00Z"), at("2026-11-04T10:52:00Z")))).toBe("10:55");
    expect(time(beatSlot(at("2026-11-04T10:31:00Z"), at("2026-11-04T11:00:00Z")))).toBe("11:00");
  });

  it("when idle, sleeps to the first :00 or :30 at least 10 minutes out, so every seeder lands on the same slot", () => {
    expect(time(beatSlot(at("2026-11-04T03:00:30Z"), null))).toBe("03:30");
    expect(time(beatSlot(at("2026-11-04T03:17:00Z"), null))).toBe("03:30"); // the hourly GitHub backup at :17
    expect(time(beatSlot(at("2026-11-04T03:21:00Z"), null))).toBe("04:00");
    expect(time(beatSlot(at("2026-11-04T03:05:00Z"), at("2026-11-04T09:00:00Z")))).toBe("03:30"); // capped
  });
});
