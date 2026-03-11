import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../components/Card';
import { ManualConditionEntry } from '../components/ManualConditionEntry';
import { formatDecisionDate } from '../utils/dateFormatter';
import { extractDecisionDate } from '../utils/aiDateParser';
import { analyzeIntelligence } from '../api/client';

export function VARatingDecisionPage() {
  const VA_DECISION_ENTITLEMENT_KEY = 'rallyforge_va_decision_entitlement';
  const [activeTab, setActiveTab] = useState('upload');
  const [decisions, setDecisions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentCompensation, setCurrentCompensation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiDomain, setAiDomain] = useState('claims');
  const [aiTags, setAiTags] = useState('appeal,nexus');
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [plainLanguage, setPlainLanguage] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setStatusMessage('');
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  const SMC_RANK_ORDER = ['T', 'S', 'R2', 'R1', 'O', 'N½', 'N', 'M½', 'M', 'L½', 'L', 'K'];

  const cleanConditionLabel = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+(?:is|was|remains)\s+(?:granted|denied)(?:\b.*)?$/i, '')
      .replace(/\s+with\s+an\s+evaluation(?:\b.*)?$/i, '')
      .replace(/[\s\-–—:;,\.]+$/g, '')
      .trim();

  const normalizeDateLabel = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const normalizeDate = (dateStr) => {
    const str = String(dateStr || '').trim();
    // Convert full month names to abbreviated format for consistent matching
    const months = {
      january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun',
      july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec'
    };
    let normalized = str;
    Object.entries(months).forEach(([full, abbr]) => {
      normalized = normalized.replace(new RegExp(full, 'gi'), abbr);
    });
    return normalized;
  };

  const extractSmcCodes = (value) => {
    const text = String(value || '').trim();
    if (!text) return [];

    const candidates = new Set();

    const explicitMatches = text.matchAll(/\bSMC[-\s]?(R1|R2|L½|M½|N½|[KLMNOST])\b/gi);
    for (const match of explicitMatches) {
      candidates.add(match[1].toUpperCase());
    }

    const levelListMatches = text.matchAll(/(?:^|[,;\s])(R1|R2|L½|M½|N½|[KLMNOST])\s*[-:]/gi);
    for (const match of levelListMatches) {
      candidates.add(match[1].toUpperCase());
    }

    return Array.from(candidates);
  };

  const saveResultsToFile = () => {
    if (!selected) return;
    
    const dataToSave = {
      savedAt: new Date().toISOString(),
      fileName: selected.fileName,
      scannedAt: selected.scannedAt,
      rating: selected.rating,
      effectiveDates: selected.effectiveDates,
      conditions: selected.conditions,
      deniedConditions: selected.deniedConditions,
      dependents: selected.dependents,
      dependentAdjustments: selected.dependentAdjustments,
      smc: selected.smc,
      compensation: currentCompensation,
      rawData: selected.rawData
    };
    
    const json = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `va-decision-${selected.fileName || 'results'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveAllDecisionsToFile = () => {
    if (decisions.length === 0) return;
    
    const dataToSave = {
      savedAt: new Date().toISOString(),
      totalDecisions: decisions.length,
      decisions: decisions.map(d => ({
        fileName: d.fileName,
        scannedAt: d.scannedAt,
        rating: d.rating,
        effectiveDates: d.effectiveDates,
        conditions: d.conditions,
        deniedConditions: d.deniedConditions,
        dependents: d.dependents,
        dependentAdjustments: d.dependentAdjustments,
        smc: d.smc,
        rawData: d.rawData
      }))
    };
    
    const json = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `va-decisions-all-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const normalizeCompensationBreakdown = (input) => {
    const value = input || {};

    if (value.breakdown && typeof value.breakdown.totalMonthly === 'number' && Number.isFinite(value.breakdown.totalMonthly)) {
      return value.breakdown;
    }

    if (typeof value.totalMonthly === 'number' && Number.isFinite(value.totalMonthly)) {
      return {
        baseMonthly: value.baseMonthly ?? value.ratingMonthly ?? 0,
        dependentMonthly: value.dependentMonthly ?? 0,
        smcMonthly: value.smcMonthly ?? 0,
        ancillaryMonthly: value.ancillaryMonthly ?? 0,
        totalMonthly: value.totalMonthly,
        totalYearly: value.totalYearly ?? value.totalMonthly * 12
      };
    }

    return null;
  };

  const getHighestSmcCodeFromDecision = (decision) => {
    const candidates = new Set();

    // Use scanner detectedLevels directly (scanner enforces grant-only SMC extraction)
    const detectedLevels = Array.isArray(decision?.rawData?.smc?.detectedLevels)
      ? decision.rawData.smc.detectedLevels
      : [];

    detectedLevels.forEach((item) => {
      const level = String(item?.level || '').toUpperCase();
      if (level) {
        candidates.add(level);
      }
    });

    // Fallback parse from legacy explicit strings if needed
    const explicitSmc = Array.isArray(decision?.smc) ? decision.smc : [];
    if (explicitSmc.length > 0) {
      explicitSmc.forEach((entry) => {
        const parsedCodes = extractSmcCodes(entry);
        parsedCodes.forEach((code) => candidates.add(code));
      });
    }

    for (const code of SMC_RANK_ORDER) {
      if (candidates.has(code)) {
        return code;
      }
    }

    return null;
  };

  const getAncillaryFlagsFromDecision = (decision) => {
    const benefits = Array.isArray(decision?.rawData?.ancillaryBenefits) ? decision.rawData.ancillaryBenefits : [];
    let aidAndAttendance = false;
    let housebound = false;

    benefits.forEach((benefit) => {
      const status = String(benefit?.status || '').toLowerCase();
      const name = String(benefit?.benefit || benefit?.shortName || '').toLowerCase();
      const isExplicitlyGranted = status === 'granted';

      if (!isExplicitlyGranted) {
        return;
      }

      if (name.includes('aid and attendance')) {
        aidAndAttendance = true;
      }
      if (name.includes('housebound')) {
        housebound = true;
      }
    });

    return { aidAndAttendance, housebound };
  };

  const getCurrentDependentsCount = (decision) => {
    const dependents = { spouse: 0, children: 0, parents: 0 };
    
    // Get all dependents from scan
    const allDependents = Array.isArray(decision?.rawData?.dependents)
      ? decision.rawData.dependents
      : (decision?.rawData?.dependents?.added || decision?.rawData?.dependentsDetailed?.added || []);
    
    // Get removed dependents (those with removal dates)
    const removedDependents = Array.isArray(decision?.rawData?.dependents?.removed)
      ? decision.rawData.dependents.removed.map(d => String(d?.name || '').trim().toLowerCase())
      : [];
    
    // Count current (not removed) dependents by type
    allDependents.forEach(dep => {
      if (!dep || !dep.name) return;
      
      const name = String(dep.name).trim().toLowerCase();
      const type = String(dep.type || dep.relationship || '').trim().toLowerCase();
      
      // Skip if removed
      if (dep.removalDate || removedDependents.includes(name)) {
        return;
      }
      
      // Count by type
      if (type.includes('spouse') || name.includes('spouse')) {
        dependents.spouse = 1;
      } else if (type.includes('child') || type.includes('kid') || type.includes('son') || type.includes('daughter')) {
        dependents.children++;
      } else if (type.includes('parent') || type.includes('mother') || type.includes('father')) {
        dependents.parents++;
      }
    });
    
    return dependents;
  };

  const getDisplayedCompensation = (decision) => {
    const fromCurrent = normalizeCompensationBreakdown(currentCompensation);
    if (fromCurrent) {
      return fromCurrent;
    }

    const fromScan = normalizeCompensationBreakdown(decision?.compensation);
    if (fromScan) {
      return fromScan;
    }

    return null;
  };


  const formatUsd = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

  const getDependentChangeDates = (scanData) => {
    const payments = scanData?.payments || [];
    const dependentReasonPattern = /(minor\s+child|dependent|spouse|child\s+adjustment|school\s+child)/i;

    return payments
      .filter((payment) => dependentReasonPattern.test(String(payment?.reason || '')))
      .map((payment) => normalizeDateLabel(payment?.startDate))
      .filter(Boolean);
  };

  const getDependentAdjustments = (scanData) => {
    if (Array.isArray(scanData?.dependentAdjustments) && scanData.dependentAdjustments.length > 0) {
      return scanData.dependentAdjustments
        .map((adj) => ({
          date: normalizeDateLabel(adj?.removalDate),
          amount: Math.abs(Number(adj?.adjustmentAmount || 0)),
          reason: `Dependent adjustment (${adj?.name || 'Unknown'})`,
          name: adj?.name || null,
          type: adj?.type || null,
          newMonthlyAmount: Number(adj?.newMonthlyAmount || 0)
        }))
        .filter((item) => item.date);
    }

    const payments = scanData?.payments || [];
    const dependentReasonPattern = /(minor\s+child|dependent|spouse|child\s+adjustment|school\s+child)/i;

    return payments
      .filter((payment) => dependentReasonPattern.test(String(payment?.reason || '')))
      .map((payment) => ({
        date: normalizeDateLabel(payment?.startDate),
        amount: payment?.amount || 0,
        reason: payment?.reason || 'Dependent adjustment'
      }))
      .filter((item) => item.date)
      .sort((a, b) => {
        // Sort by date descending (newest first)
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
  };

  const getDisabilityEffectiveDates = (scanData) => {
    const metadataDate = normalizeDateLabel(scanData?.metadata?.effectiveDate);
    const allDates = (scanData?.metadata?.allEffectiveDates || []).map(normalizeDateLabel).filter(Boolean);
    const dependentDates = new Set(getDependentChangeDates(scanData));

    const filtered = allDates.filter((date) => !dependentDates.has(date));
    const output = [];

    if (metadataDate) {
      output.push(metadataDate);
    }

    filtered.forEach((date) => {
      if (!output.includes(date)) {
        output.push(date);
      }
    });

    return output;
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    let mergedFiles = [];

    setSelectedFiles((prev) => {
      const existing = new Map(prev.map((file) => [`${file.name}|${file.size}|${file.lastModified}`, file]));
      files.forEach((file) => {
        existing.set(`${file.name}|${file.size}|${file.lastModified}`, file);
      });
      mergedFiles = Array.from(existing.values());
      return mergedFiles;
    });

    setError('');
    setStatusMessage(`${files.length} file${files.length !== 1 ? 's' : ''} selected. Scanner started automatically.`);
    e.target.value = '';

    if (mergedFiles.length > 0) {
      await runScanner(mergedFiles);
    }
  };

  const handleAddMoreFiles = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const runScanner = async (filesToScan = selectedFiles) => {
    if (!Array.isArray(filesToScan) || filesToScan.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const scannedResults = [];

      for (const file of filesToScan) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scanType', 'ratingDecision');

        const response = await fetch('/api/scanner/scan-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`${file.name}: ${errorData.error || 'Scanner failed'}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(`${file.name}: ${result.error || 'Scanner returned unsuccessful result'}`);
        }

        // LOG: Scanner response received
        console.log('[Frontend] Scanner response received for:', file.name);
        console.log('[Frontend] Dependents from scanner:', result.data.dependents);
        const dependentList = Array.isArray(result.data.dependents)
          ? result.data.dependents
          : (result.data.dependents?.added || result.data.dependentsDetailed?.added || []);
        if (dependentList.length > 0) {
          console.log('[Frontend] Dependent names:');
          dependentList.forEach((dep, idx) => {
            console.log(`  [${idx + 1}] "${dep.name}" (${dep.type}) - effective ${dep.effectiveDate || 'N/A'}`);
          });
        } else {
          console.log('[Frontend] WARNING: No dependents found in scanner response');
        }
        if (result.compensation) {
          console.log('[Frontend] Compensation:', result.compensation.breakdown);
        }

        // Deduplicate conditions by cleaned label while preserving percentage info
        const conditionMap = new Map();
        (result.data.serviceConnected || []).forEach((item) => {
          const label = cleanConditionLabel(item.condition);
          if (label && !conditionMap.has(label)) {
            conditionMap.set(label, {
              label,
              percentage: item.percentage || 0
            });
          }
        });

        const deniedMap = new Map();
        (result.data.denied || []).forEach((item) => {
          const label = cleanConditionLabel(item.condition);
          if (label && !deniedMap.has(label)) {
            deniedMap.set(label, {
              label
              // No percentage for denied conditions
            });
          }
        });

        // Extract decision date using AI parser with fallback to metadata
        const decisionDate = extractDecisionDate(result.data) || 
                            (result.data.metadata?.ratingDecisionDate ? 
                              formatDecisionDate(result.data.metadata.ratingDecisionDate) : 
                              null);
        
        scannedResults.push({
          fileName: file.name,
          decisionDate: decisionDate, // Professional format: "Month day, year"
          conditions: Array.from(conditionMap.values()),
          deniedConditions: Array.from(deniedMap.values()),
          dependentChangeDates: getDependentChangeDates(result.data),
          dependentAdjustments: getDependentAdjustments(result.data),
          dependents: Array.isArray(result.data.dependents)
            ? result.data.dependents
            : (result.data.dependents?.added || result.data.dependentsDetailed?.added || []),
          dependentsDetailed: result.data.dependentsDetailed || { added: [], removed: [], totalDependentAmount: 0, validationWarnings: [] },
          compensationTimeline: Array.isArray(result.data.compensationTimeline) ? result.data.compensationTimeline : [],
          finalMonthlyAmount: Number(result.data.finalMonthlyAmount || 0),
          rating: result.data.ratingCalculation?.calculatedCombinedRating || 0,
          smc: result.data.smc?.explicit || [],
          effectiveDates: getDisabilityEffectiveDates(result.data),
          scannedAt: new Date().toISOString(),
          source: 'scanner',
          rawData: result.data,
          compensation: result.compensation,
          quality: result.quality
        });
        
        console.log('[Frontend] Stored decision object:', scannedResults[scannedResults.length - 1]);
      }

      setDecisions((prev) => {
        const next = [...prev, ...scannedResults];
        setSelectedIndex(next.length - 1);
        return next;
      });

      setStatusMessage(`Analysis complete for ${scannedResults.length} file${scannedResults.length !== 1 ? 's' : ''}.`);

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message || 'Failed to scan PDF');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = (manualResult) => {
    // Extract decision date from manual entry if available
    const decisionDate = manualResult.decisionDate ? 
      formatDecisionDate(manualResult.decisionDate) : 
      null;
    
    const nextDecision = {
      fileName: manualResult.fileName || 'Manual Entry',
      decisionDate: decisionDate,
      conditions: (manualResult.serviceConnected || []).map((item) => item.condition),
      rating: manualResult.ratingCalculation?.calculatedCombinedRating || 0,
      smc: [],
      effectiveDates: (manualResult.serviceConnected || [])
        .filter((item) => item.effectiveDate)
        .map((item) => ({ date: item.effectiveDate, rating: item.percentage || 0 })),
      scannedAt: new Date().toISOString(),
      source: 'manual',
      rawData: manualResult
    };

    setDecisions((prev) => {
      const next = [...prev, nextDecision];
      setSelectedIndex(next.length - 1);
      return next;
    });
    setActiveTab('upload');
  };

  const runAiAnalyzer = async () => {
    const text = String(aiInput || '').trim();
    if (!text) {
      setAiError('Enter claim notes or denied-condition context to analyze.');
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const tags = aiTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const response = await analyzeIntelligence({
        text,
        domain: aiDomain,
        tags
      });

      setAiResult(response?.data || null);
      setStatusMessage('AI analysis complete.');
    } catch (err) {
      setAiError(err.message || 'Failed to run intelligence analysis.');
      setAiResult(null);
    } finally {
      setAiLoading(false);
    }
  };

  const selected = decisions[selectedIndex] || null;

  const toPlainLanguage = (text) => {
    const raw = String(text || '').trim();
    if (!plainLanguage || !raw) return raw;
    return raw
      .replace(/\bnexus\b/gi, 'medical link')
      .replace(/\bservice connection\b/gi, 'proof this is tied to service')
      .replace(/\bsecondary\b/gi, 'caused by another service-connected condition')
      .replace(/\baggravation\b/gi, 'worsening due to service')
      .replace(/\bC&P\b/gi, 'VA exam')
      .replace(/\bDBQ\b/gi, 'doctor disability form');
  };

  const buildDeniedEvidenceChecklist = (decision) => {
    const denied = Array.isArray(decision?.deniedConditions) ? decision.deniedConditions : [];
    return denied.slice(0, 5).map((item) => {
      const label = typeof item === 'string' ? item : (item?.label || 'Condition');
      const reasons = Array.isArray(item?.reasons) ? item.reasons.filter(Boolean) : [];
      const genericGaps = [
        'Current diagnosis from a treating provider',
        'Service record or buddy statement proving in-service event',
        'Medical nexus letter linking condition to service',
      ];
      return {
        label,
        gaps: reasons.length > 0 ? reasons : genericGaps,
      };
    });
  };
  const displayedCompensation = selected ? getDisplayedCompensation(selected) : null;
  const scannedFinalMonthly = Number(selected?.finalMonthlyAmount);
  const hasScannedFinalMonthly = Number.isFinite(scannedFinalMonthly) && scannedFinalMonthly > 0;

  let compensationForDisplay = displayedCompensation;
  if (displayedCompensation && hasScannedFinalMonthly) {
    const calculatedTotal = Number(displayedCompensation.totalMonthly || 0);
    if (!Number.isFinite(calculatedTotal) || Math.abs(scannedFinalMonthly - calculatedTotal) > 0.01) {
      const baseMonthly = Number(displayedCompensation.baseMonthly || 0);
      const smcMonthly = Number(displayedCompensation.smcMonthly || 0);
      const ancillaryMonthly = Number(displayedCompensation.ancillaryMonthly || 0);
      const derivedDependentMonthly = Math.max(0, scannedFinalMonthly - (baseMonthly + smcMonthly + ancillaryMonthly));

      compensationForDisplay = {
        ...displayedCompensation,
        dependentMonthly: Math.max(Number(displayedCompensation.dependentMonthly || 0), derivedDependentMonthly),
        totalMonthly: scannedFinalMonthly,
        totalYearly: scannedFinalMonthly * 12
      };
    }
  }

  const currentTotalMonthly = hasScannedFinalMonthly
    ? scannedFinalMonthly
    : Number(compensationForDisplay?.totalMonthly || 0);

  const appliedSmcCode = selected?.compensation?.components?.smc?.code || (selected ? getHighestSmcCodeFromDecision(selected) : null);

  useEffect(() => {
    if (!selected) {
      localStorage.removeItem(VA_DECISION_ENTITLEMENT_KEY);
      return;
    }

    const entitlementSnapshot = {
      rating: Number(selected.rating || 0),
      totalMonthly: Number(currentTotalMonthly || 0),
      baseMonthly: Number(compensationForDisplay?.baseMonthly || 0),
      dependentMonthly: Number(compensationForDisplay?.dependentMonthly || 0),
      smcMonthly: Number(compensationForDisplay?.smcMonthly || 0),
      ancillaryMonthly: Number(compensationForDisplay?.ancillaryMonthly || 0),
      smcCode: appliedSmcCode || null,
      source: selected.source || 'scanner',
      fileName: selected.fileName || null,
      scannedAt: selected.scannedAt || new Date().toISOString(),
      conditionsCount: Array.isArray(selected.conditions) ? selected.conditions.length : 0,
      deniedCount: Array.isArray(selected.deniedConditions) ? selected.deniedConditions.length : 0,
      dependents: getCurrentDependentsCount(selected)
    };

    localStorage.setItem(VA_DECISION_ENTITLEMENT_KEY, JSON.stringify(entitlementSnapshot));
  }, [selected, currentTotalMonthly, compensationForDisplay, appliedSmcCode]);

  useEffect(() => {
    let isCancelled = false;

    const loadCurrentCompensation = async () => {
      if (!selected?.rating) {
        setCurrentCompensation(null);
        return;
      }

      try {
        const smcCode = getHighestSmcCodeFromDecision(selected);
        const ancillary = getAncillaryFlagsFromDecision(selected);
        const currentDependents = getCurrentDependentsCount(selected);
        
        // HARDWIRED FIX: Force 2026 rates (current year)
        const response = await fetch('/api/compensation/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rating: selected.rating,
            dependents: currentDependents,
            smcCode: smcCode || null, // HARDWIRED: null if no SMC awarded
            ancillary,
            yearOverride: 2026 // HARDWIRED: Force 2026 rate table
          })
        });
        if (!response.ok) {
          throw new Error('Failed to load current compensation');
        }
        const data = await response.json();
        const quoteBreakdown = normalizeCompensationBreakdown(data?.quote);
        if (!isCancelled) {
          if (quoteBreakdown) {
            setCurrentCompensation(quoteBreakdown);
            return;
          }

          // HARDWIRED FALLBACK: Ensure compensation displays with 2026 rates
          const params = new URLSearchParams({ 
            rating: String(selected.rating),
            yearOverride: '2026'
          });
          if (smcCode) {
            params.set('smcCode', smcCode);
          }
          if (ancillary.aidAndAttendance) {
            params.set('aidAndAttendance', 'true');
          }
          if (ancillary.housebound) {
            params.set('housebound', 'true');
          }

          const fallbackResponse = await fetch(`/api/compensation?${params.toString()}`);
          if (!fallbackResponse.ok) {
            throw new Error('Failed to load current compensation fallback');
          }
          const fallbackData = await fallbackResponse.json();
          const fallbackBreakdown = normalizeCompensationBreakdown(fallbackData);
          setCurrentCompensation(fallbackBreakdown);
        }
      } catch (err) {
        console.error('[VARatingDecisionPage] Compensation load failed:', err.message);
        if (!isCancelled) {
          setCurrentCompensation(null);
        }
      }
    };

    loadCurrentCompensation();

    return () => {
      isCancelled = true;
    };
  }, [selectedIndex, decisions]);

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Scanner</div>
          <h1 className='page-title'>VA Rating Decision</h1>
          <p className='page-copy'>
            Upload a VA rating decision PDF to extract conditions, effective dates, ratings, SMC codes, and dependents — then run compensation analysis.
          </p>
        </div>
        <div className='page-badge'>Rating decision scanner</div>
      </section>
      <div className='tab-strip'>
        <button
          type='button'
          onClick={() => setActiveTab('upload')}
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
        >
          Upload &amp; Scan
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('manual')}
          className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
        >
          Manual Entry
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('ai-analyzer')}
          className={`tab-btn ${activeTab === 'ai-analyzer' ? 'active' : ''}`}
        >
          AI Analyzer
        </button>
      </div>

      {activeTab === 'manual' && (
        <Card title='Manual VA Disability Entry'>
          <ManualConditionEntry onSave={handleManualSave} />
        </Card>
      )}

      {activeTab === 'ai-analyzer' && (
        <Card title='AI-Powered Condition Analyzer'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
              Paste denied-condition context, decision rationale, or claim notes for deterministic intelligence scoring.
            </p>

            <div>
              <button
                type='button'
                onClick={() => setPlainLanguage((value) => !value)}
                className='plain-toggle'
              >
                {plainLanguage ? 'Plain Language: ON' : 'Plain Language: OFF'}
              </button>
            </div>

            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Domain</label>
            <select
              value={aiDomain}
              onChange={(e) => setAiDomain(e.target.value)}
              style={{
                padding: '0.5rem',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '0.375rem'
              }}
            >
              <option value='claims'>claims</option>
              <option value='medical'>medical</option>
              <option value='appeals'>appeals</option>
              <option value='general'>general</option>
            </select>

            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tags (comma-separated)</label>
            <input
              type='text'
              value={aiTags}
              onChange={(e) => setAiTags(e.target.value)}
              placeholder='appeal,nexus,evidence'
              style={{
                padding: '0.5rem',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '0.375rem'
              }}
            />

            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Input text</label>
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              rows={8}
              placeholder='Example: Claim denied for sleep apnea. Need nexus and service connection evidence with appeal strategy...'
              style={{
                padding: '0.75rem',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type='button'
                onClick={runAiAnalyzer}
                disabled={aiLoading}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: aiLoading ? '#475569' : '#14b8a6',
                  color: aiLoading ? '#94a3b8' : '#0f172a',
                  fontWeight: 600,
                  cursor: aiLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {aiLoading ? 'Analyzing...' : 'Run Intelligence Analysis'}
              </button>
            </div>

            {aiError && <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{aiError}</p>}

            {aiResult && (
              <div style={{ padding: '0.75rem', border: '1px solid #334155', borderRadius: '0.375rem', backgroundColor: '#0f172a' }}>
                <p style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Confidence: <strong>{aiResult.confidence}</strong>
                </p>
                <p style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                  Risk Score: <strong>{aiResult.metrics?.riskScore ?? 0}</strong> | Opportunity Score: <strong>{aiResult.metrics?.opportunityScore ?? 0}</strong>
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  Risk Keywords: {(aiResult.signals?.riskKeywords || []).join(', ') || 'none'}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Opportunity Keywords: {(aiResult.signals?.opportunityKeywords || []).join(', ') || 'none'}
                </p>
                <ul style={{ marginTop: '0.5rem', color: '#e2e8f0', fontSize: '0.8rem' }}>
                  {(aiResult.recommendations || []).map((rec, idx) => (
                    <li key={`ai-rec-${idx}`}>{toPlainLanguage(rec)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'upload' && (
        <>
          <Card title='Upload & Analyze - VA Rating Decision'>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                Select PDF File(s)
              </label>
              <input
                ref={fileInputRef}
                type='file'
                accept='.pdf'
                multiple
                onChange={handleFileChange}
                disabled={loading}
                style={{
                  display: 'block',
                  width: '100%',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                  padding: '0.5rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              />

              {selectedFiles.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected:
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {selectedFiles.map((file, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          color: '#34d399',
                          marginBottom: '0.35rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: '#0f172a'
                        }}
                      >
                        <span>✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button
                          type='button'
                          onClick={() => removeFile(idx)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {loading && (
                <div
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    backgroundColor: '#475569',
                    color: '#94a3b8',
                    fontWeight: 600,
                    opacity: 0.9
                  }}
                >
                  Scanning PDF...
                </div>
              )}
              <button
                type='button'
                onClick={handleAddMoreFiles}
                disabled={loading}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: loading ? '#64748b' : '#cbd5e1',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Add More Rating Decisions
              </button>
            </div>

            {statusMessage && !error && (
              <div
                aria-live='polite'
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#0f3b2e',
                  border: '1px solid #0d5f49',
                  borderRadius: '0.375rem'
                }}
              >
                <p style={{ fontSize: '0.75rem', color: '#99f6e4', fontWeight: 600 }}>{statusMessage}</p>
              </div>
            )}

            {error && <p style={{ color: '#f87171', marginTop: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}
          </Card>

          <Card title='Results - VA Rating Decision'>
            {decisions.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
                  {decisions.length > 1 && decisions.map((decision, idx) => (
                    <button
                      key={idx}
                      type='button'
                      onClick={() => setSelectedIndex(idx)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.35rem',
                        border: idx === selectedIndex ? '1px solid #14b8a6' : '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: idx === selectedIndex ? '#14b8a6' : '#cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      {decision.decisionDate || `Decision: #${idx + 1}`}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selected && (
                    <button
                      type='button'
                      onClick={saveResultsToFile}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.35rem',
                        border: '1px solid #14b8a6',
                        backgroundColor: '#0f172a',
                        color: '#14b8a6',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      💾 Save Current
                    </button>
                  )}
                  {decisions.length > 1 && (
                    <button
                      type='button'
                      onClick={saveAllDecisionsToFile}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.35rem',
                        border: '1px solid #5eead4',
                        backgroundColor: '#0f172a',
                        color: '#5eead4',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      💾 Save All ({decisions.length})
                    </button>
                  )}
                </div>
              </div>
            )}


            {!selected && <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>No results yet. Upload and scan a VA Rating Decision PDF to see results.</p>}

            {selected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scanned at: {selected.scannedAt}</div>

                {selected.fileName && (
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#0f172a', borderRadius: '0.35rem' }}>
                    <strong>📄 File:</strong> {selected.fileName}
                  </div>
                )}

                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem', padding: '0.5rem', backgroundColor: '#0f172a', borderRadius: '0.35rem', border: '1px dashed #334155' }}>
                  <strong>Debug Payload:</strong>{' '}
                  dependents(array)={Array.isArray(selected.rawData?.dependents) ? selected.rawData.dependents.length : 0},{' '}
                  dependents.added={Array.isArray(selected.rawData?.dependents?.added) ? selected.rawData.dependents.added.length : 0},{' '}
                  dependentsDetailed.added={Array.isArray(selected.rawData?.dependentsDetailed?.added) ? selected.rawData.dependentsDetailed.added.length : 0},{' '}
                  dependentAdjustments={Array.isArray(selected.rawData?.dependentAdjustments) ? selected.rawData.dependentAdjustments.length : 0}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', padding: '0.75rem' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>✓ Disability Rating Effective Date(s)</p>
                    {(() => {
                      const dependentDateSet = new Set((selected.dependentChangeDates || []).map(normalizeDate));
                      const filteredDates = (selected.effectiveDates || []).filter((item) => {
                        const dateStr = normalizeDate(item.date || item);
                        return !dependentDateSet.has(dateStr);
                      });
                      return filteredDates.length > 0 ? (
                        filteredDates.map((item, idx) => (
                          <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                            • {item.date || item} {item.rating ? `(${item.rating}%)` : ''}
                          </p>
                        ))
                      ) : (
                        <p style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>No effective dates found</p>
                      );
                    })()}
                  </div>
                  
                  {/* NEW SECTION: Dependents with Names */}
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>👨‍👩‍👧 Dependents</p>
                    {(() => {
                      console.log('[Render] Checking dependents - selected:', selected?.dependents);
                      const dependentList = Array.isArray(selected.dependents)
                        ? selected.dependents
                        : (selected.dependents?.added || selected.dependentsDetailed?.added || selected.rawData?.dependentsDetailed?.added || []);
                      
                      const getDependentRate = (dep) => {
                        // NOTE: monthlyAmount is no longer extracted from documents (those amounts were unreliable/incorrect)
                        // Dependent rates vary by rating and tier - they're included in the compensation breakdown calculation below
                        const lowerType = String(dep?.type || '').toLowerCase();
                        if (lowerType === 'spouse') return 'Included in base rate';
                        // For other dependent types, rate depends on rating and tier (see Total Monthly below)
                        return '';
                      };
                      
                      if (dependentList.length > 0) {
                        console.log('[Render] DISPLAYING dependents from extraction');
                        return (
                          <>
                            {dependentList.map((dep, idx) => {
                              const rate = getDependentRate(dep);
                              return (
                                <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                                  • <strong>{String(dep.type || 'Unknown').charAt(0).toUpperCase() + String(dep.type || 'Unknown').slice(1)}</strong> — {dep.name}
                                  {rate && <span style={{ color: '#86efac', marginLeft: '0.5rem' }}>({rate})</span>}
                                </p>
                              );
                            })}
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', fontStyle: 'italic' }}>
                              ℹ️ Dependent rates vary by rating and tier. See "Total Monthly" below for calculated compensation.
                            </p>
                            {(selected.dependentsDetailed?.totalDependentAmount || 0) > 0 && (
                              <p style={{ fontSize: '0.825rem', color: '#5eead4', marginTop: '0.25rem', fontWeight: 600 }}>
                                Total: ${selected.dependentsDetailed.totalDependentAmount.toFixed(2)}/mo
                              </p>
                            )}
                          </>
                        );
                      } else {
                        console.log('[Render] No dependents found');
                        if ((selected.dependentAdjustments?.length || 0) > 0 || (selected.rawData?.dependentAdjustments?.length || 0) > 0) {
                          return <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Dependent activity detected (records still resolving)</p>;
                        }
                        return <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No dependents</p>;
                      }
                    })()}
                  </div>

                  {/* Dependent Adjustments Section */}
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>📅 Dependent Adjustments</p>
                    {(() => {
                      if (selected.dependentAdjustments && selected.dependentAdjustments.length > 0) {
                        console.log('[Render] Showing dependentAdjustments');
                        const dependentList = Array.isArray(selected.dependents)
                          ? selected.dependents
                          : (selected.dependents?.added || selected.dependentsDetailed?.added || selected.rawData?.dependentsDetailed?.added || []);

                        const amountByName = new Map(
                          dependentList
                            .map((dep) => ({
                              name: String(dep?.name || '').trim().toLowerCase(),
                              amount: Number(dep?.monthlyAmount)
                            }))
                            .filter((item) => item.name && Number.isFinite(item.amount) && item.amount > 0)
                            .map((item) => [item.name, item.amount])
                        );

                        const adjustments = [...selected.dependentAdjustments].sort(
                          (left, right) => new Date(left?.date || left?.removalDate || 0) - new Date(right?.date || right?.removalDate || 0)
                        );

                        return adjustments.map((adj, idx) => {
                          const name = String(adj?.name || '').trim();
                          const normalizedName = name.toLowerCase();
                          const amountFromDependent = amountByName.get(normalizedName);
                          const amountFromAdjustment = Math.abs(Number(adj?.amount ?? adj?.adjustmentAmount));
                          const displayAmount = Number.isFinite(amountFromDependent)
                            ? amountFromDependent
                            : (Number.isFinite(amountFromAdjustment) && amountFromAdjustment > 0 ? amountFromAdjustment : null);
                          const newMonthlyAmount = Number(adj?.newMonthlyAmount);

                          return (
                            <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                              • {adj.date || adj.removalDate} {name ? <span>{name}</span> : ''} <span style={{ color: '#94a3b8' }}>(dependent adjustment)</span>
                            </p>
                          );
                        });
                      } else if (selected.dependentChangeDates && selected.dependentChangeDates.length > 0) {
                        console.log('[Render] Showing dependentChangeDates');
                        return selected.dependentChangeDates.map((date, idx) => (
                          <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                            • {date}
                          </p>
                        ));
                      } else {
                        return <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No adjustments</p>;
                      }
                    })()}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1e293b', borderRadius: '0.375rem', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Combined Rating</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14b8a6' }}>{selected.rating}%</p>
                  </div>
                  {/* Compensation Timeline - Hidden per user request */}
                </div>

                <div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>Conditions</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {(selected.conditions || [])
                      .slice()
                      .sort((a, b) => {
                        const percentA = typeof a === 'object' ? a.percentage || 0 : 0;
                        const percentB = typeof b === 'object' ? b.percentage || 0 : 0;
                        return percentB - percentA;
                      })
                      .map((condition, idx) => {
                        const conditionLabel = typeof condition === 'string' ? condition : condition.label;
                        return (
                          <li key={idx} style={{ marginBottom: '0.75rem', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #334155', backgroundColor: '#0f172a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{conditionLabel}</span>
                              {typeof condition === 'object' && typeof condition.percentage === 'number' && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#14b8a6', backgroundColor: '#0f172a', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', marginLeft: '0.5rem' }}>
                                  {condition.percentage}%
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                {!!selected.deniedConditions?.length && (
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                      <p style={{ fontSize: '0.8rem', color: '#f5d5a3', fontWeight: 700, margin: 0 }}>Evidence Gap Finder</p>
                      <button
                        type='button'
                        onClick={() => setPlainLanguage((value) => !value)}
                        className='plain-toggle'
                      >
                        {plainLanguage ? 'Plain Language: ON' : 'Plain Language: OFF'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                      Start with these missing items to improve appeal strength on denied conditions.
                    </p>
                    <div className='gap-grid'>
                      {buildDeniedEvidenceChecklist(selected).map((entry, idx) => (
                        <div key={`va-gap-${idx}`} className='gap-card'>
                          <div className='gap-title'>{entry.label}</div>
                          <ul className='gap-list'>
                            {entry.gaps.map((gap, gapIdx) => (
                              <li key={`va-gap-item-${idx}-${gapIdx}`}>{toPlainLanguage(gap)}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!selected.deniedConditions?.length && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, marginBottom: '0.25rem' }}>Denied Conditions</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {(selected.deniedConditions || [])
                        .slice()
                        .sort((a, b) => {
                          const percentA = typeof a === 'object' ? a.percentage || 0 : 0;
                          const percentB = typeof b === 'object' ? b.percentage || 0 : 0;
                          return percentB - percentA;
                        })
                        .map((condition, idx) => (
                        <li key={idx} style={{ marginBottom: '0.35rem', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #7f1d1d', backgroundColor: '#1f1115', color: '#fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{typeof condition === 'string' ? condition : condition.label}</span>
                          {/* Denied conditions should not show percentage */}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(selected.smc || []).length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>SMC</p>
                    {displayedCompensation?.smcMonthly > 0 && (
                      <p style={{ fontSize: '0.8rem', color: '#5eead4', marginBottom: '0.25rem' }}>
                        Applied SMC{appliedSmcCode ? ` (${appliedSmcCode})` : ''}: +{formatUsd(displayedCompensation.smcMonthly)}/mo
                      </p>
                    )}
                    <p>{(selected.smc || []).join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
