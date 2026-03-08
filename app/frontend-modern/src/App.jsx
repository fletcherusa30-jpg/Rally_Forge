import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { MilitaryServicePage } from './pages/MilitaryServicePage';
import { VARatingDecisionPage } from './pages/VARatingDecisionPage';
import { ServiceTreatmentRecordsPage } from './pages/ServiceTreatmentRecordsPage';
import { FinancialPlannerPage } from './pages/FinancialPlannerPage';
import { SystemHealth } from './pages/SystemHealth';
import KnowledgeBasePage from './pages/KnowledgeBasePage';

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path='/' element={<MilitaryServicePage />} />
          <Route path='/military-service' element={<MilitaryServicePage />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/va-decision' element={<VARatingDecisionPage />} />
          <Route path='/service-records' element={<ServiceTreatmentRecordsPage />} />
          <Route path='/financial-planner' element={<FinancialPlannerPage />} />
          <Route path='/knowledge-base' element={<KnowledgeBasePage />} />
          <Route path='/system-health' element={<SystemHealth />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
