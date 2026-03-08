import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface Benefit {
  benefitId: string;
  name: string;
  category: string;
  description: string;
  criteria: {
    rating_min?: number;
    state?: string;
    [key: string]: any;
  };
  benefits: string[];
  links: {
    learnMore: string;
    apply?: string;
  };
  maxGrant?: string;
}

interface StateBenefitsData {
  [state: string]: Benefit[];
}

interface StateBenefitsTableProps {
  data: StateBenefitsData;
  veteranRating?: number;
  state?: string;
  homeowner?: boolean;
  permanent_and_total?: boolean;
}

const StateBenefitsTable: React.FC<StateBenefitsTableProps> = ({
  data,
  veteranRating = 0,
  state,
  homeowner = false,
  permanent_and_total = false,
}) => {
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [expandedBenefits, setExpandedBenefits] = useState<Set<string>>(new Set());

  const toggleState = (stateName: string) => {
    const newExpanded = new Set(expandedStates);
    if (newExpanded.has(stateName)) {
      newExpanded.delete(stateName);
    } else {
      newExpanded.add(stateName);
    }
    setExpandedStates(newExpanded);
  };

  const toggleBenefit = (benefitId: string) => {
    const newExpanded = new Set(expandedBenefits);
    if (newExpanded.has(benefitId)) {
      newExpanded.delete(benefitId);
    } else {
      newExpanded.add(benefitId);
    }
    setExpandedBenefits(newExpanded);
  };

  const isBenefitEligible = (benefit: Benefit): boolean => {
    // Check state match
    if (benefit.criteria.state && benefit.criteria.state !== state) {
      return false;
    }

    // Check rating minimum
    if (benefit.criteria.rating_min !== undefined) {
      if (benefit.criteria.rating_min === 100 && !permanent_and_total) {
        return false;
      }
      if (veteranRating < benefit.criteria.rating_min) {
        return false;
      }
    }

    // Check homeowner requirement
    if (benefit.criteria.homeowner === true && !homeowner) {
      return false;
    }

    // Check permanent and total
    if (benefit.criteria.permanent_and_total === true && !permanent_and_total) {
      return false;
    }

    return true;
  };

  const getCategoryColor = (category: string): string => {
    const categoryColors: { [key: string]: string } = {
      'Property Tax': 'bg-blue-50 border-blue-200',
      'Education': 'bg-green-50 border-green-200',
      'Vehicle': 'bg-purple-50 border-purple-200',
      'Employment': 'bg-orange-50 border-orange-200',
      'Recreation': 'bg-yellow-50 border-yellow-200',
      'Income Tax': 'bg-indigo-50 border-indigo-200',
      'Housing': 'bg-pink-50 border-pink-200',
      'Federal Healthcare': 'bg-red-50 border-red-200',
      'Federal Shopping': 'bg-teal-50 border-teal-200',
      'Federal Insurance': 'bg-cyan-50 border-cyan-200',
      'Federal Education': 'bg-lime-50 border-lime-200',
    };
    return categoryColors[category] || 'bg-gray-50 border-gray-200';
  };

  const statesToDisplay = state ? [state] : Object.keys(data);

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="space-y-4">
        {statesToDisplay.map((stateName) => (
          <div key={stateName} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* State Header */}
            <button
              onClick={() => toggleState(stateName)}
              className="w-full flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">{stateName}</h2>
                <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded">
                  {data[stateName]?.length || 0} benefits
                </span>
              </div>
              {expandedStates.has(stateName) ? (
                <ChevronUpIcon className="w-6 h-6" />
              ) : (
                <ChevronDownIcon className="w-6 h-6" />
              )}
            </button>

            {/* State Benefits Content */}
            {expandedStates.has(stateName) && (
              <div className="p-6 space-y-4 bg-white">
                {data[stateName]?.map((benefit) => {
                  const isEligible = isBenefitEligible(benefit);

                  return (
                    <div
                      key={benefit.benefitId}
                      className={`border-l-4 rounded ${getCategoryColor(benefit.category)} ${
                        !isEligible ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Benefit Header */}
                      <button
                        onClick={() => toggleBenefit(benefit.benefitId)}
                        className="w-full text-left flex items-start justify-between p-4 hover:bg-opacity-75 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{benefit.name}</h3>
                            <span className="text-xs font-medium bg-gray-200 px-2 py-1 rounded">
                              {benefit.category}
                            </span>
                            {!isEligible && (
                              <span className="text-xs font-medium bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                                Not eligible
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{benefit.description}</p>
                        </div>
                        {expandedBenefits.has(benefit.benefitId) ? (
                          <ChevronUpIcon className="w-5 h-5 ml-4 flex-shrink-0 text-gray-500" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 ml-4 flex-shrink-0 text-gray-500" />
                        )}
                      </button>

                      {/* Benefit Details */}
                      {expandedBenefits.has(benefit.benefitId) && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-300">
                          {/* Eligibility Requirements */}
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900 mb-2">Eligibility Requirements:</h4>
                            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                              {benefit.criteria.rating_min !== undefined && (
                                <li>VA Disability Rating: {benefit.criteria.rating_min}% or higher</li>
                              )}
                              {benefit.criteria.permanent_and_total && (
                                <li>Permanent and Total (P&T) Disability Rating Required</li>
                              )}
                              {benefit.criteria.homeowner && (
                                <li>Must be a homeowner</li>
                              )}
                              {benefit.criteria.service_connected && (
                                <li>Service-connected disability required</li>
                              )}
                            </ul>
                          </div>

                          {/* Benefits List */}
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900 mb-2">What You Get:</h4>
                            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                              {benefit.benefits.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>

                          {/* Max Grant */}
                          {benefit.maxGrant && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 mb-2">Maximum Grant:</h4>
                              <p className="text-sm text-gray-700">{benefit.maxGrant}</p>
                            </div>
                          )}

                          {/* Links */}
                          <div className="flex gap-3 pt-2">
                            <a
                              href={benefit.links.learnMore}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                            >
                              Learn More
                            </a>
                            {benefit.links.apply && (
                              <a
                                href={benefit.links.apply}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-green-600 hover:text-green-800 underline"
                              >
                                Apply Now
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StateBenefitsTable;
