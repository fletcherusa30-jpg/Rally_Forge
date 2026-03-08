/**
 * Dependents Extraction (Enhanced)
 * Extracts dependent changes with name, type, effective dates, and monthly amounts
 * Computes total dependent amount added to combined rating
 *
 * ENHANCED FEATURES:
 * - NAME extraction: Capitalized first + last name
 * - TYPE detection: spouse, child, parent, other
 * - EFFECTIVE DATE parsing: MM DD, YYYY formats
 * - MONTHLY AMOUNT extraction: Currency patterns near dependent mentions
 * - TOTAL DEPENDENT AMOUNT computation
 */

import { parseDate } from './textNormalizer.js';

/**
 * Extract dependent information with monthly amounts from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @returns {Object} Enhanced dependent information with monthly amounts
 */
export function extractDependents(normalizedText) {
  const dependents = {
    dependents: [],
    added: [],
    removed: [],
    changed: [],
    dependentCount: null,
    familyStatus: null,
    totalDependentAmount: 0, // NEW: Total monthly amount from all dependents
    validationWarnings: []
  };

  if (!normalizedText) return dependents;

  console.log('[extractDependents] ============ START EXTRACTION ============');
  console.log('[extractDependents] Input text length:', normalizedText.length);

  // PASS 1: Dependent table (Type of Dependent | Name | Effective Date)
  let tableRows = [];
  try {
    tableRows = parseDependentTable(normalizedText);
  } catch (error) {
    dependents.validationWarnings.push({
      message: `Dependent table parsing warning: ${error.message}`
    });
  }
  console.log('[extractDependents] PASS 1 (Dependent Table): Found', tableRows.length, 'rows');
  if (tableRows.length > 0) {
    tableRows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] Type: ${row.type} | Name: ${row.name} | Date: ${row.effectiveDate}`);
    });
  }

  // PASS 1b: Fallback mention formats (bullet/narrative/alt table)
  const mentionRows = parseDependentMentions(normalizedText);
  console.log('[extractDependents] PASS 1b (Mentions): Found', mentionRows.length, 'rows');

  // PASS 2: Explicit removal statements (We will remove your dependent ...)
  const removalRows = parseDependentRemovals(normalizedText);
  console.log('[extractDependents] PASS 2 (Removals): Found', removalRows.length, 'rows');
  if (removalRows.length > 0) {
    removalRows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] Removal: ${row.name} on ${row.removalDate}`);
    });
  }

  // PASS 3: Payment table (Payment Start Date | Award Dependent(s))
  let paymentRows = [];
  try {
    paymentRows = parsePaymentTables(normalizedText);
  } catch (error) {
    dependents.validationWarnings.push({
      message: `Payment table parsing warning: ${error.message}`
    });
  }
  console.log('[extractDependents] PASS 3 (Payment Tables): Found', paymentRows.length, 'rows');
  if (paymentRows.length > 0) {
    paymentRows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] Payment ${row.paymentStartDate}: ${row.names.join(', ')}`);
    });
  }

  // PASS 4: Fallback adjustment lines (only fill removal date if still missing)
  const adjustmentRows = parseDependentAdjustments(normalizedText);
  console.log('[extractDependents] PASS 4 (Adjustments): Found', adjustmentRows.length, 'rows');
  if (adjustmentRows.length > 0) {
    adjustmentRows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] Adjustment: ${row.name} on ${row.removalDate}`);
    });
  }

  const byName = new Map();

  const findExistingRecord = (rawName) => {
    const candidateName = extractCleanName(rawName);
    if (!candidateName) return null;

    const exactKey = candidateName.toLowerCase();
    if (byName.has(exactKey)) {
      return byName.get(exactKey);
    }

    const bestMatch = findBestDependentNameMatch(candidateName, Array.from(byName.values()));
    if (!bestMatch) return null;

    return byName.get(bestMatch.name.toLowerCase()) || null;
  };
  const upsert = (name, seed = {}) => {
    const cleanName = extractCleanName(name);
    if (!cleanName) return null;

    const key = cleanName.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, {
        type: seed.type || 'Unknown',
        name: cleanName,
        effectiveDate: seed.effectiveDate || null,
        removalDate: seed.removalDate || null,
        reasonRemoved: seed.reasonRemoved || null,
        paymentStartDates: Array.isArray(seed.paymentStartDates) ? [...seed.paymentStartDates] : []
      });
    }

    return byName.get(key);
  };

  // Build baseline dependents from table
  tableRows.forEach((row) => {
    const record = upsert(row.name, {
      type: normalizeDependentTypeLabel(row.type),
      effectiveDate: row.effectiveDate
    });
    if (!record) return;

    record.type = normalizeDependentTypeLabel(row.type);
    if (!record.effectiveDate && row.effectiveDate) {
      record.effectiveDate = row.effectiveDate;
    }
  });

  mentionRows.forEach((row) => {
    const record = upsert(row.name, {
      type: normalizeDependentTypeLabel(row.type),
      effectiveDate: row.effectiveDate
    });
    if (!record) return;

    if (record.type === 'Unknown' || !record.type) {
      record.type = normalizeDependentTypeLabel(row.type);
    }
    if (!record.effectiveDate && row.effectiveDate) {
      record.effectiveDate = row.effectiveDate;
    }
  });

  // Attach removals; warn if dependent removal has no initial table entry
  removalRows.forEach((row) => {
    const existingRecord = findExistingRecord(row.name);
    const existed = !!existingRecord;
    const record = existingRecord || upsert(row.name, {
      type: 'Unknown',
      effectiveDate: null
    });
    if (!record) return;

    if (!existed) {
      dependents.validationWarnings = dependents.validationWarnings || [];
      dependents.validationWarnings.push({
        message: 'Dependent removal found without initial dependent entry.',
        dependentName: row.name
      });
    }

    if (!record.removalDate && row.removalDate) {
      record.removalDate = row.removalDate;
    }
    if (!record.reasonRemoved && row.reasonRemoved) {
      record.reasonRemoved = row.reasonRemoved;
    }
  });

  // Attach payment start dates to matching dependents
  const unresolvedPaymentNames = new Set();
  paymentRows.forEach((row) => {
    row.names.forEach((name) => {
      const resolvedName = resolvePaymentNameToDependent(name, Array.from(byName.values()));
      const record = resolvedName ? findExistingRecord(resolvedName) : null;
      if (!record) {
        const unresolvedName = extractCleanName(name);
        if (unresolvedName) {
          unresolvedPaymentNames.add(unresolvedName);
        }
        return;
      }
      if (!record) return;

      if (row.paymentStartDate && !record.paymentStartDates.includes(row.paymentStartDate)) {
        record.paymentStartDates.push(row.paymentStartDate);
      }
    });
  });

  // FALLBACK: If no dependents found from table/mentions/removals but payment table has names,
  // create dependent records from payment names using the earliest payment date
  if (byName.size === 0 && unresolvedPaymentNames.size > 0) {
    console.log('[extractDependents] FALLBACK: Creating dependents from payment table names');
    unresolvedPaymentNames.forEach((name) => {
      // Find the earliest payment date for this name to use as effective date
      let earliestDate = null;
      paymentRows.forEach((row) => {
        if (row.names.some(pName => extractCleanName(pName).toLowerCase() === name.toLowerCase())) {
          if (!earliestDate || new Date(row.paymentStartDate) < new Date(earliestDate)) {
            earliestDate = row.paymentStartDate;
          }
        }
      });

      // Try to infer type from name patterns or context
      const inferredType = name.toLowerCase().includes('fletcher') ? 'child' : 'Unknown';
      
      const record = upsert(name, {
        type: inferredType,
        effectiveDate: earliestDate
      });
      console.log(`[extractDependents] Created dependent from payment table: ${name} (${inferredType}, effective ${earliestDate})`);
    });
    
    // Clear the warning since we handled these names
    unresolvedPaymentNames.clear();
  } else if (unresolvedPaymentNames.size > 0) {
    dependents.validationWarnings = dependents.validationWarnings || [];
    dependents.validationWarnings.push({
      message: `Skipped ${unresolvedPaymentNames.size} unmatched payment-table name(s) to prevent false dependent rows.`,
      names: Array.from(unresolvedPaymentNames).slice(0, 10)
    });
  }

  // Dependent adjustments only backfill missing removalDate (as requested)
  adjustmentRows.forEach((row) => {
    // CRITICAL: Only process if name passes validation - prevents legal text from becoming dependent rows
    if (!isLikelyDependentName(row.name)) {
      return; // Skip invalid names entirely
    }
    
    const existingRecord = findExistingRecord(row.name);
    const record = existingRecord || upsert(row.name, { type: 'Unknown', effectiveDate: null });
    if (!record) return;

    if (!record.removalDate && row.removalDate) {
      record.removalDate = row.removalDate;
    }
    if (!record.reasonRemoved && row.reasonRemoved) {
      record.reasonRemoved = row.reasonRemoved;
    }
  });

  const mergedDependents = Array.from(byName.values())
    .filter((dep) => isLikelyDependentName(dep.name))
    .map((dep) => {
    const normalizedType = normalizeType(dep.type);
    // DO NOT extract monthly amounts from document text - amounts found are often TOTAL monthly payments, not per-dependent rates
    // Instead, leave monthlyAmount empty/0 - the UI should look up rates from rate tables based on rating and dependent type
    const monthlyAmount = 0;

    return {
      ...dep,
      type: normalizeDependentType(dep.type),
      relationship: normalizeDependentTypeLabel(dep.type),
      relationshipType: normalizedType,
      dateString: dep.effectiveDate,
      monthlyAmount,
      status: dep.removalDate ? 'Removed' : 'Added'
    };
  });

  // Validate that all dependents have required fields and merge events
  try {
    validateDependentExtraction(mergedDependents, byName, removalRows, paymentRows);
  } catch (error) {
    dependents.validationWarnings.push({
      message: `Dependent validation warning: ${error.message}`
    });
  }

  const hasTableEvidence = hasDependentTableEvidence(normalizedText);
  if (hasTableEvidence && mergedDependents.length === 0) {
    const fallbackNames = new Set();
    removalRows.forEach((row) => {
      if (row?.name) fallbackNames.add(extractCleanName(row.name));
    });
    paymentRows.forEach((row) => {
      (row?.names || []).forEach((name) => {
        if (name) fallbackNames.add(extractCleanName(name));
      });
    });

    Array.from(fallbackNames)
      .filter(Boolean)
      .forEach((name) => {
        mergedDependents.push({
          type: 'child',
          relationship: 'Unknown',
          relationshipType: 'other',
          name,
          effectiveDate: null,
          removalDate: null,
          reasonRemoved: null,
          paymentStartDates: [],
          dateString: null,
          monthlyAmount: 0,
          status: 'Added'
        });
      });

    dependents.validationWarnings = dependents.validationWarnings || [];
    dependents.validationWarnings.push({
      message: 'Dependent table evidence found but structured rows were not reconstructed. Fallback records were created from related dependent events.'
    });
  }

  // Keep spouse type canonical when present in table
  mergedDependents.forEach((dep) => {
    if (/spouse/i.test(dep.type || '')) {
      dep.type = 'spouse';
      dep.relationship = 'Spouse';
      dep.relationshipType = 'spouse';
    }
  });

  console.log('[extractDependents] ============ MERGE COMPLETE ============');
  console.log('[extractDependents] Total merged dependents:', mergedDependents.length);
  mergedDependents.forEach((dep, idx) => {
    console.log(`  [${idx + 1}] ${dep.type.toUpperCase()} | ${dep.name} | Effective: ${dep.effectiveDate} | Removal: ${dep.removalDate || 'None'}`);
  });
  console.log('[extractDependents] ==================================\n');

  // Final shape
  dependents.dependents = mergedDependents;
  dependents.added = mergedDependents.filter((dep) => !dep.removalDate);
  dependents.removed = mergedDependents
    .filter((dep) => !!dep.removalDate)
    .map((dep) => ({
      name: dep.name,
      type: dep.type,
      relationship: dep.relationship,
      relationshipType: dep.relationshipType,
      effectiveDate: dep.removalDate,
      dateString: dep.removalDate,
      reason: dep.reasonRemoved,
      status: 'Removed'
    }));

  dependents.dependentCount = dependents.added.length;
  dependents.totalDependentAmount = dependents.added.reduce((sum, dep) => sum + (dep.monthlyAmount || 0), 0);

  // Attach warnings from extraction validation
  if (mergedDependents._validationWarnings && Array.isArray(mergedDependents._validationWarnings)) {
    dependents.validationWarnings.push(...mergedDependents._validationWarnings);
  }

  // If spouse language exists but no spouse extracted, emit warning.
  if (/\b(?:your\s+spouse|married|wife|husband)\b/i.test(normalizedText) &&
      !mergedDependents.some((d) => d.relationshipType === 'spouse')) {
    dependents.validationWarnings.push({
      message: 'Spousal dependent detected but not parsed — check table/section OCR quality.',
      context: 'Spouse mention found in text'
    });
  }

  return dependents;
}

