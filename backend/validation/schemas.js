/**
 * Input Validation Schemas
 * Centralized validation using Zod
 * Applied to all API endpoints
 */

import { z } from 'zod';

/**
 * STRS File Upload Schema
 */
export const strsUploadSchema = z.object({
  file: z.object({
    originalname: z.string().min(1, 'Filename required'),
    mimetype: z.enum(['application/pdf', 'text/plain'], {
      errorMap: () => ({ message: 'Only PDF or TXT files allowed' })
    }),
    size: z.number()
      .max(50 * 1024 * 1024, 'File exceeds 50MB limit')
      .min(1, 'File is empty'),
    buffer: z.instanceof(Buffer)
  })
});

/**
 * Veteran Onboarding Schema
 */
export const onboardingSchema = z.object({
  branch: z.enum(
    ['Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force', 'Other'],
    { errorMap: () => ({ message: 'Invalid military branch' }) }
  ),
  component: z.enum(
    ['Active Duty', 'Reserve', 'National Guard'],
    { errorMap: () => ({ message: 'Invalid service component' }) }
  ),
  servicePeriods: z.array(z.object({
    startDate: z.string().date('Invalid start date format (YYYY-MM-DD)'),
    endDate: z.string().date('Invalid end date format (YYYY-MM-DD)').optional(),
    theater: z.string().optional()
  })).min(1, 'At least one service period required'),
  combatSelfReported: z.enum(['yes', 'no', 'not_sure']),
  disabilityRatingKnown: z.boolean(),
  disabilityRatingPercent: z.number().min(0).max(100).optional(),
  stateOfResidence: z.string().min(2, 'Valid state required'),
  awards: z.array(z.string()).optional()
});

/**
 * Login Schema
 */
export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number')
});

/**
 * Dependent Schema (for SMC calculations)
 */
export const dependentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name required'),
  relationship: z.enum(['spouse', 'child', 'parent', 'other']),
  age: z.number().min(0).max(150),
  disabledStatus: z.enum(['no', 'yes']).default('no')
});

/**
 * Retirement Planning Schema
 */
export const retirementPlanSchema = z.object({
  currentAge: z.number().min(18).max(100),
  retirementAge: z.number().min(18).max(100),
  currentSavings: z.number().min(0),
  monthlyContribution: z.number().min(0),
  investmentReturn: z.number().min(0).max(1), // 0.07 = 7%
  lifeExpectancy: z.number().min(60).max(120),
  expenses: z.object({
    monthly: z.number().min(0),
    healthcare: z.number().min(0).optional(),
    travel: z.number().min(0).optional()
  })
});

/**
 * Benefits Query Schema
 */
export const benefitsQuerySchema = z.object({
  veteranId: z.string().min(1),
  includeStateOnly: z.boolean().default(false),
  includePending: z.boolean().default(true)
});

/**
 * Rate Limiting keys by endpoint
 */
export const rateLimitConfig = {
  default: { windowMs: 15 * 60 * 1000, max: 100 },  // 100 requests per 15 min
  auth: { windowMs: 60 * 60 * 1000, max: 5 },       // 5 attempts per hour
  upload: { windowMs: 60 * 60 * 1000, max: 20 },    // 20 uploads per hour
  search: { windowMs: 60 * 1000, max: 30 }          // 30 searches per minute
};

/**
 * Validation middleware factory
 * Validates incoming request data against schema
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      // Validate body
      if (req.body) {
        const validated = schema.parse(req.body);
        req.validatedData = validated;
      }

      // Validate query params if schema includes it
      if (req.query && schema.shape?.query) {
        schema.shape.query.parse(req.query);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      next(error);
    }
  };
};
