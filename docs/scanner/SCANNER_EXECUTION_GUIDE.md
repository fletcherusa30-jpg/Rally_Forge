# SCANNER EXECUTION GUIDE

## Quick Start

### Execute Full Scan (Recommended First Step)

```bash
cd "c:\Dev\Rally Forge"
node scanner/scanner_cli.js scan
```

**Expected Output**:
```
🔍 Rally Forge Scanner - Analysis Mode

Root: c:\Dev\Rally Forge
Scope: full
Output format: summary

Running scan pipeline....... done!

📊 Scan Results:
  Assets indexed: [number]
  Structural findings: [number]
  Logic findings: [number]
  Performance findings: [number]
  Semantic insights: [number]
  Repair actions: [number]
  Total findings: [number]
  Overall health: [EXCELLENT|GOOD|FAIR|POOR|CRITICAL]

✅ Report saved: c:\Dev\Rally Forge\scanner\runtime\reports\scan_[timestamp].json
```

## Command Reference

### Scan Operations

#### Full System Scan
```bash
node scanner/scanner_cli.js scan
```

Scans entire Rally Forge codebase.

#### Backend-Only Scan
```bash
node scanner/scanner_cli.js scan --scope backend
```

Focuses on backend/ directory - API, services, database.

#### Frontend-Only Scan
```bash
node scanner/scanner_cli.js scan --scope frontend
```

Focuses on src/ and frontend/ - React components, styling.

#### Scanner-Subsystem Scan
```bash
node scanner/scanner_cli.js scan --scope scanner
```

Self-analysis: Scans the scanner/ modules themselves.

#### Full Output (All Logs)
```bash
node scanner/scanner_cli.js scan --format full
```

Shows detailed execution log for each pipeline stage with timings.

#### JSON Output (Machine Readable)
```bash
node scanner/scanner_cli.js scan --format json
```

Outputs raw JSON report - useful for parsing or piping to other tools.

---

### Report Operations

#### List Available Reports
```bash
node scanner/scanner_cli.js status
```

Shows count of reports and snapshots generated.

#### View Latest Report Summary
```bash
node scanner/scanner_cli.js report --id scan_1708511696000
```

Replace `scan_1708511696000` with actual report ID from status or scan output.

#### View Full Report (Markdown)
```bash
node scanner/scanner_cli.js report --id scan_1708511696000 --format full
```

Displays human-readable Markdown version with all details.

#### Export Report as JSON
```bash
node scanner/scanner_cli.js report --id scan_1708511696000 --format json
```

Outputs raw JSON for integration with other systems.

---

### Repair Operations

#### Dry-Run (No Changes)
```bash
node scanner/scanner_cli.js repair --plan-id repair_1708511696000 --mode dry-run
```

Shows what repairs would be executed without making any changes.

#### Auto-Repair (Safe Only)
```bash
node scanner/scanner_cli.js repair --plan-id repair_1708511696000 --mode auto
```

Executes reversible, low-risk repairs automatically.

#### Manual Repair (Confirm Each)
```bash
node scanner/scanner_cli.js repair --plan-id repair_1708511696000 --mode manual
```

Prompts for confirmation before each repair (not yet implemented).

---

### Help & Information

#### Scanner Help
```bash
node scanner/scanner_cli.js help
```

Shows all available commands and options.

#### Scan Help
```bash
node scanner/scanner_cli.js scan --help
```

Detailed help for scan command.

#### Version
```bash
node scanner/scanner_cli.js version
```

Shows scanner version number.

---

## Step-by-Step Execution Workflow

### Step 1: Review Configuration

```bash
# Check main configuration
cat scanner/config/scanner.config.json

# Review performance thresholds
cat scanner/config/thresholds.json
```

Ensure settings match your expectations for:
- Ignore patterns
- Performance baselines
- Severity levels

### Step 2: Run Initial Scan

```bash
node scanner/scanner_cli.js scan --format full
```

This will:
1. Index all files (Discovery stage)
2. Validate structure (Structural Analysis stage)
3. Check code quality (Logic Analysis stage)
4. Measure performance (Performance Profiling stage)
5. Correlate findings (Semantic Analysis stage)
6. Create repair plan (Repair Planning stage)
7. Generate report (Report Generation stage)

### Step 3: Review Findings

Check the generated report:

```bash
# Show summary
node scanner/scanner_cli.js report --id scan_[timestamp] --format summary

# Show full details
node scanner/scanner_cli.js report --id scan_[timestamp] --format full

# View HTML version if available
cat scanner/runtime/reports/scan_[timestamp].md
```

