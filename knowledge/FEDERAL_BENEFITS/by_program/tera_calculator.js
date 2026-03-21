/**
 * TERA (Temporary Early Retirement Authority) Calculation Engine
 * Calculates military retirement pay for service members with 15-20 years of service
 * @module TERACalculationEngine
 * @version 1.0.0
 */

class TERACalculationEngine {
    constructor() {
        this.MULTIPLIER_RATE = 0.025; // 2.5% per year of service
        this.MIN_YEARS = 15;
        this.MAX_YEARS = 20;
        this.SBP_RATE = 0.065; // 6.5% for Survivor Benefit Plan
    }

    /**
     * Validates TERA eligibility
     * @param {Object} serviceRecord - Service member's service record
     * @returns {Object} - Validation result with eligibility status and messages
     */
    validateEligibility(serviceRecord) {
        const errors = [];
        const warnings = [];
        
        const years = serviceRecord.totalService.fractionalYears;
        
        // Check minimum service requirement
        if (years < this.MIN_YEARS) {
            errors.push({
                code: 'INSUFFICIENT_SERVICE',
                message: `Service years (${years}) below minimum ${this.MIN_YEARS} years for TERA`,
                severity: 'error'
            });
        }
        
        // Check maximum service requirement
        if (years >= this.MAX_YEARS) {
            errors.push({
                code: 'EXCEEDS_TERA_LIMIT',
                message: `Service years (${years}) meets or exceeds 20 years - eligible for regular retirement instead`,
                severity: 'error',
                recommendation: 'Apply for regular retirement (better benefits)'
            });
        }
        
        // Warning for close to 20 years
        if (years >= 19 && years < this.MAX_YEARS) {
            warnings.push({
                code: 'NEAR_FULL_RETIREMENT',
                message: `Only ${(20 - years).toFixed(2)} years from full retirement`,
                recommendation: 'Consider completing 20 years for higher retirement pay',
                impact: `Would gain ${((0.50 - (years * this.MULTIPLIER_RATE)) * 100).toFixed(1)}% more retirement pay`
            });
        }
        
        return {
            eligible: errors.length === 0,
            errors,
            warnings,
            years,
            multiplier: years * this.MULTIPLIER_RATE
        };
    }

    /**
     * Calculate TERA retirement pay
     * @param {Object} input - Input data conforming to TERA calculation schema
     * @returns {Object} - Complete TERA calculation results
     */
    calculate(input) {
        // Validate eligibility first
        const eligibility = this.validateEligibility(input.serviceRecord);
        
        if (!eligibility.eligible) {
            return {
                success: false,
                eligibility,
                error: 'Service member not eligible for TERA retirement'
            };
        }
        
        // Extract values
        const years = input.serviceRecord.totalService.fractionalYears;
        const high36Average = input.serviceRecord.high36.average;
        const multiplier = years * this.MULTIPLIER_RATE;
        
        // Calculate gross retirement pay
        const monthlyPay = high36Average * multiplier;
        const annualPay = monthlyPay * 12;
        
        // Build calculation result
        const result = {
            success: true,
            eligibility,
            serviceMember: input.serviceMember,
            calculation: {
                multiplier: this.roundToDecimal(multiplier, 4),
                multiplierPercentage: this.roundToDecimal(multiplier * 100, 2),
                high36Average,
                monthlyPay: this.roundToDecimal(monthlyPay, 2),
                annualPay: this.roundToDecimal(annualPay, 2),
                effectiveDate: input.serviceRecord.retirementDate
            },
            comparison: this.calculateComparison(years, high36Average, monthlyPay, annualPay),
            metadata: {
                calculationDate: new Date().toISOString(),
                calculatedBy: 'TERA Calculation Engine v1.0.0',
                validationStatus: 'validated'
            }
        };
        
        // Calculate deductions if provided
        if (input.deductions) {
            result.deductions = this.calculateDeductions(monthlyPay, input.deductions);
            result.netPay = this.calculateNetPay(monthlyPay, result.deductions);
        }
        
        // Calculate COLA projections if requested
        if (input.includeProjections) {
            result.cola = this.calculateCOLAProjections(monthlyPay, input.projectionYears || 20);
        }
        
        return result;
    }

    /**
     * Calculate comparison to 20-year retirement
     * @param {number} teraYears - TERA years of service
     * @param {number} high36Average - High-36 average pay
     * @param {number} teraMonthly - TERA monthly pay
     * @param {number} teraAnnual - TERA annual pay
     * @returns {Object} - Comparison data
     */
    calculateComparison(teraYears, high36Average, teraMonthly, teraAnnual) {
        const fullRetirementMultiplier = 0.50; // 20 years × 0.025
        const fullMonthly = high36Average * fullRetirementMultiplier;
        const fullAnnual = fullMonthly * 12;
        
        const monthlyDiff = teraMonthly - fullMonthly;
        const annualDiff = teraAnnual - fullAnnual;
        const percentReduction = ((monthlyDiff / fullMonthly) * 100);
        
        // Estimate lifetime difference (assuming retirement to age 75, 30+ year retirement)
        const estimatedRetirementYears = 30;
        const lifetimeDiff = annualDiff * estimatedRetirementYears;
        
        return {
            tera: {
                years: teraYears,
                monthlyPay: this.roundToDecimal(teraMonthly, 2),
                annualPay: this.roundToDecimal(teraAnnual, 2)
            },
            fullRetirement: {
                years: 20,
                estimatedMonthlyPay: this.roundToDecimal(fullMonthly, 2),
                estimatedAnnualPay: this.roundToDecimal(fullAnnual, 2)
            },
            difference: {
                monthlyDifference: this.roundToDecimal(monthlyDiff, 2),
                annualDifference: this.roundToDecimal(annualDiff, 2),
                percentageReduction: this.roundToDecimal(Math.abs(percentReduction), 2),
                lifetimeDifferenceEstimate: this.roundToDecimal(lifetimeDiff, 2),
                note: `TERA retirement at ${teraYears} years results in ${this.roundToDecimal(Math.abs(percentReduction), 1)}% less monthly income than 20-year retirement`
            }
        };
    }

