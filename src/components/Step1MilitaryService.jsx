import React, { useState, useEffect } from 'react';
import UIBlock from './UIBlock';
import UIButton from './UIButton';
import '../styles/step1.css';

export default function Step1MilitaryService({ serviceInfo, setServiceInfo, stateOfResidence, setStateOfResidence }) {
  const [branch, setBranch] = useState(serviceInfo?.branch || '');
  const [component, setComponent] = useState(serviceInfo?.component || '');
  const [combatService, setCombatService] = useState(serviceInfo?.combatService || '');
  const [servicePeriods, setServicePeriods] = useState(serviceInfo?.servicePeriods || []);
  const [awards, setAwards] = useState(serviceInfo?.awards || []);
  const [state, setState] = useState(stateOfResidence || '');

  useEffect(() => {
    setServiceInfo({
      branch,
      component,
      combatService,
      servicePeriods,
      awards
    });
    setStateOfResidence(state);
  }, [branch, component, combatService, servicePeriods, awards, state, setServiceInfo, setStateOfResidence]);

  const branches = ['Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force', 'Other'];
  const components = ['Active Duty', 'Reserve', 'National Guard', 'Other'];
  const theaters = [
    'CONUS',
    'OEF',
    'OIF',
    'OND',
    'GWOT',
    'Vietnam',
    'Persian Gulf',
    'Korea',
    'Other'
  ];
  const awardsList = [
    'Purple Heart',
    'Bronze Star',
    'Silver Star',
    'Combat Action Badge',
    'Combat Infantryman Badge',
    'Combat Medical Badge',
    'Combat Action Ribbon',
    'Other'
  ];

  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming'
  ];

  const addServicePeriod = () => {
    setServicePeriods([...servicePeriods, {
      id: Date.now(),
      startDate: '',
      endDate: '',
      isPresent: false,
      theater: ''
    }]);
  };

  const removeServicePeriod = (id) => {
    setServicePeriods(servicePeriods.filter(p => p.id !== id));
  };

  const updateServicePeriod = (id, field, value) => {
    setServicePeriods(servicePeriods.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const addAward = (e) => {
    const selectedAward = e.target.value;
    if (selectedAward && !awards.includes(selectedAward)) {
      setAwards([...awards, selectedAward]);
    }
  };

  const removeAward = (award) => {
    setAwards(awards.filter(a => a !== award));
  };

  return (
    <div className="step1-container">
      {/* BLOCK 1 - Branch & Component */}
      <UIBlock title="Branch & Component">
        <div className="rf-grid-2">
          <div className="step1-field">
            <label className="rf-label">Branch</label>
            <select 
              className="rf-select"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">Select branch</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="step1-field">
            <label className="rf-label">Component</label>
            <select 
              className="rf-select"
              value={component}
              onChange={(e) => setComponent(e.target.value)}
            >
              <option value="">Select component</option>
              {components.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </UIBlock>

      {/* BLOCK 2 - Combat Service */}
      <UIBlock>
        <h3 className="step1-block-title">Combat Service</h3>
        <div className="rf-radio-group">
          <label className="rf-radio-label">
            <input 
               title="Combat Service"
              value="yes"
              checked={combatService === 'yes'}
              onChange={(e) => setCombatService(e.target.value)}
            />
            Yes
          </label>
          <label className="rf-radio-label">
            <input 
              type="radio" 
              name="combatService"
              value="no"
              checked={combatService === 'no'}
              onChange={(e) => setCombatService(e.target.value)}
            />
            No
          </label>
          <label className="rf-radio-label">
            <input 
              type="radio" 
              name="combatService"
              value="not-sure"
              checked={c_sure"
              checked={combatService === 'not_e(e.target.value)}
            />
            Not sure
          </label>
        </div>
      </UIBlock>

      {/* BLOCK 3 - Service Periods */}
      <UIBlock>
        <h3 cl title="Service Periods"
          {servicePeriods.map((period) => (
            <div key={period.id} className="step1-period-item">
              <div className="step1-period-fields">
                <div>
                  <label className="rf-label">Start Date</label>
                  <input 
                    type="date"
                    className="rf-input"
                    value={period.startDate}
                    onChange={(e) => updateServicePeriod(period.id, 'startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="rf-label">End Date</label>
                  <input 
                    type="date"
                    className="rf-input"
                    value={period.endDate}
                    onChange={(e) => updateServicePeriod(period.id, 'endDate', e.target.value)}
                    disabled={period.isPresent}
                  />
                </div>
                <div>
                  <label className="rf-label">Theater</label>
                  <select 
                    className="rf-select"
                    value={period.theater}
                    onChange={(e) => updateServicePeriod(period.id, 'theater', e.target.value)}
                  >
                    <option value="">Select theater</option>
                    {theaters.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rf-flex-between">
                <label className="rf-checkbox-label">
                  <input 
                    type="checkbox"
                    checked={period.isPresent}
                    onChange={(e) => updateServicePeriod(period.id, 'isPresent', e.target.checked)}
                  />
                  Present
                </label>
                <UIButton 
                  variant="secondary"
                  onClick={() => removeServicePeriod(period.id)}
                >
                  Remove
                </UIButton>
              </div>
            </div>
          ))}
        </div>
        <UIButton className="step1-add-button" onClick={addServicePeriod}>
          Add Service Period
        </UIButton>
      </UIBlock>

      {/* BLOCK 4 - Awards */}
      <UIBlock title="Awards">
        <div className="step1-field">
          <label className="rf-label">Award</label>
          <select 
            className="rf-select"
            defaultValue=""
            onChange={addAward}
          >
            <option value="">Select award to add</option>
            {awardsList.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        {awards.length > 0 && (
          <div className="step1-awards-list">
            <ul className="rf-list">
              {awards.map((award, index) => (
                <li key={index} className="rf-list-item">
                  <span>{award}</span>
                  <button 
                    className="rf-chip-remove"
                    onClick={() => removeAward(award)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </UIBlock>

      {/* State of Residence */}
      <UIBlock title="State of Residence">
        <div className="step1-field">
          <label className="rf-label">State</label>
          <select 
            className="rf-select"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Select state</option>
            {states.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </UIBlock>
    </div>
  );
}
