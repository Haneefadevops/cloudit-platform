import type { PortalCatalogueSource } from '../../../src/sync';

/** In-memory portal catalogue source with synthetic workflow keys. */
export class MockPortalCatalogueSource implements PortalCatalogueSource {
  private listedKeys: ReadonlySet<string>;

  constructor(listedKeys: Iterable<string>) {
    this.listedKeys = new Set(listedKeys);
  }

  setListedKeys(listedKeys: Iterable<string>): void {
    this.listedKeys = new Set(listedKeys);
  }

  async listListedKeys(): Promise<ReadonlySet<string>> {
    return new Set(this.listedKeys);
  }
}
