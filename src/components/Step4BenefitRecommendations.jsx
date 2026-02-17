import React, { useState, useEffect } from 'react';
import UIBlock from './UIBlock';
import { inferBenefits } from '../utils/inferBenefits';
import '../styles/step4.css';

export default function Step4BenefitRecommendations({ 
  serviceInfo, 
  classifiedDisabilities,
  combinedRating 
}) {
  const [benefits, setBenefits] = useState(null);

  useEffect(() => {
    if (serviceInfo && classifiedDisabilities) {
      const inferred = inferBenefits({
        serviceInfo,
        classifiedDisabilities,
        combinedRating
      });
      setBenefits(inferred);
    }
  }, [serviceInfo, classifiedDisabilities, combinedRating]);

  const likelyEligible = benefits?.likelyEligible || [];
  const possiblyEligible = benefits?.possiblyEligible || [];
  const notEligible = benefits?.notEligibleOrMissingEvidence || [];

  const BenefitItem = ({ benefit }) => (
    <div className="step4-benefit-item">
      <div className="step4-benefit-name">{benefit.name}</div>
      <div className="step4-benefit-reason">{benefit.reason}</div>
      <div className="step4-benefit-cfr">{benefit.cfrReference}</div>
      <div className="step4-benefit-evidence">
        <div className="step4-benefit-evidence-title">Evidence Needed:</div>
        {benefit.evidenceNeeded}
      </div>
    </div>
  );

  return (
    <div className="step4-container">
      {/* Likely Eligible */}
      <div className="step4-category">
        <h3 className="step4-category-title">
          Likely Eligible Benefits
          <span className="step4-category-badge">{likelyEligible.length}</span>
        </h3>
        <UIBlock>
          {likelyEligible.length > 0 ? (
            <div className="step4-benefit-list">
              {likelyEligible.map((benefit, index) => (
                <BenefitItem key={index} benefit={benefit} />
              ))}
            </div>
          ) : (
            <div className="step4-empty-state">
              No likely eligible benefits identified
            </div>
          )}
        </UIBlock>
      </div>

      {/* Possibly Eligible */}
      <div className="step4-category">
        <h3 className="step4-category-title">
          Possibly Eligible Benefits
          <span className="step4-category-badge">{possiblyEligible.length}</span>
        </h3>
        <UIBlock>
          {possiblyEligible.length > 0 ? (
            <div className="step4-benefit-list">
              {possiblyEligible.map((benefit, index) => (
                <BenefitItem key={index} benefit={benefit} />
              ))}
            </div>
          ) : (
            <div className="step4-empty-state">
              No possibly eligible benefits identified
            </div>
          )}
        </UIBlock>
      </div>

      {/* Not Eligible / Missing Evidence */}
      <div className="step4-category">
        <h3 className="step4-category-title">
          Not Eligible / Missing Evidence
          <span className="step4-category-badge">{notEligible.length}</span>
        </h3>
        <UIBlock>
          {notEligible.length > 0 ? (
            <div className="step4-benefit-list">
              {notEligible.map((benefit, index) => (
                <BenefitItem key={index} benefit={benefit} />
              ))}
            </div>
          ) : (
            <div className="step4-empty-state">
              All identified benefits may be available
            </div>
          )}
        </UIBlock>
      </div>
    </div>
  );
}
