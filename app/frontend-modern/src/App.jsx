import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ClaimWorkspaceProvider } from './context/ClaimWorkspaceContext';
import { AppLayout } from './layouts/AppLayout';
import { ProfilePage } from './components/profile/ProfilePage';
import { MilitaryServicePage } from './pages/MilitaryServicePage';

const Dashboard = lazy(() => import('./pages/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })));
const CurrentTreatmentPage = lazy(() => import('./pages/treatment/CurrentTreatmentPage').then((module) => ({ default: module.CurrentTreatmentPage })));
const VARatingDecisionPage = lazy(() => import('./pages/benefits/VARatingDecisionPage').then((module) => ({ default: module.VARatingDecisionPage })));
const ServiceTreatmentRecordsPage = lazy(() => import('./pages/ServiceTreatmentRecordsPage').then((module) => ({ default: module.ServiceTreatmentRecordsPage })));
const FinancialPlannerPage = lazy(() => import('./components/financial/FinancialPlannerPage').then((module) => ({ default: module.FinancialPlannerPage })));
const StateBenefitsPage = lazy(() => import('./pages/benefits/StateBenefitsPage').then((module) => ({ default: module.StateBenefitsPage })));
const ReviewQueuePage = lazy(() => import('./pages/claims/ReviewQueuePage').then((module) => ({ default: module.ReviewQueuePage })));
const ScannerActivityPage = lazy(() => import('./pages/scanner/ScannerActivityPage').then((module) => ({ default: module.ScannerActivityPage })));
const SystemHealth = lazy(() => import('./pages/system/SystemHealth').then((module) => ({ default: module.SystemHealth })));
const ClaimGeneratorSummaryPage = lazy(() => import('./pages/claims/ClaimGeneratorSummaryPage').then((module) => ({ default: module.ClaimGeneratorSummaryPage })));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })));
const DevelopersPage = lazy(() => import('./pages/DevelopersPage').then((module) => ({ default: module.DevelopersPage })));
const DeveloperToolsWorkbenchPage = lazy(() => import('./app/developer/DeveloperToolsWorkbenchPage').then((module) => ({ default: module.DeveloperToolsWorkbenchPage })));
const WorkspaceUpdatesPage = lazy(() => import('./pages/system/WorkspaceUpdatesPage').then((module) => ({ default: module.WorkspaceUpdatesPage })));

function RouteFallback() {
  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Loading</div>
          <h1 className='page-title'>Opening page</h1>
          <p className='page-copy'>Fetching workflow tools and evidence views for this step.</p>
        </div>
      </section>
      <article className='rf-card'>
        <div className='rf-card-body'>Loading workspace module...</div>
      </article>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ClaimWorkspaceProvider>
        <AppLayout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path='/' element={<ProfilePage />} />
              <Route path='/profile' element={<ProfilePage />} />
              <Route path='/military-service' element={<MilitaryServicePage />} />
              <Route path='/current-treatment' element={<CurrentTreatmentPage />} />
              <Route path='/dashboard' element={<Dashboard />} />
              <Route path='/va-decision' element={<VARatingDecisionPage />} />
              <Route path='/service-records' element={<ServiceTreatmentRecordsPage />} />
              <Route path='/claim-generator-summary' element={<ClaimGeneratorSummaryPage />} />
              <Route path='/analyzer' element={<Navigate to='/claim-generator-summary' replace />} />
              <Route path='/case-summary' element={<Navigate to='/claim-generator-summary' replace />} />
              <Route path='/resources' element={<ToolsPage />} />
              <Route path='/tools' element={<Navigate to='/resources' replace />} />
              <Route path='/developers' element={<DevelopersPage />} />
              <Route path='/developer-tools-workbench' element={<DeveloperToolsWorkbenchPage />} />
              <Route path='/financial-planner' element={<FinancialPlannerPage />} />
              <Route path='/state-benefits' element={<StateBenefitsPage />} />
              <Route path='/review-queue' element={<ReviewQueuePage />} />
              <Route path='/scanner-activity' element={<ScannerActivityPage />} />
              <Route path='/knowledge-base' element={<KnowledgeBasePage />} />
              <Route path='/system-health' element={<SystemHealth />} />
              <Route path='/workspace-updates' element={<WorkspaceUpdatesPage />} />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </ClaimWorkspaceProvider>
    </BrowserRouter>
  );
}
