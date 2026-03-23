import React, { useState, useEffect } from 'react';

/**
 * StateBenefitsUI Component
 * Displays state-specific benefits and programs for veterans
 */
export default function StateBenefitsUI({ veteranId, veteranState }) {
  const [stateBenefits, setStateBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBenefit, setSelectedBenefit] = useState(null);
  const [filters, setFilters] = useState({ category: 'all' });

  useEffect(() => {
    fetchStateBenefits();
  }, [veteranState]);

  const fetchStateBenefits = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/state-benefits/${veteranState}`);
      if (!response.ok) throw new Error('Failed to fetch state benefits');
      const data = await response.json();
      setStateBenefits(data.benefits || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setStateBenefits([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategories = () => {
    const cats = new Set(stateBenefits.map((b) => b.category || 'General'));
    return Array.from(cats).sort();
  };

  const filteredBenefits =
    filters.category === 'all'
      ? stateBenefits
      : stateBenefits.filter((b) => b.category === filters.category);

  const getCategoryColor = (category) => {
    const colors = {
      'Property Tax': 'bg-blue-100 text-blue-800',
      Employment: 'bg-green-100 text-green-800',
      Education: 'bg-purple-100 text-purple-800',
      Healthcare: 'bg-red-100 text-red-800',
      Financial: 'bg-yellow-100 text-yellow-800',
      Housing: 'bg-orange-100 text-orange-800',
      General: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.General;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="state-benefits-container p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">State-Specific Veteran Benefits</h2>
        <p className="text-gray-600">
          <span className="font-semibold">{veteranState}</span> - Additional benefits and programs available
        </p>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-semibold">Error loading state benefits</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setFilters({ category: 'all' })}
              className={`px-4 py-2 rounded-full font-semibold transition-colors ${
                filters.category === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              All Categories ({stateBenefits.length})
            </button>

            {getCategories().map((category) => {
              const count = stateBenefits.filter((b) => b.category === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setFilters({ category })}
                  className={`px-4 py-2 rounded-full font-semibold transition-colors ${
                    filters.category === category
                      ? `${getCategoryColor(category)} border-2`
                      : `${getCategoryColor(category)} opacity-60 hover:opacity-100`
                  }`}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>

          {/* Benefits List */}
          {filteredBenefits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No benefits found for selected category</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBenefits.map((benefit, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedBenefit(selectedBenefit === idx ? null : idx)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{benefit.programName}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(benefit.category)}`}>
                          {benefit.category || 'General'}
                        </span>
                      </div>
                      <p className="text-gray-700">{benefit.description}</p>
                    </div>
                    <span className="ml-4 text-2xl text-gray-400">
                      {selectedBenefit === idx ? '−' : '+'}
                    </span>
                  </div>

                  {selectedBenefit === idx && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {benefit.eligibilityRequirements && (
                        <div>
                          <p className="font-semibold text-gray-900 mb-2">Eligibility Requirements</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                            {Array.isArray(benefit.eligibilityRequirements) ? (
                              benefit.eligibilityRequirements.map((req, i) => <li key={i}>{req}</li>)
                            ) : (
                              <li>{benefit.eligibilityRequirements}</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {benefit.applicationProcess && (
                        <div>
                          <p className="font-semibold text-gray-900 mb-2">How to Apply</p>
                          <p className="text-sm text-gray-700">{benefit.applicationProcess}</p>
                        </div>
                      )}

                      {benefit.benefits && (
                        <div>
                          <p className="font-semibold text-gray-900 mb-2">What You Get</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                            {Array.isArray(benefit.benefits) ? (
                              benefit.benefits.map((b, i) => <li key={i}>{b}</li>)
                            ) : (
                              <li>{benefit.benefits}</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {benefit.website && (
                        <div>
                          <a
                            href={benefit.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 font-semibold hover:underline text-sm"
                          >
                            Visit Official Website →
                          </a>
                        </div>
                      )}

                      {benefit.contactInfo && (
                        <div>
                          <p className="font-semibold text-gray-900 mb-1 text-sm">Contact</p>
                          <p className="text-sm text-gray-700">{benefit.contactInfo}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-900 text-sm">
          <strong>State Benefits Tip:</strong> Many states offer additional property tax exemptions, employment programs,
          and education benefits for veterans. Check back regularly as programs change.
        </p>
      </div>
    </div>
  );
}
