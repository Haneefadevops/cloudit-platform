import type { ManifestEntry } from '@cloudit/operations-agent-contracts';
import type { ManifestSource } from '../../../src/sync';

/**
 * In-memory manifest source. All values are obviously synthetic
 * (keys prefixed `wf.synthetic.`, hash from the synthetic fixture).
 */
export class MockManifestSource implements ManifestSource {
  constructor(private entries: ManifestEntry[]) {}

  setEntries(entries: ManifestEntry[]): void {
    this.entries = entries;
  }

  async listEntries(): Promise<ManifestEntry[]> {
    return this.entries.map((e) => ({ ...e }));
  }
}
