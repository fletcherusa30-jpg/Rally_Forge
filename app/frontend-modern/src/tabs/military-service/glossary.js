export const DD214_GLOSSARY_LINKS = {
  spdCode: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/133601p.pdf',
  reCode: 'https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/133601p.pdf',
  separationAuthority: 'https://www.ecfr.gov/current/title-38',
};

export function validateGlossaryLinks() {
  const status = {};

  Object.entries(DD214_GLOSSARY_LINKS).forEach(([key, value]) => {
    try {
      const parsed = new URL(value);
      status[key] = parsed.protocol === 'https:' && parsed.hostname.length > 0;
    } catch {
      status[key] = false;
    }
  });

  return status;
}
