import React, { useState } from 'react';
import './styles/theme.css';
import Step1MilitaryService from './components/Step1MilitaryService';
import Step2UploadNarrative from './components/Step2UploadNarrative';
import Step3DisabilityReview from './components/Step3DisabilityReview';
import Step4BenefitRecommendations from './components/Step4BenefitRecommendations';
import StateBenefits from './components/StateBenefits';
import UIButton from './components/UIButton';

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [narrativeResult, setNarrativeResult] = useState(null);
  const [classifiedDisabilities, setClassifiedDisabilities] = useState(null);
  const [stateOfResidence, setStateOfResidence] = useState(null);
  const [combinedRating, setCombinedRating] = useState(0);

  const stepTitles = {
    1: 'Military Service Information',
    2: 'VA Rating Narrative Upload',
    3: 'Disability Review',
    4: 'Benefit Recommendations',
    5: 'State Benefits'
  };

  const stepSubtitles = {
    1: 'Provide your military service details',
    2: 'Upload your VA rating decision letter',
    3: 'Review and classify your disabilities',
    4: 'Discover benefits you may qualify for',
    5: 'Discover state-specific benefits',
    4: 'Discover benefits you may qualify for'
  };5

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="rf-app-background">
      <div className="rf-page-shell">
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '8px' }}>
            Step {currentStep} of 5
          </div>
          <h1 style={{ marginBottom: '8px' }}>{stepTitles[currentStep]}</h1>
          <p style={{ opacity: 0.9, fontSize: '1rem' }}>{stepSubtitles[currentStep]}</p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          {currentStep === 1 && (
            <Step1MilitaryService 
              serviceInfo={serviceInfo} 
              setServiceInfo={setServiceInfo}
              stateOfResidence={stateOfResidence}
              setStateOfResidence={setStateOfResidence}
            />
          )}
          {currentStep === 2 && (
            <Step2UploadNarrative 
              narrativeResult={narrativeResult} 
              setNarrativeResult={setNarrativeResult}
            />
          )}
          {currentStep === 3 && (
            <Step3DisabilityReview
              serviceInfo={serviceInfo}
              narrativeResult={narrativeResult}
              classifiedDisabilities={classifiedDisabilities}
              setClassifiedDisabilities={setClassifiedDisabilities}
            />
          )}
          {currentStep === 4 && (
            <Step4BenefitRecommendations
              serviceInfo={serviceInfo}
              classifiedDisabilities={classifiedDisabilities}
              combinedRating={combinedRating}
            />
          )}
          {currentStep === 5 && (
            <StateBenefits
              stateOfResidence={stateOfResidence}
              combinedRating={combinedRating}
              serviceInfo={serviceInfo}
              classifiedDisabilities={classifiedDisabilities}
            />
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.2)'
        }}>
          <UIButton 
            variant="secondary"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Back
          </UIButton>
          <UIButton 
            onClick={handleNext}
            disabled={currentStep === 5}
          >
            Next
          </UIButton>
        </div>
      </div>
    </div>
  );
}
