import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claimJobMock = vi.fn();
const processJobMock = vi.fn();
const recoverExpiredLeasesMock = vi.fn();

vi.mock("../src/services/notificationOutboxService.js", () => ({
  claimJob: (...args: unknown[]) => claimJobMock(...args),
  processJob: (...args: unknown[]) => processJobMock(...args),
  recoverExpiredLeases: (...args: unknown[]) => recoverExpiredLeasesMock(...args),
}));

import {
  isNotificationOutboxWorkerRunning,
  startNotificationOutboxWorker,
  stopNotificationOutboxWorker,
} from "../src/services/notificationOutboxWorker.js";

describe("notificationOutboxWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    claimJobMock.mockReset();
    processJobMock.mockReset();
    recoverExpiredLeasesMock.mockReset();
    recoverExpiredLeasesMock.mockResolvedValue(0);
    claimJobMock.mockResolvedValue(null);
  });

  afterEach(async () => {
    await stopNotificationOutboxWorker({ drainTimeoutMs: 50 });
    vi.useRealTimers();
  });

  it("does not start duplicate polling loops when started twice", async () => {
    startNotificationOutboxWorker({ pollIntervalMs: 1000, leaseRecoveryIntervalMs: 5000 });
    startNotificationOutboxWorker({ pollIntervalMs: 1000, leaseRecoveryIntervalMs: 5000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(recoverExpiredLeasesMock).toHaveBeenCalledTimes(1);
    expect(isNotificationOutboxWorkerRunning()).toBe(true);
  });

  it("stops scheduling new polls and drains in-flight work within bound", async () => {
    let resolveProcess!: () => void;
    claimJobMock.mockResolvedValueOnce({ _id: "job1" }).mockResolvedValue(null);
    processJobMock.mockImplementation(
      () => new Promise<void>((resolve) => { resolveProcess = resolve; }),
    );

    startNotificationOutboxWorker({ pollIntervalMs: 1000, leaseRecoveryIntervalMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(processJobMock).toHaveBeenCalledTimes(1);

    const stopPromise = stopNotificationOutboxWorker({ drainTimeoutMs: 1000 });
    resolveProcess();
    await vi.advanceTimersByTimeAsync(0);
    await stopPromise;

    expect(isNotificationOutboxWorkerRunning()).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(claimJobMock.mock.calls.length).toBeLessThanOrEqual(2); // initial claim + maybe none after stop
  });

  it("times out drain safely without marking jobs delivered", async () => {
    claimJobMock.mockResolvedValueOnce({ _id: "job1" }).mockResolvedValue(null);
    processJobMock.mockImplementation(() => new Promise<void>(() => undefined)); // never resolves

    startNotificationOutboxWorker({ pollIntervalMs: 1000, leaseRecoveryIntervalMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(processJobMock).toHaveBeenCalledTimes(1);

    const stopPromise = stopNotificationOutboxWorker({ drainTimeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(25);
    await stopPromise;

    expect(isNotificationOutboxWorkerRunning()).toBe(false);
    // Worker must not force-complete jobs; no markSent exists here, process never resolved.
  });
});