Look for:
- Critical findings (fix immediately)
- High findings (fix within sprint)
- Patterns and root causes (address systematically)
- Health scores (track over time)

### Step 4: Plan Repairs

The scanner generates repair plans automatically:
- Actions listed by priority (critical → high → medium → low)
- Each action includes effort estimate
- Marked as reversible or destructive
- Safe/automated vs. requires review

Review the repair plan in the report.

### Step 5: Dry-Run Repairs

Before making changes, test with dry-run:

```bash
node scanner/scanner_cli.js repair --plan-id [repair-id] --mode dry-run
```

This shows what would happen without executing.

### Step 6: Execute Repairs (Optional)

After review and dry-run:

```bash
# Auto-execute safe repairs
node scanner/scanner_cli.js repair --plan-id [repair-id] --mode auto
```

Or execute manually (not yet implemented):

```bash
node scanner/scanner_cli.js repair --plan-id [repair-id] --mode manual
```

### Step 7: Verify Fixes

Re-run scan to verify improvements:

```bash
node scanner/scanner_cli.js scan --format summary
```

Compare with previous report:
- Should see fewer/lower severity findings
- Health scores should improve
- Total finding count should decrease

### Step 8: Track Trends

Monitor scan results over time:

```bash
node scanner/scanner_cli.js status
```

Shows historical reports and snapshots for trend analysis.

---

## Understanding Output

### Summary Format

```
📊 Scan Results:
  Assets indexed: 1,247          # Total files/modules found
  Structural findings: 8         # Schema/naming/reference issues
  Logic findings: 24             # Code quality issues
  Performance findings: 3        # Performance bottlenecks
  Semantic insights: 12          # Root cause interpretations
  Repair actions: 28             # Recommended repairs
  Total findings: 35             # Sum of all finding types
  Overall health: GOOD           # Calculated from 3 metrics
```

### Full Format

Complete pipeline execution log with:
- Stage-by-stage output
- Execution timings
- Count summaries
- Detailed logs

### JSON Format

Machine-readable report with:
- Raw ScanReport object
- All findings (full details)
- Repair plan with actions
- Health snapshot
- Execution metadata

---

## Report Locations

Reports are archived in:

```
scanner/runtime/reports/
├── scan_1708511696000.json      # JSON report
├── scan_1708511696000.md        # Markdown report
├── scan_1708511696001.json
└── scan_1708511696001.md
```

Snapshots for drift detection:

```
scanner/runtime/snapshots/
├── snapshot_1708511696000.json
├── snapshot_1708511696001.json
└── snapshot_1708511696002.json
```

---

## Interpreting Findings

### Structural Findings

| Type | Example | Fix |
|------|---------|-----|
| broken_reference | Import './utils/helper' not found | Fix path or create file |
| missing_file | package.json missing | Create required file |
| schema_violation | Config file not JSON | Update to correct format |
| naming_violation | File named FileName.js (PascalCase) | Rename to file-name.js |

### Logic Findings

| Type | Example | Fix |
|------|---------|-----|
| unhandled_promises | `.then().done()` missing `.catch()` | Add error handler |
| empty_functions | `function do() {}` | Implement or remove |
| console_excessive | Multiple console.log in single file | Use logging service |
| todo_comments | `// TODO: implement this` | Complete or track issue |
| debug_code | `debugger;` or `.only()` | Remove before shipping |
| async_no_trycatch | `async function() { await x; }` | Wrap with try-catch |

### Performance Findings

| Type | Baseline | Warning | Critical |
|------|----------|---------|----------|
| bloated_codebase | 5MB | 6MB | 8MB |
| oversized_file | 250 lines | 325 lines | 400 lines |
| dependency_bloat | 30 packages | 45 packages | 60 packages |
| large_asset | Varies | 1.5x baseline | 2x baseline |

### Semantic Insights

| Category | Meaning | Action |
|----------|---------|--------|
| root_cause | Systematic problem | Address systemically |
| pattern | Architectural pattern/anti-pattern | Refactor if anti-pattern |
| risk | Potential failure cascade | Mitigate risk |
| opportunity | Optimization opportunity | Include in backlog |

---

## Priority-Based Action Plan

### Critical Findings (Fix First)
- System cannot function
- Runtime crashes likely
- Data loss risk
- Security vulnerabilities

**Timeline**: Today/ASAP

