// To be filled in Phase 6: queue claiming (atomic claim), heartbeat/lease
// renewal, interrupted-job recovery and cancellation behavior tests.
import { describe, expect, it } from "vitest";

describe("kuyruk sahiplenme", () => {
  it.todo("the same job cannot be claimed by two processes at once");
  it.todo("a job whose lease expired is marked interrupted");
});
