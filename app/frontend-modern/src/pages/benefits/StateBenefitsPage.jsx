import React, { useEffect, useMemo, useState } from 'react';
import { getStateBenefitsByCode, getStructuredStateBenefits } from '../../api/client';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext';

const STATE_OPTIONS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','GU','VI','AS','MP'
];

const WARTIME_ERA_KEYWORDS = ['world war', 'korean', 'vietnam', 'gulf', 'post-9/11', 'post 9/11', 'pact act'];
const WARTIME_PERIODS = [
  { start: '1941-12-07', end: '1946-12-31' },
  { start: '1950-06-27', end: '1955-01-31' },
  { start: '1961-11-01', end: '1975-05-07' },
  { start: '1990-08-02', end: null },
];

function parseComparableDate(value) {
  const time = Date.parse(value || '');
  return Number.isNaN(time) ? null : time;
}

function servicePeriodOverlapsWartime(record) {
  const era = String(record?.era || '').toLowerCase();
  if (WARTIME_ERA_KEYWORDS.some((keyword) => era.includes(keyword))) {
    return true;
  }

  const start = parseComparableDate(record?.startDate);
  const end = parseComparableDate(record?.endDate) ?? Date.now();
  if (start === null) {
    return false;
  }

  return WARTIME_PERIODS.some((period) => {
    const wartimeStart = parseComparableDate(period.start);
    const wartimeEnd = period.end ? parseComparableDate(period.end) : Date.now();
    return wartimeStart !== null && wartimeEnd !== null && start <= wartimeEnd && end >= wartimeStart;
  });
}

function deriveStateBenefitsProfile(workspace) {
  const records = Array.isArray(workspace?.militaryService?.records) ? workspace.militaryService.records : [];
  const entitlementSnapshot = workspace?.vaDecision?.entitlementSnapshot || {};
  const selectedDecision = workspace?.vaDecision?.selectedDecision || null;
  const allDecisions = Array.isArray(workspace?.vaDecision?.decisions) ? workspace.vaDecision.decisions : [];

  const derivedState = String(workspace?.profile?.state || '').trim().toUpperCase();
  const selectedConditionsCount = Array.isArray(selectedDecision?.conditions) ? selectedDecision.conditions.length : 0;
  const anyDecisionHasConditions = allDecisions.some((decision) => Array.isArray(decision?.conditions) && decision.conditions.length > 0);
  const derivedRating = Math.max(
    0,
    Number(entitlementSnapshot?.rating || 0),
    Number(selectedDecision?.rating || 0)
  );

  return {
    state: STATE_OPTIONS.includes(derivedState) ? derivedState : '',
    rating: derivedRating,
    serviceConnected: derivedRating > 0 || Number(entitlementSnapshot?.conditionsCount || 0) > 0 || selectedConditionsCount > 0 || anyDecisionHasConditions,
    combatVeteran:
      records.some((record) => Boolean(record?.combatVeteran)) ||
      Boolean(workspace?.militaryService?.summary?.combatVeteran),
    wartimeVeteran: records.some(servicePeriodOverlapsWartime),
    homeowner: Boolean(workspace?.profile?.homeowner),
  };
}