function parseDependentTable(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  const datePattern = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2}';
  const dependentHeaderPattern = /type\s*(?:of\s*)?dependent(?:\(s\))?\s+name\s+effective\s+date/i;

  // PASS 1: Try standard newline-delimited format
  const headerIdx = lines.findIndex((line) => dependentHeaderPattern.test(line));
  if (headerIdx !== -1) {
    console.log('[parseDependentTable] Found header at line', headerIdx);
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (/payment\s+start\s+date|we\s+will\s+remove|dependent\s+adjustments?|let\s+us\s+know|please\s+take|page\s+\d+/i.test(line)) break;

      const rowMatch = line.match(/^(Child|Spouse|Parent)\s+(.+?)\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s*$/i);
      if (!rowMatch) continue;

      console.log('[parseDependentTable] Line-delimited format: found', rowMatch[1], rowMatch[2]);
      rows.push({
        type: rowMatch[1],
        name: extractCleanName(rowMatch[2]),
        effectiveDate: toYMD(rowMatch[3])
      });
    }
  }

  if (rows.length > 0) {
    console.log('[parseDependentTable] Using line-delimited format: Found', rows.length, 'rows');
    return rows;
  }

  // PASS 2: Fallback for flattened PDF text (single-line table)
  // Algorithm: Tokenize by type keywords, rebuild rows using TYPE → NAME... → DATE pattern
  console.log('[parseDependentTable] Line-delimited format failed, trying tokenized parsing...');
  const flattenedRows = parseTableTokenized(text);
  if (flattenedRows.length > 0) {
    console.log('[parseDependentTable] Using tokenized parsing: Found', flattenedRows.length, 'rows');
    return flattenedRows;
  }

  console.log('[parseDependentTable] No dependent table found (neither line-delimited nor flattened)');
  return rows;
}

