# Manual Entry Forms Integration Guide

**Quick Start**: 3 simple steps to add manual entry forms to your app

---

## Step 1: Import the Selector Component

```jsx
// In your parent component (e.g., App.jsx or a dashboard page)
import { ManualEntrySelector } from './components/ManualEntrySelector';
```

## Step 2: Add to Your JSX

```jsx
export function App() {
  const handleEntriesSubmitted = (entries) => {
    console.log('[App] Manual entries submitted:', entries);
    // TODO: Send to backend API
    // POST /api/manual-entries
  };

  return (
    <div>
      {/* Your existing content */}
      
      {/* Add Manual Entry Forms */}
      <ManualEntrySelector onComplete={handleEntriesSubmitted} />
    </div>
  );
}
```

## Step 3: Handle Submitted Data

```jsx
const handleEntriesSubmitted = async (entries) => {
  // entries is an array of completed submissions
  
  entries.forEach(entry => {
    if (entry.extractionSummary.entryType === 'VA_RATING_DECISION') {
      // Handle VA rating decision
      console.log('Combined Rating:', entry.ratingCalculation.calculatedCombinedRating);
      
      // Send to backend
      // POST /api/va-ratings/manual
      // Body: entry.allConditions
      
    } else if (entry.extractionSummary.entryType === 'SERVICE_TREATMENT_RECORD') {
      // Handle STR
      console.log('Medical Events:', entry.allRecords.length);
      
      // Send to backend
      // POST /api/str/manual
      // Body: entry.allRecords
    }
  });
};
```

---

## Usage Examples

### Example 1: Adding to Rating Decision Page

```jsx
// app/frontend-modern/src/pages/VARatingDecisionPage.jsx

import { ManualEntrySelector } from '../components/ManualEntrySelector';

export function VARatingDecisionPage() {
  const [manualEntries, setManualEntries] = useState([]);

  const handleManualEntries = (entries) => {
    setManualEntries(entries);
    // Merge with existing scanned entries
  };

  return (
    <div>
      <h1>VA Rating Decision</h1>
      
      {/* Display scanned results */}
      {/* ... existing code ... */}
      
      {/* Add manual entry forms */}
      <section>
        <h2>Manual Entry (if Scanner Missed Data)</h2>
        <ManualEntrySelector onComplete={handleManualEntries} />
      </section>

      {/* Show merged results */}
      {manualEntries.length > 0 && (
        <section>
          <h2>Manually Added Conditions</h2>
          {/* Display manual entries */}
        </section>
      )}
    </div>
  );
}
```

### Example 2: Dedicated Manual Entry Page

```jsx
// app/frontend-modern/src/pages/ManualDataEntryPage.jsx

import { ManualEntrySelector } from '../components/ManualEntrySelector';

export function ManualDataEntryPage() {
  const handleDataSubmitted = async (entries) => {
    for (const entry of entries) {
      try {
        const response = await fetch('/api/manual-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: entry.extractionSummary.entryType,
            data: entry.extractionSummary.entryType === 'VA_RATING_DECISION' 
              ? entry.allConditions 
              : entry.allRecords
          })
        });
        
        if (!response.ok) throw new Error('Failed to save entry');
        
        const saved = await response.json();
        console.log('Saved entry:', saved);
      } catch (error) {
        console.error('Error saving entry:', error);
      }
    }
  };

  return (
    <div>
      <h1>Manual Data Entry</h1>
      <p>Manually enter VA rating decisions or service treatment records.</p>
      <ManualEntrySelector onComplete={handleDataSubmitted} />
    </div>
  );
}
```

---

## Response Format

### VA Rating Decision Response

```javascript
{
  success: true,
  serviceConnected: [
    { condition: "PTSD", percentage: 70 },
    { condition: "Tinnitus", percentage: 10 }
  ],
  denied: [
    { condition: "Claimed Condition A" },
    { condition: "Claimed Condition B" }
  ],
  allConditions: [
    {
      conditionName: "PTSD",
      diagnosticType: "disability",
      pageNumber: "12",
      status: "Service Connected",
      ratingPercent: 70,
      effectiveDate: "2001-06-15",
      isBilateral: false,
      extremity: null,
      scBasis: "direct",
      secondaryTo: null,
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: "Medical evidence...",
      rationaleSummary: "Service member...",
      evidenceNotes: "Test results...",
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    },
    // ... more conditions
  ],
  ratingCalculation: {
    calculatedCombinedRating: 73,
    conditions: [70, 10],
    hasBilateralPairs: false,
    calculationMethod: "Manual entry (38 CFR §4.25)"
  },
  extractionSummary: {
    totalServiceConnected: 2,
    totalDenied: 2,
    manualEntry: true,
    entryType: 'VA_RATING_DECISION'
  },
  fileName: 'VA Rating Decision Manual Entry',
  submittedAt: '2025-02-21T14:30:00.000Z'
}
```

### STR Response

```javascript
{
  success: true,
  records: [
    { condition: "PTSD", date: "2004-03-15", description: "Combat trauma" },
    { condition: "Rash", date: "2006-05-20", description: "Heat rash" },
    { condition: "Respiratory symptoms", date: "2006-08-10", description: "Cough from exposure" }
  ],
  allRecords: [
    {
      conditionName: "PTSD",
      dateOfEvent: "2004-03-15",
      type: "injury",
      location: "Iraq",
      provider: "Combat Support Hospital",
      description: "Combat-related trauma incident",
      severity: "severe",
      lineOfDuty: "Yes",
      MOSRelevant: null,
      exposureType: null,
      inServiceEvent: true,
      chronicityEvidence: "Continuous symptoms 2004-2025",
      continuityNotes: "Periodic exacerbations treated with therapy",
      nexusIndicators: "Combat documentation confirms incident",
      manualEntry: true,
      type: "SERVICE_TREATMENT_RECORD"
    },
    // ... more records
  ],
  patientHistory: {
    totalMedicalEvents: 3,
    inServiceCount: 3,
    exposureEvents: 1,
    chronicConditions: 2
  },
  exposureSummary: {
    exposureTypes: ["burn pits"],
    MOSRelevantCount: 1
  },
  extractionSummary: {
    totalRecords: 3,
    manualEntry: true,
    entryType: 'SERVICE_TREATMENT_RECORD'
  },
  fileName: 'Service Treatment Records Manual Entry',
  submittedAt: '2025-02-21T14:30:00.000Z'
}
```