export function StateBenefitsPage() {
  const { workspace } = useClaimWorkspace();
  const [selectedState, setSelectedState] = useState('');
  const [profile, setProfile] = useState({
    rating: 0,
    serviceConnected: false,
    combatVeteran: false,
    wartimeVeteran: false,
    homeowner: false,
  });
  const [touched, setTouched] = useState({
    state: false,
    rating: false,
    serviceConnected: false,
    combatVeteran: false,
    wartimeVeteran: false,
    homeowner: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eligibility, setEligibility] = useState(null);

  const derivedProfile = useMemo(() => deriveStateBenefitsProfile(workspace), [workspace]);

  useEffect(() => {
    if (!touched.state && derivedProfile.state && selectedState !== derivedProfile.state) {
      setSelectedState(derivedProfile.state);
    }
  }, [derivedProfile.state, selectedState, touched.state]);

  useEffect(() => {
    setProfile((prev) => ({
      ...prev,
      rating: touched.rating ? prev.rating : derivedProfile.rating,
      serviceConnected: touched.serviceConnected ? prev.serviceConnected : derivedProfile.serviceConnected,
      combatVeteran: touched.combatVeteran ? prev.combatVeteran : derivedProfile.combatVeteran,
      wartimeVeteran: touched.wartimeVeteran ? prev.wartimeVeteran : derivedProfile.wartimeVeteran,
      homeowner: touched.homeowner ? prev.homeowner : derivedProfile.homeowner,
    }));
  }, [derivedProfile, touched]);

  const quickChecklist = useMemo(() => {
    if (!selectedState) {
      return [
        'Select a state or territory to begin your benefits research.',
        'Confirm residency and service-character requirements for each program.',
        'Capture filing deadlines and required documents in your claim notes.'
      ];
    }

    return [
      `Review ${selectedState} veterans affairs department eligibility rules.`,
      'Check education, property tax, and employment preference programs.',
      'Save links and evidence requirements before filing state applications.'
    ];
  }, [selectedState]);

  const categorySummary = useMemo(() => {
    const counts = new Map();
    (eligibility?.eligible || []).forEach((benefit) => {
      const category = String(benefit?.category || 'Other').trim() || 'Other';
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [eligibility]);

  useEffect(() => {
    let ignore = false;

    const buildFallbackEligibility = (stateData) => {
      const categories = stateData?.categories || {};
      const flattened = Object.entries(categories).flatMap(([category, benefits]) =>
        (benefits || []).map((benefit, index) => ({
          id: `${selectedState}-${category}-${index}`,
          name: benefit.name,
          category,
          description: benefit.description,
          benefit_details: benefit.description,
          rating_min: Number(benefit.criteria?.rating_min || 0),
          links: benefit.links?.learnMore || null,
          requires: Array.isArray(benefit.requires) ? benefit.requires : [],
        }))
      );

      const eligible = flattened.filter((benefit) => {
        const requirementText = (benefit.requires || []).join(' ').toLowerCase();
        if (Number(benefit.rating_min || 0) > Number(profile.rating || 0)) return false;
        if (/service[ -]?connected/.test(requirementText) && !profile.serviceConnected) return false;
        if (/combat/.test(requirementText) && !profile.combatVeteran) return false;
        if (/wartime/.test(requirementText) && !profile.wartimeVeteran) return false;
        if (/(homeowner|property owner|owner occupied)/.test(requirementText) && !profile.homeowner) return false;
        return true;
      });

      return {
        stateCode: selectedState,
        stateName: stateData?.name || selectedState,
        profile: { ...profile },
        totalInState: flattened.length,
        eligibleCount: eligible.length,
        eligible,
        source: 'fallback',
      };
    };

    const loadBenefits = async () => {
      if (!selectedState) {
        setEligibility(null);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await getStructuredStateBenefits(selectedState, profile);
        if (!ignore) {
          setEligibility(response?.data || null);
        }
      } catch (loadError) {
        try {
          const fallbackResponse = await getStateBenefitsByCode(selectedState);
          if (!ignore) {
            setEligibility(buildFallbackEligibility(fallbackResponse?.data || null));
            setError('');
          }
        } catch (fallbackError) {
          if (!ignore) {
            setError(fallbackError.message || loadError.message || 'Unable to load state benefits right now.');
            setEligibility(null);
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadBenefits();

    return () => {
      ignore = true;
    };
  }, [selectedState, profile]);

  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Resources</div>
          <h1 className='page-title'>State Benefits</h1>
          <p className='page-copy'>
            Search the selected state or territory and filter benefits using the claim profile already gathered in Rally Forge.
          </p>
        </div>
        <div className='page-badge'>{selectedState || 'State research'}</div>
      </header>

      <article className='rf-card'>
        <h2 className='rf-card-title'>State/Territory Selection</h2>
        <div className='rf-card-body profile-grid'>
          <div className='profile-field'>
            <label className='profile-label'>State</label>
            <select className='str-input' value={selectedState} onChange={(event) => {
              setTouched((prev) => ({ ...prev, state: true }));
              setSelectedState(event.target.value);
            }}>
              <option value=''>Select state...</option>
              {STATE_OPTIONS.map((stateCode) => (
                <option key={stateCode} value={stateCode}>{stateCode}</option>
              ))}
            </select>
          </div>

          <div className='profile-field'>
            <label className='profile-label'>Combined Rating (%)</label>
            <input
              className='str-input'
              type='number'
              min='0'
              max='100'
              value={profile.rating}
              onChange={(event) => {
                const value = Number(event.target.value);
                const safeRating = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
                setTouched((prev) => ({ ...prev, rating: true }));
                setProfile((prev) => ({ ...prev, rating: safeRating }));
              }}
            />
          </div>

          <div className='profile-field'>
            <label className='profile-label'>Veteran Status Filters</label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type='checkbox'
                checked={profile.serviceConnected}
                onChange={(event) => {
                  setTouched((prev) => ({ ...prev, serviceConnected: true }));
                  setProfile((prev) => ({ ...prev, serviceConnected: event.target.checked }));
                }}
              />
              Service-connected
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type='checkbox'
                checked={profile.combatVeteran}
                onChange={(event) => {
                  setTouched((prev) => ({ ...prev, combatVeteran: true }));
                  setProfile((prev) => ({ ...prev, combatVeteran: event.target.checked }));
                }}
              />
              Combat veteran
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type='checkbox'
                checked={profile.wartimeVeteran}
                onChange={(event) => {
                  setTouched((prev) => ({ ...prev, wartimeVeteran: true }));
                  setProfile((prev) => ({ ...prev, wartimeVeteran: event.target.checked }));
                }}
              />
              Wartime veteran
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type='checkbox'
                checked={profile.homeowner}
                onChange={(event) => {
                  setTouched((prev) => ({ ...prev, homeowner: true }));
                  setProfile((prev) => ({ ...prev, homeowner: event.target.checked }));
                }}
              />
              Homeowner
            </label>
          </div>
        </div>
        {(derivedProfile.state || derivedProfile.rating || derivedProfile.serviceConnected || derivedProfile.combatVeteran || derivedProfile.wartimeVeteran) && (
          <div className='rf-card-body' style={{ paddingTop: 0, color: 'var(--rf-text-soft)', fontSize: '0.8rem' }}>
            Autofilled from workflow: state {derivedProfile.state || 'N/A'}, rating {profile.rating}%, service-connected {profile.serviceConnected ? 'yes' : 'no'}, combat veteran {profile.combatVeteran ? 'yes' : 'no'}, wartime veteran {profile.wartimeVeteran ? 'yes' : 'no'}.
          </div>
        )}
      </article>

      <article className='rf-card'>
        <h2 className='rf-card-title'>Benefit Research Checklist</h2>
        <ul className='rf-card-body' style={{ paddingLeft: '1.1rem', lineHeight: 1.7 }}>
          {quickChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className='rf-card'>
        <h2 className='rf-card-title'>Eligible State Benefits</h2>
        <div className='rf-card-body'>
          {!selectedState && 'Select a state to see eligible benefits from the state benefits database.'}
          {selectedState && loading && 'Loading benefits...'}
          {selectedState && error && <div style={{ color: '#ef6f6c' }}>{error}</div>}
          {selectedState && !loading && !error && eligibility && (
            <>
              <div style={{ marginBottom: '0.8rem' }}>
                Showing {eligibility.eligibleCount} of {eligibility.totalInState} benefits for {eligibility.stateName || selectedState}
                {eligibility.source === 'fallback' && (
                  <span style={{ marginLeft: '0.5rem', color: '#9db1c2', fontSize: '0.85rem' }}>
                    using fallback search
                  </span>
                )}
              </div>
              {categorySummary.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginBottom: '0.9rem' }}>
                  {categorySummary.map(([category, count]) => (
                    <div key={category} style={{ border: '1px solid rgba(131, 169, 194, 0.22)', borderRadius: '999px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#9db1c2' }}>
                      {category}: {count}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {eligibility.eligible.map((benefit) => (
                  <div key={benefit.id} style={{ border: '1px solid rgba(131, 169, 194, 0.22)', borderRadius: '12px', padding: '0.85rem' }}>
                    <div style={{ fontWeight: 700, color: '#e8f1f7' }}>{benefit.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#f6b44c', marginTop: '0.2rem' }}>{benefit.category}</div>
                    <div style={{ marginTop: '0.45rem' }}>{benefit.description || benefit.benefit_details}</div>
                    <div style={{ marginTop: '0.45rem', fontSize: '0.88rem' }}>
                      Minimum Rating: {benefit.rating_min || 0}%
                    </div>
                    {Array.isArray(benefit.requires) && benefit.requires.length > 0 && (
                      <div style={{ marginTop: '0.45rem', fontSize: '0.84rem', color: '#9db1c2' }}>
                        Requirements: {benefit.requires.join(' | ')}
                      </div>
                    )}
                    {benefit.links?.learnMore && (
                      <a href={benefit.links.learnMore} target='_blank' rel='noreferrer' style={{ display: 'inline-block', marginTop: '0.4rem', color: '#9ddcff' }}>
                        Official link
                      </a>
                    )}
                  </div>
                ))}
                {eligibility.eligibleCount === 0 && (
                  <div>No benefits matched this profile. Try lowering filters or changing status selections.</div>
                )}
              </div>
            </>
          )}
        </div>
      </article>
    </section>
  );
}