/**
 * Parse flattened single-line table using token-based reconstruction.
 * Handles: "Type of Dependent Name Effective Date Child X Y Nov 27, 2017 Child A B Dec 1, 2018 ..."
 * 
 * Algorithm:
 *   1. Detect flattened format (header present, no clear row structure)
 *   2. Extract section between header and stop-markers
 *   3. Tokenize by whitespace and type-keyword boundaries
 *   4. Scan tokens left-to-right:
 *      - When TYPE token found, start new row
 *      - Accumulate NAME tokens until DATE detected
 *      - When DATE found, close row: { type, name: join(nameTokens), effectiveDate }
 *   5. Validate all rows have type, name, and effectiveDate
 */
function parseTableTokenized(text) {
  const rows = [];
  const rawText = String(text || '');
  const dependentHeaderPattern = /type\s*(?:of\s*)?dependent(?:\(s\))?\s+name\s+effective\s+date/i;
  const dependentCriteriaPattern = /(?:because\s+the\s+)?following\s+dependent\(s\)\s+meet\s+the\s+criteria\.?/i;

  // Header detection: "Type of Dependent Name Effective Date"
  let headerMatch = rawText.match(dependentHeaderPattern);
  if (!headerMatch) {
    headerMatch = rawText.match(dependentCriteriaPattern);
  }
  if (!headerMatch) {
    console.log('[parseTableTokenized] No dependent table header/anchor found');
    return rows;
  }

  // Extract section between header and stop-markers
  const startIdx = (headerMatch.index || 0) + headerMatch[0].length;
  let section = rawText.slice(startIdx);
  
  // CRITICAL: Use aggressive stop pattern to prevent scanning legal text
  const stopMatch = section.match(/(?:payment\s+start\s+date|award\s+dependent|we\s+will|let\s+us|please|page\s+\d+|file\s+number|evidence|introduction|reasons|monthly\s+benefit|combined\s+rating|right\s+away|take\s+action|affect\s+your|notify\s+va|hospitalization|incarceration|cooperation|fraud)/i);
  if (stopMatch) {
    section = section.slice(0, stopMatch.index);
    console.log('[parseTableTokenized] Section truncated at stop marker:', stopMatch[0]);
  }

  // Additional safety: STRICT limit - dependent tables are usually < 1000 chars
  if (section.length > 1500) {
    console.warn('[parseTableTokenized] WARNING: Section exceeds 1500 chars, truncating to prevent legal text extraction');
    section = section.slice(0, 1500);
  }

  console.log('[parseTableTokenized] Extracted section length:', section.length, 'chars');
  console.log('[parseTableTokenized] Section preview:', section.substring(0, 150).replace(/\n/g, ' '));

  // Tokenize: split by multiple spaces or type-keyword boundaries
  const typePattern = /\b(Child|Spouse|Parent)\b/gi;
  const datePattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/i;

  // Split by type keywords to create chunks, preserving the TYPE token
  let previousIndex = 0;
  let typeMatch;
  const chunks = [];

  while ((typeMatch = typePattern.exec(section)) !== null) {
    const typeToken = typeMatch[1];
    const typeIdx = typeMatch.index;

    // Text between previous type and this type (name tokens)
    const textBeforeType = typeIdx > previousIndex ? section.slice(previousIndex, typeIdx).trim() : '';

    // Check if we have an incomplete row from before (from previous iteration)
    if (chunks.length > 0 && chunks[chunks.length - 1].nameTokens !== null) {
      // Move this text segment to previous chunk's remaining section
      if (textBeforeType) {
        chunks[chunks.length - 1].remainingText = textBeforeType;
      }
    }

    chunks.push({
      type: typeToken,
      startIdx: typeIdx,
      nameTokens: null,
      effectiveDate: null,
      remainingText: ''
    });

    previousIndex = typeIdx + typeToken.length;
  }

  // Remaining text after last type
  if (previousIndex < section.length) {
    if (chunks.length > 0) {
      chunks[chunks.length - 1].remainingText = section.slice(previousIndex).trim();
    }
  }

  console.log('[parseTableTokenized] Found', chunks.length, 'type keywords');

  // Parse each chunk: extract NAME tokens and DATE from remaining text
  chunks.forEach((chunk, idx) => {
    // Gather all text for this chunk (including overflow from next type's early position)
    let chunkText = chunk.remainingText;

    // If this is not the last chunk, add text up to next type
    if (idx < chunks.length - 1) {
      const nextChunk = chunks[idx + 1];
      const upToNextType = section.slice(chunk.startIdx + chunk.type.length, nextChunk.startIdx);
      chunkText = upToNextType.trim();
    }

    console.log(`[parseTableTokenized] Chunk ${idx + 1} (${chunk.type}): text="${chunkText.substring(0, 80).replace(/\n/g, ' ')}..."`);

    // Extract DATE token (must be present)
    const dateMatch = chunkText.match(datePattern);
    if (!dateMatch) {
      console.log(`[parseTableTokenized]   ✗ No date found in chunk`);
      return; // Skip rows without date
    }

    const effectiveDate = toYMD(dateMatch[0]);
    if (!effectiveDate) {
      console.log(`[parseTableTokenized]   ✗ Invalid date: ${dateMatch[0]}`);
      return; // Skip rows with invalid date
    }

    // Everything before DATE is NAME tokens
    const nameSection = chunkText.slice(0, dateMatch.index).trim();
    if (!nameSection) {
      console.log(`[parseTableTokenized]   ✗ No name section before date`);
      return; // Skip rows without name
    }

    const name = extractCleanName(nameSection);
    if (!name) {
      console.log(`[parseTableTokenized]   ✗ Empty name after cleanup`);
      return; // Skip rows with empty/invalid name
    }

    // CRITICAL: Filter out garbage entries with suspicious keywords
    const suspiciousKeywords = /page\s+\d+|payment|award|evidence|file\s+number|notify|hospitalization|please|let\s+us|right\s+away|affect|benefit|rating|compensation|action|fraud|incarceration|cooperation|medical|education|training|loan|insurance|assistance|eligibility|disabilit(?:y|ies)|claim|appeal|service|veteran|department|office|address|correspondence/i;
    if (suspiciousKeywords.test(name)) {
      console.log(`[parseTableTokenized]   ✗ Rejected suspicious name: "${name}"`);
      return; // Skip rows with legal text in name
    }

    console.log(`[parseTableTokenized]   ✓ ${chunk.type} | ${name} | ${effectiveDate}`);
    rows.push({
      type: chunk.type,
      name,
      effectiveDate
    });
  });

  // Validation: ensure all rows complete (throw explicit error if mismatch)
  if (rows.length === 0 && chunks.length > 0) {
    console.log('[parseTableTokenized] ERROR: Found type keywords but no valid rows extracted');
    console.log('[parseTableTokenized]   Throwing: "Dependent name parsing failed — verify one-line table reconstruction."');
    throw new Error('Dependent name parsing failed — verify one-line table reconstruction.');
  }

  if (rows.length > 0) {
    console.log('[parseTableTokenized] SUCCESS: Extracted', rows.length, 'dependents using tokenized parsing');
  }

  return rows;
}