Example repairs:
```
[1] Repair broken imports in src/components/
[2] Add .catch() handlers to critical promises
[3] Remove debugger statements
[4] Fix async functions missing try-catch
```

### High Findings (Fix This Sprint)
- Major functionality affected
- User-visible issues
- Definition of done blockers

**Timeline**: This sprint (1-2 weeks)

Example repairs:
```
[5] Refactor oversized files (>500 lines)
[6] Consolidate dependencies
[7] Implement empty stub functions
```

### Medium Findings (Include in Backlog)
- Minor functionality affected
- Code quality improvements
- Performance optimizations

**Timeline**: Next sprint or backlog

Example repairs:
```
[8] Replace console statements with logging service
[9] Address TODOs and technical debt
[10] Optimize bundle size
```

### Low/Info Findings (Nice to Have)
- Cosmetic issues
- Non-blocking improvements
- Future enhancements

**Timeline**: When resources available

---

## Interpreting Health Scores

### Integrity Score (Schema Conformance)
- **0.95-1.0** ✅ Excellent - All structure valid
- **0.85-0.94** ⚠️ Good - Minor deviations
- **0.70-0.84** ⚠️ Fair - Some violations
- **0.50-0.69** 🔴 Poor - Many violations
- **<0.50** 🔴 Critical - Structure broken

**Improve by**: Fixing missing files, broken references, naming violations.

### Stability Score (Error Handling)
- **0.95-1.0** ✅ Excellent - Robust error handling
- **0.85-0.94** ⚠️ Good - Mostly covered
- **0.70-0.84** ⚠️ Fair - Some gaps
- **0.50-0.69** 🔴 Poor - Many unhandled cases
- **<0.50** 🔴 Critical - Crash risk

**Improve by**: Adding error handlers, try-catch blocks, validations.

### Performance Score (Optimization)
- **0.95-1.0** ✅ Excellent - Well optimized
- **0.85-0.94** ⚠️ Good - Minor optimizations needed
- **0.70-0.84** ⚠️ Fair - Some bottlenecks
- **0.50-0.69** 🔴 Poor - Significant overhead
- **<0.50** 🔴 Critical - Major slowdowns

**Improve by**: Reducing bundle size, splitting files, consolidating dependencies.

---

## Customizing Configuration

### Adjust Baselines

Edit `scanner/config/thresholds.json`:

```json
{
  "performance": {
    "codeSize": {
      "totalCodebase": {
        "baseline": 5242880,      // Change from 5MB to your target
        "warning": 6291456,
        "critical": 7864320
      }
    }
  }
}
```

Update baselines based on actual Rally Forge metrics after first scan.

### Add Ignore Patterns

Edit `scanner/config/scanner.config.json`:

```json
{
  "discovery": {
    "ignorePatterns": [
      "node_modules",
      ".git",
      "my_special_directory",  // Add custom patterns
      "*.tmp"
    ]
  }
}
```

### Adjust Severity Triggers

Edit `scanner/config/thresholds.json`:

```json
{
  "severity": {
    "triggers": {
      "critical": {
        "failedTests": 5,
        "brokenReferences": 3      // Raise threshold if too many alerts
      }
    }
  }
}
```

---

## Troubleshooting

### Scan Hangs/Times Out

**Problem**: Scanner takes longer than expected.

**Solutions**:
1. Increase `timeoutMs` in `scanner.config.json`
2. Add directories to `ignorePatterns`
3. Reduce scan scope: `--scope backend` instead of `full`

### No Findings Generated

**Problem**: Scan completes but shows 0 findings.

**Solutions**:
1. Verify `discovery.index` has items (check with `--format full`)
2. Ensure analysis is enabled in `scanner.config.json`
3. Check thresholds are reasonable in `thresholds.json`

### False Positives

**Problem**: Findings don't match actual issues.

**Solutions**:
1. Adjust baselines in `thresholds.json` based on metrics
2. Update naming conventions if project uses different standard
3. Add to `ignorePatterns` if specific directories are exceptions

### Repair Fails

**Problem**: Repair action fails to execute.

**Solutions**:
1. Use `--mode dry-run` first to preview
2. Check repair action reversibility
3. Verify permission to write to target files
4. Review error log in report

### Memory Issues

**Problem**: Scanner crashes or uses excessive memory.

**Solutions**:
1. Run single-scope scan instead of full
2. Increase Node.js heap: `node --max-old-space-size=4096 scanner/scanner_cli.js scan`
3. Exclude large directories temporarily

---

## Integration with CI/CD

### GitHub Actions

