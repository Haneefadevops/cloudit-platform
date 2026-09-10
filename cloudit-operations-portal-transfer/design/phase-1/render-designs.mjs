// Phase 1 design tooling only. This file generates static SVG artboards and PNG
// review exports; it is not portal application code and has no runtime behavior.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve('cloudit-operations-portal-transfer/design/phase-1');
const desktopDir = path.join(out, 'desktop');
const mobileDir = path.join(out, 'mobile');
await fs.mkdir(desktopDir, { recursive: true });
await fs.mkdir(mobileDir, { recursive: true });

const C = {
  bg: '#07101f', surface: '#0d192b', raised: '#122139', line: '#243551',
  text: '#f4f7fb', muted: '#91a1b9', faint: '#62738d', purple: '#7c4dff',
  pink: '#ff3868', cyan: '#32c5ff', green: '#35d39a', amber: '#ffb84d',
  red: '#ff5d73', blue: '#86a5d8', white: '#ffffff'
};

const screens = [
  { id: 'login', title: 'Sign in', kicker: 'Private operations portal', type: 'login' },
  { id: 'overview', title: 'Operations overview', kicker: 'All clients · live service and evidence health', type: 'overview' },
  { id: 'client-dashboard', title: 'Cavetta Properties', kicker: 'Production · Europe/Malta', type: 'client' },
  { id: 'clients', title: 'Clients', kicker: 'Tenants, environments and publishing status', type: 'clients' },
  { id: 'workflows', title: 'Workflow health', kicker: 'Curated automation status · never an editable n8n canvas', type: 'workflows' },
  { id: 'infrastructure', title: 'Infrastructure', kicker: 'Website, PostgreSQL and connection evidence', type: 'infrastructure' },
  { id: 'vercel', title: 'Vercel analytics', kicker: 'Supported API evidence · production', type: 'vercel' },
  { id: 'imagekit', title: 'ImageKit analytics', kicker: 'Usage, quota and delivery health', type: 'imagekit' },
  { id: 'backups', title: 'Backup centre', kicker: 'Encrypted archive and isolated restore evidence', type: 'backups' },
  { id: 'reports', title: 'Reports', kicker: 'Private monthly maintenance reports', type: 'reports' },
  { id: 'report-viewer', title: 'September 2026 report', kicker: 'Cavetta Properties · DRAFT · read-only preview', type: 'report' },
  { id: 'incidents', title: 'Incidents', kicker: 'Active and resolved operational findings', type: 'incidents' },
  { id: 'audit-log', title: 'Audit log', kicker: 'Append-only administrative and report history', type: 'audit' },
  { id: 'settings', title: 'Settings', kicker: 'Owner-only controls and policy visibility', type: 'settings' },
  { id: 'system-states', title: 'System states', kicker: 'Loading, empty, no-data, stale, partial, permission and error', type: 'states' },
  { id: 'navigation-map', title: 'Navigation map', kicker: 'Desktop hierarchy and mobile More destination', type: 'navigation' }
];

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const text = (x,y,value,size=14,fill=C.text,weight=500,anchor='start') =>
  `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
const rect = (x,y,w,h,r=16,fill=C.surface,stroke='none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const line = (x1,y1,x2,y2,stroke=C.line,width=1,dash='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
const dot = (x,y,color,r=5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const icon = (x,y,label,color=C.muted) => `${rect(x,y,28,28,8,C.raised)}${text(x+14,y+19,label,11,color,700,'middle')}`;
const pill = (x,y,label,color,w=86) => `${rect(x,y,w,26,13,`${color}20`,`${color}66`)}${dot(x+13,y+13,color,4)}${text(x+24,y+18,label,11,color,700)}`;
const button = (x,y,w,label,primary=false) => `${rect(x,y,w,40,10,primary?'url(#accent)':C.raised,primary?'none':C.line)}${text(x+w/2,y+26,label,13,C.text,650,'middle')}`;
const metric = (x,y,w,label,value,meta,status='green') => {
  const color = C[status] || C.green;
  return `${rect(x,y,w,112,16,C.surface,C.line)}${text(x+18,y+27,label.toUpperCase(),10,C.muted,700)}${text(x+18,y+63,value,28,C.text,720)}${dot(x+20,y+88,color,4)}${text(x+31,y+93,meta,11,C.muted,500)}`;
};
const spark = (x,y,w,h,color=C.purple,points='0,65 40,50 80,58 120,32 160,41 200,20 240,29 280,9') => {
  const coords = points.split(' ').map(p=>{const [a,b]=p.split(',').map(Number);return `${x+a*(w/280)},${y+b*(h/70)}`}).join(' ');
  return `${line(x,y+h,x+w,y+h,C.line)}${line(x,y+h*.5,x+w,y+h*.5,C.line,1,'4 5')}<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const chartCard = (x,y,w,h,titleLabel,sub,color=C.purple) => `${rect(x,y,w,h,16,C.surface,C.line)}${text(x+18,y+28,titleLabel,14,C.text,650)}${text(x+w-18,y+28,sub,11,C.muted,500,'end')}${spark(x+18,y+48,w-36,h-70,color)}`;
