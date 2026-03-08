# Rally Forge - Priority Enhancement Quick-Start Guide

**Purpose:** Specific, actionable next steps to rapidly advance the application  
**Timeline:** 30-60 days to production-ready fundamentals  
**Owner Assignment:** Recommended developer allocation

---

## PHASE 0A: IMMEDIATE ACTIONS (This Week)

### Action 0A-1: Initialize PostgreSQL Development Environment
**Time:** 1-2 hours  
**Owner:** DevOps / Backend Lead

```bash
# Option 1: Docker (Recommended)
docker run -d \
  --name rally-postgres \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=rally_forge \
  -p 5432:5432 \
  postgres:15-alpine

# Option 2: Direct installation
# See: backend/database/cp_schema/README.md

# Test connection
psql -h localhost -U postgres -d rally_forge -c "SELECT 1"
```

**Outcome:** PostgreSQL running locally, connection verified  
**Evidence:** `backend/.env.local` created with `DATABASE_URL=postgresql://...`

---

### Action 0A-2: Create Environment Configuration System
**Time:** 30 minutes  
**Owner:** Backend Lead

**File:** `backend/.env.example`
```env
# Database
DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/rally_forge

# Server
PORT=4000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Secrets (leave empty for dev)
JWT_SECRET=development-key-not-for-production
ANTHROPIC_API_KEY=

# Feature flags
ENABLE_AI_ANALYSIS=false
ENABLE_VA_INTEGRATION=false
```

**File:** `backend/config.js` (new)
```javascript
export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  
  return {
    database: process.env.DATABASE_URL,
    port: parseInt(process.env.PORT || 4000),
    corsOrigins: (process.env.CORS_ORIGIN || '').split(','),
    jwtSecret: process.env.JWT_SECRET,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    features: {
      aiAnalysis: process.env.ENABLE_AI_ANALYSIS === 'true',
      vaIntegration: process.env.ENABLE_VA_INTEGRATION === 'true'
    },
    isProduction
  };
};
```

**Outcome:** Environment variables no longer hardcoded, safe for production  
**Evidence:** `.env.local` added to `.gitignore`, deployment uses proper `EnvVar` approach

---

### Action 0A-3: Set Up Database Migration Framework
**Time:** 1 hour  
**Owner:** Backend Lead

```bash
# Install migration tool
npm install -D node-postgres-migrations

# Create migration
npx pg-migrations create create_c_p_tables

# File: migrations/001_create_cp_schema.sql
# Copy content from: backend/database/cp_schema/schema.sql
```

**migrate.js** (new)
```javascript
import { migrate } from 'node-postgres-migrations';
import { getConfig } from './config.js';

const runMigrations = async () => {
  await migrate({ 
    databaseUrl: getConfig().database,
    migrationsDirectory: 'migrations',
    tableName: 'migrations'
  });
};

export { runMigrations };
```

**Outcome:** Reproducible database schema, versioned migrations  
**Evidence:** `migrations/` folder with `.sql` files, `migrations` table in DB

---

### Action 0A-4: Implement Basic Request Logging
**Time:** 1-2 hours  
**Owner:** Backend Lead

**File:** `backend/middleware/expressLogging.js` (new)
```javascript
import morgan from 'morgan';
import fs from 'fs';

const logStream = fs.createWriteStream('logs/access.log', { flags: 'a' });

export const loggingMiddleware = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
  { stream: logStream }
);
```

**Update `backend/app.js`:**
```javascript
import { loggingMiddleware } from './middleware/expressLogging.js';

export function createApp() {
  const app = express();
  
  // Add logging as first middleware
  app.use(loggingMiddleware);
  
  // ... rest of middleware
}
```

**Outcome:** All HTTP requests logged, debuggable from `/logs/access.log`  
**Evidence:** Access logs visible, timestamps and status codes recorded

---

## PHASE 0B: SECURITY & VALIDATION (Next 3-5 Days)

### Action 0B-1: Implement Basic Input Validation
**Time:** 2-3 hours  
**Owner:** Backend Lead

```bash
npm install zod
```

**File:** `backend/validation/schemas.js` (new)
```javascript
import { z } from 'zod';

export const strsUploadSchema = z.object({
  file: z.object({
    originalname: z.string(),
    mimetype: z.enum(['application/pdf', 'text/plain']),
    size: z.number().max(50 * 1024 * 1024, 'File too large')
  })
});

export const onboardingSchema = z.object({
  branch: z.enum(['Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force']),
  component: z.enum(['Active Duty', 'Reserve', 'National Guard']),
  servicePeriods: z.array(z.object({
    startDate: z.string().date(),
    endDate: z.string().date().optional()
  }))
});
```

