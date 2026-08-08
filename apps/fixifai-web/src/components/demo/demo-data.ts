/**
 * Static seed data for the interactive demo (Phase 3/3B) —
 * CityFix Maintenance Services (Pvt) Ltd, a fictional multi-trade
 * maintenance company. Fully client-side, no backend.
 */

export type JobStatus = 'new' | 'assigned' | 'in-progress' | 'done';

export type AssetType = 'AC' | 'Generator' | 'Lift' | 'Fire Panel';

export interface Site {
  id: string;
  name: string;
  kind: string;
  city: string;
}

export interface Technician {
  id: string;
  name: string;
  initials: string;
  trade: string;
  status: 'available' | 'on-job' | 'off-duty';
  jobsDone: number;
  phone: string;
  rating: number;
  jobsToday: number;
}

export interface AssetHistoryEntry {
  date: string;
  type: string;
  note: string;
  technician: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  siteId: string;
  qrCode: string;
  status: 'operational' | 'needs-attention';
  installDate: string;
  warrantyUntil: string;
  inWarranty: boolean;
  amcPlan: string;
  lifetimeSpend: number;
  history: AssetHistoryEntry[];
}

export interface Job {
  id: string;
  ref: string;
  title: string;
  siteId: string;
  assetId: string;
  trade: AssetType;
  priority: 'low' | 'medium' | 'high';
  status: JobStatus;
  technicianId: string | null;
  created: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  since: string;
  siteIds: string[];
}

export interface QuotationLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Quotation {
  id: string;
  ref: string;
  customerId: string;
  siteId: string;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  date: string;
  validUntil: string;
  lines: QuotationLine[];
}

export interface Invoice {
  id: string;
  ref: string;
  jobRef: string;
  customerId: string;
  title: string;
  amount: number;
  status: 'unpaid' | 'paid';
  dueDate: string;
}

export interface ScheduleEntry {
  id: string;
  technicianId: string;
  day: number; // 0 = Mon … 5 = Sat
  slot: 'AM' | 'PM';
  ref: string;
  title: string;
  siteId: string;
}

export const SITES: Site[] = [
  { id: 'grand-pearl', name: 'Grand Pearl Hotel', kind: 'Hotel', city: 'Colombo 03' },
  { id: 'lanka-threads', name: 'Lanka Threads Garments', kind: 'Garment factory', city: 'Katunayake' },
  { id: 'oceanview', name: 'Oceanview Residencies', kind: 'Apartment complex', city: 'Mount Lavinia' },
  { id: 'trade-center', name: 'Trade Center Tower', kind: 'Office tower', city: 'Colombo 01' },
];

export const TECHNICIANS: Technician[] = [
  { id: 'kasun', name: 'Kasun Perera', initials: 'KP', trade: 'AC & Refrigeration', status: 'on-job', jobsDone: 214, phone: '077 234 5678', rating: 4.9, jobsToday: 3 },
  { id: 'nimal', name: 'Nimal Fernando', initials: 'NF', trade: 'Generators & Power', status: 'on-job', jobsDone: 187, phone: '071 876 5432', rating: 4.8, jobsToday: 2 },
  { id: 'tharindu', name: 'Tharindu Silva', initials: 'TS', trade: 'Lifts & Elevators', status: 'available', jobsDone: 156, phone: '076 345 1298', rating: 4.7, jobsToday: 2 },
  { id: 'sachini', name: 'Sachini Jayasinghe', initials: 'SJ', trade: 'Fire & Security', status: 'available', jobsDone: 132, phone: '070 912 6745', rating: 4.9, jobsToday: 1 },
  { id: 'ruwan', name: 'Ruwan Wickramasinghe', initials: 'RW', trade: 'Electrical & CCTV', status: 'off-duty', jobsDone: 98, phone: '075 628 3910', rating: 4.6, jobsToday: 0 },
  { id: 'dilshan', name: 'Dilshan Bandara', initials: 'DB', trade: 'AC & Refrigeration', status: 'available', jobsDone: 121, phone: '078 450 9821', rating: 4.8, jobsToday: 2 },
];

