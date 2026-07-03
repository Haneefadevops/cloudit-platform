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
      { key: 'org_chart', label: 'Org Chart', description: 'Organization chart' },
      { key: 'attendance', label: 'Attendance', description: 'Attendance tracking' },
      { key: 'live_attendance', label: 'Live Attendance', description: 'Live attendance dashboard' },
      { key: 'spoofing_review', label: 'Spoofing Review', description: 'Attendance spoofing review' },
      { key: 'payroll', label: 'Payroll', description: 'Payroll management' },
      { key: 'payslips', label: 'Payslips', description: 'Employee payslips' },
      { key: 'leave', label: 'Leave', description: 'Leave requests' },
      { key: 'overtime', label: 'Overtime', description: 'Overtime management' },
      { key: 'comp_off', label: 'Comp-Off', description: 'Compensatory off requests' },
      { key: 'encashment', label: 'Encashment', description: 'Leave encashment' },
      { key: 'roster', label: 'Roster', description: 'Employee rostering' },
      { key: 'shifts', label: 'Shifts', description: 'Shift management' },
      { key: 'calendar', label: 'Calendar', description: 'Team calendar' },
      { key: 'corrections', label: 'Corrections', description: 'Attendance corrections' },
      { key: 'training', label: 'Training', description: 'Employee training' },
      { key: 'performance', label: 'Performance', description: 'Performance reviews' },
      { key: 'recruitment', label: 'Recruitment', description: 'Hiring pipeline' },
      { key: 'expenses', label: 'Expenses', description: 'Employee expenses' },
      { key: 'assets', label: 'Assets', description: 'Asset management' },
      { key: 'documents', label: 'Documents', description: 'Document management' },
      { key: 'announcements', label: 'Announcements', description: 'Company announcements' },
      { key: 'geofences', label: 'Geofences', description: 'Location-based check-in boundaries' },
      { key: 'reports', label: 'Reports', description: 'HR reports and analytics' },
      { key: 'audit', label: 'Audit', description: 'Activity audit logs' },
      { key: 'settings', label: 'Settings', description: 'Organization settings' },
      { key: 'kiosk', label: 'Kiosk', description: 'Self-service attendance kiosk' },
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
