import React, { useEffect } from 'react';
import UIBlock from './UIBlock';
import { classifyDisabilities } from '../utils/classifyDisabilities';
import presumptives from '../data/presumptives.json';
import secondaryConditions from '../data/secondaryConditions.json';
import '../styles/step3.css';

export default function Step3DisabilityReview({ 
  serviceInfo, 
  narrativeResult, 
  classifiedDisabilities,
  setClassifiedDisabilities 
}) {
  useEffect(() => {
    if (narrativeResult && serviceInfo && !classifiedDisabilities) {
      const classified = classifyDisabilities(
        narrativeResult.disabilities || [],
        serviceInfo
      );
      setClassifiedDisabilities(classified);
    }
  }, [narrativeResult, serviceInfo, classifiedDisabilities, setClassifiedDisabilities]);

  const disabilities = classifiedDisabilities || { serviceConnected: [], nonServiceConnected: [], potentiallyServiceConnectable: [] };
  
  const serviceConnected = disabilities.serviceConnected || [];
  const nonServiceConnected = disabilities.nonServiceConnected || [];
  const potentiallyServiceConnectable = disabilities.potentiallyServiceConnectable || [];

  const DisabilityItem = ({ disability }) => (
    <div className="step3-disability-item">
      <div className="step3-disability-header">
        <div className="step3-disability-name">{disability.name}</div>
        {disability.rating && (
          <div className="step3-disability-rating">{disability.rating}%</div>
        )}
      </div>
      <div className="step3-disability-meta">
        <span>Source: {disability.evidenceSource}</span>
      </div>
      <div className="step3-disability-reason">
        {disability.classificationReason}
      </div>
    </div>
  );

  return (
    <div className="step3-container">
      {/* Service-Connected (SC) */}
      <div className="step3-category">
        <h3 className="step3-category-title">
          Service-Connected (SC)
          <span className="step3-category-badge">{serviceConnected.length}</span>
        </h3>
        <UIBlock>
          {serviceConnected.length > 0 ? (
            <div className="step3-disability-list">
              {serviceConnected.map((disability, index) => (
                <DisabilityItem key={index} disability={disability} />
              ))}
            </div>
          ) : (
            <div className="step3-empty-state">
              No service-connected disabilities found
            </div>
          )}
        </UIBlock>
      </div>

      {/* Non-Service-Connected (NSC) */}
      <div className="step3-category">
        <h3 className="step3-category-title">
          Non-Service-Connected (NSC)
          <span className="step3-category-badge">{nonServiceConnected.length}</span>
        </h3>
        <UIBlock>
          {nonServiceConnected.length > 0 ? (
            <div className="step3-disability-list">
              {nonServiceConnected.map((disability, index) => (
                <DisabilityItem key={index} disability={disability} />
              ))}
            </div>
          ) : (
            <div className="step3-empty-state">
              No non-service-connected disabilities found
            </div>
          )}
        </UIBlock>
      </div>

      {/* Potentially Service-Connectable (PSC) */}
      <div className="step3-category">
        <h3 className="step3-category-title">
          Potentially Service-Connectable (PSC)
          <span className="step3-category-badge">{potentiallyServiceConnectable.length}</span>
        </h3>
        <UIBlock>
          {potentiallyServiceConnectable.length > 0 ? (
            <div className="step3-disability-list">
              {potentiallyServiceConnectable.map((disability, index) => (
                <DisabilityItem key={index} disability={disability} />
              ))}
            </div>
          ) : (
            <div className="step3-empty-state">
              No potentially service-connectable disabilities found
            </div>
          )}
        </UIBlock>
      </div>
    </div>
  );
}
