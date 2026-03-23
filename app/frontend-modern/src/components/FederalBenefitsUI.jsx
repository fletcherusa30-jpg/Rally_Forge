import React, { useState, useEffect } from 'react';

/**
 * FederalBenefitsUI Component
 * Displays federal VA benefits and programs with detailed eligibility info
 */
export default function FederalBenefitsUI({ veteranId, veteranProfile }) {
  const [federalBenefits, setFederalBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBenefit, setSelectedBenefit] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    fetchFederalBenefits();
  }, []);

  const fetchFederalBenefits = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/veterans/${veteranId}/federal-benefits`);
      if (!response.ok) throw new Error('Failed to fetch federal benefits');
      const data = await response.json();
      setFederalBenefits(data.benefits || defaultBenefits());
      setError(null);
    } catch (err) {
      setError(err.message);
      setFederalBenefits(defaultBenefits());
    } finally {
      setLoading(false);
    }
  };

  const defaultBenefits = () => [
    {
      id: 'va-disability',
      name: 'VA Disability Compensation',
      description: 'Monthly compensation for service-connected disabilities',
      category: 'Compensation',
      icon: '💰',
      eligibility: ['Honorable discharge', 'Service-connected disability', '10%+ rating recommended'],
      application: 'File VA Form 21-526-EZ online, by mail, or at your local VA office',
    },
    {
      id: 'va-pension',
      name: 'VA Pension',
      description: 'Non-service-connected pension for wartime veterans',
      category: 'Income Support',
      icon: '🏦',
      eligibility: ['Honorable discharge', 'Served during wartime', 'Low income'],
      application: 'File VA Form 21-527 with your local VA office',
    },
    {
      id: 'va-healthcare',
      name: 'VA Healthcare',
      description: 'Comprehensive medical and mental health services',
      category: 'Healthcare',
      icon: '🏥',
      eligibility: ['Honorable or General discharge', 'Priority based on rating/income'],
      application: 'Enroll online at VA.gov or visit your local VA Medical Center',
    },
    {
      id: 'gi-bill',
      name: 'GI Bill Education Benefits',
      description: 'Tuition assistance and monthly living stipend for education',
      category: 'Education',
      icon: '📚',
      eligibility: ['Post-9/11 service', 'VA-approved school or training program', '36+ months service'],
      application: 'Apply at VA.gov - Post-9/11 GI Bill section',
    },
    {
      id: 'home-loan',
      name: 'VA Home Loan',
      description: 'Guaranteed mortgage for home purchase or refinance',
      category: 'Housing',
      icon: '🏡',
      eligibility: ['Satisfactory discharge', 'Credit/income requirements', 'Occupancy commitment'],
      application: 'Contact VA-approved lender or visit VA.gov Loans section',
    },
    {
      id: 'vocational-rehab',
      name: 'Vocational Rehabilitation',
      description: 'Job training and employment services for disabled veterans',
      category: 'Employment',
      icon: '👔',
      eligibility: ['Service-connected disability', 'Discharged from active duty', '20%+ rating'],
      application: 'File VA Form 28-1900 with your Regional Office',
    },
  ];

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const categories = [...new Set(federalBenefits.map((b) => b.category))];
  const benefitsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = federalBenefits.filter((b) => b.category === cat);
    return acc;
  }, {});

  return (
    <div className="federal-benefits-container p-6 bg-white rounded-lg shadow-md">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Federal VA Benefits</h1>
        <p className="text-gray-600">Comprehensive guide to benefits available through the U.S. Department of Veterans Affairs</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            <strong>Note:</strong> Displaying standard benefits. {error}
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {categories.map((category) => (
          <div key={category} className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{benefitsByCategory[category].length}</p>
            <p className="text-sm text-gray-600">{category}</p>
          </div>
        ))}
      </div>

      {/* Benefits by Category */}
      <div className="space-y-8">
        {categories.map((category) => (
          <section key={category} className="border-l-4 border-blue-500 pl-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">{category}</h2>

            <div className="space-y-4">
              {benefitsByCategory[category].map((benefit) => (
                <div key={benefit.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  <button
                    onClick={() => toggleSection(benefit.id)}
                    className="w-full text-left p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{benefit.icon}</span>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{benefit.name}</h3>
                        <p className="text-sm text-gray-600">{benefit.description}</p>
                      </div>
                    </div>
                    <span className="text-2xl text-gray-400 ml-4">{expandedSections[benefit.id] ? '−' : '+'}</span>
                  </button>

                  {expandedSections[benefit.id] && (
                    <div className="p-6 bg-white border-t space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">✓ Eligibility Requirements</h4>
                        <ul className="space-y-2">
                          {benefit.eligibility.map((req, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-700">
                              <span className="text-green-500 mt-1 flex-shrink-0">•</span>
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">📋 How to Apply</h4>
                        <p className="text-gray-700">{benefit.application}</p>
                      </div>

                      {benefit.timeline && (
                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-gray-900 mb-2">⏱ Processing Time</h4>
                          <p className="text-gray-700">{benefit.timeline}</p>
                        </div>
                      )}

                      {benefit.maxAmount && (
                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-gray-900 mb-2">💵 Maximum Benefit</h4>
                          <p className="text-lg text-green-600 font-bold">${benefit.maxAmount.toLocaleString()}</p>
                        </div>
                      )}

                      <div className="border-t pt-4 flex gap-2">
                        <button className="flex-1 py-2 px-4 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition-colors">
                          Learn More
                        </button>
                        <button className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Help Section */}
      <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-3">Need Help?</h3>
        <p className="text-blue-800 mb-3">For official information and assistance:</p>
        <ul className="space-y-2 text-blue-800">
          <li>• <strong>VA Benefits Hotline:</strong> 1-800-827-1000 (TTY: 711)</li>
          <li>• <strong>Website:</strong> www.va.gov</li>
          <li>• <strong>Veterans Crisis Line:</strong> 988 then press 1</li>
        </ul>
      </div>
    </div>
  );
}
