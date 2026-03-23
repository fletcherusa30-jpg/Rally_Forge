import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mosDir = path.join(root, 'knowledge', 'mos');
const outDir = path.join(mosDir, 'generated');

function readJson(file) {
  const p = path.join(mosDir, file);
  const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJsonAbs(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function writeJson(file, obj) {
  writeJsonAbs(path.join(mosDir, file), obj);
}

function rankFromType(type) {
  if (type === 'warrant') return 'Warrant Officer';
  if (type === 'officer') return 'Officer';
  return 'Enlisted';
}

function normalizeBranchShort(branch) {
  if (branch === 'Marine Corps') return 'USMC';
  if (branch === 'Air Force') return 'USAF';
  if (branch === 'Space Force') return 'USSF';
  if (branch === 'Coast Guard') return 'USCG';
  return branch;
}

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeTitle(title) {
  return String(title || '').trim().replace(/\s+/g, ' ');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function defaultDescription(entry, branch) {
  if (entry.description && String(entry.description).trim()) return String(entry.description).trim();
  return `${entry.title} specialty in the ${branch} occupational system.`;
}

function defaultExposure(entry) {
  if (entry.exposureCategory && String(entry.exposureCategory).trim()) return String(entry.exposureCategory).trim();
  if (entry.type === 'officer') return 'Leadership / Staff';
  if (entry.type === 'warrant') return 'Technical / Operational';
  return 'General Military Operations';
}

function enrichEntry(entry, rootBranch) {
  const code = normalizeCode(entry.code);
  const title = normalizeTitle(entry.title);
  const branch = normalizeBranchShort(rootBranch);
  return {
    code,
    title,
    description: defaultDescription(entry, rootBranch),
    branch,
    rankCategory: rankFromType(entry.type),
    feederMOS: entry.feederMOS || null,
    feederCodes: ensureArray(entry.feederCodes),
    feederRatings: ensureArray(entry.feederRatings),
    crossBranchEquivalents: ensureArray(entry.crossBranchEquivalents),
    exposureCategory: defaultExposure(entry),
    notes: entry.notes || `${branch} ${rankFromType(entry.type)} specialty`,
    type: entry.type
  };
}

function dedupeByCode(entries) {
  const seen = new Map();
  for (const item of entries) {
    const key = `${item.code}::${item.rankCategory}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

function addOrUpdateWarrantEntries(catalog, additions) {
  const byCode = new Map(catalog.mos.map((m, idx) => [`${String(m.code).toUpperCase()}::${m.type}`, idx]));
  for (const add of additions) {
    const key = `${add.code}::warrant`;
    const idx = byCode.get(key);
    if (idx === undefined) {
      catalog.mos.push(add);
    } else {
      catalog.mos[idx] = { ...catalog.mos[idx], ...add, type: 'warrant' };
    }
  }
}

const coastGuard = readJson('coast-guard.json');
addOrUpdateWarrantEntries(coastGuard, [
  { code: 'BOSN', title: 'Boatswain', type: 'warrant', description: 'Coast Guard afloat operations and deck seamanship technical warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['BM'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MSSD', title: 'Maritime Security Specialist', type: 'warrant', description: 'Coast Guard maritime security and protection operations technical warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['ME'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MSSR', title: 'Marine Safety Specialist Response', type: 'warrant', description: 'Coast Guard marine safety response and incident operations warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['MST'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MSSE', title: 'Marine Safety Specialist Engineering', type: 'warrant', description: 'Coast Guard marine safety engineering inspection and compliance warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['MST', 'MK'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MSST', title: 'Marine Safety Specialist Training', type: 'warrant', description: 'Coast Guard marine safety training and standards development warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['MST'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MAT', title: 'Materials Officer', type: 'warrant', description: 'Coast Guard materials management and supply sustainment warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['SK'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MLES', title: 'Law Enforcement Specialist', type: 'warrant', description: 'Coast Guard maritime law enforcement operations and policy warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['ME'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'MLEI', title: 'Law Enforcement Intelligence', type: 'warrant', description: 'Coast Guard law enforcement intelligence integration warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['IS', 'ME'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'ELC', title: 'Electronics Technician (Warrant)', type: 'warrant', description: 'Coast Guard electronics systems technical warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['ET'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'ENG', title: 'Engineering Officer (Warrant)', type: 'warrant', description: 'Coast Guard engineering systems and propulsion management warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['MK', 'EM'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'NAV', title: 'Navigation Systems Technician', type: 'warrant', description: 'Coast Guard navigation systems and bridge operations warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['OS', 'BM'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'WEPS', title: 'Weapons Specialist', type: 'warrant', description: 'Coast Guard weapons systems and armament technical warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['GM'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'AVN', title: 'Aviation Engineering Officer (Warrant)', type: 'warrant', description: 'Coast Guard aviation engineering support and maintenance warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['AMT', 'AET'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'AVT', title: 'Aviation Technician (Warrant)', type: 'warrant', description: 'Coast Guard aviation technical maintenance warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['AMT', 'AET', 'AST'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'PERS', title: 'Personnel Administration', type: 'warrant', description: 'Coast Guard personnel administration and readiness warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['YN', 'PS'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'FIN', title: 'Finance & Supply', type: 'warrant', description: 'Coast Guard finance and supply management warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['SK'], notes: 'Coast Guard Warrant Officer Specialty' },
  { code: 'INV', title: 'Investigations Officer', type: 'warrant', description: 'Coast Guard investigative and enforcement support warrant specialty.', rankCategory: 'Warrant Officer', branch: 'Coast Guard', feederRatings: ['ME', 'IS'], notes: 'Coast Guard Warrant Officer Specialty' }
]);
coastGuard.mos = coastGuard.mos.filter((m) => String(m.code).toUpperCase() !== 'F&S');
writeJson('coast-guard.json', coastGuard);

const navy = readJson('navy.json');
addOrUpdateWarrantEntries(navy, [
  { code: '711X', title: 'Boatswain (Surface)', description: 'Navy warrant surface deck and seamanship technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['BM'], notes: 'Navy Warrant Officer Specialty' },
  { code: '712X', title: 'Operations Technician', description: 'Navy warrant operations technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['OS'], notes: 'Navy Warrant Officer Specialty' },
  { code: '713X', title: 'Ship\'s Clerk', description: 'Navy warrant shipboard administration technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['YN', 'PS'], notes: 'Navy Warrant Officer Specialty' },
  { code: '715X', title: 'Special Warfare Combatant-Craft Crewman (SWCC)', description: 'Navy warrant combatant-craft tactical operations specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['SB'], notes: 'Navy Warrant Officer Specialty' },
  { code: '717X', title: 'Boatswain (Submarine)', description: 'Navy warrant submarine deck and seamanship technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['STS', 'TM'], notes: 'Navy Warrant Officer Specialty' },
  { code: '718X', title: 'Diving Officer', description: 'Navy warrant diving operations technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['ND'], notes: 'Navy Warrant Officer Specialty' },
  { code: '721X', title: 'Engineering Technician (Surface)', description: 'Navy warrant surface engineering technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['EN', 'MM'], notes: 'Navy Warrant Officer Specialty' },
  { code: '722X', title: 'Engineering Technician (Submarine)', description: 'Navy warrant submarine engineering technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['MM', 'MT'], notes: 'Navy Warrant Officer Specialty' },
  { code: '723X', title: 'Repair Technician', description: 'Navy warrant ship repair and maintenance technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['HT', 'MR'], notes: 'Navy Warrant Officer Specialty' },
  { code: '724X', title: 'Ordnance Technician', description: 'Navy warrant ordnance and weapons maintenance specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['GM', 'AO', 'FC'], notes: 'Navy Warrant Officer Specialty' },
  { code: '726X', title: 'Electronics Technician (Surface)', description: 'Navy warrant surface electronics technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['ET', 'FC'], notes: 'Navy Warrant Officer Specialty' },
  { code: '727X', title: 'Electronics Technician (Submarine)', description: 'Navy warrant submarine electronics technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['STS', 'ET'], notes: 'Navy Warrant Officer Specialty' },
  { code: '728X', title: 'Aviation Electronics Technician', description: 'Navy warrant aviation electronics technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['AT'], notes: 'Navy Warrant Officer Specialty' },
  { code: '729X', title: 'Aviation Ordnance Technician', description: 'Navy warrant aviation ordnance technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['AO'], notes: 'Navy Warrant Officer Specialty' },
  { code: '731X', title: 'Cryptologic Technician (Surface)', description: 'Navy warrant surface cryptologic operations technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['CTI', 'CTR', 'CTT', 'CTM', 'CTN'], notes: 'Navy Warrant Officer Specialty' },
  { code: '732X', title: 'Cryptologic Technician (Submarine)', description: 'Navy warrant submarine cryptologic operations technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['CTI', 'CTR', 'CTT', 'CTM', 'CTN'], notes: 'Navy Warrant Officer Specialty' },
  { code: '733X', title: 'Information Systems Technician', description: 'Navy warrant information systems and communications technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['IT'], notes: 'Navy Warrant Officer Specialty' },
  { code: '734X', title: 'Intelligence Technician', description: 'Navy warrant intelligence technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['IS'], notes: 'Navy Warrant Officer Specialty' },
  { code: '741X', title: 'Ship\'s Clerk (Admin)', description: 'Navy warrant ship administration technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['YN', 'PS'], notes: 'Navy Warrant Officer Specialty' },
  { code: '751X', title: 'Supply Corps Warrant Officer', description: 'Navy warrant supply corps technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['LS'], notes: 'Navy Warrant Officer Specialty' },
  { code: '752X', title: 'Aviation Maintenance Technician (General)', description: 'Navy warrant aviation maintenance general technical specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['AD'], notes: 'Navy Warrant Officer Specialty' },
  { code: '753X', title: 'Aviation Maintenance Technician (Avionics)', description: 'Navy warrant aviation avionics maintenance specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['AT', 'AE'], notes: 'Navy Warrant Officer Specialty' },
  { code: '754X', title: 'Aviation Maintenance Technician (Structures)', description: 'Navy warrant aviation structures maintenance specialty.', type: 'warrant', branch: 'Navy', feederRatings: ['AM'], notes: 'Navy Warrant Officer Specialty' }
]);
writeJson('navy.json', navy);

const army = readJson('army.json');
addOrUpdateWarrantEntries(army, [
  { code: '120A', title: 'Construction Engineering Technician', description: 'Army warrant construction engineering technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '12-series', notes: 'Army Warrant Officer MOS' },
  { code: '125D', title: 'Geospatial Engineering Technician', description: 'Army warrant geospatial engineering technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '12Y', notes: 'Army Warrant Officer MOS' },
  { code: '131A', title: 'Field Artillery Technician', description: 'Army warrant field artillery technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '13-series', notes: 'Army Warrant Officer MOS' },
  { code: '140A', title: 'Command and Control Systems Technician', description: 'Army warrant command and control systems technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '14-series', notes: 'Army Warrant Officer MOS' },
  { code: '140K', title: 'Air and Missile Defense Tactician/Technician', description: 'Army warrant air and missile defense tactical-technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '14-series', notes: 'Army Warrant Officer MOS' },
  { code: '140L', title: 'Air and Missile Defense Systems Integrator', description: 'Army warrant integrated air and missile defense systems specialty.', type: 'warrant', branch: 'Army', feederMOS: '14-series', notes: 'Army Warrant Officer MOS' },
  { code: '150A', title: 'Aviation Maintenance Technician', description: 'Army warrant aviation maintenance technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '15-series', notes: 'Army Warrant Officer MOS' },
  { code: '150U', title: 'Unmanned Aircraft Systems Operations Technician', description: 'Army warrant UAS operations technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '15W', notes: 'Army Warrant Officer MOS' },
  { code: '151A', title: 'Aviation Maintenance Technician (Aircraft)', description: 'Army warrant aircraft maintenance technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '15-series', notes: 'Army Warrant Officer MOS' },
  { code: '152B', title: 'OH-58D Scout Pilot', description: 'Army warrant scout helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '152C', title: 'OH-6 Pilot', description: 'Army warrant rotary-wing pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '152D', title: 'AH-64D Pilot', description: 'Army warrant attack helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '152F', title: 'AH-64E Pilot', description: 'Army warrant advanced attack helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '153A', title: 'Rotary Wing Aviator', description: 'Army warrant rotary-wing aviation specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '153D', title: 'UH-60 Pilot', description: 'Army warrant utility helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '153E', title: 'MH-60 Pilot', description: 'Army warrant special mission helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '153L', title: 'UH-72 Pilot', description: 'Army warrant light utility helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '154C', title: 'CH-47 Pilot', description: 'Army warrant heavy-lift helicopter pilot specialty.', type: 'warrant', branch: 'Army', feederMOS: null, notes: 'Army Warrant Officer MOS' },
  { code: '170A', title: 'Cyber Operations Technician', description: 'Army warrant cyber operations technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '17C', notes: 'Army Warrant Officer MOS' },
  { code: '180A', title: 'Special Forces Warrant Officer', description: 'Army warrant special forces technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '18-series', notes: 'Army Warrant Officer MOS' },
  { code: '255A', title: 'Information Services Technician', description: 'Army warrant information services technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '25-series', notes: 'Army Warrant Officer MOS' },
  { code: '255N', title: 'Network Management Technician', description: 'Army warrant network management technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '25-series', notes: 'Army Warrant Officer MOS' },
  { code: '255S', title: 'Cyberspace Defense Technician', description: 'Army warrant cyberspace defense technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '17C/25D', notes: 'Army Warrant Officer MOS' },
  { code: '270A', title: 'Legal Administrator', description: 'Army warrant legal administration specialty.', type: 'warrant', branch: 'Army', feederMOS: '27D', notes: 'Army Warrant Officer MOS' },
  { code: '290A', title: 'Electronic Warfare Technician', description: 'Army warrant electronic warfare technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '17E', notes: 'Army Warrant Officer MOS' },
  { code: '350F', title: 'All-Source Intelligence Technician', description: 'Army warrant all-source intelligence technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '35F', notes: 'Army Warrant Officer MOS' },
  { code: '350G', title: 'Imagery Intelligence Technician', description: 'Army warrant geospatial imagery intelligence specialty.', type: 'warrant', branch: 'Army', feederMOS: '35G', notes: 'Army Warrant Officer MOS' },
  { code: '351L', title: 'Counterintelligence Technician', description: 'Army warrant counterintelligence technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '35L', notes: 'Army Warrant Officer MOS' },
  { code: '351M', title: 'Human Intelligence Technician', description: 'Army warrant HUMINT technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '35M', notes: 'Army Warrant Officer MOS' },
  { code: '352N', title: 'Signals Intelligence Analyst Technician', description: 'Army warrant SIGINT analysis technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '35N', notes: 'Army Warrant Officer MOS' },
  { code: '352S', title: 'Signals Collector/Analyst Technician', description: 'Army warrant SIGINT collection and analysis specialty.', type: 'warrant', branch: 'Army', feederMOS: '35S', notes: 'Army Warrant Officer MOS' },
  { code: '420A', title: 'Human Resources Technician', description: 'Army warrant human resources technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '42A', notes: 'Army Warrant Officer MOS' },
  { code: '640A', title: 'Marine Deck Officer', description: 'Army warrant watercraft deck operations specialty.', type: 'warrant', branch: 'Army', feederMOS: '88K/88L', notes: 'Army Warrant Officer MOS' },
  { code: '641A', title: 'Marine Engineering Officer', description: 'Army warrant watercraft engineering specialty.', type: 'warrant', branch: 'Army', feederMOS: '88L', notes: 'Army Warrant Officer MOS' },
  { code: '880A', title: 'Marine Operations Technician', description: 'Army warrant marine operations technical specialty.', type: 'warrant', branch: 'Army', feederMOS: '88-series', notes: 'Army Warrant Officer MOS' }
]);
writeJson('army.json', army);

const cross = readJson('cross-branch-equivalents.json');
const existingCross = new Set((cross.mappings || []).map((m) => `${m.branch}::${m.code}`));
const crossAdditions = [
  { code: 'BOSN', title: 'Boatswain', branch: 'Coast Guard', equivalents: { Army: ['640A'], Navy: ['711X'], 'Air Force': [], 'Space Force': [], 'Marine Corps': ['0301'] }, notes: 'Coast Guard warrant equivalency map' },
  { code: 'ELC', title: 'Electronics Technician (Warrant)', branch: 'Coast Guard', equivalents: { Army: ['948B'], Navy: ['726X'], 'Air Force': ['2A0X1'], 'Space Force': [], 'Marine Corps': ['2805'] }, notes: 'Coast Guard warrant equivalency map' },
  { code: 'ENG', title: 'Engineering Officer (Warrant)', branch: 'Coast Guard', equivalents: { Army: ['120A'], Navy: ['721X'], 'Air Force': [], 'Space Force': [], 'Marine Corps': ['1361'] }, notes: 'Coast Guard warrant equivalency map' },
  { code: 'AVN', title: 'Aviation Engineering Officer (Warrant)', branch: 'Coast Guard', equivalents: { Army: ['151A'], Navy: ['752X'], 'Air Force': ['2A5X1'], 'Space Force': [], 'Marine Corps': [] }, notes: 'Coast Guard warrant equivalency map' },
  { code: '711X', title: 'Boatswain (Surface)', branch: 'Navy', equivalents: { Army: ['640A'], 'Marine Corps': ['0301'], 'Air Force': [], 'Space Force': [], 'Coast Guard': ['BOSN'] }, notes: 'Navy warrant equivalency map' },
  { code: '728X', title: 'Aviation Electronics Technician', branch: 'Navy', equivalents: { Army: ['151A'], 'Marine Corps': ['6316'], 'Air Force': ['2A0X1'], 'Space Force': [], 'Coast Guard': ['AVT'] }, notes: 'Navy warrant equivalency map' },
  { code: '731X', title: 'Cryptologic Technician (Surface)', branch: 'Navy', equivalents: { Army: ['352N'], 'Marine Corps': ['2621'], 'Air Force': ['1N2X1'], 'Space Force': ['1N2'], 'Coast Guard': [] }, notes: 'Navy warrant equivalency map' },
  { code: '754X', title: 'Aviation Maintenance Technician (Structures)', branch: 'Navy', equivalents: { Army: ['151A'], 'Marine Corps': ['6216'], 'Air Force': ['2A7X1'], 'Space Force': [], 'Coast Guard': ['AVN'] }, notes: 'Navy warrant equivalency map' },
  { code: '180A', title: 'Special Forces Warrant Officer', branch: 'Army', equivalents: { 'Marine Corps': ['0370'], Navy: ['715X'], 'Air Force': [], 'Space Force': [], 'Coast Guard': [] }, notes: 'Army warrant equivalency map' },
  { code: '420A', title: 'Human Resources Technician', branch: 'Army', equivalents: { 'Marine Corps': ['0170'], Navy: ['741X'], 'Air Force': ['38F'], 'Space Force': [], 'Coast Guard': ['PERS'] }, notes: 'Army warrant equivalency map' }
];
for (const m of crossAdditions) {
  const key = `${m.branch}::${m.code}`;
  if (!existingCross.has(key)) cross.mappings.push(m);
}
cross.version = new Date().toISOString().slice(0, 10);
cross.source = 'Rally Forge MOS/Warrant normalization and matrix generation';
writeJson('cross-branch-equivalents.json', cross);

const branchFiles = [
  ['Army', 'army.json'],
  ['USMC', 'marine-corps.json'],
  ['Navy', 'navy.json'],
  ['USAF', 'air-force.json'],
  ['USSF', 'space-force.json'],
  ['USCG', 'coast-guard.json'],
];

const catalogs = {};
for (const [short, file] of branchFiles) {
  const data = readJson(file);
  const branchName = data.branch || (short === 'USMC' ? 'Marine Corps' : short);
  const enriched = dedupeByCode((data.mos || []).map((m) => enrichEntry(m, branchName)));
  catalogs[short] = enriched;
}

const byBranchOutput = {
  'army-mos.json': catalogs.Army,
  'usmc-mos.json': catalogs.USMC,
  'navy-mos.json': catalogs.Navy,
  'usaf-afsc.json': catalogs.USAF,
  'ussf-afsc.json': catalogs.USSF,
  'uscg-ratings.json': catalogs.USCG,
};

for (const [file, obj] of Object.entries(byBranchOutput)) {
  writeJsonAbs(path.join(outDir, file), obj);
}

const crossByCode = {};
for (const m of cross.mappings || []) {
  crossByCode[`${m.branch}::${normalizeCode(m.code)}`] = m;
}

function matrixForBranch(branchShort, branchLong) {
  const out = {};
  for (const e of catalogs[branchShort]) {
    const key = `${branchLong}::${e.code}`;
    const map = crossByCode[key];
    out[e.code] = {
      Army: ensureArray(map?.equivalents?.Army),
      Navy: ensureArray(map?.equivalents?.Navy),
      AirForce: ensureArray(map?.equivalents?.['Air Force'] || map?.equivalents?.AirForce),
      SpaceForce: ensureArray(map?.equivalents?.['Space Force'] || map?.equivalents?.SpaceForce),
      CoastGuard: ensureArray(map?.equivalents?.['Coast Guard'] || map?.equivalents?.CoastGuard),
    };
  }
  return out;
}

writeJsonAbs(path.join(outDir, 'usmc-cross-branch-matrix.json'), matrixForBranch('USMC', 'USMC'));

const dodMatrix = {
  Army: { MOS: {} },
  USMC: { MOS: {} },
  Navy: { MOS: {} },
  AirForce: { MOS: {} },
  SpaceForce: { MOS: {} },
  CoastGuard: { MOS: {} }
};

for (const item of catalogs.Army) {
  dodMatrix.Army.MOS[item.code] = {
    USMC: ensureArray(crossByCode[`Army::${item.code}`]?.equivalents?.['Marine Corps']),
    Navy: matrixForBranch('Army', 'Army')[item.code].Navy,
    AirForce: matrixForBranch('Army', 'Army')[item.code].AirForce,
    SpaceForce: matrixForBranch('Army', 'Army')[item.code].SpaceForce,
    CoastGuard: matrixForBranch('Army', 'Army')[item.code].CoastGuard,
  };
}
for (const item of catalogs.USMC) {
  dodMatrix.USMC.MOS[item.code] = {
    Army: matrixForBranch('USMC', 'USMC')[item.code].Army,
    Navy: matrixForBranch('USMC', 'USMC')[item.code].Navy,
    AirForce: matrixForBranch('USMC', 'USMC')[item.code].AirForce,
    SpaceForce: matrixForBranch('USMC', 'USMC')[item.code].SpaceForce,
    CoastGuard: matrixForBranch('USMC', 'USMC')[item.code].CoastGuard,
  };
}
for (const item of catalogs.Navy) {
  dodMatrix.Navy.MOS[item.code] = {
    Army: matrixForBranch('Navy', 'Navy')[item.code].Army,
    USMC: ensureArray(crossByCode[`Navy::${item.code}`]?.equivalents?.['Marine Corps']),
    AirForce: matrixForBranch('Navy', 'Navy')[item.code].AirForce,
    SpaceForce: matrixForBranch('Navy', 'Navy')[item.code].SpaceForce,
    CoastGuard: matrixForBranch('Navy', 'Navy')[item.code].CoastGuard,
  };
}
for (const item of catalogs.USAF) {
  dodMatrix.AirForce.MOS[item.code] = {
    Army: matrixForBranch('USAF', 'Air Force')[item.code].Army,
    USMC: ensureArray(crossByCode[`Air Force::${item.code}`]?.equivalents?.['Marine Corps']),
    Navy: matrixForBranch('USAF', 'Air Force')[item.code].Navy,
    SpaceForce: matrixForBranch('USAF', 'Air Force')[item.code].SpaceForce,
    CoastGuard: matrixForBranch('USAF', 'Air Force')[item.code].CoastGuard,
  };
}
for (const item of catalogs.USSF) {
  dodMatrix.SpaceForce.MOS[item.code] = {
    Army: matrixForBranch('USSF', 'Space Force')[item.code].Army,
    USMC: ensureArray(crossByCode[`Space Force::${item.code}`]?.equivalents?.['Marine Corps']),
    Navy: matrixForBranch('USSF', 'Space Force')[item.code].Navy,
    AirForce: matrixForBranch('USSF', 'Space Force')[item.code].AirForce,
    CoastGuard: matrixForBranch('USSF', 'Space Force')[item.code].CoastGuard,
  };
}
for (const item of catalogs.USCG) {
  dodMatrix.CoastGuard.MOS[item.code] = {
    Army: matrixForBranch('USCG', 'Coast Guard')[item.code].Army,
    USMC: ensureArray(crossByCode[`Coast Guard::${item.code}`]?.equivalents?.['Marine Corps']),
    Navy: matrixForBranch('USCG', 'Coast Guard')[item.code].Navy,
    AirForce: matrixForBranch('USCG', 'Coast Guard')[item.code].AirForce,
    SpaceForce: matrixForBranch('USCG', 'Coast Guard')[item.code].SpaceForce,
  };
}
writeJsonAbs(path.join(outDir, 'dod-cross-branch-matrix.json'), dodMatrix);

const exposureTemplate = (entry) => ({
  exposureCategory: entry.exposureCategory || 'General Military Operations',
  exposureSubcategories: [entry.exposureCategory || 'General Military Operations'],
  typicalHazards: entry.rankCategory === 'Officer'
    ? ['operational-stress']
    : ['noise'],
  operationalEnvironment: entry.rankCategory === 'Officer'
    ? ['staff', 'operational-planning']
    : ['field', 'industrial', 'maritime', 'aviation'].filter((_, i) => i < 2),
  notes: entry.notes || `${entry.branch} occupational exposure baseline`
});

function exposureMatrix(entries) {
  const out = {};
  for (const e of entries) out[e.code] = exposureTemplate(e);
  return out;
}

const exposureByBranch = {
  Army: exposureMatrix(catalogs.Army),
  USMC: exposureMatrix(catalogs.USMC),
  Navy: exposureMatrix(catalogs.Navy),
  USAF: exposureMatrix(catalogs.USAF),
  USSF: exposureMatrix(catalogs.USSF),
  USCG: exposureMatrix(catalogs.USCG),
};

writeJsonAbs(path.join(outDir, 'army-exposure-matrix.json'), exposureByBranch.Army);
writeJsonAbs(path.join(outDir, 'usmc-exposure-matrix.json'), exposureByBranch.USMC);
writeJsonAbs(path.join(outDir, 'navy-exposure-matrix.json'), exposureByBranch.Navy);
writeJsonAbs(path.join(outDir, 'usaf-exposure-matrix.json'), exposureByBranch.USAF);
writeJsonAbs(path.join(outDir, 'ussf-exposure-matrix.json'), exposureByBranch.USSF);
writeJsonAbs(path.join(outDir, 'uscg-exposure-matrix.json'), exposureByBranch.USCG);

function toMasterBranch(branch) {
  if (branch === 'USAF') return 'AirForce';
  if (branch === 'USSF') return 'SpaceForce';
  if (branch === 'USCG') return 'CoastGuard';
  return branch;
}

function crossTemplate() {
  return {
    Army: [],
    USMC: [],
    Navy: [],
    AirForce: [],
    SpaceForce: [],
    CoastGuard: [],
  };
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

const master = [];
for (const [branchKey, entries] of Object.entries(catalogs)) {
  const matrixBranch = toMasterBranch(branchKey);
  const matrixRows = dodMatrix?.[matrixBranch]?.MOS || {};
  const exposureRows = exposureByBranch[branchKey] || {};

  for (const entry of entries) {
    const row = matrixRows[entry.code] || {};
    const crossBranchEquivalents = crossTemplate();
    for (const key of Object.keys(crossBranchEquivalents)) {
      crossBranchEquivalents[key] = ensureArray(row[key]);
    }

    master.push({
      code: entry.code,
      title: normalizeTitle(entry.title),
      description: String(entry.description || '').trim(),
      branch: matrixBranch,
      rankCategory: entry.rankCategory,
      feederCodes: [...new Set([
        ...ensureArray(entry.feederCodes),
        ...ensureArray(entry.feederRatings),
        ...toArray(entry.feederMOS),
      ].map((value) => String(value || '').trim()).filter(Boolean))],
      crossBranchEquivalents,
      exposure: exposureRows[entry.code] || exposureTemplate(entry),
      notes: String(entry.notes || '').trim(),
    });
  }
}

// Distinct by branch + code + rankCategory to preserve same codes across branches/types.
const dedupedMaster = [];
const seenMaster = new Set();
for (const item of master) {
  const key = `${item.branch}::${item.code}::${item.rankCategory}`;
  if (seenMaster.has(key)) continue;
  seenMaster.add(key);
  dedupedMaster.push(item);
}
writeJsonAbs(path.join(outDir, 'dod-mos-master.json'), dedupedMaster);

const analyzerPath = path.join(root, 'knowledge', 'analyzer', 'analyzer-index.json');
const analyzer = JSON.parse(fs.readFileSync(analyzerPath, 'utf8').replace(/^\uFEFF/, ''));
analyzer.generated = new Date().toISOString();
analyzer.mos = {
  'Coast Guard': catalogs.USCG.map((e) => ({ code: e.code, title: e.title })),
  'Space Force': catalogs.USSF.map((e) => ({ code: e.code, title: e.title })),
  'Air Force': catalogs.USAF.map((e) => ({ code: e.code, title: e.title })),
  'USPHS': analyzer.mos?.USPHS || [],
  'Army': catalogs.Army.map((e) => ({ code: e.code, title: e.title })),
  'NOAA': analyzer.mos?.NOAA || [],
  'Marine Corps': catalogs.USMC.map((e) => ({ code: e.code, title: e.title })),
  'Navy': catalogs.Navy.map((e) => ({ code: e.code, title: e.title })),
};
fs.writeFileSync(analyzerPath, JSON.stringify(analyzer, null, 4) + '\n', 'utf8');

console.log('Generated branch files, matrices, dod master registry, exposure matrices, and analyzer index update.');