---

## Routing Integration

If you want to use routing to navigate to a dedicated manual entry page:

```jsx
// In your router configuration
import { ManualDataEntryPage } from './pages/ManualDataEntryPage';

const routes = [
  // ... other routes
  {
    path: '/manual-entry',
    element: <ManualDataEntryPage />
  }
];
```

Then link to it:

```jsx
<a href="/manual-entry">
  Add Data Manually
</a>
```

---

## State Management

If using a state management system like Redux or Zustand:

```javascript
// Redux slice example
const manualEntriesSlice = createSlice({
  name: 'manualEntries',
  initialState: [],
  reducers: {
    addEntry: (state, action) => {
      state.push({
        ...action.payload,
        id: generateId(),
        savedAt: new Date().toISOString()
      });
    },
    removeEntry: (state, action) => {
      return state.filter(e => e.id !== action.payload);
    }
  }
});

// In component
const dispatch = useDispatch();

const handleEntriesSubmitted = (entries) => {
  entries.forEach(entry => {
    dispatch(addEntry(entry));
  });
};
```

---

## Styling Customization

All components use inline styles with CSS variables. To customize:

```jsx
// Option 1: Override button styles
const customButtonStyle = {
  backgroundColor: '#your-color',
  color: '#text-color',
  // ... other styles
};

// Option 2: Create a styled wrapper
const StyledManualEntry = styled(ManualEntrySelector)`
  button {
    background-color: #your-color;
  }
`;
```

### Default Color Scheme
- Dark Background: `#0f172a`
- Container: `#1e293b`
- Primary Button: `#14b8a6` (teal)
- Secondary Button: `#06b6d4` (cyan)
- Error: `#ef4444` (red)
- Success: `#34d399` (green)
- Warning: `#f59e0b` (amber)
- Text: `#cbd5e1`
- Muted: `#94a3b8`

---

## Validation Debugging

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('DEBUG_MANUAL_ENTRY', 'true');
```

Components will log:
- Field validation results
- Entry additions/removals
- Combined rating calculations
- Save operations

---

## Error Handling

```jsx
const handleEntriesSubmitted = async (entries) => {
  try {
    entries.forEach(entry => {
      // Validate before sending
      if (!entry.allConditions || entry.allConditions.length === 0) {
        throw new Error('No conditions to save');
      }
      
      // Attempt to save
      // POST to backend
    });
  } catch (error) {
    console.error('Error processing entries:', error);
    // Show user-friendly error message
    showNotification({
      type: 'error',
      message: 'Failed to save entries: ' + error.message
    });
  }
};
```

---

## Testing

### Unit Testing

```jsx
import { render, screen, userEvent } from '@testing-library/react';
import { ManualEntrySelector } from './components/ManualEntrySelector';

test('VA Rating form submission', async () => {
  const mockOnComplete = jest.fn();
  render(<ManualEntrySelector onComplete={mockOnComplete} />);
  
  // Click VA Rating button
  const vaButton = screen.getByText(/VA Rating Decision/i);
  await userEvent.click(vaButton);
  
  // Fill form
  await userEvent.type(screen.getByAsText('Condition Name'), 'PTSD');
  // ... more assertions
});
```

### Integration Testing

Test the entire flow from selection to submission:

```javascript
// tests/manual-entry-integration.test.js
test('Complete VA rating entry workflow', async () => {
  // 1. User selects VA Rating
  // 2. Enters multiple conditions
  // 3. System calculates combined rating
  // 4. User submits
  // 5. Verify output format
});
```

---

## Performance Considerations

- Forms handle up to 20 entries efficiently
- Validation runs in real-time (debounced)
- Combined rating calculation O(n) runtime
- No backend calls until Save button clicked

For high-volume data entry, consider:
- Batch import from CSV/JSON
- Pagination for large entry lists
- Export incomplete entries for later completion

---

## Troubleshooting

### Issue: Combined rating showing wrong value
**Solution**: Check that all ratings are integers 0-100. Formula rounds intermediate values.

### Issue: Conditional fields not appearing
**Solution**: Verify parent field value matches trigger condition exactly.

### Issue: Validation errors not clearing
**Solution**: Form resets error state when user fixes validation. Check browser console.

### Issue: Data not saving
**Solution**: Check response from onComplete handler. Verify entryType matches expected value.

---

## Next Steps

1. ✅ Components created and tested (24/24 tests passing)
2. ✅ Documentation complete
3. ➡️ **Backend API endpoints** - Create `/api/manual-entries/*` endpoints
4. ➡️ **Database schema** - Design tables for manual entries
5. ➡️ **Merge logic** - Combine scanner results + manual entries
6. ➡️ **Display merged results** - Show combined adjudicative + medical data

---

## Questions?

Refer to:
- [`MANUAL_ENTRY_FORMS.md`](MANUAL_ENTRY_FORMS.md) - Complete system documentation
- [Test suite](../tests/test-manual-entry-forms.js) - All validation rules
- Component source files - Inline JSDoc comments