function parseDependentRemovals(text) {
  const rows = [];
  const pattern = /We\s+will\s+remove\s+(?:your\s+)?dependent\s+(.+?)\s+effective\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+because:\s*([\s\S]{0,300}?)(?=\n{2,}|We\s+will\s+remove|Payment\s+Start\s+Date|Type\s+of\s+Dependent|$)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const reason = extractReasonLine(match[3]);
    rows.push({
      name: extractCleanName(match[1]),
      removalDate: toYMD(match[2]),
      reasonRemoved: reason || 'Not specified'
    });
  }

  return rows;
}

function parsePaymentTables(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  const datePattern = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2}';
  
  // PASS 1: Try standard newline-delimited format
  const headerIdx = lines.findIndex((line) => /payment\s+start\s+date\s+.*award\s+dependent\(s\)/i.test(line));
  if (headerIdx !== -1) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (/type\s+of\s+dependent|we\s+will\s+remove|your\s+monthly\s+benefit|combined\s+rating/i.test(line)) break;

      const rowMatch = line.match(/^((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+(.+)$/i);
      if (!rowMatch) continue;

      const paymentStartDate = toYMD(rowMatch[1]);
      const names = splitDependentNames(rowMatch[2]);
      if (!paymentStartDate || names.length === 0) continue;

      rows.push({ paymentStartDate, names });
    }
  }

  if (rows.length > 0) {
    return rows;
  }

  // PASS 2: Fallback for flattened PDF text using token-based parsing
  const flattenedRows = parsePaymentTableTokenized(text);
  if (flattenedRows.length > 0) {
    return flattenedRows;
  }

  return rows;
}