    /**
     * Calculate deductions from retirement pay
     * @param {number} monthlyPay - Gross monthly retirement pay
     * @param {Object} deductions - Deduction configuration
     * @returns {Object} - Calculated deductions
     */
    calculateDeductions(monthlyPay, deductions) {
        const result = {
            sbp: null,
            federalTax: null,
            stateTax: null,
            totalDeductions: 0
        };
        
        // SBP deduction
        if (deductions.sbp && deductions.sbp.elected) {
            const baseCoverage = deductions.sbp.baseCoverage || monthlyPay;
            const sbpPremium = baseCoverage * this.SBP_RATE;
            result.sbp = {
                elected: true,
                coverageLevel: deductions.sbp.coverageLevel,
                baseCoverage: this.roundToDecimal(baseCoverage, 2),
                monthlyPremium: this.roundToDecimal(sbpPremium, 2),
                annualPremium: this.roundToDecimal(sbpPremium * 12, 2)
            };
            result.totalDeductions += sbpPremium;
        }
        
        // Federal tax withholding (simplified - actual calculation more complex)
        if (deductions.federalTax) {
            const estimatedFederalTax = deductions.federalTax.additionalWithholding || 0;
            result.federalTax = {
                withholdingStatus: deductions.federalTax.withholdingStatus,
                exemptions: deductions.federalTax.exemptions,
                monthlyWithholding: estimatedFederalTax
            };
            result.totalDeductions += estimatedFederalTax;
        }
        
        // State tax withholding
        if (deductions.stateTax && deductions.stateTax.withholdingAmount) {
            result.stateTax = {
                state: deductions.stateTax.state,
                monthlyWithholding: deductions.stateTax.withholdingAmount
            };
            result.totalDeductions += deductions.stateTax.withholdingAmount;
        }
        
        result.totalDeductions = this.roundToDecimal(result.totalDeductions, 2);
        
        return result;
    }

    /**
     * Calculate net pay after deductions
     * @param {number} monthlyPay - Gross monthly pay
     * @param {Object} deductions - Calculated deductions
     * @returns {Object} - Net pay information
     */
    calculateNetPay(monthlyPay, deductions) {
        const monthlyNet = monthlyPay - deductions.totalDeductions;
        const annualNet = monthlyNet * 12;
        
        return {
            monthlyNet: this.roundToDecimal(monthlyNet, 2),
            annualNet: this.roundToDecimal(annualNet, 2),
            deductionSummary: {
                grossMonthly: this.roundToDecimal(monthlyPay, 2),
                totalDeductions: deductions.totalDeductions,
                netMonthly: this.roundToDecimal(monthlyNet, 2),
                deductionPercentage: this.roundToDecimal((deductions.totalDeductions / monthlyPay) * 100, 2)
            }
        };
    }

    /**
     * Calculate COLA (Cost of Living Adjustment) projections
     * @param {number} baseMonthlyPay - Base monthly retirement pay
     * @param {number} years - Number of years to project
     * @param {number} avgCOLA - Average annual COLA rate (default 2.5%)
     * @returns {Object} - COLA projection data
     */
    calculateCOLAProjections(baseMonthlyPay, years = 20, avgCOLA = 0.025) {
        const projections = [];
        let currentPay = baseMonthlyPay;
        
        for (let year = 1; year <= years; year++) {
            currentPay = currentPay * (1 + avgCOLA);
            projections.push({
                year,
                colaRate: this.roundToDecimal(avgCOLA * 100, 2),
                monthlyPay: this.roundToDecimal(currentPay, 2),
                annualPay: this.roundToDecimal(currentPay * 12, 2),
                cumulativeIncrease: this.roundToDecimal(((currentPay - baseMonthlyPay) / baseMonthlyPay) * 100, 2)
            });
        }
        
        return {
            enabled: true,
            averageCOLARate: avgCOLA,
            baseMonthlyPay: this.roundToDecimal(baseMonthlyPay, 2),
            projections,
            note: `Projections assume constant ${(avgCOLA * 100).toFixed(1)}% annual COLA. Actual COLA varies yearly based on CPI.`
        };
    }

    /**
     * Batch calculate multiple TERA scenarios
     * @param {Array} inputs - Array of calculation inputs
     * @returns {Array} - Array of calculation results
     */
    batchCalculate(inputs) {
        return inputs.map((input, index) => {
            try {
                const result = this.calculate(input);
                return {
                    index,
                    inputId: input.serviceMember?.id || `scenario-${index}`,
                    ...result
                };
            } catch (error) {
                return {
                    index,
                    inputId: input.serviceMember?.id || `scenario-${index}`,
                    success: false,
                    error: error.message
                };
            }
        });
    }

    /**
     * Round number to specified decimal places
     * @param {number} value - Number to round
     * @param {number} decimals - Number of decimal places
     * @returns {number} - Rounded number
     */
    roundToDecimal(value, decimals) {
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TERACalculationEngine;
}

// Example usage:
// const engine = new TERACalculationEngine();
// const result = engine.calculate(inputData);
// console.log(result);
