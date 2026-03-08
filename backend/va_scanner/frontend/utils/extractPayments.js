/**
 * Payment Information Extraction
 * Extracts payment amounts, dates, and changes
 */

import { parseDate, extractPercentage } from './textNormalizer.js';

/**
 * Extract payment information from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @returns {Array<Object>} Payment information
 */
export function extractPayments(normalizedText) {
  const payments = [];
  const seen = new Set();

  if (!normalizedText) return payments;

  // FIRST: Try table-based extraction (actual VA decision format)
  const tableMatch = normalizedText.match(/Total\s+VA\s+Benefit\s+Amount\s+Withheld\s+Amount\s+Paid\s+Payment\s+Start\s+Date\s+Reason\s+([\s\S]+?)(?:We\s+are\s+currently|$)/i);
  if (tableMatch) {
    const tableContent = tableMatch[1];
    const lines = tableContent.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      // Match: $X $Y $Z Date Reason pattern
      const payMatch = line.match(/\$(\d+(?:[,\d]*\.\d{2}))\s+\$(\d+(?:[,\d]*\.\d{2}))\s+\$(\d+(?:[,\d]*\.\d{2}))\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\s+(.+?)$/i);
      if (payMatch) {
        const totalBenefit = parseFloat(payMatch[1].replace(/,/g, ''));
        const withheld = parseFloat(payMatch[2].replace(/,/g, ''));
        const paid = parseFloat(payMatch[3].replace(/,/g, ''));
        const month = payMatch[4];
        const day = payMatch[5];
        const year = payMatch[6];
        const reason = payMatch[7].trim();
        const dateStr = `${month} ${day}, ${year}`;
        
        payments.push({
          type: 'Schedule',
          monthlyAmount: paid,
          totalVABenefit: totalBenefit,
          amountWithheld: withheld,
          amountPaid: paid,
          paymentStartDate: parseDate(dateStr),
          dateString: dateStr,
          reason: reason,
          status: 'Active',
          currency: 'USD',
          evidenceSource: 'VA Payment Schedule Table'
        });
      }
    }
  }

  // Payment extraction patterns
  const paymentPatterns = [
    // Pattern 1: "Your monthly disability payment is $XXXX effective [date]"
    {
      regex: /(?:your\s+)?monthly\s+(?:disability\s+)?payment\s+(?:is|will\s+be|amount)\s*\$?(\d{1,5}(?:[,.]?\d{3})*)\s*effective\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
      groups: { amount: 1, effectiveDate: 2 }
    },

    // Pattern 2: "Disability payment: $XXXX"
    {
      regex: /(?:disability|monthly|payment)\s*(?:amount)?[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)\s*per\s+month/gi,
      groups: { amount: 1 }
    },

    // Pattern 3: "You will receive $XXXX each month"
    {
      regex: /you\s+(?:will\s+)?receive\s+\$?(\d{1,5}(?:[,.]?\d{3})*)\s*(?:each|per)\s+month/gi,
      groups: { amount: 1 }
    },

    // Pattern 4: "Beginning [date], your payment is $XXXX"
    {
      regex: /beginning\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})[,.]?\s+(?:your\s+)?(?:monthly\s+)?payment\s+(?:is|will\s+be)\s*\$?(\d{1,5}(?:[,.]?\d{3})*)/gi,
      groups: { effectiveDate: 1, amount: 2 }
    },

    // Pattern 5: "New payment amount: $XXXX effective [date]"
    {
      regex: /new\s+(?:monthly\s+)?payment\s+(?:amount)?\s*[:=]?\s*\$?(\d{1,5}(?:[,.]?\d{3})*)\s+effective\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
      groups: { amount: 1, effectiveDate: 2 }
    },

    // Pattern 6: "Payment change effective [date]"
    {
      regex: /payment\s+(?:change|adjustment)\s+(?:effective|as\s+of)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s*[:\s]*\$?(\d{1,5}(?:[,.]?\d{3})*)/gi,
      groups: { effectiveDate: 1, amount: 2 }
    }
  ];

  // Extract main payment amounts
  paymentPatterns.forEach((pattern, patternIndex) => {
    let match;
    while ((match = pattern.regex.exec(normalizedText)) !== null) {
      try {
        const amountStr = match[pattern.groups.amount]?.replace(/,/g, '');
        const amount = parseFloat(amountStr);
        const dateStr = pattern.groups.effectiveDate ? match[pattern.groups.effectiveDate] : null;
        const effectiveDate = dateStr ? parseDate(dateStr) : null;

        if (amount && !isNaN(amount) && amount > 0) {
          const key = `${amount}_${effectiveDate?.toISOString() || 'unknown'}`;
          if (!seen.has(key)) {
            seen.add(key);
            payments.push({
              type: 'Entitlement',
              monthlyAmount: amount,
              effectiveDate: effectiveDate,
              currency: 'USD',
              extractionPattern: patternIndex + 1,
              evidenceSource: 'VA Rating Decision'
            });
            console.log(`[Payment] Monthly entitlement: $${amount} effective ${effectiveDate?.toLocaleDateString() || 'Date not found'}`);
          }
        }
      } catch (error) {
        console.warn('Error parsing payment match:', error);
      }
    }
  });

  // Extract withheld amounts
  const withheldPatterns = [
    /(?:amount\s+)?withheld[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)/gi,
    /tax\s+(?:withholding|withheld)[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)/gi,
    /offset[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)/gi
  ];

  withheldPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);

      if (amount && !isNaN(amount) && amount > 0) {
        const key = `withheld_${amount}`;
        if (!seen.has(key)) {
          seen.add(key);
          payments.push({
            type: 'Withheld',
            monthlyAmount: amount,
            currency: 'USD',
            extractionPattern: 'withheld',
            evidenceSource: 'VA Rating Decision'
          });
          console.log(`[Payment] Amount withheld: $${amount}`);
        }
      }
    }
  });

  // Extract payment start dates
  const startDatePatterns = [
    /payment\s+(?:begins?|starts?|begins?)\s+(?:on|effective)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /(?:you\s+will\s+)?receive\s+payment\s+(?:beginning|starting|effective)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /first\s+payment\s+(?:date|effective)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi
  ];

  let paymentStartDate = null;
  startDatePatterns.some(pattern => {
    const match = normalizedText.match(pattern);
    if (match) {
      paymentStartDate = parseDate(match[1]);
      console.log(`[Payment Start Date] ${paymentStartDate?.toLocaleDateString()}`);
      return true;
    }
    return false;
  });

  if (paymentStartDate && payments.length > 0) {
    payments[0].startDate = paymentStartDate;
  }

  // Extract payment reasons/explanations
  const reasonPatterns = [
    /(?:payment\s+)?change\s+(?:reason|because)[\s:]+([^.]+)/gi,
    /(?:payment\s+)?reason[\s:]+([^.]+)/gi
  ];

  reasonPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      const reason = match[1]?.trim();
      if (reason && payments.length > 0) {
        const latestPayment = payments[payments.length - 1];
        if (!latestPayment.reason) {
          latestPayment.reason = reason;
          console.log(`[Payment Reason] ${reason}`);
        }
      }
    }
  });

  // Extract back pay information
  const backPayPatterns = [
    /back\s+pay[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)/gi,
    /arrearage[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)/gi,
    /retroactive\s+payment[\s:]+\$?(\d{1,5}(?:[,.]?\d{3})*)/gi
  ];

  // Extract monthly payment details from structured format
  const monthlyPaymentPattern = /(?:Effective|effective)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4}):[\s\S]*?Monthly\s+entitlement:\s*\$([\d,]+\.\d{2})[\s\S]*?Amount\s+withheld[\s\S]*?:\s*\$([\d,]+\.\d{2})[\s\S]*?Net\s+amount\s+paid:\s*\$([\d,]+\.\d{2})/gi;
  let monthlyMatch;
  while ((monthlyMatch = monthlyPaymentPattern.exec(normalizedText)) !== null) {
    const effectiveDate = parseDate(monthlyMatch[1]);
    const monthlyEntitlement = parseFloat(monthlyMatch[2].replace(/,/g, ''));
    const amountWithheld = parseFloat(monthlyMatch[3].replace(/,/g, ''));
    const netAmountPaid = parseFloat(monthlyMatch[4].replace(/,/g, ''));
    
    const key = `monthly_${monthlyEntitlement}_${effectiveDate?.toISOString() || 'unknown'}`;
    if (!seen.has(key)) {
      seen.add(key);
      payments.push({
        type: 'Monthly Entitlement',
        monthlyAmount: monthlyEntitlement,
        amountWithheld: amountWithheld,
        netAmountPaid: netAmountPaid,
        effectiveDate: effectiveDate,
        currency: 'USD',
        evidenceSource: 'VA Payment Schedule'
      });
      console.log(`[Payment] Monthly entitlement: $${monthlyEntitlement}, Withheld: $${amountWithheld}, Net: $${netAmountPaid}`);
    }
  }
  
  backPayPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);

      if (amount && !isNaN(amount) && amount > 0) {
        payments.push({
          type: 'Back Pay',
          totalAmount: amount,
          currency: 'USD',
          extractionPattern: 'back pay',
          evidenceSource: 'VA Rating Decision'
        });
        console.log(`[Back Pay] ${amount}`);
      }
    }
  });

  return payments;
}