```yaml
name: Code Quality Check

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - run: npm install
      
      - name: Run Scanner
        run: |
          node scanner/scanner_cli.js scan --format json > scan-report.json
      
      - name: Check Critical Findings
        run: |
          CRITICAL=$(jq '[.structuralFindings[] | select(.severity=="critical")]' scan-report.json | jq length)
          if [ $CRITICAL -gt 0 ]; then
            echo "❌ Critical findings detected"
            exit 1
          fi
          echo "✅ No critical findings"
      
      - name: Archive Report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: scan-report
          path: scan-report.json
```

### Local Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running scanner..."
node scanner/scanner_cli.js scan --format json > /tmp/scan.json

CRITICAL=$(jq '[.structuralFindings[] | select(.severity=="critical")]' /tmp/scan.json | jq length)
if [ $CRITICAL -gt 0 ]; then
  echo "❌ Critical issues found. Commit blocked."
  node scanner/scanner_cli.js report --id $(tail -1 /tmp/scan.json | jq -r '.scanReport_id')
  exit 1
fi

echo "✅ Scanner passed"
exit 0
```

---

## Best Practices

### Run Regular Scans
- **Daily**: In CI/CD on every commit
- **Weekly**: Full scan and analysis
- **Monthly**: Review trends and update baselines

### Prioritize Findings
1. **First**: Critical (system-blocking) issues
2. **Second**: High (major functionality) issues
3. **Third**: Medium (quality/performance) improvements
4. **Last**: Low/Info (optimization) opportunities

### Use Scopes Effectively
- **Backend scan** when working on APIs/services
- **Frontend scan** when working on UI/components
- **Scanner scan** for infrastructure improvements
- **Full scan** for comprehensive audits

### Monitor Trends
```bash
# Compare latest 3 scans
ls -lt scanner/runtime/reports/ | head -10
# Review health score progression
jq '.snapshot | .integrity.score, .stability.score' scanner/runtime/reports/*.json
```

### Update Baselines Periodically
- After major improvements, update thresholds.json
- Based on actual Rally Forge metrics (not generic)
- Document why baselines changed

### Keep Reports Clean
```bash
# Archive old reports (keep last 20)
ls -t scanner/runtime/reports/*.json | tail -n +21 | xargs rm
```

---

## Advanced Usage

### Analyze Specific Finding Type

Use `jq` to parse JSON reports:

```bash
# Show all critical findings
node scanner/scanner_cli.js scan --format json | \
  jq '.structuralFindings[] | select(.severity=="critical")'

# Count findings by type
node scanner/scanner_cli.js scan --format json | \
  jq '[.structuralFindings[].type] | group_by(.) | map({type: .[0], count: length})'

# List all TODOs
node scanner/scanner_cli.js scan --format json | \
  jq '.logicFindings[] | select(.type=="todo_comments")'
```

### Generate Custom Reports

```bash
# Create CSV of findings
node scanner/scanner_cli.js scan --format json | \
  jq -r '.structuralFindings[] | [.assetId, .severity, .type, .message] | @csv'
```

### Compare Two Scans

```bash
# Diff snapshots to find drift
diff <(jq '.snapshot' scanner/runtime/reports/scan_1.json) \
     <(jq '.snapshot' scanner/runtime/reports/scan_2.json)
```

---

## Support

### Getting Help

```bash
# Show command help
node scanner/scanner_cli.js help
node scanner/scanner_cli.js scan --help
node scanner/scanner_cli.js repair --help

# Check logs
cat scanner/runtime/logs/*.log

# Review documentation
cat scanner/README.md
```

### Reporting Issues

When reporting scanner issues, include:
1. Scanner version: `node scanner/scanner_cli.js version`
2. Rally Forge codebase size
3. Affected command
4. Error message and stack trace
5. Output with `--format full`

---

## Summary

The Rally Forge Scanner is now ready to use. Follow these steps:

1. **Run**: `node scanner/scanner_cli.js scan`
2. **Review**: `node scanner/scanner_cli.js report --id [report-id]`
3. **Plan**: Examine findings and repair recommendations
4. **Dry-run**: `node scanner/scanner_cli.js repair --plan-id [id] --mode dry-run`
5. **Execute**: `node scanner/scanner_cli.js repair --plan-id [id] --mode auto` (after review)
6. **Verify**: Re-run scan to confirm improvements
7. **Monitor**: Set up CI/CD integration for continuous scanning

---

**Start Scanning**: `node scanner/scanner_cli.js scan`

Good luck! 🚀
