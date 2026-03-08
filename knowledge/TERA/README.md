# TERA (Temporary Early Retirement Authority)

This directory contains the complete TERA retirement calculation system including:

## Components

- **database/** - TERA eligibility criteria and program data
- **schemas/** - JSON schemas for TERA calculations
- **engine/** - JavaScript calculation engine for TERA retirement pay
- **tests/** - Test cases and validation suite
- **docs/** - Documentation and user guides
- **manifests/** - Processing manifests and workflows
- **logs/** - Calculation logs and audit trail
- **ui/** - User interface components for TERA calculator

## Overview

TERA provides temporary authority for voluntary early retirement of eligible service members with 15-20 years of active service. The retirement multiplier is 2.5% per year (same as regular retirement), but fewer years result in lower monthly pension.

## Files

- `database/tera_eligibility.json` - Complete eligibility criteria, program overview, and requirements
- `schemas/tera_calculation_schema.json` - JSON schema for retirement calculations
- `engine/tera_calculator.js` - JavaScript calculation engine
- `tests/tera_test_cases.json` - Comprehensive test suite with 8 test cases

## Usage

See individual subdirectories for specific implementation details.