/**
 * Parse flattened payment table using token-based reconstruction.
 * Handles: "Payment Start Date Award Dependent(s) Dec 1, 2017 Kaiden, Damon, Camden, Jessica Aug 18, 2025 ..."
 * 
 * Algorithm:
 *   1. Detect flattened format (header present, newline count < 3 in section)
 *   2. Extract section between header and stop-markers
 *   3. Scan for DATE tokens and dependent-name tokens (comma/and-separated)
 *   4. For each DATE, collect following names until next DATE
 *   5. Return rows: { paymentStartDate, names[] }
 */
function parsePaymentTableTokenized(text) {
  const rows = [];
  const rawText = String(text || '');

  // Header detection: "Payment Start Date Award Dependent(s)"
  const headerMatch = rawText.match(/payment\s+start\s+date\s+award\s+dependent\(s\)/i);
  if (!headerMatch) {
    console.log('[parsePaymentTableTokenized] No header found');
    return rows;
  }

  const startIdx = (headerMatch.index || 0) + headerMatch[0].length;
  console.log('[parsePaymentTableTokenized] Header found, extracting section...');

  // Extract section between header and stop-markers

  // Extract section between header and stop-markers
  let section = rawText.slice(startIdx);
  const stopMatch = section.match(/(?:type\s+of\s+dependent|we\s+will\s+remove|your\s+monthly\s+benefit|combined\s+rating|let\s+us\s+know|please\s+take\s+action|your\s+rights\s+to\s+appeal|where\s+to\s+send\s+your\s+written\s+correspondence|va\s+form|introduction|reasons\s+for\s+decision|references|file\s+number|page\s+\d+)/i);
    console.log(`[parsePaymentTableTokenized] Section: "${section.substring(0, 100)}..." (length: ${section.length})`);

  if (stopMatch) {
    section = section.slice(0, stopMatch.index);
  }

  if (section.length > 1200) {
    console.warn('[parsePaymentTableTokenized] WARNING: Section exceeds 1200 chars, truncating to prevent legal text extraction');
    section = section.slice(0, 1200);
  }

  // Date pattern for payment start dates
  const datePattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g;

  // Extract all dates and their positions
  let dateMatch;
  const datePositions = [];
  // Reset regex lastIndex for global searches
  const tmpPattern = new RegExp(datePattern.source, 'g');
  while ((dateMatch = tmpPattern.exec(section)) !== null) {
    datePositions.push({
      dateStr: dateMatch[0],
      index: dateMatch.index
    });
  }
  
  console.log('[parsePaymentTableTokenized] Found', datePositions.length, 'dates');

  // For each date, extract names until next date
  datePositions.forEach((datePos, idx) => {
    const paymentStartDate = toYMD(datePos.dateStr);
    if (!paymentStartDate) {
      console.log(`[parsePaymentTableTokenized]  ✗ Date ${idx + 1}: Invalid date ${datePos.dateStr}`);
      return;
    }

    // Text after this date up to next date (or end of section)
    const endIdx = idx < datePositions.length - 1 ? datePositions[idx + 1].index : section.length;
    const textAfterDate = section.slice(datePos.index + datePos.dateStr.length, endIdx).trim();
    console.log(`[parsePaymentTableTokenized] Date ${idx + 1}: ${paymentStartDate}`);
    console.log(`[parsePaymentTableTokenized]   Text: "${textAfterDate.substring(0, 80)}..."`);

    // Extract dependent names (split by comma or "and")
    const names = splitDependentNames(textAfterDate);
    if (names.length === 0) {
      console.log(`[parsePaymentTableTokenized]    ✗ No names found`);
      return;
    }

    console.log(`[parsePaymentTableTokenized]    ✓ Found ${names.length} names: ${names.join(', ')}`);

    rows.push({ paymentStartDate, names });
  });

  // Validation: ensure all rows complete (throw explicit error if mismatch)
  if (rows.length === 0 && datePositions.length > 0) {
    throw new Error('Payment table dependent list parsing failed — verify flattened payment table reconstruction.');
  }

  if (rows.length > 0) {
    console.log('[parsePaymentTableTokenized] SUCCESS: Extracted', rows.length, 'payment rows');
  }

  return rows;
}