export const ASSETS: Asset[] = [
  {
    id: 'a1',
    name: 'Lobby Chiller AC',
    type: 'AC',
    siteId: 'grand-pearl',
    qrCode: 'CFX-GPH-AC-001',
    status: 'operational',
    installDate: 'Mar 2021',
    warrantyUntil: 'Mar 2024',
    inWarranty: false,
    amcPlan: 'Comprehensive AMC · renews 01 Jan 2027',
    lifetimeSpend: 486000,
    history: [
      { date: '12 Jul 2026', type: 'Repair', note: 'Low airflow — blower wheel cleaned, belts tensioned.', technician: 'Kasun Perera' },
      { date: '03 Apr 2026', type: 'Quarterly service', note: 'Descaling, coil wash, refrigerant pressure check.', technician: 'Kasun Perera' },
      { date: '18 Jan 2026', type: 'Inspection', note: 'AMC inspection — all parameters within range.', technician: 'Dilshan Bandara' },
    ],
  },
  {
    id: 'a2',
    name: 'Rooftop VRV Unit',
    type: 'AC',
    siteId: 'grand-pearl',
    qrCode: 'CFX-GPH-AC-002',
    status: 'needs-attention',
    installDate: 'Jun 2022',
    warrantyUntil: 'Jun 2025',
    inWarranty: false,
    amcPlan: 'Comprehensive AMC · renews 01 Jan 2027',
    lifetimeSpend: 512000,
    history: [
      { date: '28 Jun 2026', type: 'Repair', note: 'Thermistor fault on circuit 2 — replaced.', technician: 'Kasun Perera' },
      { date: '11 Mar 2026', type: 'Quarterly service', note: 'Filters replaced, drain lines flushed.', technician: 'Dilshan Bandara' },
    ],
  },
  {
    id: 'a3',
    name: 'Standby Generator 250kVA',
    type: 'Generator',
    siteId: 'grand-pearl',
    qrCode: 'CFX-GPH-GEN-001',
    status: 'operational',
    installDate: 'Nov 2020',
    warrantyUntil: 'Nov 2023',
    inWarranty: false,
    amcPlan: 'Generator AMC · quarterly service + test runs',
    lifetimeSpend: 398000,
    history: [
      { date: '20 Jul 2026', type: 'Monthly test run', note: '30-min load test — voltage and frequency stable.', technician: 'Nimal Fernando' },
      { date: '20 Jun 2026', type: 'Service', note: 'Oil + filters changed, coolant topped up.', technician: 'Nimal Fernando' },
    ],
  },
  {
    id: 'a4',
    name: 'Main Generator 500kVA',
    type: 'Generator',
    siteId: 'lanka-threads',
    qrCode: 'CFX-LTG-GEN-001',
    status: 'operational',
    installDate: 'Jan 2022',
    warrantyUntil: 'Jan 2025',
    inWarranty: false,
    amcPlan: 'Generator AMC · quarterly service + test runs',
    lifetimeSpend: 615000,
    history: [
      { date: '02 Jul 2026', type: 'Service', note: '500-hour service — injectors cleaned.', technician: 'Nimal Fernando' },
      { date: '09 May 2026', type: 'Repair', note: 'Block heater fault — element replaced.', technician: 'Nimal Fernando' },
    ],
  },
  {
    id: 'a5',
    name: 'Compressor Room AC',
    type: 'AC',
    siteId: 'lanka-threads',
    qrCode: 'CFX-LTG-AC-001',
    status: 'needs-attention',
    installDate: 'Feb 2026',
    warrantyUntil: 'Feb 2027',
    inWarranty: true,
    amcPlan: 'Installation warranty + Comprehensive AMC',
    lifetimeSpend: 85000,
    history: [
      { date: '25 Jul 2026', type: 'Inspection', note: 'Refrigerant low — gas top-up scheduled.', technician: 'Dilshan Bandara' },
      { date: '14 Feb 2026', type: 'Installation', note: 'Unit commissioned under AMC contract.', technician: 'Kasun Perera' },
    ],
  },
  {
    id: 'a6',
    name: 'Fire Alarm Panel — Block B',
    type: 'Fire Panel',
    siteId: 'lanka-threads',
    qrCode: 'CFX-LTG-FIR-001',
    status: 'operational',
    installDate: 'Sep 2019',
    warrantyUntil: 'Sep 2022',
    inWarranty: false,
    amcPlan: 'Fire & Security AMC · annual certification',
    lifetimeSpend: 210000,
    history: [
      { date: '30 Jul 2026', type: 'Repair', note: 'Backup battery low — replaced and load-tested.', technician: 'Sachini Jayasinghe' },
      { date: '30 Jan 2026', type: 'Annual test', note: 'Full zone walk test — 2 detectors cleaned.', technician: 'Sachini Jayasinghe' },
    ],
  },
  {
    id: 'a7',
    name: 'Passenger Lift A',
    type: 'Lift',
    siteId: 'oceanview',
    qrCode: 'CFX-OVR-LFT-001',
    status: 'needs-attention',
    installDate: 'Aug 2016',
    warrantyUntil: 'Aug 2019',
    inWarranty: false,
    amcPlan: 'Lift AMC · monthly service + 24/7 callouts',
    lifetimeSpend: 890000,
    history: [
      { date: '22 Jul 2026', type: 'Callout', note: 'Door sensor intermittent fault — reported by residents.', technician: 'Tharindu Silva' },
      { date: '15 Apr 2026', type: 'Monthly service', note: 'Guide rails lubricated, safety circuits tested.', technician: 'Tharindu Silva' },
    ],
  },
  {
    id: 'a8',
    name: 'Fire Alarm Panel — Main',
    type: 'Fire Panel',
    siteId: 'oceanview',
    qrCode: 'CFX-OVR-FIR-001',
    status: 'operational',
    installDate: 'May 2021',
    warrantyUntil: 'May 2024',
    inWarranty: false,
    amcPlan: 'Fire & Security AMC · annual certification',
    lifetimeSpend: 145000,
    history: [
      { date: '05 Jun 2026', type: 'Quarterly test', note: 'All 48 detectors responded, sounders OK.', technician: 'Sachini Jayasinghe' },
    ],
  },
  {
    id: 'a9',
    name: 'Lobby AC Unit',
    type: 'AC',
    siteId: 'oceanview',
    qrCode: 'CFX-OVR-AC-001',
    status: 'operational',
    installDate: 'Apr 2023',
    warrantyUntil: 'Apr 2027',
    inWarranty: true,
    amcPlan: 'Standard AMC · bi-annual service',
    lifetimeSpend: 62000,
    history: [
      { date: '27 Jul 2026', type: 'Service', note: 'Filters replaced, condensate pump checked.', technician: 'Ruwan Wickramasinghe' },
    ],
  },
  {
    id: 'a10',
    name: 'Passenger Lift B',
    type: 'Lift',
    siteId: 'trade-center',
    qrCode: 'CFX-TCT-LFT-001',
    status: 'operational',
    installDate: 'Jan 2018',
    warrantyUntil: 'Jan 2021',
    inWarranty: false,
    amcPlan: 'Lift AMC · monthly service + 24/7 callouts',
    lifetimeSpend: 745000,
    history: [
      { date: '19 Jun 2026', type: 'Monthly service', note: 'Door operator adjusted, ropes inspected.', technician: 'Tharindu Silva' },
      { date: '19 Mar 2026', type: 'Repair', note: 'ARD battery pack replaced.', technician: 'Tharindu Silva' },
    ],
  },
  {
    id: 'a11',
    name: 'Server Room Precision AC',
    type: 'AC',
    siteId: 'trade-center',
    qrCode: 'CFX-TCT-AC-001',
    status: 'operational',
    installDate: 'Oct 2024',
    warrantyUntil: 'Oct 2026',
    inWarranty: true,
    amcPlan: 'Comprehensive AMC · quarterly service',
    lifetimeSpend: 128000,
    history: [
      { date: '08 Jul 2026', type: 'Inspection', note: 'Humidity control recalibrated.', technician: 'Dilshan Bandara' },
    ],
  },
  {
    id: 'a12',
    name: 'Standby Generator 350kVA',
    type: 'Generator',
    siteId: 'trade-center',
    qrCode: 'CFX-TCT-GEN-001',
    status: 'needs-attention',
    installDate: 'Jul 2021',
    warrantyUntil: 'Jul 2024',
    inWarranty: false,
    amcPlan: 'Generator AMC · quarterly service + test runs',
    lifetimeSpend: 540000,
    history: [
      { date: '01 Aug 2026', type: 'Service', note: 'Quarterly service in progress — coolant leak traced to hose.', technician: 'Nimal Fernando' },
      { date: '01 May 2026', type: 'Quarterly service', note: 'Full service with load bank test.', technician: 'Nimal Fernando' },
    ],
  },
];

