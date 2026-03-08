import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';

const ranksByBranch = {
  'Army': {
    enlisted: [
      { code: 'E-1', title: 'Private' },
      { code: 'E-2', title: 'Private (PV2)' },
      { code: 'E-3', title: 'Private First Class' },
      { code: 'E-4', title: 'Specialist / Corporal' },
      { code: 'E-5', title: 'Sergeant' },
      { code: 'E-6', title: 'Staff Sergeant' },
      { code: 'E-7', title: 'Sergeant First Class' },
      { code: 'E-8', title: 'Master Sergeant / First Sergeant' },
      { code: 'E-9', title: 'Sergeant Major / Command Sergeant Major / Sergeant Major of the Army' }
    ],
    warrant: [
      { code: 'W-1', title: 'Warrant Officer 1' },
      { code: 'W-2', title: 'Chief Warrant Officer 2' },
      { code: 'W-3', title: 'Chief Warrant Officer 3' },
      { code: 'W-4', title: 'Chief Warrant Officer 4' },
      { code: 'W-5', title: 'Chief Warrant Officer 5' }
    ],
    officer: [
      { code: 'O-1', title: 'Second Lieutenant' },
      { code: 'O-2', title: 'First Lieutenant' },
      { code: 'O-3', title: 'Captain' },
      { code: 'O-4', title: 'Major' },
      { code: 'O-5', title: 'Lieutenant Colonel' },
      { code: 'O-6', title: 'Colonel' },
      { code: 'O-7', title: 'Brigadier General' },
      { code: 'O-8', title: 'Major General' },
      { code: 'O-9', title: 'Lieutenant General' },
      { code: 'O-10', title: 'General' }
    ]
  },
  'Marine Corps': {
    enlisted: [
      { code: 'E-1', title: 'Private' },
      { code: 'E-2', title: 'Private First Class' },
      { code: 'E-3', title: 'Lance Corporal' },
      { code: 'E-4', title: 'Corporal' },
      { code: 'E-5', title: 'Sergeant' },
      { code: 'E-6', title: 'Staff Sergeant' },
      { code: 'E-7', title: 'Gunnery Sergeant' },
      { code: 'E-8', title: 'Master Sergeant / First Sergeant' },
      { code: 'E-9', title: 'Master Gunnery Sergeant / Sergeant Major / Sergeant Major of the Marine Corps' }
    ],
    warrant: [
      { code: 'W-1', title: 'Warrant Officer 1' },
      { code: 'W-2', title: 'Chief Warrant Officer 2' },
      { code: 'W-3', title: 'Chief Warrant Officer 3' },
      { code: 'W-4', title: 'Chief Warrant Officer 4' },
      { code: 'W-5', title: 'Chief Warrant Officer 5' }
    ],
    officer: [
      { code: 'O-1', title: 'Second Lieutenant' },
      { code: 'O-2', title: 'First Lieutenant' },
      { code: 'O-3', title: 'Captain' },
      { code: 'O-4', title: 'Major' },
      { code: 'O-5', title: 'Lieutenant Colonel' },
      { code: 'O-6', title: 'Colonel' },
      { code: 'O-7', title: 'Brigadier General' },
      { code: 'O-8', title: 'Major General' },
      { code: 'O-9', title: 'Lieutenant General' },
      { code: 'O-10', title: 'General' }
    ]
  },
  'Navy': {
    enlisted: [
      { code: 'E-1', title: 'Seaman Recruit' },
      { code: 'E-2', title: 'Seaman Apprentice' },
      { code: 'E-3', title: 'Seaman' },
      { code: 'E-4', title: 'Petty Officer Third Class' },
      { code: 'E-5', title: 'Petty Officer Second Class' },
      { code: 'E-6', title: 'Petty Officer First Class' },
      { code: 'E-7', title: 'Chief Petty Officer' },
      { code: 'E-8', title: 'Senior Chief Petty Officer' },
      { code: 'E-9', title: 'Master Chief Petty Officer / Fleet/Command Master Chief / MCPON' }
    ],
    warrant: [
      { code: 'W-2', title: 'Chief Warrant Officer 2' },
      { code: 'W-3', title: 'Chief Warrant Officer 3' },
      { code: 'W-4', title: 'Chief Warrant Officer 4' },
      { code: 'W-5', title: 'Chief Warrant Officer 5' }
    ],
    officer: [
      { code: 'O-1', title: 'Ensign' },
      { code: 'O-2', title: 'Lieutenant Junior Grade' },
      { code: 'O-3', title: 'Lieutenant' },
      { code: 'O-4', title: 'Lieutenant Commander' },
      { code: 'O-5', title: 'Commander' },
      { code: 'O-6', title: 'Captain' },
      { code: 'O-7', title: 'Rear Admiral (Lower Half)' },
      { code: 'O-8', title: 'Rear Admiral (Upper Half)' },
      { code: 'O-9', title: 'Vice Admiral' },
      { code: 'O-10', title: 'Admiral' }
    ]
  },
  'Air Force': {
    enlisted: [
      { code: 'E-1', title: 'Airman Basic' },
      { code: 'E-2', title: 'Airman' },
      { code: 'E-3', title: 'Airman First Class' },
      { code: 'E-4', title: 'Senior Airman' },
      { code: 'E-5', title: 'Staff Sergeant' },
      { code: 'E-6', title: 'Technical Sergeant' },
      { code: 'E-7', title: 'Master Sergeant / First Sergeant' },
      { code: 'E-8', title: 'Senior Master Sergeant / First Sergeant' },
      { code: 'E-9', title: 'Chief Master Sergeant / Command Chief / CMSAF' }
    ],
    warrant: [],
    officer: [
      { code: 'O-1', title: 'Second Lieutenant' },
      { code: 'O-2', title: 'First Lieutenant' },
      { code: 'O-3', title: 'Captain' },
      { code: 'O-4', title: 'Major' },
      { code: 'O-5', title: 'Lieutenant Colonel' },
      { code: 'O-6', title: 'Colonel' },
      { code: 'O-7', title: 'Brigadier General' },
      { code: 'O-8', title: 'Major General' },
      { code: 'O-9', title: 'Lieutenant General' },
      { code: 'O-10', title: 'General' }
    ]
  },
  'Space Force': {
    enlisted: [
      { code: 'E-1', title: 'Specialist 1' },
      { code: 'E-2', title: 'Specialist 2' },
      { code: 'E-3', title: 'Specialist 3' },
      { code: 'E-4', title: 'Specialist 4' },
      { code: 'E-5', title: 'Sergeant' },
      { code: 'E-6', title: 'Technical Sergeant' },
      { code: 'E-7', title: 'Master Sergeant' },
      { code: 'E-8', title: 'Senior Master Sergeant' },
      { code: 'E-9', title: 'Chief Master Sergeant / CMSSF' }
    ],
    warrant: [],
    officer: [
      { code: 'O-1', title: 'Second Lieutenant' },
      { code: 'O-2', title: 'First Lieutenant' },
      { code: 'O-3', title: 'Captain' },
      { code: 'O-4', title: 'Major' },
      { code: 'O-5', title: 'Lieutenant Colonel' },
      { code: 'O-6', title: 'Colonel' },
      { code: 'O-7', title: 'Brigadier General' },
      { code: 'O-8', title: 'Major General' },
      { code: 'O-9', title: 'Lieutenant General' },
      { code: 'O-10', title: 'General' }
    ]
  },
  'Coast Guard': {
    enlisted: [
      { code: 'E-1', title: 'Seaman Recruit' },
      { code: 'E-2', title: 'Seaman Apprentice' },
      { code: 'E-3', title: 'Seaman' },
      { code: 'E-4', title: 'Petty Officer Third Class' },
      { code: 'E-5', title: 'Petty Officer Second Class' },
      { code: 'E-6', title: 'Petty Officer First Class' },
      { code: 'E-7', title: 'Chief Petty Officer' },
      { code: 'E-8', title: 'Senior Chief Petty Officer' },
      { code: 'E-9', title: 'Master Chief Petty Officer / Area/Command MCPO / MCPOCG' }
    ],
    warrant: [
      { code: 'W-2', title: 'Chief Warrant Officer 2' },
      { code: 'W-3', title: 'Chief Warrant Officer 3' },
      { code: 'W-4', title: 'Chief Warrant Officer 4' }
    ],
    officer: [
      { code: 'O-1', title: 'Ensign' },
      { code: 'O-2', title: 'Lieutenant Junior Grade' },
      { code: 'O-3', title: 'Lieutenant' },
      { code: 'O-4', title: 'Lieutenant Commander' },
      { code: 'O-5', title: 'Commander' },
      { code: 'O-6', title: 'Captain' },
      { code: 'O-7', title: 'Rear Admiral (Lower Half)' },
      { code: 'O-8', title: 'Rear Admiral (Upper Half)' },
      { code: 'O-9', title: 'Vice Admiral' },
      { code: 'O-10', title: 'Admiral' }
    ]
  },
  'Public Health Service Commissioned Corps (USPHS)': {
    enlisted: [],
    warrant: [],
    officer: [
      { code: 'O-1', title: 'Ensign' },
      { code: 'O-2', title: 'Lieutenant Junior Grade' },
      { code: 'O-3', title: 'Lieutenant' },
      { code: 'O-4', title: 'Lieutenant Commander' },
      { code: 'O-5', title: 'Commander' },
      { code: 'O-6', title: 'Captain' },
      { code: 'O-7', title: 'Rear Admiral (Lower Half)' },
      { code: 'O-8', title: 'Rear Admiral (Upper Half)' },
      { code: 'O-9', title: 'Vice Admiral' },
      { code: 'O-10', title: 'Admiral' }
    ]
  },
  'NOAA Commissioned Officer Corps': {
    enlisted: [],
    warrant: [],
    officer: [
      { code: 'O-1', title: 'Ensign' },
      { code: 'O-2', title: 'Lieutenant Junior Grade' },
      { code: 'O-3', title: 'Lieutenant' },
      { code: 'O-4', title: 'Lieutenant Commander' },
      { code: 'O-5', title: 'Commander' },
      { code: 'O-6', title: 'Captain' },
      { code: 'O-7', title: 'Rear Admiral (Lower Half)' },
      { code: 'O-8', title: 'Rear Admiral (Upper Half)' },
      { code: 'O-9', title: 'Vice Admiral' },
      { code: 'O-10', title: 'Admiral' }
    ]
  }
};

