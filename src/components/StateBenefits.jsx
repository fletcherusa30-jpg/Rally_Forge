import React, { useState, useEffect } from 'react';
import UIBlock from './UIBlock';
import { inferStateBenefits } from '../utils/inferStateBenefits';
import '../styles/stateBenefits.css';

export default function StateBenefits({ 
  stateOfResidence,
  combinedRating, 
  serviceInfo,
  classifiedDisabilities
}) {
  const [benefits, setBenefits] = useState(null);

  useEffect(() => {
    if (stateOfResidence) {
      const inferred = inferStateBenefits({
        state: stateOfResidence,
        combinedRating,
        serviceInfo,
        classifiedDisabilities
      });
      setBenefits(inferred);
    }
  }, [stateOfResidence, combinedRating, serviceInfo, classifiedDisabilities]);

  if (!stateOfResidence) {
    return (
      <div className="state-benefits-container">
        <UIBlock>
          <div className="state-benefits-empty">
            Please provide your state of residence in Step 1 to view state-specific benefits.
          </div>
        </UIBlock>
      </div>
    );
  }

  const categories = benefits?.categories || {};

  const BenefitItem = ({ benefit }) => (
    <div className="state-benefit-item">
      <div className="state-benefit-name">{benefit.name}</div>
      <div className="state-benefit-eligibility">{benefit.eligibilityRules}</div>
      {benefit.ratingThreshold && (
        <div className="state-benefit-threshold">
          Minimum Rating: {benefit.ratingThreshold}%
        </div>
      )}
      {benefit.statuteReference && (
        <div className="state-benefit-statute">{benefit.statuteReference}</div>
      )}
      {benefit.applicationLink && (
        <div className="state-benefit-link">
          <a href={benefit.applicationLink} target="_blank" rel="noopener noreferrer">
            Apply Now →
          </a>
        </div>
      )}
      {benefit.notes && (
        <div className="state-benefit-notes">{benefit.notes}</div>
      )}
    </div>
  );

  return (
    <div className="state-benefits-container">
      <UIBlock>
        <div className="state-benefits-header">
          <div className="state-benefits-state">{stateOfResidence}</div>
          <div className="state-benefits-rating">
            Combined Rating: {combinedRating}%
          </div>
        </div>
      </UIBlock>

      {Object.keys(categories).map(categoryName => (
        <div key={categoryName} className="state-benefit-category">
          <h3 className="state-benefit-category-title">
            {categoryName}
            <span className="state-benefit-category-badge">
              {categories[categoryName].length}
            </span>
          </h3>
          <UIBlock>
            {categories[categoryName].length > 0 ? (
              <div className="state-benefit-list">
                {categories[categoryName].map((benefit, index) => (
                  <BenefitItem key={index} benefit={benefit} />
                ))}
              </div>
            ) : (
              <div className="state-benefit-empty-category">
                No benefits in this category for your current rating
              </div>
            )}
          </UIBlock>
        </div>
      ))}
    </div>
  );
}