**Update `backend/api/strs.js`:**
```javascript
import { strsUploadSchema } from '../validation/schemas.js';

router.post('/upload', upload.single('strs'), asyncHandler(async (req, res) => {
  try {
    strsUploadSchema.parse({ file: req.file });
    // ... proceed with processing
  } catch (error) {
    return res.status(400).json({ error: error.errors[0].message });
  }
}));
```

**Outcome:** Invalid requests rejected at API boundary, detailed error messages  
**Evidence:** POST requests with invalid data rejected with 400 status

---

### Action 0B-2: Add Rate Limiting
**Time:** 1 hour  
**Owner:** Backend Lead

**Update `backend/middleware/hardening.js`:**
```javascript
import RateLimit from 'express-rate-limit';

export const apiLimiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit per IP
  message: 'Too many requests, please try again later',
  standardHeaders: true, // return rate limit info in headers
  legacyHeaders: false // disable X-RateLimit-* headers
});

export const authLimiter = RateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  skipSuccessfulRequests: true
});
```

**Update `backend/app.js`:**
```javascript
import { apiLimiter, authLimiter } from './middleware/hardening.js';

export function createApp() {
  app.use('/api/', apiLimiter);
  // ... more routes
}
```

**Outcome:** API protected from abuse, requests throttled at 100/15min/IP  
**Evidence:** Requests beyond limit receive 429 status

---

### Action 0B-3: Implement JWT Authentication Framework
**Time:** 3-4 hours  
**Owner:** Backend Lead

```bash
npm install jsonwebtoken bcryptjs
```

**File:** `backend/middleware/auth.js` (new)
```javascript
import jwt from 'jsonwebtoken';
import { getConfig } from '../config.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, getConfig().jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    getConfig().jwtSecret,
    { expiresIn: '24h' }
  );
};
```

**File:** `backend/api/auth.js` (new)
```javascript
import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// TODO: Connect to veterans table in database
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Placeholder for now - will integrate with DB
  // In production:
  // 1. Look up user in veterans table
  // 2. Hash incoming password with stored salt
  // 3. If match, return JWT token
  
  const token = generateToken('veteran-123', 'veteran');
  res.json({ token });
});

export default router;
```

**Update `backend/app.js`:**
```javascript
import authRouter from './api/auth.js';
import { authenticateToken } from './middleware/auth.js';

app.use('/api/auth', authRouter);
app.use('/api/protected', authenticateToken); // Protect future endpoints
```

**Outcome:** Token-based auth ready for OAuth integration  
**Evidence:** `/api/auth/login` returns JWT token, token validated on protected routes

---

## PHASE 0C: ASYNC PROCESSING (Days 6-8)

### Action 0C-1: Add Job Queue for PDF Processing
**Time:** 3-4 hours  
**Owner:** Backend Lead

```bash
npm install bull redis
```

**File:** `backend/queue/pdfQueue.js` (new)
```javascript
import Bull from 'bull';
import { extractTextFromPdf, scanSTRText } from '../engine/strs/strs-engine.js';

const pdfQueue = new Bull('pdf-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

pdfQueue.process(async (job) => {
  const { filePath, fileName } = job.data;
  
  job.progress(10);
  const text = await extractTextFromPdf(filePath);
  
  job.progress(50);
  const results = scanSTRText(text);
  
  job.progress(100);
  return results;
});

pdfQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed`);
  // Store results in database
});

export { pdfQueue };
```

**Update `backend/api/strs.js`:**
```javascript
import { pdfQueue } from '../queue/pdfQueue.js';