const row = (x,y,w,primary,secondary,status='GREEN',right='Fresh now') => {
  const color = status==='GREEN'?C.green:status==='AMBER'?C.amber:status==='RED'?C.red:C.blue;
  return `${rect(x,y,w,54,11,C.raised)}${dot(x+18,y+27,color,5)}${text(x+32,y+22,primary,13,C.text,620)}${text(x+32,y+39,secondary,11,C.muted)}${text(x+w-16,y+31,right,11,color,650,'end')}`;
};
const legend = (x,y) => `${pill(x,y,'GREEN',C.green,78)}${pill(x+86,y,'AMBER',C.amber,82)}${pill(x+176,y,'RED',C.red,64)}${pill(x+248,y,'NO DATA',C.blue,90)}`;

const sidebar = (active) => {
  const nav = [['overview','Overview','OV'],['clients','Clients','CL'],['workflows','Workflows','WF'],['infrastructure','Infrastructure','IN'],['vercel','Vercel','VE'],['imagekit','ImageKit','IK'],['backups','Backups','BK'],['reports','Reports','RP'],['incidents','Incidents','IC'],['audit-log','Audit log','AU'],['settings','Settings','ST']];
  return `${rect(0,0,238,1024,0,'#091426')}
  <path d="M32 42 C43 24 58 24 69 42 C80 60 95 60 106 42 C95 66 80 72 68 54 C56 36 43 36 32 54" fill="none" stroke="url(#accent)" stroke-width="6" stroke-linecap="round"/>
  ${text(121,48,'CLOUDIT',18,C.text,760)}${text(121,66,'OPERATIONS',9,C.muted,700)}
  ${nav.map(([id,label,ic],i)=>{const y=112+i*61;const on=active===id||(active==='client-dashboard'&&id==='clients')||(active==='report-viewer'&&id==='reports')||(active==='system-states'&&id==='settings');return `${on?rect(14,y-11,210,46,11,'#172641'):''}${icon(26,y-2,ic,on?C.white:C.muted)}${text(68,y+17,label,13,on?C.white:C.muted,on?650:500)}${on?`<rect x="14" y="${y-11}" width="3" height="46" rx="2" fill="url(#accent)"/>`:''}`}).join('')}
  ${rect(18,936,202,66,14,C.surface,C.line)}${dot(42,960,C.green,5)}${text(56,960,'Nadun',12,C.text,650)}${text(56,978,'Cloud owner',10,C.muted)}${text(204,970,'⋯',18,C.muted,700,'end')}`;
};

