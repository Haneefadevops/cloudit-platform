export interface ProductModuleDefinition {
  key: string;
  label: string;
  description: string;
}

export interface ProductDefinition {
  key: string;
  label: string;
  description: string;
  modules: ProductModuleDefinition[];
}

export const PRODUCT_REGISTRY: ProductDefinition[] = [
  {
    key: 'platform',
    label: 'CloudIT Platform',
    description: 'Core platform management',
    modules: [
      { key: 'users', label: 'Users', description: 'User management' },
      { key: 'organizations', label: 'Organizations', description: 'Organization management' },
      { key: 'roles', label: 'Roles & Permissions', description: 'Role management' },
      { key: 'audit_logs', label: 'Audit Logs', description: 'Activity audit logs' },
      { key: 'settings', label: 'Settings', description: 'Organization settings' },
      { key: 'integrations', label: 'Integrations', description: 'Third-party integrations' },
      { key: 'ai', label: 'AI & Automation', description: 'AI assistant and automation' },
    ],
  },
  {
    key: 'hospitality',
    label: 'CloudIT Hospitality OS',
    description: 'Hotel and guesthouse management',
    modules: [
      { key: 'properties', label: 'Properties', description: 'Hotels and guesthouses' },
      { key: 'rooms', label: 'Rooms', description: 'Room management' },
      { key: 'guests', label: 'Guests', description: 'Guest management' },
      { key: 'reservations', label: 'Reservations', description: 'Bookings and reservations' },
      { key: 'invoices', label: 'Invoices', description: 'Billing and invoices' },
      { key: 'reports', label: 'Reports', description: 'Reports and analytics' },
      { key: 'taxes', label: 'Taxes', description: 'Tax rate configuration' },
    ],
  },
  {
    key: 'orbitone',
    label: 'CloudIT OrbitOne',
    description: 'Digital business cards',
    modules: [
      { key: 'cards', label: 'Cards', description: 'Digital business cards' },
      { key: 'templates', label: 'Templates', description: 'Card templates' },
      { key: 'analytics', label: 'Analytics', description: 'Card view analytics' },
    ],
  },
  {
    key: 'touchorbit',
    label: 'CloudIT TouchOrbit HR',
    description: 'HR management',
    modules: [
      { key: 'employees', label: 'Employees', description: 'Employee management' },
      { key: 'attendance', label: 'Attendance', description: 'Attendance tracking' },
      { key: 'payroll', label: 'Payroll', description: 'Payroll management' },
      { key: 'leave', label: 'Leave', description: 'Leave requests' },
      { key: 'recruitment', label: 'Recruitment', description: 'Hiring pipeline' },
      { key: 'performance', label: 'Performance', description: 'Performance reviews' },
    ],
  },
];

export function getProductRegistry(): ProductDefinition[] {
  return PRODUCT_REGISTRY;
}

export function isValidModule(product: string, moduleKey: string): boolean {
  const p = PRODUCT_REGISTRY.find((x) => x.key === product);
  if (!p) return false;
  return p.modules.some((m) => m.key === moduleKey);
}