/**
 * Calculate total monthly entitlement
 * @param {Array<Object>} payments - Payments from extractPayments
 * @returns {number} Total monthly entitlement
 */
export function calculateTotalMonthlyEntitlement(payments) {
  if (!Array.isArray(payments)) return 0;

  const entitlements = payments.filter(p => p.type === 'Entitlement');
  if (entitlements.length === 0) return 0;

  // Return the most recent/highest entitlement
  return Math.max(...entitlements.map(e => e.monthlyAmount || 0));
}

/**
 * Get payment summary
 * @param {Array<Object>} payments - Payments from extractPayments
 * @returns {Object} Payment summary
 */
export function getPaymentSummary(payments) {
  if (!Array.isArray(payments)) {
    return {
      monthlyEntitlement: null,
      amountWithheld: null,
      netAmountPaid: null,
      backPayAmount: null
    };
  }

  const entitlements = payments.filter(p => p.type === 'Entitlement' || p.type === 'Monthly Entitlement');
  const withheld = payments.filter(p => p.type === 'Withheld');
  const backPayments = payments.filter(p => p.type === 'Back Pay');

  // Get monthly entitlement from first payment (might have all details)
  const firstPayment = entitlements[0];
  const monthlyEntitlement = firstPayment?.monthlyAmount || 
                             (entitlements.length > 0 ? Math.max(...entitlements.map(e => e.monthlyAmount || 0)) : null);

  const amountWithheld = firstPayment?.amountWithheld || 
                        (withheld.length > 0 ? withheld.reduce((sum, w) => sum + (w.monthlyAmount || 0), 0) : null);

  const netAmountPaid = firstPayment?.netAmountPaid || 
                       (monthlyEntitlement && amountWithheld ? monthlyEntitlement - amountWithheld : monthlyEntitlement);

  const backPayAmount = backPayments.length > 0
    ? (backPayments[0].totalAmount || backPayments[0].amount || backPayments[0].monthlyAmount)
    : null;

  return {
    monthlyEntitlement,
    amountWithheld,
    netAmountPaid,
    backPayAmount,
    startDate: firstPayment?.effectiveDate || entitlements[0]?.startDate || null
  };
}

