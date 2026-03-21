import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mosDir = join(__dirname, '..', 'knowledge', 'mos');

function loadCatalog(name) {
  const raw = readFileSync(join(mosDir, name), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function saveCatalog(name, data) {
  writeFileSync(join(mosDir, name), JSON.stringify(data, null, 4) + '\n', 'utf8');
}

// ── ARMY ──
const army = loadCatalog('army.json');
army.mos.forEach(e => { e.type = 'enlisted'; });

const armyWarrant = [
  { code: '131A', title: 'Field Artillery Targeting Technician', type: 'warrant' },
  { code: '140A', title: 'Command and Control Systems Integrator', type: 'warrant' },
  { code: '150A', title: 'Air Traffic and Airspace Management Technician', type: 'warrant' },
  { code: '150U', title: 'Unmanned Aircraft Systems Operations Technician', type: 'warrant' },
  { code: '153A', title: 'Rotary Wing Aviator', type: 'warrant' },
  { code: '153M', title: 'Rotary Wing Aviator (MH-47)', type: 'warrant' },
  { code: '155A', title: 'Fixed Wing Aviator', type: 'warrant' },
  { code: '170A', title: 'Cyber Operations Technician', type: 'warrant' },
  { code: '255A', title: 'Information Services Technician', type: 'warrant' },
  { code: '255N', title: 'Network Management Technician', type: 'warrant' },
  { code: '255Z', title: 'Senior Network Operations Technician', type: 'warrant' },
  { code: '270A', title: 'Legal Administrator', type: 'warrant' },
  { code: '350F', title: 'All Source Intelligence Technician', type: 'warrant' },
  { code: '350G', title: 'Imagery Intelligence Technician', type: 'warrant' },
  { code: '351L', title: 'Counterintelligence Technician', type: 'warrant' },
  { code: '352N', title: 'Signal Intelligence Analysis Technician', type: 'warrant' },
  { code: '353T', title: 'IEW Equipment Technician', type: 'warrant' },
  { code: '890A', title: 'Ammunition Warrant Officer', type: 'warrant' },
  { code: '913A', title: 'Armament Systems Maintenance Warrant Officer', type: 'warrant' },
  { code: '915A', title: 'Automotive Maintenance Warrant Officer', type: 'warrant' },
  { code: '919A', title: 'Engineer Equipment Maintenance Warrant Officer', type: 'warrant' },
  { code: '920A', title: 'Property Accounting Technician', type: 'warrant' },
  { code: '920B', title: 'Supply Systems Technician', type: 'warrant' },
  { code: '948B', title: 'Electronic Systems Maintenance Warrant Officer', type: 'warrant' },
  { code: '948D', title: 'Electronic Missile Systems Maintenance Warrant Officer', type: 'warrant' },
];

const armyOfficer = [
  { code: '11A', title: 'Infantry Officer', type: 'officer' },
  { code: '12A', title: 'Engineer Officer', type: 'officer' },
  { code: '13A', title: 'Field Artillery Officer', type: 'officer' },
  { code: '14A', title: 'Air Defense Artillery Officer', type: 'officer' },
  { code: '15A2', title: 'Aviation General Officer', type: 'officer' },
  { code: '17A', title: 'Cyber Operations Officer', type: 'officer' },
  { code: '18A2', title: 'Special Forces Officer', type: 'officer' },
  { code: '19A', title: 'Armor Officer', type: 'officer' },
  { code: '25A2', title: 'Signal Officer', type: 'officer' },
  { code: '26A', title: 'Network Systems Engineering', type: 'officer' },
  { code: '26B', title: 'Information Systems Management', type: 'officer' },
  { code: '27A', title: 'Judge Advocate', type: 'officer' },
  { code: '30A', title: 'Information Operations Officer', type: 'officer' },
  { code: '31A2', title: 'Military Police Officer', type: 'officer' },
  { code: '35A2', title: 'Military Intelligence Officer', type: 'officer' },
  { code: '36A2', title: 'Financial Management Officer', type: 'officer' },
  { code: '38A2', title: 'Civil Affairs Officer', type: 'officer' },
  { code: '42B2', title: 'Human Resources Officer', type: 'officer' },
  { code: '46A2', title: 'Public Affairs Officer', type: 'officer' },
  { code: '56A', title: 'Chaplain', type: 'officer' },
  { code: '60A', title: 'Operational Medicine', type: 'officer' },
  { code: '61A', title: 'Medical Specialist Officer', type: 'officer' },
  { code: '64A', title: 'Veterinary Officer', type: 'officer' },
  { code: '65A', title: 'Occupational Therapy Officer', type: 'officer' },
  { code: '66H', title: 'Psychiatric Nurse', type: 'officer' },
  { code: '67J', title: 'Aeromedical Evacuation Officer', type: 'officer' },
  { code: '70A', title: 'Health Services Administration', type: 'officer' },
  { code: '72A', title: 'Telecommunications Systems Engineer', type: 'officer' },
  { code: '74A2', title: 'Chemical Officer', type: 'officer' },
  { code: '88A2', title: 'Transportation Officer', type: 'officer' },
  { code: '89E', title: 'Explosive Ordnance Disposal Officer', type: 'officer' },
  { code: '91A2', title: 'Maintenance Officer', type: 'officer' },
  { code: '92A2', title: 'Quartermaster Officer', type: 'officer' },
];

const armyExisting = new Set(army.mos.map(e => e.code));
army.mos = [...army.mos, ...armyWarrant.filter(e => !armyExisting.has(e.code)), ...armyOfficer.filter(e => !armyExisting.has(e.code))];
saveCatalog('army.json', army);
console.log(`Army: ${army.mos.length} entries (${army.mos.filter(e=>e.type==='enlisted').length} E, ${army.mos.filter(e=>e.type==='warrant').length} W, ${army.mos.filter(e=>e.type==='officer').length} O)`);

// ── NAVY ──
const navy = loadCatalog('navy.json');
navy.mos.forEach(e => { e.type = 'enlisted'; });

const navyWarrant = [
  { code: '7120', title: 'Aviation Maintenance Duty Officer (Warrant)', type: 'warrant' },
  { code: '7210', title: 'Air Traffic Control Warrant Officer', type: 'warrant' },
  { code: '7310', title: 'Ship Repair Warrant Officer', type: 'warrant' },
  { code: '7412', title: 'Civil Engineer Corps Warrant Officer', type: 'warrant' },
  { code: '7481', title: 'Diving Warrant Officer', type: 'warrant' },
  { code: '7491', title: 'Explosive Ordnance Disposal Warrant Officer', type: 'warrant' },
  { code: '7511', title: 'Surface Operations Warrant Officer', type: 'warrant' },
  { code: '7521', title: 'Naval Intelligence Warrant Officer', type: 'warrant' },
  { code: '7811', title: 'Supply Corps Warrant Officer', type: 'warrant' },
  { code: '7831', title: 'Personnel Administration Warrant Officer', type: 'warrant' },
];

const navyOfficer = [
  { code: '1110', title: 'Surface Warfare Officer', type: 'officer' },
  { code: '1120', title: 'Submarine Warfare Officer', type: 'officer' },
  { code: '1130', title: 'Special Warfare Officer (SEAL)', type: 'officer' },
  { code: '1140', title: 'Special Operations Officer (EOD)', type: 'officer' },
  { code: '1310', title: 'Naval Aviator', type: 'officer' },
  { code: '1320', title: 'Naval Flight Officer', type: 'officer' },
  { code: '1510', title: 'Intelligence Officer', type: 'officer' },
  { code: '1610', title: 'Information Warfare Officer', type: 'officer' },
  { code: '1710', title: 'Cyber Warfare Engineer', type: 'officer' },
  { code: '1810', title: 'Oceanography Officer', type: 'officer' },
  { code: '2100', title: 'Nuclear Power Officer', type: 'officer' },
  { code: '2200', title: 'Information Professional', type: 'officer' },
  { code: '2300', title: 'Meteorology / Oceanography Officer', type: 'officer' },
  { code: '2500', title: 'Judge Advocate General Corps', type: 'officer' },
  { code: '2900', title: 'Supply Corps Officer', type: 'officer' },
  { code: '3100', title: 'Civil Engineer Corps', type: 'officer' },
  { code: '4100', title: 'Medical Corps', type: 'officer' },
  { code: '4200', title: 'Dental Corps', type: 'officer' },
  { code: '4500', title: 'Medical Service Corps', type: 'officer' },
  { code: '4600', title: 'Nurse Corps', type: 'officer' },
];

const navyExisting = new Set(navy.mos.map(e => e.code));
navy.mos = [...navy.mos, ...navyWarrant.filter(e => !navyExisting.has(e.code)), ...navyOfficer.filter(e => !navyExisting.has(e.code))];
saveCatalog('navy.json', navy);
console.log(`Navy: ${navy.mos.length} entries (${navy.mos.filter(e=>e.type==='enlisted').length} E, ${navy.mos.filter(e=>e.type==='warrant').length} W, ${navy.mos.filter(e=>e.type==='officer').length} O)`);

// ── MARINES ──
const marines = loadCatalog('marine-corps.json');
// Marine MOS: enlisted = 4-digit ending in 0-9 at lower series, officers typically xx01/xx02 or 03xx vs 01xx
// Classify by known patterns: 0301, 0302, 0602, 1802, etc. are officer
const marineOfficerCodes = new Set([
  '0102','0180','0202','0203','0207','0302','0370','0402','0602','0802',
  '1302','1370','1802','2502','3002','3102','3404','3502','4402','5803','6002','7202','7315'
]);
marines.mos.forEach(e => {
  if (marineOfficerCodes.has(e.code)) {
    e.type = 'officer';
  } else {
    e.type = 'enlisted';
  }
});

const marineOfficerNew = [
  { code: '0102', title: 'Marine Officer Candidate', type: 'officer' },
  { code: '0202', title: 'Intelligence Officer', type: 'officer' },
  { code: '0302', title: 'Infantry Officer', type: 'officer' },
  { code: '0402', title: 'Logistics Officer', type: 'officer' },
  { code: '0602', title: 'Communications Officer', type: 'officer' },
  { code: '0802', title: 'Artillery Officer', type: 'officer' },
  { code: '1302', title: 'Engineer Officer (Combat)', type: 'officer' },
  { code: '1802', title: 'Tank Officer', type: 'officer' },
  { code: '2502', title: 'Operational Communications Officer', type: 'officer' },
  { code: '3002', title: 'Supply Administration Officer', type: 'officer' },
  { code: '3102', title: 'Purchasing Officer', type: 'officer' },
  { code: '3502', title: 'Motor Transport Officer', type: 'officer' },
  { code: '4402', title: 'Legal Services Officer', type: 'officer' },
  { code: '5803', title: 'Military Police Officer', type: 'officer' },
  { code: '6002', title: 'Aircraft Maintenance Officer', type: 'officer' },
  { code: '7202', title: 'Air Traffic Control Officer', type: 'officer' },
  { code: '7315', title: 'AV-8B Pilot', type: 'officer' },
];

// Marines don't have warrant officers in the traditional sense
const marineWarrant = [
  { code: 'W0120', title: 'Personnel Officer (Warrant)', type: 'warrant' },
  { code: 'W0430', title: 'Mobility Officer (Warrant)', type: 'warrant' },
  { code: 'W0602', title: 'Communications Warrant Officer', type: 'warrant' },
  { code: 'W2805', title: 'Electronics Maintenance Warrant Officer', type: 'warrant' },
  { code: 'W3510', title: 'Motor Transport Warrant Officer', type: 'warrant' },
  { code: 'W4130', title: 'Marine Corps Community Services Warrant Officer', type: 'warrant' },
];

const marineExisting = new Set(marines.mos.map(e => e.code));
marines.mos = [...marines.mos, ...marineOfficerNew.filter(e => !marineExisting.has(e.code)), ...marineWarrant.filter(e => !marineExisting.has(e.code))];
saveCatalog('marine-corps.json', marines);
console.log(`Marines: ${marines.mos.length} entries (${marines.mos.filter(e=>e.type==='enlisted').length} E, ${marines.mos.filter(e=>e.type==='warrant').length} W, ${marines.mos.filter(e=>e.type==='officer').length} O)`);

// ── AIR FORCE ──
const af = loadCatalog('air-force.json');
// AFSC: Enlisted = digit+letter+digit+X+digit (1A0X1); Officer = digit+digit+letter+digit or similar
af.mos.forEach(e => {
  // Officer AFSCs typically are 2 digits + letter (no X), like 11BX, 12SX, 13BX
  const code = e.code.toUpperCase();
  if (/^\d{2}[A-Z]X?$/i.test(code) || /^\d{2}[A-Z]\d$/i.test(code)) {
    e.type = 'officer';
  } else {
    e.type = 'enlisted';
  }
});

const afOfficer = [
  { code: '11BX', title: 'Bomber Pilot', type: 'officer' },
  { code: '11FX', title: 'Fighter Pilot', type: 'officer' },
  { code: '11HX', title: 'Helicopter Pilot', type: 'officer' },
  { code: '11SX', title: 'Special Operations Pilot', type: 'officer' },
  { code: '12BX', title: 'Bomber Navigator', type: 'officer' },
  { code: '12SX', title: 'Special Operations Combat Systems Officer', type: 'officer' },
  { code: '13BX', title: 'Air Battle Manager', type: 'officer' },
  { code: '13DX', title: 'Nuclear and Missile Operations', type: 'officer' },
  { code: '13NX', title: 'Nuclear and Missile Operations', type: 'officer' },
  { code: '13SX', title: 'Space Operations Officer', type: 'officer' },
  { code: '14NX', title: 'Intelligence Officer', type: 'officer' },
  { code: '15WX', title: 'Weather Officer', type: 'officer' },
  { code: '16GX', title: 'Air Force Operations Staff Officer', type: 'officer' },
  { code: '17DX', title: 'Cyberspace Operations Officer', type: 'officer' },
  { code: '21AX', title: 'Aircraft Maintenance Officer', type: 'officer' },
  { code: '21MX', title: 'Munitions and Missile Maintenance Officer', type: 'officer' },
  { code: '31PX', title: 'Security Forces Officer', type: 'officer' },
  { code: '32EX', title: 'Civil Engineer Officer', type: 'officer' },
  { code: '33SX', title: 'Communications Officer', type: 'officer' },
  { code: '34MX', title: 'Services Officer', type: 'officer' },
  { code: '35PX', title: 'Public Affairs Officer', type: 'officer' },
  { code: '38FX', title: 'Force Support Officer', type: 'officer' },
  { code: '43HX', title: 'Biomedical Laboratory Officer', type: 'officer' },
  { code: '44MX', title: 'Flight Surgeon', type: 'officer' },
  { code: '46MX', title: 'Nurse Officer', type: 'officer' },
  { code: '51JX', title: 'Judge Advocate', type: 'officer' },
  { code: '61AX', title: 'Operations Research Analyst', type: 'officer' },
  { code: '62EX', title: 'Developmental Engineer', type: 'officer' },
  { code: '63AX', title: 'Acquisition Manager', type: 'officer' },
  { code: '64PX', title: 'Contracting Officer', type: 'officer' },
  { code: '65FX', title: 'Financial Management Officer', type: 'officer' },
];

const afExisting = new Set(af.mos.map(e => e.code));
af.mos = [...af.mos, ...afOfficer.filter(e => !afExisting.has(e.code))];
saveCatalog('air-force.json', af);
console.log(`Air Force: ${af.mos.length} entries (${af.mos.filter(e=>e.type==='enlisted').length} E, ${af.mos.filter(e=>e.type==='officer').length} O)`);

// ── COAST GUARD ──
const cg = loadCatalog('coast-guard.json');
cg.mos.forEach(e => { e.type = 'enlisted'; });

const cgOfficer = [
  { code: 'AVCG', title: 'Aviation Commander', type: 'officer' },
  { code: 'CG-ENG', title: 'Engineer Officer', type: 'officer' },
  { code: 'CG-OPS', title: 'Operations Ashore', type: 'officer' },
  { code: 'CG-INT', title: 'Coast Guard Intelligence Officer', type: 'officer' },
  { code: 'CG-LAW', title: 'Maritime Law Enforcement Officer', type: 'officer' },
  { code: 'CG-NAV', title: 'Navigation Officer', type: 'officer' },
  { code: 'CG-SUP', title: 'Supply Officer', type: 'officer' },
  { code: 'CG-CIV', title: 'Civil Engineering Officer', type: 'officer' },
  { code: 'CG-MED', title: 'Health Services Officer', type: 'officer' },
  { code: 'CG-LEG', title: 'Legal Officer', type: 'officer' },
];

const cgWarrant = [
  { code: 'BOSN', title: 'Boatswain Warrant Officer', type: 'warrant' },
  { code: 'WEPS', title: 'Weapons Warrant Officer', type: 'warrant' },
  { code: 'ELC', title: 'Electronics Warrant Officer', type: 'warrant' },
  { code: 'MACH', title: 'Machinery Warrant Officer', type: 'warrant' },
  { code: 'PERS', title: 'Personnel Administration Warrant Officer', type: 'warrant' },
  { code: 'F&S', title: 'Finance and Supply Warrant Officer', type: 'warrant' },
  { code: 'INV', title: 'Investigator Warrant Officer', type: 'warrant' },
  { code: 'MLES', title: 'Marine Safety Specialist Warrant Officer', type: 'warrant' },
  { code: 'MSSD', title: 'Marine Safety Deck Warrant Officer', type: 'warrant' },
  { code: 'MSSE', title: 'Marine Safety Engineering Warrant Officer', type: 'warrant' },
];

const cgExisting = new Set(cg.mos.map(e => e.code));
cg.mos = [...cg.mos, ...cgWarrant.filter(e => !cgExisting.has(e.code)), ...cgOfficer.filter(e => !cgExisting.has(e.code))];
saveCatalog('coast-guard.json', cg);
console.log(`Coast Guard: ${cg.mos.length} entries (${cg.mos.filter(e=>e.type==='enlisted').length} E, ${cg.mos.filter(e=>e.type==='warrant').length} W, ${cg.mos.filter(e=>e.type==='officer').length} O)`);

// ── NOAA ──
const noaa = loadCatalog('noaa.json');
noaa.mos.forEach(e => { e.type = 'officer'; }); // All NOAA Commissioned Corps are officers
saveCatalog('noaa.json', noaa);
console.log(`NOAA: ${noaa.mos.length} entries (all officer)`);

// ── USPHS ──
const usphs = loadCatalog('usphs.json');
usphs.mos.forEach(e => { e.type = 'officer'; }); // All USPHS Commissioned Corps are officers
saveCatalog('usphs.json', usphs);
console.log(`USPHS: ${usphs.mos.length} entries (all officer)`);

// ── SPACE FORCE ──
const sf = loadCatalog('space-force.json');
sf.mos.forEach(e => { e.type = 'enlisted'; });

const sfOfficer = [
  { code: '13SXA', title: 'Space Operations Officer', type: 'officer' },
  { code: '17DXA', title: 'Cyber Operations Officer', type: 'officer' },
  { code: '61DXA', title: 'Space Systems Acquisitions Officer', type: 'officer' },
  { code: '62EXA', title: 'Space Systems Engineer', type: 'officer' },
];

const sfExisting = new Set(sf.mos.map(e => e.code));
sf.mos = [...sf.mos, ...sfOfficer.filter(e => !sfExisting.has(e.code))];
saveCatalog('space-force.json', sf);
console.log(`Space Force: ${sf.mos.length} entries (${sf.mos.filter(e=>e.type==='enlisted').length} E, ${sf.mos.filter(e=>e.type==='officer').length} O)`);

console.log('\nDone! All catalogs updated with type field.');