export const JOBS: Job[] = [
  { id: 'j1034', ref: '#1034', title: 'Chiller quarterly descaling', siteId: 'grand-pearl', assetId: 'a1', trade: 'AC', priority: 'medium', status: 'done', technicianId: 'kasun', created: 'Mon 9:02 AM' },
  { id: 'j1035', ref: '#1035', title: 'Lobby chiller low airflow', siteId: 'grand-pearl', assetId: 'a1', trade: 'AC', priority: 'medium', status: 'assigned', technicianId: 'kasun', created: 'Tue 2:40 PM' },
  { id: 'j1036', ref: '#1036', title: 'Quarterly generator service', siteId: 'trade-center', assetId: 'a12', trade: 'Generator', priority: 'medium', status: 'in-progress', technicianId: 'nimal', created: 'Wed 8:15 AM' },
  { id: 'j1037', ref: '#1037', title: 'Lift door sensor fault', siteId: 'oceanview', assetId: 'a7', trade: 'Lift', priority: 'high', status: 'new', technicianId: null, created: 'Wed 11:52 AM' },
  { id: 'j1038', ref: '#1038', title: 'Fire panel battery replacement', siteId: 'lanka-threads', assetId: 'a6', trade: 'Fire Panel', priority: 'high', status: 'done', technicianId: 'sachini', created: 'Thu 10:05 AM' },
  { id: 'j1039', ref: '#1039', title: 'Compressor AC gas top-up', siteId: 'lanka-threads', assetId: 'a5', trade: 'AC', priority: 'medium', status: 'in-progress', technicianId: 'dilshan', created: 'Thu 1:30 PM' },
  { id: 'j1040', ref: '#1040', title: 'Lobby AC filter replacement', siteId: 'oceanview', assetId: 'a9', trade: 'AC', priority: 'low', status: 'done', technicianId: 'ruwan', created: 'Fri 9:44 AM' },
  { id: 'j1041', ref: '#1041', title: 'Lift B annual safety inspection', siteId: 'trade-center', assetId: 'a10', trade: 'Lift', priority: 'medium', status: 'new', technicianId: null, created: 'Fri 3:18 PM' },
];

