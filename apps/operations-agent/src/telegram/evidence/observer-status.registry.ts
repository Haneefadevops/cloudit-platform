/**
 * Observer status registry — the one coordinator seam that plain Nest DI
 * cannot express: the SoakDriver provider lives in the AppModule root scope
 * (it needs SupervisorService, AlertEngine and the audit port), while the
 * Telegram evidence adapter is bound inside the commands module. The root
 * factory binds the constructed driver (or null, when the observer is
 * unconfigured) exactly once at startup; the adapter reads it through this
 * registry. Single agent process, bind-once at composition, read-only
 * afterwards — no runtime mutation path exists.
 */
import type { SoakDriver } from '../../observer';

let bound: SoakDriver | null = null;

export const observerStatusRegistry = {
  bind(driver: SoakDriver | null): void {
    bound = driver;
  },
  get(): SoakDriver | null {
    return bound;
  },
};
