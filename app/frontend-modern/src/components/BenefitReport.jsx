import React, { useState, useEffect } from 'react';

/**
 * BenefitReport Component
 * Displays veteran's benefit eligibility, ratings, and relevant programs
 */
export default function BenefitReport({ veteranId }) {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBenefit, setSelectedBenefit] = useState(null);

  useEffect(() => {
    fetchBenefits();
  }, [veteranId]);

  const fetchBenefits = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/veterans/${veteranId}/benefits`);
      if (!response.ok) throw new Error('Failed to fetch benefits');
      const data = await response.json();
      setBenefits(data.benefits || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setBenefits([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      ELIGIBLE: 'bg-green-50 border-green-200 text-green-800',
      INELIGIBLE: 'bg-red-50 border-red-200 text-red-800',
      PENDING: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      RESTRICTED: 'bg-orange-50 border-orange-200 text-orange-800',
    };
    return colors[status] || 'bg-gray-50 border-gray-200 text-gray-800';
  };

  const getStatusBadge = (status) => {
    const badges = {
      ELIGIBLE: '✓ Eligible',
      INELIGIBLE: '✗ Ineligible',
      PENDING: '? Pending',
      RESTRICTED: '⚠ Restricted',
    };
    return badges[status] || status;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-semibold">Error loading benefits</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="benefit-report-container p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Benefit Eligibility Report</h2>
        <button onClick={fetchBenefits} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
          Refresh
        </button>
      </div>

      {benefits.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No benefit information available</p>
          <p className="text-gray-400 text-sm mt-2">Upload or enter military service records to see eligible benefits</p>
        </div>
      ) : (
        <div className="space-y-4">
          {benefits.map((benefit, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${getStatusColor(benefit.eligibilityStatus)}`}
              onClick={() => setSelectedBenefit(selectedBenefit === idx ? null : idx)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{benefit.benefitType}</h3>
                  <p className="text-sm opacity-75">{benefit.shortName}</p>
                </div>
                <span className="px-3 py-1 bg-white bg-opacity-50 rounded-full text-sm font-semibold">
                  {getStatusBadge(benefit.eligibilityStatus)}
                </span>
              </div>

              {selectedBenefit === idx && (
                <div className="mt-4 pt-4 border-t border-current opacity-50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold opacity-100">Description</p>
                      <p className="mt-1">{benefit.description}</p>
                    </div>

                    {benefit.monthlyAmount && (
                      <div>
                        <p className="font-semibold opacity-100">Monthly Amount</p>
                        <p className="mt-1">${benefit.monthlyAmount.toLocaleString()}</p>
                      </div>
                    )}

                    {benefit.requirements && (
                      <div className="col-span-2">
                        <p className="font-semibold opacity-100 mb-2">Requirements</p>
                        <ul className="list-disc list-inside space-y-1">
                          {Object.entries(benefit.requirements).map(([key, val]) => (
                            <li key={key} className="text-sm">
                              {String(key).replace(/([A-Z])/g, ' $1').trim()}: {String(val)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {benefit.restrictions && benefit.restrictions.length > 0 && (
                      <div className="col-span-2">
                        <p className="font-semibold opacity-100 mb-2">Restrictions</p>
                        <ul className="list-disc list-inside space-y-1">
                          {benefit.restrictions.map((restriction, i) => (
                            <li key={i}>{restriction}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="col-span-2">
                      <p className="font-semibold opacity-100 mb-2">Next Steps</p>
                      <button className="text-blue-500 font-semibold hover:underline">Learn More →</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-900 text-sm">
          <strong>Note:</strong> This report is based on available service records and VA ratings. For official eligibility
          determinations, contact the VA at 1-800-827-1000.
        </p>
      </div>
    </div>
  );
}
