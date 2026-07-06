import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

interface CachedProduct {
  key: string;
  modules: { key: string; enabled: boolean }[];
}

interface CachedModules {
  products: CachedProduct[];
  expiresAt: number;
}

@Injectable()
export class ProductModulesService {
  private readonly logger = new Logger(ProductModulesService.name);
  private readonly cache = new Map<string, CachedModules>();
  private readonly ttlMs = 60_000;

  constructor(private readonly configService: ConfigService) {}

  async isEnabled(
    orgId: string,
    product: string,
    moduleKey: string,
  ): Promise<boolean> {
    const modules = await this.fetchModules(orgId);
    const productEntry = modules.find((p: CachedProduct) => p.key === product);
    if (!productEntry) {
      // Platform returned no product entry (unreachable / unconfigured).
      // Allow access rather than locking the tenant out.
      return true;
    }
    const moduleEntry = productEntry.modules.find(
      (m: { key: string; enabled: boolean }) => m.key === moduleKey,
    );
    if (!moduleEntry) return true;

    // If none of the product's modules are enabled, the tenant was likely
    // never explicitly configured. Default to allowing all modules.
    const anyEnabled = productEntry.modules.some((m) => m.enabled);
    if (!anyEnabled) return true;

    return moduleEntry.enabled;
  }

  private async fetchModules(orgId: string): Promise<CachedProduct[]> {
    const cached = this.cache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.products;
    }

    const platformApiUrl = this.configService.get<string>("PLATFORM_API_URL");
    const internalToken = this.configService.get<string>("INTERNAL_API_TOKEN");

    if (!platformApiUrl || !internalToken) {
      this.logger.warn(
        "PLATFORM_API_URL or INTERNAL_API_TOKEN not configured; disabling module gating",
      );
      return [];
    }

    try {
      const response = await axios.get(
        `${platformApiUrl}/modules/internal/${orgId}`,
        {
          headers: { "x-internal-token": internalToken },
          timeout: 5000,
        },
      );
      const products: CachedProduct[] =
        response.data?.data ?? response.data ?? [];
      this.cache.set(orgId, { products, expiresAt: Date.now() + this.ttlMs });
      return products;
    } catch (error) {
      this.logger.error(`Failed to fetch modules for org ${orgId}`, error);
      return [];
    }
  }
}
