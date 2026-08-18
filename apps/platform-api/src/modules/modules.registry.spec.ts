import { getProductRegistry, isValidModule } from './modules.registry';

describe('NotchMe module registry', () => {
  it.each(['crm', 'scheduling', 'analytics', 'ratings', 'business_accounts'])(
    'accepts the active NotchMe %s module',
    (moduleKey) => {
      expect(isValidModule('notchme', moduleKey)).toBe(true);
    },
  );

  it.each(['cards', 'templates'])(
    'rejects obsolete NotchMe %s modules',
    (moduleKey) => {
      expect(isValidModule('notchme', moduleKey)).toBe(false);
    },
  );

  it('exposes exactly the active API guard modules', () => {
    const notchme = getProductRegistry().find(
      (product) => product.key === 'notchme',
    );

    expect(notchme?.modules.map((module) => module.key)).toEqual([
      'crm',
      'scheduling',
      'analytics',
      'ratings',
      'business_accounts',
    ]);
  });
});