/** The job created live during tour step 1. */
export const TOUR_JOB: Job = {
  id: 'j1042',
  ref: '#1042',
  title: 'Suite 1204 AC not cooling',
  siteId: 'grand-pearl',
  assetId: 'a2',
  trade: 'AC',
  priority: 'high',
  status: 'new',
  technicianId: null,
  created: 'Just now',
};

export const TOUR_TRACKING_NO = 'CFX-1042-X7K2';

/** The job created in the customer portal's report flow. */
export const PORTAL_JOB_REF = '#1045';
export const PORTAL_TRACKING_NO = 'CFX-1045-M3Q9';

export const CUSTOMERS: Customer[] = [
  { id: 'c-pearl', name: 'Grand Pearl Hotel', contactPerson: 'Amaya Rathnayake — Chief Engineer', phone: '077 452 8890', email: 'engineering@grandpearl.lk', since: '2024', siteIds: ['grand-pearl'] },
  { id: 'c-threads', name: 'Lanka Threads Garments (Pvt) Ltd', contactPerson: 'Ruwan Jayasooriya — Factory Manager', phone: '071 238 9045', email: 'maintenance@lankathreads.lk', since: '2025', siteIds: ['lanka-threads'] },
  { id: 'c-oceanview', name: 'Oceanview Residencies — Management Corp.', contactPerson: 'Fathima Rizvi — Property Manager', phone: '076 811 2234', email: 'office@oceanview.lk', since: '2025', siteIds: ['oceanview'] },
  { id: 'c-tradecenter', name: 'Trade Center Tower (Pvt) Ltd', contactPerson: 'Suresh de Mel — Head of Facilities', phone: '070 555 7812', email: 'facilities@tradecenter.lk', since: '2024', siteIds: ['trade-center'] },
];