router.post('/upload', upload.single('strs'), asyncHandler(async (req, res) => {
  const filePath = req.file.path;
  
  // Queue the job instead of processing sync
  const job = await pdfQueue.add(
    { filePath, fileName: req.file.originalname },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
  
  // Return immediately with job ID
  res.json({
    success: true,
    jobId: job.id,
    status: 'processing',
    estimatedTime: '30-60 seconds for typical documents'
  });
}));

// Allow frontend to check job status
router.get('/status/:jobId', asyncHandler(async (req, res) => {
  const job = await pdfQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const state = await job.getState();
  const progress = job._progress;
  
  res.json({ status: state, progress, result: job.returnvalue });
}));
```

**Outcome:** PDF processing no longer blocks main thread, scalable to 1000+ concurrent uploads  
**Evidence:** `/api/strs/upload` returns immediately, `/api/strs/status/{id}` shows progress

---

## PHASE 1A: FEATURE COMPLETION (Days 9-15)

### Action 1A-1: Complete Retirement Planner API
**Time:** 2-3 days  
**Owner:** Backend Lead

**File:** `backend/api/financial.js` (update)
```javascript
import express from 'express';
import { computeRetirementScenarios } from '../engine/retirementEngine.js';

const router = express.Router();

router.post('/retirement/analyze', authenticateToken, asyncHandler(async (req, res) => {
  const {
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    investmentReturn,
    lifeExpectancy,
    expenses
  } = req.body;
  
  const scenarios = computeRetirementScenarios({
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    investmentReturn,
    lifeExpectancy,
    expenses
  });
  
  res.json({
    success: true,
    scenarios: {
      conservative: scenarios.conservative,
      moderate: scenarios.moderate,
      aggressive: scenarios.aggressive
    },
    probabilityOfSuccess: scenarios.successRate,
    recommendations: scenarios.recommendations
  });
}));

export default router;
```

**Wire into `backend/app.js`:**
```javascript
import financialRouter from './api/financial.js';
app.use('/api/financial', authenticateToken, financialRouter);
```

**Frontend:** `app/frontend-modern/src/pages/RetirementPlannerPage.jsx` (update)
```jsx
const handleAnalyze = async () => {
  const response = await fetch('/api/financial/retirement/analyze', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(formData)
  });
  
  const result = await response.json();
  setScenarios(result.scenarios);
  setSuccessRate(result.probabilityOfSuccess);
};
```

**Outcome:** Retirement Planner fully functional, integrated with backend  
**Evidence:** `/api/financial/retirement/analyze` returns scenario data with success probabilities

---

### Action 1A-2: Implement Multi-Dependent SMC Calculation UI
**Time:** 2 days  
**Owner:** Frontend Lead

**File:** `app/frontend-modern/src/pages/DependentManagementPage.jsx` (new)
```jsx
import React, { useState } from 'react';
import { Card } from '../components/Card';

export function DependentManagementPage() {
  const [dependents, setDependents] = useState([]);
  const [smcImpact, setSmcImpact] = useState(0);

  const addDependent = () => {
    setDependents([...dependents, {
      id: Date.now(),
      name: '',
      relationship: 'spouse',
      age: 0
    }]);
  };

  const calculateSMC = async () => {
    const response = await fetch('/api/calculator/smc-with-dependents', {
      method: 'POST',
      body: JSON.stringify({ dependents })
    });
    
    const result = await response.json();
    setSmcImpact(result.monthlyIncrease);
  };

  return (
    <Card title="Dependent Management & SMC Impact">
      {/* Form to add/edit dependents */}
      {dependents.map(dep => (
        <DependentRow key={dep.id} dependent={dep} />
      ))}
      <button onClick={addDependent}>+ Add Dependent</button>
      <button onClick={calculateSMC}>Calculate SMC Impact</button>
      
      {smcImpact > 0 && (
        <div style={{ color: 'green', fontSize: '1.2rem' }}>
          Additional Monthly: +${smcImpact.toFixed(2)}
        </div>
      )}
    </Card>
  );
}
```

**Outcome:** Veterans can model dependent scenarios and see SMC impact  
**Evidence:** Dependent UI populated, SMC changes reflected in calculator

---

## PHASE 1B: CLEANUP & STABILIZATION (Days 16-20)

### Action 1B-1: Fix All 80 Unresolved Imports
**Time:** 2 days  
**Owner:** Backend Lead + Frontend Lead

```bash
# Generate import audit
node tooling/scripts/audit-imports.js > import-report.json

# Review and fix:
# 1. Replace moved files
# 2. Add missing file extensions
# 3. Remove circular imports
```

**Script:** `tooling/scripts/fix-imports.js` (new)
```javascript
import fs from 'fs';
import path from 'path';
import glob from 'glob';

const fixes = {
  '../services/combatService': '../engine/benefits/combatEngine',
  '../engine/stateBenefits': '../engine/benefits/stateBenefits',
  // ... add more mappings
};

glob('**/**.{js,jsx}', (err, files) => {
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    Object.entries(fixes).forEach(([old, modern]) => {
      content = content.replace(
        new RegExp(`from ['"]${old}['"]`, 'g'),
        `from '${modern}'`
      );
    });
    
    fs.writeFileSync(file, content);
  });
});
```

**Outcome:** All imports resolvable, no broken paths  
**Evidence:** `npm run build` succeeds with no unresolved warnings

---

### Action 1B-2: Delete Legacy `app/` Architecture
**Time:** 1 day  
**Owner:** Backend Lead

```bash
# Backup first
git tag backup-before-legacy-deletion
cp -r app app.backup