function body(type,x,y,w,mobile=false){
  const gap=mobile?10:14, col=mobile?w:(w-gap)/2, third=mobile?w:(w-gap*2)/3;
  if(type==='overview') return `${legend(x,y)}${mobile?'':metric(x,y+44,third,'Clients healthy','1 / 1','All evidence fresh')+metric(x+third+gap,y+44,third,'Open incidents','2','1 requires attention','amber')+metric(x+(third+gap)*2,y+44,third,'Latest report','DRAFT','September 2026','amber')}${row(x,y+(mobile?48:174),w,'Cavetta Properties','Production · cavetta.com','AMBER','Updated 2m ago')}${chartCard(x,y+(mobile?114:244),col,mobile?172:238,'Service health','Last 24 hours',C.green)}${mobile?'':chartCard(x+col+gap,y+244,col,238,'Evidence freshness','5 minute samples',C.cyan)}${row(x,y+(mobile?298:496),w,'Backup evidence','Archive + checksum + Drive round trip','GREEN','4h ago')}`;
  if(type==='client') return `${legend(x,y)}${metric(x,y+44,third,'Live service','GREEN','5 endpoints healthy')}${mobile?'':metric(x+third+gap,y+44,third,'Analytics','NO DATA','ImageKit collection due','amber')+metric(x+(third+gap)*2,y+44,third,'Automation','AMBER','1 repeated failure','amber')}${chartCard(x,y+(mobile?168:174),w,mobile?170:218,'Public response time','p95 · ms · Europe/Malta',C.cyan)}${row(x,y+(mobile?350:406),w,'Active finding','Vercel analytics evidence is stale','AMBER','Observed 34m ago')}`;
  if(type==='clients') return `${button(x,y,136,'Add client',true)}${pill(x+w-90,y,'OWNER',C.purple,90)}${row(x,y+58,w,'Cavetta Properties','1 environment · 5 endpoints · 10 workflows','AMBER','Evidence 2m ago')}${row(x,y+122,w,'Northwind Studio','Onboarding not started · no publisher','NO DATA','Empty state')}${mobile?'':`${rect(x,y+198,w,250,16,C.surface,C.line)}${text(x+20,y+228,'Selected client boundary',15,C.text,650)}${text(x+20,y+258,'operations database',12,C.muted)}${text(x+230,y+258,'operations role · least privilege',12,C.green)}${text(x+20,y+292,'Shared PostgreSQL service',12,C.muted)}${text(x+230,y+292,'Private Docker network · no public port',12,C.green)}${line(x+20,y+316,x+w-20,y+316)}${text(x+20,y+349,'Publisher',12,C.muted)}${text(x+230,y+349,'Scoped to client + environment + record types',12,C.text)}${text(x+20,y+383,'Browser access',12,C.muted)}${text(x+230,y+383,'Authenticated server routes only',12,C.text)}`}`;
  if(type==='workflows') return `${row(x,y,w,'Approved monthly report sender','Every 5 min · critical','GREEN','Last success 3m')}${row(x,y+64,w,'Automation watchdog','Every 15 min · critical','AMBER','1 timeout bucket')}${row(x,y+128,w,'Weekly health check','Monday 08:00 · normal','GREEN','Next Mon 08:00')}${mobile?'':`${rect(x,y+210,w,268,16,C.surface,C.line)}${text(x+20,y+239,'Curated workflow · Approved report sender',15,C.text,650)}${pill(x+w-106,y+222,'READ ONLY',C.blue,88)}${['Approved report','Atomic claim','Private PDF','SMTP delivery','Record sentAt'].map((s,i)=>`${rect(x+22+i*((w-60)/5),y+292,(w-100)/5,58,12,C.raised,C.line)}${text(x+22+i*((w-60)/5)+(w-100)/10,y+318,`${i+1}`,11,C.purple,700,'middle')}${text(x+22+i*((w-60)/5)+(w-100)/10,y+338,s,10,C.text,600,'middle')}${i<4?text(x+22+i*((w-60)/5)+(w-100)/5+10,y+325,'→',17,C.muted,700,'middle'):''}`).join('')}${spark(x+22,y+382,w-44,62,C.green)}`}`;
  if(type==='infrastructure') return `${metric(x,y,third,'PostgreSQL','UP','Observed 4m ago')}${mobile?'':metric(x+third+gap,y,third,'DB size','2.4 GB','+3.1% in 7d')+metric(x+(third+gap)*2,y,third,'Connections','31%','62 / 200 clients')}${chartCard(x,y+(mobile?124:126),col,mobile?160:210,'Connection utilization','15 min · %',C.purple)}${mobile?'':chartCard(x+col+gap,y+126,col,210,'Memory and disk','15 min · %',C.cyan)}${row(x,y+(mobile?296:352),w,'Private database boundary','operations DB · dedicated role · shared PostgreSQL','GREEN','No public port')}`;
  if(type==='vercel') return `${metric(x,y,third,'Visitors','12.8k','Exact 30-day range')}${mobile?'':metric(x+third+gap,y,third,'Page views','31.4k','+8.2% vs prior')+metric(x+(third+gap)*2,y,third,'Production','READY','Deployed 2d ago')}${chartCard(x,y+(mobile?124:126),w,mobile?180:224,'Traffic trend','Daily · Europe/Malta',C.purple)}${row(x,y+(mobile?316:366),w,'/properties','8,214 page views','GREEN','Allowlisted route')}${row(x,y+(mobile?380:430),w,'Usage metrics','Not available on verified API/plan','NO DATA','Does not affect uptime')}`;
  if(type==='imagekit') return `${metric(x,y,third,'Bandwidth','62%','38% remaining','amber')}${mobile?'':metric(x+third+gap,y,third,'Media storage','41%','59% remaining')+metric(x+(third+gap)*2,y,third,'Delivery','GREEN','Stable asset healthy')}${chartCard(x,y+(mobile?124:126),w,mobile?180:224,'Bandwidth usage','6 hour samples · provider cached',C.pink)}${row(x,y+(mobile?316:366),w,'Last successful collection','10 Sep 2026 · 06:00 Europe/Malta','GREEN','As of 6h ago')}${row(x,y+(mobile?380:430),w,'Request counts','Unsupported provider field','NO DATA','Shown honestly')}`;
  if(type==='backups') return `${metric(x,y,third,'Latest backup','PASSED','4h old · 68.2 MB')}${mobile?'':metric(x+third+gap,y,third,'Restore test','PASSED','8d old')+metric(x+(third+gap)*2,y,third,'Next run','02:17 UTC','In 17 hours')}${rect(x,y+(mobile?124:126),w,mobile?230:252,16,C.surface,C.line)}${text(x+18,y+(mobile?153:155),'September 2026',15,C.text,650)}${['M','T','W','T','F','S','S'].map((d,i)=>text(x+31+i*((w-48)/7),y+(mobile?184:190),d,10,C.muted,700,'middle')).join('')}${Array.from({length:14},(_,i)=>{const cx=x+31+(i%7)*((w-48)/7),cy=y+(mobile?215:225)+Math.floor(i/7)*50;const color=i===11?C.red:i===13?C.blue:C.green;return `${dot(cx,cy,color,10)}${text(cx,cy+31,String(i+1).padStart(2,'0'),9,C.muted,600,'middle')}`}).join('')}${row(x,y+(mobile?366:394),w,'Encrypted archive pair','AES-256 archive + checksum · round trip verified','GREEN','GitHub run ↗')}`;
  if(type==='reports') return `${row(x,y,w,'September 2026 maintenance report','DRAFT · partial evidence · generated 09:12','AMBER','Review only')}${row(x,y+64,w,'August 2026 maintenance report','DRAFT · historical non-authoritative evidence','NO DATA','Excluded from health')}${row(x,y+128,w,'July 2026 maintenance report','SENT · historical pre-guard acceptance','GREEN','Sent 01 Aug')}${mobile?'':`${rect(x,y+210,w,220,16,C.surface,C.line)}${text(x+20,y+241,'Report state model',15,C.text,650)}${['DRAFT','APPROVED','SENDING','SENT'].map((s,i)=>`${pill(x+22+i*146,y+274,s,i===3?C.green:i===2?C.amber:C.blue,112)}${i<3?text(x+139+i*146,y+293,'→',16,C.muted,700):''}`).join('')}${text(x+22,y+337,'Opening or downloading a report never changes its state.',12,C.green,650)}${text(x+22,y+368,'Approve, reject and send controls are intentionally absent in Phase 1.',12,C.muted)}`}`;
  if(type==='report') return `${pill(x,y,'DRAFT',C.amber,76)}${pill(x+86,y,'PARTIAL',C.blue,86)}${button(x+w-136,y,136,'Download PDF')}${rect(x,y+58,mobile?w:w*.66,mobile?324:466,12,'#eef1f5')}${text(x+(mobile?w/2:w*.33),y+94,'CLOUDIT MONTHLY MAINTENANCE',11,'#59677c',700,'middle')}${text(x+(mobile?w/2:w*.33),y+137,'September 2026',24,'#0c1830',760,'middle')}${rect(x+24,y+168,(mobile?w:w*.66)-48,68,8,'#ffffff','#d6dde8')}${text(x+40,y+195,'Overall status',10,'#65758c',700)}${text(x+40,y+222,'AMBER · Evidence incomplete',17,'#b76b00',700)}${text(x+24,y+272,'Sanitized findings',13,'#17243a',700)}${text(x+40,y+302,'• Vercel analytics evidence is stale',12,'#3d4c62')}${text(x+40,y+329,'• Live service remains healthy',12,'#3d4c62')}${mobile?'':`${rect(x+w*.68+16,y+58,w*.32-16,466,16,C.surface,C.line)}${text(x+w*.68+36,y+90,'Report history',14,C.text,650)}${row(x+w*.68+30,y+112,w*.32-44,'Generated','09:12 · private PDF','GREEN','')}${row(x+w*.68+30,y+178,w*.32-44,'Review reminder','Not yet due','NO DATA','')}${text(x+w*.68+36,y+272,'Read-only boundary',12,C.muted,700)}${text(x+w*.68+36,y+300,'No approve action',12,C.green)}${text(x+w*.68+36,y+326,'No reject action',12,C.green)}${text(x+w*.68+36,y+352,'No send action',12,C.green)}${text(x+w*.68+36,y+392,'Server-mediated PDF',12,C.text)}`}`;
  if(type==='incidents') return `${button(x,y,126,'Active · 2',true)}${button(x+136,y,126,'Resolved · 18')}${row(x,y+62,w,'Vercel analytics evidence stale','Analytics · missing evidence · occurrence 1','AMBER','34m open')}${row(x,y+126,w,'Workflow timeout repeated','Automation watchdog · timeout · occurrence 3','RED','12m open')}${mobile?'':`${rect(x,y+208,w,236,16,C.surface,C.line)}${text(x+20,y+239,'Recovery timeline',15,C.text,650)}${dot(x+34,y+282,C.amber,7)}${line(x+34,y+289,x+34,y+382,C.line,2)}${text(x+55,y+279,'Detected',12,C.text,650)}${text(x+55,y+298,'09:14 · safe category: timeout',11,C.muted)}${dot(x+34,y+342,C.red,7)}${text(x+55,y+339,'Confirmed',12,C.text,650)}${text(x+55,y+358,'09:16 · third repeated failure',11,C.muted)}${dot(x+34,y+396,C.blue,7)}${text(x+55,y+400,'Awaiting recovery evidence',12,C.muted,600)}`}`;
  if(type==='audit') return `${row(x,y,w,'Report viewed','Owner · report September 2026 · success','GREEN','10 Sep · 10:04')}${row(x,y+64,w,'Publisher rotated','Owner · Cavetta production · success','GREEN','08 Sep · 16:22')}${row(x,y+128,w,'Command rejected','System · stale version · no change','AMBER','07 Sep · 11:41')}${mobile?'':`${rect(x,y+210,w,188,16,C.surface,C.line)}${text(x+20,y+241,'Audit privacy',15,C.text,650)}${text(x+20,y+278,'✓ Append-only presentation',12,C.green)}${text(x+20,y+307,'✓ Safe actor and target identifiers',12,C.green)}${text(x+20,y+336,'✓ No payload, email, token or before/after values',12,C.green)}`}`;
  if(type==='settings') return `${row(x,y,w,'Owner authentication','MFA decision required before Phase 2','AMBER','Planning')}${row(x,y+64,w,'Operations database','Separate “operations” DB · dedicated least-privilege role','GREEN','Approved direction')}${row(x,y+128,w,'Ticketing and client notifications','Disabled','GREEN','Locked off')}${row(x,y+192,w,'External whole-server monitor','Not configured · same-server Kuma insufficient','NO DATA','Later phase')}${mobile?'':`${rect(x,y+274,w,168,16,C.surface,C.line)}${text(x+20,y+305,'Deployment fit',15,C.text,650)}${text(x+20,y+339,'Traefik → portal container → private PostgreSQL',12,C.text)}${text(x+20,y+369,'Docker “cloudit” network · GitHub Actions gated',12,C.muted)}${text(x+20,y+399,'No DNS, Compose or workflow changes in Phase 1',12,C.green)}`}`;
  if(type==='states') return `${[['LOADING','Skeleton content · retain page context',C.purple],['EMPTY','No configured records · show next safe action',C.blue],['NO DATA','Source unsupported or not yet collected',C.blue],['STALE','Keep last value · show observed time',C.amber],['PARTIAL','Some evidence missing · never claim healthy',C.amber],['PERMISSION','Explain access boundary · reveal no metadata',C.red],['ERROR','Safe category + retry · never raw error',C.red]].map(([a,b,c],i)=>{const yy=y+i*(mobile?58:62);return `${rect(x,yy,w,50,12,C.surface,C.line)}${pill(x+12,yy+12,a,c,mobile?88:100)}${text(x+(mobile?110:126),yy+30,b,mobile?10:12,C.muted,500)}`}).join('')}`;
  if(type==='navigation') {
    if(mobile) return `${rect(x,y,w,474,20,C.surface,C.line)}${text(x+20,y+34,'More',22,C.text,740)}${text(x+20,y+57,'All remaining portal areas',11,C.muted)}${[['IN','Infrastructure'],['VE','Vercel analytics'],['IK','ImageKit analytics'],['BK','Backups'],['RP','Reports'],['IC','Incidents'],['AU','Audit log'],['ST','Settings']].map(([ic,label],i)=>{const xx=x+14+(i%2)*166,yy=y+84+Math.floor(i/2)*82;return `${rect(xx,yy,158,64,12,C.raised,C.line)}${icon(xx+12,yy+18,ic,C.text)}${text(xx+50,yy+39,label,11,C.text,620)}`}).join('')}${text(x+20,y+442,'Detail routes return to their parent area.',11,C.green,650)}`;
    return `${rect(x,y,w,414,18,C.surface,C.line)}${text(x+22,y+34,'Route hierarchy',16,C.text,680)}${text(x+22,y+58,'Persistent sidebar → collection → authorized detail',11,C.muted)}${[['Overview','/'],['Clients','/clients'],['↳ Client dashboard','/clients/:clientKey'],['Workflows','/workflows'],['Infrastructure','/infrastructure'],['Vercel analytics','/analytics/vercel'],['ImageKit analytics','/analytics/imagekit'],['Backups','/backups'],['Reports','/reports'],['↳ Report viewer','/reports/:reportKey'],['Incidents','/incidents'],['Audit log','/audit'],['Settings','/settings']].map(([label,route],i)=>{const col=i<7?0:1,rowIndex=i<7?i:i-7,xx=x+22+col*(w/2),yy=y+92+rowIndex*43;return `${dot(xx,yy-4,label.startsWith('↳')?C.purple:C.green,4)}${text(xx+14,yy,label,12,label.startsWith('↳')?C.muted:C.text,620)}${text(xx+w/2-42,yy,route,10,C.faint,500,'end')}`}).join('')}`;
  }
  return '';
}