export const QUOTATIONS: Quotation[] = [
  {
    id: 'q1',
    ref: 'QT-2026-041',
    customerId: 'c-pearl',
    siteId: 'grand-pearl',
    title: 'VRV compressor replacement — Rooftop unit',
    status: 'sent',
    date: '03 Aug 2026',
    validUntil: '17 Aug 2026',
    lines: [
      { description: 'Compressor unit, R410A, 5HP scroll', qty: 1, unitPrice: 385000 },
      { description: 'Refrigerant R410A recharge (per kg)', qty: 4, unitPrice: 12500 },
      { description: 'Labour — removal, installation, vacuum & pressure test', qty: 1, unitPrice: 45000 },
      { description: 'Materials — copper piping, insulation, brazing', qty: 1, unitPrice: 18500 },
    ],
  },
  {
    id: 'q2',
    ref: 'QT-2026-038',
    customerId: 'c-threads',
    siteId: 'lanka-threads',
    title: 'Fire panel expansion — 8-zone module, Block B',
    status: 'approved',
    date: '28 Jul 2026',
    validUntil: '11 Aug 2026',
    lines: [
      { description: '8-zone expansion module (addressable)', qty: 1, unitPrice: 165000 },
      { description: 'Optical smoke detectors', qty: 12, unitPrice: 8500 },
      { description: 'Installation, programming & certification', qty: 1, unitPrice: 55000 },
    ],
  },
  {
    id: 'q3',
    ref: 'QT-2026-044',
    customerId: 'c-tradecenter',
    siteId: 'trade-center',
    title: 'Lift B — ARD modernization kit',
    status: 'draft',
    date: '04 Aug 2026',
    validUntil: '04 Sep 2026',
    lines: [
      { description: 'ARD unit with Li-ion battery pack', qty: 1, unitPrice: 295000 },
      { description: 'Controller interface card', qty: 1, unitPrice: 48000 },
      { description: 'Installation & commissioning', qty: 1, unitPrice: 38000 },
    ],
  },
  {
    id: 'q4',
    ref: 'QT-2026-036',
    customerId: 'c-oceanview',
    siteId: 'oceanview',
    title: 'Passenger Lift A — door operator replacement',
    status: 'sent',
    date: '25 Jul 2026',
    validUntil: '08 Aug 2026',
    lines: [
      { description: 'Door operator assembly (VVVF)', qty: 1, unitPrice: 340000 },
      { description: 'Door sensors & safety edges', qty: 2, unitPrice: 22000 },
      { description: 'Labour — replacement & alignment', qty: 1, unitPrice: 42000 },
    ],
  },
];

export const INVOICES: Invoice[] = [
  { id: 'inv1', ref: 'INV-2026-118', jobRef: '#1034', customerId: 'c-pearl', title: 'Chiller quarterly descaling', amount: 42500, status: 'unpaid', dueDate: '20 Aug 2026' },
  { id: 'inv2', ref: 'INV-2026-112', jobRef: '#1038', customerId: 'c-threads', title: 'Fire panel battery replacement', amount: 28500, status: 'paid', dueDate: '—' },
  { id: 'inv3', ref: 'INV-2026-109', jobRef: '#1040', customerId: 'c-oceanview', title: 'Lobby AC filter replacement', amount: 12500, status: 'paid', dueDate: '—' },
];

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SCHEDULE: ScheduleEntry[] = [
  { id: 's1', technicianId: 'kasun', day: 0, slot: 'AM', ref: '#1042', title: 'Suite 1204 AC not cooling', siteId: 'grand-pearl' },
  { id: 's2', technicianId: 'kasun', day: 0, slot: 'PM', ref: '#1035', title: 'Lobby chiller low airflow', siteId: 'grand-pearl' },
  { id: 's3', technicianId: 'kasun', day: 2, slot: 'AM', ref: 'SV-88', title: 'VRV quarterly service', siteId: 'grand-pearl' },
  { id: 's4', technicianId: 'nimal', day: 0, slot: 'AM', ref: '#1036', title: 'Quarterly generator service', siteId: 'trade-center' },
  { id: 's5', technicianId: 'nimal', day: 1, slot: 'PM', ref: 'TR-31', title: 'Generator monthly test run', siteId: 'grand-pearl' },
  { id: 's6', technicianId: 'nimal', day: 4, slot: 'AM', ref: 'LB-12', title: 'Load bank test — 500kVA', siteId: 'lanka-threads' },
  { id: 's7', technicianId: 'tharindu', day: 1, slot: 'AM', ref: '#1037', title: 'Lift door sensor fault', siteId: 'oceanview' },
  { id: 's8', technicianId: 'tharindu', day: 3, slot: 'PM', ref: '#1041', title: 'Lift B safety inspection', siteId: 'trade-center' },
  { id: 's9', technicianId: 'sachini', day: 2, slot: 'AM', ref: 'FT-54', title: 'Fire panel quarterly test', siteId: 'oceanview' },
  { id: 's10', technicianId: 'sachini', day: 4, slot: 'PM', ref: 'WT-19', title: 'Detector walk test — Block B', siteId: 'lanka-threads' },
  { id: 's11', technicianId: 'dilshan', day: 0, slot: 'PM', ref: '#1039', title: 'Compressor AC gas top-up', siteId: 'lanka-threads' },
  { id: 's12', technicianId: 'dilshan', day: 2, slot: 'PM', ref: 'SV-91', title: 'Precision AC calibration', siteId: 'trade-center' },
];

