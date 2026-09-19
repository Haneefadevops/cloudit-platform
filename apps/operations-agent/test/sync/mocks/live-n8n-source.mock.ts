import type {
  LiveN8nObservationSource,
  LiveN8nSnapshot,
  LiveN8nWorkflowRecord,
} from '../../../src/sync';

/**
 * In-memory live n8n observation source simulating:
 *  - `healthy`        — n8n reachable, per-workflow records supplied;
 *  - `unavailable`    — n8n unreachable while the observer stays up: the
 *                       snapshot is marked observerAvailable=false and no
 *                       workflow data is trusted (plan section 12).
 * Individual workflow drift is simulated by mutating the records array.
 */
export class MockLiveN8nSource implements LiveN8nObservationSource {
  private snapshot: LiveN8nSnapshot;

  private constructor(snapshot: LiveN8nSnapshot) {
    this.snapshot = snapshot;
  }

  static healthy(workflows: LiveN8nWorkflowRecord[], observedAt: string | number | Date) {
    return new MockLiveN8nSource({ observerAvailable: true, observedAt, workflows });
  }

  static unavailable(observedAt: string | number | Date) {
    return new MockLiveN8nSource({ observerAvailable: false, observedAt, workflows: [] });
  }

  setSnapshot(snapshot: LiveN8nSnapshot): void {
    this.snapshot = snapshot;
  }

  async observe(): Promise<LiveN8nSnapshot> {
    return {
      observerAvailable: this.snapshot.observerAvailable,
      observedAt: this.snapshot.observedAt,
      workflows: this.snapshot.workflows.map((w) => ({ ...w })),
    };
  }
}