function loginSvg(mobile){
  const W=mobile?390:1440,H=mobile?844:1024, panelW=mobile?342:444,px=(W-panelW)/2,py=mobile?110:184;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="accent"><stop stop-color="${C.pink}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient><radialGradient id="glow"><stop stop-color="#4b2c8d" stop-opacity=".42"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="${C.bg}"/><circle cx="${mobile?325:1080}" cy="160" r="${mobile?230:500}" fill="url(#glow)"/>${rect(px,py,panelW,mobile?580:620,24,C.surface,C.line)}<path d="M${px+34} ${py+51} C${px+46} ${py+31} ${px+62} ${py+31} ${px+74} ${py+51} C${px+86} ${py+71} ${px+102} ${py+71} ${px+114} ${py+51}" fill="none" stroke="url(#accent)" stroke-width="7" stroke-linecap="round"/>${text(px+130,py+54,'CLOUDIT',18,C.text,760)}${text(px+34,py+118,'Operations Portal',mobile?25:31,C.text,750)}${text(px+34,py+150,'Private access for authorized maintainers',13,C.muted)}${text(px+34,py+205,'EMAIL',10,C.muted,700)}${rect(px+34,py+220,panelW-68,50,10,C.raised,C.line)}${text(px+50,py+251,'owner@cloudit.lk',13,C.faint)}${text(px+34,py+303,'PASSWORD',10,C.muted,700)}${rect(px+34,py+318,panelW-68,50,10,C.raised,C.line)}${text(px+50,py+349,'••••••••••••',14,C.faint)}${button(px+34,py+394,panelW-68,'Sign in securely',true)}${rect(px+34,py+458,panelW-68,80,12,'#0a1628',C.line)}${icon(px+50,py+476,'S',C.green)}${text(px+88,py+489,'Protected session',12,C.text,650)}${text(px+88,py+509,'MFA and recovery policy confirmed before Phase 2',10,C.muted)}${text(W/2,H-35,'Design data · illustrative · no production connection',10,C.faint,500,'middle')}</svg>`;
}