export function MilitaryServicePage() {
  const [serviceData, setServiceData] = useState({
    branch: '',
    startDate: '',
    endDate: '',
    rank: '',
    serviceType: '',
    dischargeType: ''
  });

  const [records, setRecords] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Try to load from backend first, fall back to localStorage
    const loadRecords = async () => {
      try {
        const response = await fetch('/api/military/records');
        if (response.ok) {
          const result = await response.json();
          if (result.data && result.data.length > 0) {
            setRecords(result.data);
            return;
          }
        }
      } catch (error) {
        console.log('Backend unavailable, using localStorage');
      }
      
      // Fall back to localStorage
      const saved = localStorage.getItem('militaryServiceRecords');
      if (saved) {
        try {
          setRecords(JSON.parse(saved));
        } catch (error) {
          console.error('Failed to load records:', error);
        }
      }
    };
    
    loadRecords();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setServiceData((prev) => {
      const updated = {
        ...prev,
        [name]: value
      };
      // Clear rank when branch changes
      if (name === 'branch') {
        updated.rank = '';
      }
      return updated;
    });
  };

  const handleAddRecord = () => {
    if (serviceData.branch && serviceData.startDate) {
      setRecords((prev) => [...prev, { ...serviceData, id: Date.now() }]);
      setServiceData({
        branch: '',
        startDate: '',
        endDate: '',
        rank: '',
        serviceType: '',
        dischargeType: ''
      });
    }
  };

  const handleRemoveRecord = (id) => {
    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const calculateTotalServiceYears = () => {
    if (records.length === 0) return { years: 0, months: 0 };
    
    let totalMonths = 0;
    records.forEach((record) => {
      if (!record.startDate) return;
      const start = new Date(record.startDate);
      const end = record.endDate ? new Date(record.endDate) : new Date();
      
      let years = end.getFullYear() - start.getFullYear();
      let months = end.getMonth() - start.getMonth();
      
      if (months < 0) {
        years--;
        months += 12;
      }
      
      totalMonths += years * 12 + months;
    });
    
    const totalYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    
    return { years: totalYears, months: remainingMonths };
  };

  const calculateYearsOfService = (startDate, endDate) => {
    if (!startDate) return 'N/A';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0 && months === 0) return 'Less than 1 month';
    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
  };

  const totalService = calculateTotalServiceYears();

  const handleSave = async () => {
    if (records.length === 0) {
      setSaveMessage('⚠ No records to save');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }
    try {
      // Save to localStorage
      localStorage.setItem('militaryServiceRecords', JSON.stringify(records));
      
      // Try to save to backend
      try {
        const response = await fetch('/api/military/save-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records })
        });

        if (!response.ok) {
          throw new Error('Backend save failed');
        }

        const result = await response.json();
        console.log('Backend save successful:', result);
      } catch (backendError) {
        console.log('Using offline mode - record saved locally only', backendError.message);
      }

      setSaveMessage('✓ Military service records saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveMessage('✗ Failed to save records: ' + error.message);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title='Military Service Information'>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>Branch of Service</label>
              <select
                name='branch'
                value={serviceData.branch}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#cbd5e1'
                }}
              >
                <option value=''>Select branch...</option>
                <option value='Army'>Army</option>
                <option value='Marine Corps'>Marine Corps</option>
                <option value='Navy'>Navy</option>
                <option value='Air Force'>Air Force</option>
                <option value='Space Force'>Space Force</option>
                <option value='Coast Guard'>Coast Guard</option>
                <option value='Public Health Service Commissioned Corps (USPHS)'>Public Health Service Commissioned Corps (USPHS)</option>
                <option value='NOAA Commissioned Officer Corps'>NOAA Commissioned Officer Corps</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>Service Type</label>
              <select
                name='serviceType'
                value={serviceData.serviceType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#cbd5e1'
                }}
              >
                <option value=''>Select type...</option>
                <option value='Active Duty'>Active Duty</option>
                <option value='Reserve'>Reserve</option>
                <option value='National Guard'>National Guard</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>Start Date</label>
              <input
                type='date'
                name='startDate'
                value={serviceData.startDate}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#cbd5e1'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>End Date</label>
              <input
                type='date'
                name='endDate'
                value={serviceData.endDate}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#cbd5e1'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>Rank/Rate</label>
              <select
                name='rank'
                value={serviceData.rank}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                <option value=''>Select rank...</option>
                {serviceData.branch && ranksByBranch[serviceData.branch] && (
                  <>
                    {ranksByBranch[serviceData.branch].enlisted.length > 0 && (
                      <optgroup label='Enlisted (E-1 to E-9)'>
                        {ranksByBranch[serviceData.branch].enlisted.map((rank) => (
                          <option key={rank.code} value={rank.code}>
                            {rank.code} — {rank.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {ranksByBranch[serviceData.branch].warrant.length > 0 && (
                      <optgroup label='Warrant Officer'>
                        {ranksByBranch[serviceData.branch].warrant.map((rank) => (
                          <option key={rank.code} value={rank.code}>
                            {rank.code} — {rank.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {ranksByBranch[serviceData.branch].officer.length > 0 && (
                      <optgroup label='Commissioned Officer (O-1 to O-10)'>
                        {ranksByBranch[serviceData.branch].officer.map((rank) => (
                          <option key={rank.code} value={rank.code}>
                            {rank.code} — {rank.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>Discharge Type</label>
              <select
                name='dischargeType'
                value={serviceData.dischargeType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#cbd5e1'
                }}
              >
                <option value=''>Select discharge...</option>
                <option value='Honorable'>Honorable</option>
                <option value='General'>General</option>
                <option value='Other Than Honorable'>Other Than Honorable</option>
                <option value='Bad Conduct'>Bad Conduct</option>
                <option value='Dishonorable'>Dishonorable</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleAddRecord}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#14b8a6',
              color: '#0f172a',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Add Service Record
          </button>
        </div>
      </Card>

      {records.length > 0 && (
        <Card title={`Service Records — Total: ${totalService.years} year${totalService.years !== 1 ? 's' : ''} ${totalService.months} month${totalService.months !== 1 ? 's' : ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {records.map((record) => (
              <div
                key={record.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start'
                }}
              >
                <div>
                  <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{record.branch}</p>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    {record.serviceType} • {record.startDate} to {record.endDate || '(Current)'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    Rank: {record.rank} • Discharge: {record.dischargeType}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#14b8a6', fontWeight: '600' }}>
                    ⏱ Service: {calculateYearsOfService(record.startDate, record.endDate)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveRecord(record.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    fontWeight: '600'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                💾 Save Records
              </button>
              {saveMessage && (
                <div
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    color: '#cbd5e1',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {saveMessage}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