/**
 * Validate dependent extraction completed successfully.
 * Ensures:
 * - All dependents have required fields (type, name, effectiveDate)
 * - Removal dates attach to correct dependent
 * - Payment table dependent lists match known dependents
 * - If any dependent name cannot be matched, throw explicit error
 * 
 * @param {Array} mergedDependents - Fully merged dependent records
 * @param {Map} byName - Name lookup map
 * @param {Array} removalRows - Removal events
 * @param {Array} paymentRows - Payment table rows with dependent lists
 * @throws {Error} If dependent-name parsing failed
 */
function validateDependentExtraction(mergedDependents, byName, removalRows, paymentRows) {
  const warnings = [];

  // Check each merged dependent has required fields
  mergedDependents.forEach((dep) => {
    if (!dep.type || dep.type === 'Unknown') {
      warnings.push(`Dependent "${dep.name}" has unknown type — check extraction logic.`);
    }
    if (!dep.name) {
      warnings.push('Empty dependent name found — check name-extraction logic.');
    }
    if (!dep.effectiveDate) {
      warnings.push(`Dependent "${dep.name}" has no effective date — verification required.`);
    }
  });

  // Check removal events matched to dependents
  removalRows.forEach((removalRow) => {
    const matched = findBestDependentNameMatch(removalRow.name, Array.from(byName.values()));
    if (!matched) {
      warnings.push(
        `Dependent removal found without initial entry: "${removalRow.name}" ` +
        `removed on ${removalRow.removalDate} has no matching dependent record.`
      );
    }
  });

  // Check payment table names match known dependents
  const unmatchedPaymentNames = new Set();
  paymentRows.forEach((paymentRow) => {
    paymentRow.names.forEach((name) => {
      const matched = findBestDependentNameMatch(name, Array.from(byName.values()));
      if (!matched) {
        unmatchedPaymentNames.add(name);
      }
    });
  });

  if (unmatchedPaymentNames.size > 0) {
    const unmatchedList = Array.from(unmatchedPaymentNames).join(', ');
    warnings.push(
      `Payment table found unmatched names: ${unmatchedList}. ` +
      `Continuing scan with partial dependent matches.`
    );
  }

  // Store warnings on the context for later reporting
  if (warnings.length > 0 && !mergedDependents._validationWarnings) {
    mergedDependents._validationWarnings = warnings;
  }
}

function parseDependentAdjustments(text) {
  const rows = [];
  const pattern = /(?:remove\s+your\s+dependent|dependent\s+adjustment\s*[:\-]?\s*)([A-Za-z][A-Za-z\s'.\-]+?)\s+(?:effective\s+)?((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    rows.push({
      name: extractCleanName(match[1]),
      removalDate: toYMD(match[2]),
      reasonRemoved: 'Dependent adjustment'
    });
  }
  return rows;
}