export const REPORT_JOBS_PER_WEEK = [
  { week: 'W27', jobs: 12 },
  { week: 'W28', jobs: 15 },
  { week: 'W29', jobs: 11 },
  { week: 'W30', jobs: 18 },
  { week: 'W31', jobs: 14 },
  { week: 'W32', jobs: 17 },
];

export const REPORT_REVENUE = [
  { week: 'W27', lkr: 412000 },
  { week: 'W28', lkr: 528000 },
  { week: 'W29', lkr: 385000 },
  { week: 'W30', lkr: 640000 },
  { week: 'W31', lkr: 495000 },
  { week: 'W32', lkr: 602000 },
];

export const REPORT_REPEAT_FAULTS = [
  { assetId: 'a7', count: 3, note: 'Door sensor fault recurred 3× in 90 days — recommend door operator replacement (QT-2026-036).' },
  { assetId: 'a2', count: 2, note: 'Second cooling fault this quarter — compressor replacement quoted (QT-2026-041).' },
  { assetId: 'a12', count: 2, note: 'Coolant leak reappeared after May service — hose set replacement advised.' },
];

export const TRADE_CHECKLISTS: Record<AssetType, string[]> = {
  AC: ['Inspect unit & error codes', 'Check refrigerant pressure', 'Clean filters & coils', 'Test-run for 15 minutes'],
  Generator: ['Check oil & coolant levels', 'Inspect battery & terminals', 'Test-run under load', 'Log hours & fuel level'],
  Lift: ['Test safety circuits', 'Inspect door operation', 'Lubricate guide rails', 'Check alarm & intercom'],
  'Fire Panel': ['Test all zones', 'Check backup battery', 'Test sounders & strobes', 'Log faults & clear panel'],
};

export const TRACKER_STAGES = ['Reported', 'Scheduled', 'On the way', 'Done'] as const;

/** Map a job status onto the customer-facing tracker (reported → scheduled → on the way → done). */
export function trackerStage(status: JobStatus): number {
  switch (status) {
    case 'new':
      return 0;
    case 'assigned':
      return 1;
    case 'in-progress':
      return 2;
    case 'done':
      return 3;
  }
}

export function siteById(id: string): Site {
  return SITES.find((s) => s.id === id) ?? SITES[0];
}

export function assetById(id: string): Asset {
  return ASSETS.find((a) => a.id === id) ?? ASSETS[0];
}

export function technicianById(id: string): Technician {
  return TECHNICIANS.find((t) => t.id === id) ?? TECHNICIANS[0];
}

export function customerById(id: string): Customer {
  return CUSTOMERS.find((c) => c.id === id) ?? CUSTOMERS[0];
}

/** Customer owning the given site (1:1 in the seed data). */
export function customerBySite(siteId: string): Customer {
  return CUSTOMERS.find((c) => c.siteIds.includes(siteId)) ?? CUSTOMERS[0];
}

export function quotationTotals(q: Quotation): { subtotal: number; vat: number; total: number } {
  const subtotal = q.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const vat = Math.round(subtotal * 0.18);
  return { subtotal, vat, total: subtotal + vat };
}

export function lkr(n: number): string {
  return `LKR ${n.toLocaleString('en-US')}`;
}
