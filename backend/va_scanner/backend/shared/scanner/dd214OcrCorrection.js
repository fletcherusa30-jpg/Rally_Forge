const OCR_REPLACEMENTS = [
  [/\b0CT\b/g, 'OCT'],
  [/\bSEJ\b/g, 'SEC'],
  [/\b1S\b/g, 'IS'],
  [/\b0\s*\-/g, 'O-'],
  [/\bE0([1-9])\b/g, 'E-$1'],
  [/\bO0([1-9])\b/g, 'O-$1'],
  [/\bW0([1-5])\b/g, 'W-$1'],
  [/\b(20\d{2})[\/.](\d{2})[\/.](\d{2})\b/g, '$1-$2-$3'],
  [/\bCONT\s+IN\s+BLOCK\s*(\d+)\b/gi, 'CONT FROM BLOCK $1'],
  [/\bperlods\b/gi, 'periods'],
  [/\bAUTH0RIZED\b/g, 'AUTHORIZED'],
  [/\bRIBB0NS\b/g, 'RIBBONS'],
  [/\bSERVlCE\b/g, 'SERVICE'],
  [/\bSEPARATI0N\b/g, 'SEPARATION'],
  [/\bTHlS\b/g, 'THIS'],
  [/\bTHISPERIOD\b/gi, 'THIS PERIOD'],
  [/\bDATEENTERED\b/gi, 'DATE ENTERED'],
  [/\bPRIVIARY\b/gi, 'PRIMARY'],
  [/\bPRIMA\s*RY\b/gi, 'PRIMARY'],
  [/\bSGLICOVERAGE\b/gi, 'SGLI COVERAGE'],
  [/\bPERlOD\b/g, 'PERIOD'],
  [/\blRAQ\b/g, 'IRAQ'],
  [/\bOPERATI0N\b/g, 'OPERATION'],
  [/\blN\b/g, 'IN'],
  [/\bC0MPONENT\b/g, 'COMPONENT'],
];

export function correctDD214OcrNoise(rawText) {
  let text = String(rawText || '');
  for (const [pattern, replacement] of OCR_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // Remove high-noise caution line repeats that can poison field extraction.
  text = text.replace(/CAUTION:\s*NOT\s+TO\s+BE\s+USED\s+FOR\s+THIS[\s\S]{0,180}?RENDER\s+FORM\s+VOID/gi, '');
  text = text.replace(/\bRIBBONS?\s+AWARDED\s+OR\s+AUTHORIZED\s*\((?:ALL|AII)\s+PERIODS\s+OF\s+SERVICE\)\s*YEAR\s+COMPLETED\)\s*/gi, '');
  text = text.replace(/\bRIBBONS?\s+AWARDED\s+OR\s+AUTHORIZED\b\s*:?/gi, '');
  return text;
}