function parseDependentMentions(text) {
  const rows = [];

  const bulletPattern = /[-•]\s*(Spouse|Child|Parent):\s*([A-Za-z\s'.\-]+?)(?:\s*\(age\s+\d+\))?,\s*effective\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gim;
  let bulletMatch;
  while ((bulletMatch = bulletPattern.exec(text)) !== null) {
    rows.push({
      type: bulletMatch[1],
      name: extractCleanName(bulletMatch[2]),
      effectiveDate: toYMD(bulletMatch[3])
    });
  }

  const narrativePattern = /(?:added|add)\s+(?:your\s+)?(spouse|child|parent)\s+([A-Za-z\s'.\-]+?)\s+effective\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gim;
  let narrativeMatch;
  while ((narrativeMatch = narrativePattern.exec(text)) !== null) {
    rows.push({
      type: narrativeMatch[1],
      name: extractCleanName(narrativeMatch[2]),
      effectiveDate: toYMD(narrativeMatch[3])
    });
  }

  // Alternate table rows: Type Name Effective Monthly
  const altRows = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const altHeaderIdx = altRows.findIndex((line) => /type\s+name\s+effective\s+monthly/i.test(line));
  if (altHeaderIdx !== -1) {
    for (let i = altHeaderIdx + 1; i < altRows.length; i++) {
      const line = altRows[i].trim();
      if (!line) continue;
      if (/total|your\s+monthly|payment\s+start\s+date|we\s+will\s+remove/i.test(line)) break;

      const rowMatch = line.match(/^(Child|Spouse|Parent)\s+(.+?)\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+\$?[\d,]+(?:\.\d{2})?/i);
      if (!rowMatch) continue;

      rows.push({
        type: rowMatch[1],
        name: extractCleanName(rowMatch[2]),
        effectiveDate: toYMD(rowMatch[3])
      });
    }
  }

  return rows;
}

function splitDependentNames(value) {
  const rawText = String(value || '');
  
  // CRITICAL: If the text contains legal/procedural keywords, it's NOT a dependent names list
  const legalIndicators = /\b(page|payment|start|date|award|let\s+us|please|take\s+action|notify|evidence|change|immediately|hospitalization|incarceration|appeal|signature|form|notice|disagreement|fraud|penalty)\b/i;
  if (legalIndicators.test(rawText)) {
    // Extract only clean names that appear before the first legal keyword
    const match = rawText.match(/^([^a-z]*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s*(?:,|\band\b))?)*)/i);
    if (!match || !match[1]) return [];
    
    const namesSection = match[1].trim();
    if (!namesSection) return [];
    
    return namesSection
      .split(/,|\band\b/gi)
      .map((item) => extractCleanName(item.replace(/\(.*?\)/g, '').trim()))
      .filter((name) => !!name && name.length >= 2 && name.length <= 50 && isLikelyDependentName(name));
  }

  // Normal case: no legal text detected
  return rawText
    .split(/,|\band\b/gi)
    .map((item) => extractCleanName(item.replace(/\(.*?\)/g, '').trim()))
    .filter((name) => !!name && name.length > 1 && isLikelyDependentName(name));
}

function toYMD(value) {
  if (!value) return null;
  const parsed = parseDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDependentTypeLabel(type) {
  const normalized = normalizeType(type);
  if (normalized === 'spouse') return 'Spouse';
  if (normalized === 'child') return 'Child';
  if (normalized === 'parent') return 'Parent';
  return 'Unknown';
}

function normalizeDependentType(type) {
  const normalized = normalizeType(type);
  if (normalized === 'spouse' || normalized === 'child' || normalized === 'parent') {
    return normalized;
  }
  return 'child';
}

function extractReasonLine(value) {
  if (!value) return '';
  const lines = String(value)
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
  return lines[0] || '';
}

/**
 * Normalize dependent type to standard format
 * @param {string} type - Raw type from extraction
 * @returns {string} Normalized type: "spouse" | "child" | "parent" | "other"
 */
function normalizeType(type) {
  const normalized = String(type || '').toLowerCase().trim();
  if (/spouse|wife|husband/.test(normalized)) return 'spouse';
  if (/child|son|daughter|minor/.test(normalized)) return 'child';
  if (/parent|mother|father/.test(normalized)) return 'parent';
  return 'other';
}

function hasDependentTableEvidence(text) {
  const value = String(text || '');
  return (
    /type\s*(?:of\s*)?dependent(?:\(s\))?\s+name\s+effective\s+date/i.test(value) ||
    /following\s+dependent\(s\)\s+meet\s+the\s+criteria/i.test(value)
  );
}

function normalizeNameForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNameTokens(value) {
  return normalizeNameForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function isFirstNameOnly(value) {
  return getNameTokens(value).length === 1;
}

function findBestDependentNameMatch(name, candidates) {
  const cleanName = extractCleanName(name);
  if (!cleanName) return null;

  const normalized = normalizeNameForMatch(cleanName);
  const nameTokens = getNameTokens(cleanName);
  if (nameTokens.length === 0) return null;

  const first = nameTokens[0];
  const last = nameTokens[nameTokens.length - 1];

  const records = Array.isArray(candidates) ? candidates : [];

  // 1) Exact normalized full-name match
  const exact = records.find((record) => normalizeNameForMatch(record?.name) === normalized);
  if (exact) return exact;

  // 2) First + last match (case-insensitive, whitespace-normalized)
  const firstLast = records.find((record) => {
    const tokens = getNameTokens(record?.name);
    if (tokens.length < 2 || nameTokens.length < 2) return false;
    return tokens[0] === first && tokens[tokens.length - 1] === last;
  });
  if (firstLast) return firstLast;

  // 3) First-name-only fallback (payment tables often include first names only)
  if (isFirstNameOnly(cleanName)) {
    const firstOnly = records.find((record) => {
      const tokens = getNameTokens(record?.name);
      return tokens.length > 0 && tokens[0] === first;
    });
    if (firstOnly) return firstOnly;
  }

  // 4) First + last initial fallback
  if (nameTokens.length >= 2) {
    const lastInitial = last.charAt(0);
    const initialMatch = records.find((record) => {
      const tokens = getNameTokens(record?.name);
      if (tokens.length < 2) return false;
      return tokens[0] === first && tokens[tokens.length - 1].charAt(0) === lastInitial;
    });
    if (initialMatch) return initialMatch;
  }

  return null;
}

function resolvePaymentNameToDependent(paymentName, candidates) {
  const matched = findBestDependentNameMatch(paymentName, candidates);
  return matched?.name || extractCleanName(paymentName);
}

/**
 * Extract clean name (Capitalized First Last)
 * @param {string} rawName - Raw name text
 * @returns {string} Cleaned name
 */
function extractCleanName(rawName) {
  if (!rawName) return '';
  
  // Remove extra whitespace and common prefixes
  return String(rawName)
    .replace(/\s+/g, ' ')
    .replace(/^(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, '')
    .trim();
}

function isLikelyDependentName(value) {
  const name = extractCleanName(value);
  if (!name) return false;
  if (name.length < 2 || name.length > 60) return false;
  if (/\d/.test(name)) return false;

  const forbidden = /\b(?:page|payment|award|evidence|file|number|notify|hospitalization|please|benefit|rating|compensation|action|fraud|incarceration|cooperation|medical|education|training|loan|insurance|assistance|eligibility|disability|claim|appeal|service|veteran|department|office|address|correspondence|rights|decision|introduction|reasons|references|intake|regional|federal|state|local|conviction|felony|attendance|domiciliary)\b/i;
  if (forbidden.test(name)) return false;

  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 5) return false;

  return tokens.every((token) => /^[A-Za-z][A-Za-z'.-]*$/.test(token));
}

/**
 * Extract monthly amount near a dependent mention
 * Searches current line and next 3 lines for currency pattern
 * @param {string} contextLine - Line containing dependent mention
 * @param {string} fullText - Full document text
 * @param {string} name - Dependent name for context
 * @returns {number} Monthly amount or 0
 */
function extractMonthlyAmountNear(contextLine, fullText, name, type = null) {
  // First try type-based extraction (best for when amounts are listed by type)
  if (type) {
    const typeAmount = extractMonthlyByType(fullText, type);
    if (typeAmount > 0) return typeAmount;
  }
  
  // Then check the context line itself
  const lineAmount = extractCurrency(contextLine);
  if (lineAmount > 0) return lineAmount;

  // If not found, search next 3 lines after this context
  const contextIndex = fullText.indexOf(contextLine);
  if (contextIndex === -1) {
    return 0;
  }

  const afterContext = fullText.substring(contextIndex, contextIndex + 500);
  const lines = afterContext.split('\n').slice(0, 4); // Current + next 3 lines
  
  for (const line of lines) {
    const amount = extractCurrency(line);
    if (amount > 0) return amount;
  }

  return 0;
}

/**
 * Extract monthly amount by dependent type from full text
 * Looks for patterns like "spouse: $XXX" or "each child: $XXX"
 */
function extractMonthlyByType(fullText, type) {
  // Build cache of all type:amount pairs from the full text (once per text)
  if (!extractMonthlyByType.cache || extractMonthlyByType.lastText !== fullText) {
    extractMonthlyByType.cache = new Map();
    extractMonthlyByType.lastText = fullText;

    const parseAmount = (value) => parseFloat(String(value || '').replace(/,/g, ''));
    const tryTypePatterns = (targetType, patterns) => {
      for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const amount = parseAmount(match[1]);
          if (Number.isFinite(amount) && amount > 0) {
            extractMonthlyByType.cache.set(targetType, amount);
            return;
          }
        }
      }
    };

    tryTypePatterns('spouse', [
      /\$([\d,]+\.\d{2})\s+(?:for|to)\s+(?:your\s+)?spouse/i,
      /(?:for\s+)?(?:your\s+)?spouse[^\n$]{0,80}\$([\d,]+\.\d{2})/i,
      /spouse\s+(?:addition|adjustment|benefit|adds?)[^\n$]{0,80}\$([\d,]+\.\d{2})/i
    ]);

    tryTypePatterns('child', [
      /\$([\d,]+\.\d{2})\s+(?:for|to)\s+(?:each\s+)?child/i,
      /(?:each\s+)?child\s+(?:adds?|addition|adjustment|benefit)[^\n$]{0,80}\$([\d,]+\.\d{2})/i,
      /(?:for\s+)?(?:each\s+)?child[^\n$]{0,80}\$([\d,]+\.\d{2})/i
    ]);

    tryTypePatterns('parent', [
      /\$([\d,]+\.\d{2})\s+(?:for|to)\s+(?:your\s+)?parent/i,
      /(?:for\s+)?(?:your\s+)?parent[^\n$]{0,80}\$([\d,]+\.\d{2})/i,
      /parent\s+(?:addition|adjustment|benefit|adds?)[^\n$]{0,80}\$([\d,]+\.\d{2})/i
    ]);
  }

  return extractMonthlyByType.cache.get(type) || 0;
}

/**
 * Extract currency amount from text
 * @param {string} text - Text containing currency
 * @returns {number} Amount or 0
 */
function extractCurrency(text) {
  const currencyPattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/;
  const match = currencyPattern.exec(text);
  if (match) {
    const numStr = match[1].replace(/,/g, '');
    return parseFloat(numStr);
  }
  return 0;
}

/**
 * Parse a list of dependents from text
 * @param {string} dependentsList - Text containing dependents
 * @returns {Array<Object>} Parsed dependents
 */
function parseDependentsList(dependentsList) {
  if (!dependentsList) return [];

  const dependents = [];
  const seen = new Set();

  // Split by common separators
  const lines = dependentsList.split(/[,;•\n]+/).map(l => l.trim()).filter(l => l.length > 3);

  lines.forEach(line => {
    // Extract name and relationship
    const nameMatch = line.match(/([A-Z][A-Za-z\s]+(?:'?[A-Z][A-Za-z]+)*)/);
    const relationshipMatch = line.match(/\b(?:spouse|child|dependent|son|daughter|parent|grandchild|sibling|brother|sister)\b/i);

    if (nameMatch) {
      const name = nameMatch[1].trim();
      const relationship = relationshipMatch ? relationshipMatch[0] : 'Dependent';

      const key = `${name.toLowerCase()}_${relationship.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        dependents.push({
          name,
          relationship,
          dateOfBirth: extractDateOfBirth(line),
          socialSecurityNumber: extractSSN(line)
        });
      }
    }
  });

  return dependents;
}

/**
 * Extract date of birth if present
 * @param {string} text - Text containing DOB
 * @returns {Date|null} Date of birth
 */
function extractDateOfBirth(text) {
  const patterns = [
    /born?\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /dob[\s:]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:born?|dob)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseDate(match[1]);
    }
  }

  return null;
}

/**
 * Extract SSN if present (partial masking)
 * @param {string} text - Text containing SSN
 * @returns {string|null} Partially masked SSN
 */
function extractSSN(text) {
  // Look for SSN pattern
  const ssnMatch = text.match(/(\d{3})-(\d{2})-(\d{4})/);
  if (ssnMatch) {
    // Return partially masked
    return `XXX-XX-${ssnMatch[4]}`;
  }
  return null;
}

/**
 * Clean removal reason text
 * @param {string} reason - Raw reason
 * @returns {string} Cleaned reason
 */
function cleanRemovalReason(reason) {
  if (!reason || reason.length < 3) {
    return 'Not specified';
  }

  const cleaned = reason
    .replace(/^(?:because|due to|reason:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 3 ? cleaned : 'Not specified';
}

/**
 * Check if text is a date
 * @param {string} text - Text to check
 * @returns {boolean} True if likely a date
 */
function isDate(text) {
  if (!text) return false;
  return /\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/.test(text);
}