# Delete legacy files
rm -rf app/backend
rm -rf app/frontend
rm -rf app/tools

# Keep only:
# - app/frontend-modern/ (modern React)

# Update package.json workspaces
# Change: "app/*" → "app/frontend-modern"
```

**Outcome:** Cleaner codebase, ~50 orphaned files removed, faster builds  
**Evidence:** `du -sh app` shows significantly reduced size

---

## PHASE 2: SHORT-TERM WINS (Weeks 4-5)

### Quick Wins for Maximum Impact

| Feature | Owner | Time | Impact | Users |
|---------|-------|------|--------|-------|
| **Regional Office Locator** | Jr Dev | 1-2 days | High | All |
| **Multi-Language (Spanish)** | Jr Dev | 2-3 days | Medium | 15% more |
| **Appointment Scheduler** | Jr Dev | 2 days | Medium | 25% engagement |
| **Evidence Checklist Generator** | Backend | 1-2 days | High | Appeal prep |
| **Benefit Comparison Tool** | Frontend | 2-3 days | High | Decision making |
| **Mobile-Responsive UI Fix** | Frontend | 2 days | High | Mobile users |

---

## PHASE 3: STRATEGIC INITIATIVES (Weeks 6-12)

### High-Impact, Higher-Effort Items

1. **VA.gov Integration** (2-3 weeks)
   - OAuth2 flow for auto-population
   - Reduces data entry by 70%
   - Dramatically improves user satisfaction

2. **AI-Powered Recommendations** (1-2 weeks)
   - Claude API integration
   - Personalized next steps per veteran
   - Improves NPS score by 30+ points

3. **Mobile App (React Native)** (2-3 weeks)
   - Expo setup, shared business logic
   - Camera for document upload
   - Push notifications for claim updates

4. **Database Reporting Suite** (1-2 weeks)
   - Custom dashboards per veteran
   - Aggregate insights for VSOsand partners
   - Compliance reporting for audits

---

## SUCCESS METRICS & TRACKING

### Define What Success Looks Like

```markdown
## Completion Criteria

### Phase 0 (Weeks 1-2)
- [ ] PostgreSQL running with schema migrated
- [ ] Environment variables externalized
- [ ] JWT auth framework in place (not yet required)
- [ ] Input validation on all endpoints
- [ ] Rate limiting active
- [ ] 0 security warnings in npm audit

### Phase 1 (Weeks 3-5)
- [ ] Retirement Planner API complete
- [ ] Dependent management UI working
- [ ] All 80 unresolved imports fixed
- [ ] Legacy `app/` folder deleted
- [ ] All tests passing
- [ ] Deployment to staging environment

### Phase 2 (Weeks 6-8)
- [ ] Regional Office Locator integrated
- [ ] Multi-language support (Spanish)
- [ ] Mobile app MVP launched
- [ ] AI recommendations active
- [ ] 50% reduction in user support tickets

### Success is Achieved When:
- ✅ Application deployed to production (HTTPS, real DB)
- ✅ 10,000+ veterans have used platform
- ✅ 4.5+ star rating on independent reviews
- ✅ Zero HIPAA violations in audit
- ✅ Partnerships signed with 5+ VSOs
```

---

## Resource Allocation Recommendation

### Minimum Team (3 developers)
```
- Backend Lead (1): Database, APIs, security
- Frontend Lead (1): UI, mobile prep
- Full-Stack Engineer (1): Integration, DevOps basics
+ Product Manager (0.5): Prioritization, requirements
+ QA (0.5): Testing, deployment verification
```

### Optimal Team (5+ developers)
```
- Backend Lead: Architecture, security, performance
- Backend Dev (1-2): Features, database
- Frontend Lead: UI/UX, React
- Frontend Dev (1-2): Components, mobile
- DevOps/SRE: Deployment, monitoring, scaling
+ Product Manager: Roadmap, user research
+ QA: Test automation, manual verification
```

---

## Risk Mitigation Plan

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Database migration fails | Medium | High | Weekly backups, dry-run migrations |
| Performance degrades | Medium | High | Load testing before Phase 2 |
| Security audit fails | Low | Critical | Third-party audit in parallel with dev |
| Team turnover | Medium | High | Documentation investment, pair programming |
| Scope creep | High | High | Strict change control, sprint planning |
| User adoption slow | Medium | Medium | Beta program with 100 veterans first |

---

## Next Review: April 7, 2026

Reconvene to assess Phase 0 completion and adjust roadmap as needed.

**End of Quick-Start Guide**