function artboard(screen,mobile=false){
  if(screen.type==='login') return loginSvg(mobile);
  const W=mobile?390:1440,H=mobile?844:1024;
  const defs=`<defs><linearGradient id="accent"><stop stop-color="${C.pink}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient></defs>`;
  if(mobile){
    const nav=['Overview','Clients','Workflows','More'];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">${defs}<rect width="390" height="844" fill="${C.bg}"/>${rect(0,0,390,72,0,'#091426')}${text(20,31,'CLOUDIT',15,C.text,760)}${text(20,49,'OPERATIONS',8,C.muted,700)}${pill(272,23,'AMBER',C.amber,86)}${text(18,106,screen.title,23,C.text,760)}${text(18,128,screen.kicker,10,C.muted)}${body(screen.type,18,154,354,true)}${rect(0,774,390,70,0,'#091426',C.line)}${nav.map((n,i)=>`${icon(20+i*94,786,['OV','CL','WF','••'][i],i===3?C.text:C.muted)}${text(34+i*94,830,n,9,i===3?C.text:C.muted,600,'middle')}`).join('')}${text(372,760,'Illustrative',8,C.faint,500,'end')}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1024" viewBox="0 0 1440 1024">${defs}<rect width="1440" height="1024" fill="${C.bg}"/>${sidebar(screen.id)}${text(278,66,screen.title,28,C.text,760)}${text(278,91,screen.kicker,12,C.muted)}${pill(1260,42,'AMBER',C.amber,88)}${text(1368,96,'Design data · illustrative',9,C.faint,500,'end')}${body(screen.type,278,126,1116,false)}</svg>`;
}

for (const screen of screens) {
  for (const mobile of [false,true]) {
    const dir=mobile?mobileDir:desktopDir;
    const svg=artboard(screen,mobile);
    const svgPath=path.join(dir,`${screen.id}.svg`);
    const pngPath=path.join(dir,`${screen.id}.png`);
    await fs.writeFile(svgPath,svg,'utf8');
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
  }
}

async function contactSheet(mobile=false) {
  const cols=mobile?5:3, thumbW=mobile?234:432, thumbH=mobile?506:307, labelH=34;
  const rows=Math.ceil(screens.length/cols), pad=18;
  const width=pad+cols*(thumbW+pad), height=pad+rows*(thumbH+labelH+pad);
  const composites=[];
  for (let i=0;i<screens.length;i++) {
    const screen=screens[i], left=pad+(i%cols)*(thumbW+pad), top=pad+Math.floor(i/cols)*(thumbH+labelH+pad);
    const png=await sharp(path.join(mobile?mobileDir:desktopDir,`${screen.id}.png`)).resize(thumbW,thumbH,{fit:'fill'}).toBuffer();
    const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${thumbW}" height="${labelH}"><rect width="100%" height="100%" fill="${C.surface}"/><text x="12" y="23" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${C.text}">${esc(`${String(i+1).padStart(2,'0')} · ${screen.title}`)}</text></svg>`);
    composites.push({input:png,left,top},{input:label,left,top:top+thumbH});
  }
  await sharp({create:{width,height,channels:4,background:C.bg}}).composite(composites).png().toFile(path.join(out,mobile?'mobile-contact-sheet.png':'desktop-contact-sheet.png'));
}

await contactSheet(false);
await contactSheet(true);
console.log(`Generated ${screens.length * 2} SVG artboards, ${screens.length * 2} PNG review exports and two contact sheets.`);
