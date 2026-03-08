"""
Evidence Inference Engine
Analyzes claims and identifies evidence gaps with actionable recommendations
"""

from typing import Dict, List, Any
from dataclasses import dataclass
from enum import Enum


class EvidenceType(Enum):
    """Types of evidence for VA claims"""
    MEDICAL_DIAGNOSIS = "Current medical diagnosis"
    TREATMENT_RECORDS = "Medical treatment records"
    SERVICE_RECORDS = "Service medical records (SMR)"
    NEXUS_LETTER = "Medical nexus/IMO letter"
    DBQ = "Disability Benefits Questionnaire"
    BUDDY_STATEMENT = "Buddy/lay statements"
    STRESSOR_STATEMENT = "Stressor statement (PTSD)"
    PRIVATE_MEDICAL = "Private medical records"
    VA_MEDICAL = "VA medical records"
    EMPLOYMENT_RECORDS = "Employment impact documentation"
    DAILY_LIFE_IMPACT = "Daily activities impact statement"
    SPECIALIST_EVAL = "Specialist evaluation"
    DIAGNOSTIC_TESTS = "Diagnostic test results"
    DEPLOYMENT_RECORDS = "Deployment/exposure records"


@dataclass
class EvidenceGap:
    """Identified gap in claim evidence"""
    evidence_type: EvidenceType
    priority: str  # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    reason: str
    how_to_obtain: str
    impact_on_claim: str
    cost_estimate: str  # 'FREE', '$', '$$', '$$$'
    timeline: str


class EvidenceInferenceEngine:
    """
    Advanced evidence gap analysis engine
    Identifies missing evidence and provides acquisition strategies
    """
    
    # Evidence requirements by condition
    CONDITION_EVIDENCE = {
        'PTSD': [
            EvidenceType.MEDICAL_DIAGNOSIS,
            EvidenceType.STRESSOR_STATEMENT,
            EvidenceType.TREATMENT_RECORDS,
            EvidenceType.BUDDY_STATEMENT,
            EvidenceType.DBQ
        ],
        'Tinnitus': [
            EvidenceType.MEDICAL_DIAGNOSIS,
            EvidenceType.DIAGNOSTIC_TESTS,  # Audiology exam
            EvidenceType.SERVICE_RECORDS,
            EvidenceType.BUDDY_STATEMENT
        ],
        'Sleep Apnea': [
            EvidenceType.MEDICAL_DIAGNOSIS,
            EvidenceType.DIAGNOSTIC_TESTS,  # Sleep study
            EvidenceType.TREATMENT_RECORDS,  # CPAP records
            EvidenceType.NEXUS_LETTER
        ],
        'TBI': [
            EvidenceType.MEDICAL_DIAGNOSIS,
            EvidenceType.SERVICE_RECORDS,  # Head injury docs
            EvidenceType.SPECIALIST_EVAL,  # Neurologist
            EvidenceType.DIAGNOSTIC_TESTS,  # MRI/CT
            EvidenceType.NEXUS_LETTER
        ]
    }
    
    def analyze_evidence_gaps(self, claim_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Comprehensive evidence gap analysis
        
        Args:
            claim_data: {
                'condition': str,
                'service_connection_type': str,
                'existing_evidence': {
                    'medical_records': bool,
                    'nexus_letter': bool,
                    'service_records': bool,
                    'buddy_statements': bool,
                    'dbq': bool,
                    'diagnostic_tests': bool
                },
                'veteran_status': {
                    'combat_veteran': bool,
                    'has_va_provider': bool,
                    'private_insurance': bool
                }
            }
        
        Returns:
            Evidence gap analysis with prioritized recommendations
        """
        condition = claim_data.get('condition', '')
        service_type = claim_data.get('service_connection_type', 'DIRECT')
        existing = claim_data.get('existing_evidence', {})
        veteran_status = claim_data.get('veteran_status', {})
        
        gaps = []
        
        # 1. Current Diagnosis (ALWAYS required)
        if not existing.get('medical_records'):
            gaps.append(EvidenceGap(
                evidence_type=EvidenceType.MEDICAL_DIAGNOSIS,
                priority='CRITICAL',
                reason='VA requires current diagnosis for all claims',
                how_to_obtain='Schedule exam with VA provider or private doctor. Request written diagnosis in medical records.',
                impact_on_claim='Claim will be denied without current diagnosis',
                cost_estimate='FREE (VA) or $$ (private)',
                timeline='1-4 weeks'
            ))
        
        # 2. Service Connection Evidence
        if service_type == 'DIRECT':
            if not existing.get('service_records'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.SERVICE_RECORDS,
                    priority='HIGH',
                    reason='Need evidence of in-service injury/event',
                    how_to_obtain='Request Service Treatment Records (STRs) from National Archives. File FOIA request if needed.',
                    impact_on_claim='Significantly weakens claim without service records',
                    cost_estimate='FREE',
                    timeline='6-12 weeks'
                ))
            
            if not existing.get('nexus_letter'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.NEXUS_LETTER,
                    priority='HIGH',
                    reason='Medical nexus links current condition to service',
                    how_to_obtain='Request Independent Medical Opinion (IMO) from VA or private doctor. Doctor must state "as likely as not" condition is service-related.',
                    impact_on_claim='Greatly improves chances - provides medical evidence of causation',
                    cost_estimate='FREE (VA) or $$$ (private IMO: $1500-$3000)',
                    timeline='2-6 weeks'
                ))
        
        elif service_type == 'SECONDARY':
            if not existing.get('nexus_letter'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.NEXUS_LETTER,
                    priority='CRITICAL',
                    reason='Secondary claims require medical causation opinion',
                    how_to_obtain='Get doctor to write nexus explaining how primary condition caused/aggravated secondary condition.',
                    impact_on_claim='Cannot establish secondary connection without medical causation',
                    cost_estimate='$$$ (private IMO recommended)',
                    timeline='2-4 weeks'
                ))
        
        # 3. Condition-specific evidence
        if condition == 'PTSD':
            if not existing.get('stressor_statement'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.STRESSOR_STATEMENT,
                    priority='CRITICAL',
                    reason='PTSD requires detailed stressor description',
                    how_to_obtain='Write personal statement describing traumatic event(s) - who, what, when, where. Include dates, locations, units.',
                    impact_on_claim='PTSD claim will be denied without stressor verification',
                    cost_estimate='FREE',
                    timeline='1 day (DIY)'
                ))
            
            if not existing.get('buddy_statements'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.BUDDY_STATEMENT,
                    priority='HIGH',
                    reason='Buddy statements corroborate stressor and symptoms',
                    how_to_obtain='Ask fellow service members or family to write statements about observed changes in behavior.',
                    impact_on_claim='Significantly strengthens claim credibility',
                    cost_estimate='FREE',
                    timeline='1-2 weeks'
                ))
        
        elif condition == 'Tinnitus':
            if not existing.get('diagnostic_tests'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.DIAGNOSTIC_TESTS,
                    priority='CRITICAL',
                    reason='Tinnitus requires audiology examination',
                    how_to_obtain='Schedule audiology exam at VA or private audiologist. Must document tinnitus.',
                    impact_on_claim='Cannot rate tinnitus without audiology exam',
                    cost_estimate='FREE (VA)',
                    timeline='2-6 weeks'
                ))
        
        elif condition == 'Sleep Apnea':
            if not existing.get('diagnostic_tests'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.DIAGNOSTIC_TESTS,
                    priority='CRITICAL',
                    reason='Sleep apnea requires sleep study results',
                    how_to_obtain='Get sleep study (polysomnography) from VA or private sleep clinic. Results must show AHI score.',
                    impact_on_claim='Cannot diagnose sleep apnea without sleep study',
                    cost_estimate='FREE (VA) or $$$ (private: $1000+)',
                    timeline='4-8 weeks'
                ))
            
            if existing.get('cpap_use') and not existing.get('treatment_records'):
                gaps.append(EvidenceGap(
                    evidence_type=EvidenceType.TREATMENT_RECORDS,
                    priority='HIGH',
                    reason='CPAP usage records support 50% rating',
                    how_to_obtain='Request CPAP compliance data from supplier. Shows nightly usage.',
                    impact_on_claim='CPAP use automatically qualifies for 50% rating',
                    cost_estimate='FREE',
                    timeline='1 week'
                ))
        
        # 4. DBQ (Disability Benefits Questionnaire)
        if not existing.get('dbq'):
            gaps.append(EvidenceGap(
                evidence_type=EvidenceType.DBQ,
                priority='MEDIUM',
                reason='DBQ provides standardized medical evidence',
                how_to_obtain=f'Request condition-specific DBQ from VA or private provider. Use VA Form 21-0960 series.',
                impact_on_claim='Speeds up claim processing - VA uses DBQs for rating decisions',
                cost_estimate='$ (private provider fee)',
                timeline='1-2 weeks'
            ))
        
        # 5. Lay Evidence
        if not existing.get('buddy_statements') and not veteran_status.get('combat_veteran'):
            gaps.append(EvidenceGap(
                evidence_type=EvidenceType.BUDDY_STATEMENT,
                priority='MEDIUM',
                reason='Lay statements from witnesses strengthen claim',
                how_to_obtain='Get written statements from people who observed your condition/symptoms (family, friends, coworkers).',
                impact_on_claim='Corroborates your testimony - especially important for symptoms others can observe',
                cost_estimate='FREE',
                timeline='1-2 weeks'
            ))
        
        # Sort by priority
        priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        gaps.sort(key=lambda x: priority_order[x.priority])
        
        # Calculate strength score
        evidence_strength = self._calculate_evidence_strength(existing, gaps)
        
        return {
            'evidence_gaps': [self._gap_to_dict(g) for g in gaps],
            'total_gaps': len(gaps),
            'critical_gaps': len([g for g in gaps if g.priority == 'CRITICAL']),
            'evidence_strength_score': evidence_strength,
            'strength_rating': 'STRONG' if evidence_strength > 80 else 'MODERATE' if evidence_strength > 50 else 'WEAK',
            'total_estimated_cost': self._estimate_total_cost(gaps),
            'estimated_timeline': self._estimate_timeline(gaps),
            'recommendations': self._generate_recommendations(gaps, veteran_status)
        }
    
    def _calculate_evidence_strength(self, existing: Dict, gaps: List[EvidenceGap]) -> float:
        """Calculate evidence strength score (0-100)"""
        base_score = 50
        
        # Add points for existing evidence
        if existing.get('medical_records'):
            base_score += 20
        if existing.get('nexus_letter'):
            base_score += 15
        if existing.get('service_records'):
            base_score += 10
        if existing.get('buddy_statements'):
            base_score += 5
        
        # Subtract for critical gaps
        critical_gaps = len([g for g in gaps if g.priority == 'CRITICAL'])
        base_score -= (critical_gaps * 25)
        
        return max(0, min(100, base_score))
    
    def _estimate_total_cost(self, gaps: List[EvidenceGap]) -> str:
        """Estimate total cost to fill gaps"""
        cost_map = {'FREE': 0, '$': 100, '$$': 500, '$$$': 2000}
        total = sum(cost_map[g.cost_estimate] for g in gaps)
        
        if total == 0:
            return 'FREE'
        elif total < 200:
            return '$50-$200'
        elif total < 1000:
            return '$200-$1000'
        else:
            return '$1000-$3000+'
    
    def _estimate_timeline(self, gaps: List[EvidenceGap]) -> str:
        """Estimate time to gather all evidence"""
        if not gaps:
            return 'Ready to file'
        
        # Find longest timeline
        timelines = [g.timeline for g in gaps if g.priority in ['CRITICAL', 'HIGH']]
        
        if any('12 weeks' in t for t in timelines):
            return '2-3 months'
        elif any('6 weeks' in t or '8 weeks' in t for t in timelines):
            return '6-8 weeks'
        else:
            return '2-4 weeks'
    
    def _generate_recommendations(self, gaps: List[EvidenceGap], veteran_status: Dict) -> List[str]:
        """Generate action plan"""
        recs = []
        
        if veteran_status.get('has_va_provider'):
            recs.append('Schedule VA appointments for diagnosis and DBQ completion (FREE)')
        else:
            recs.append('Consider enrolling in VA healthcare for free medical evidence')
        
        critical = [g for g in gaps if g.priority == 'CRITICAL']
        if critical:
            recs.append(f'PRIORITY: Obtain {critical[0].evidence_type.value} immediately - claim cannot succeed without this')
        
        if any(g.evidence_type == EvidenceType.NEXUS_LETTER for g in gaps):
            recs.append('Consider hiring IMO company (Woods & Woods, Medical Opinion Now, etc.) for professional nexus letter')
        
        return recs
    
    def _gap_to_dict(self, gap: EvidenceGap) -> Dict:
        """Convert evidence gap to dictionary"""
        return {
            'evidence_type': gap.evidence_type.value,
            'priority': gap.priority,
            'reason': gap.reason,
            'how_to_obtain': gap.how_to_obtain,
            'impact_on_claim': gap.impact_on_claim,
            'cost_estimate': gap.cost_estimate,
            'timeline': gap.timeline
        }


def infer_evidence(claim: dict) -> dict:
    """Legacy function - use EvidenceInferenceEngine directly"""
    engine = EvidenceInferenceEngine()
    return engine.analyze_evidence_gaps(claim)


if __name__ == '__main__':
    # Test evidence analysis
    sample_claim = {
        'condition': 'PTSD',
        'service_connection_type': 'DIRECT',
        'existing_evidence': {
            'medical_records': True,
            'nexus_letter': False,
            'service_records': False,
            'buddy_statements': False,
            'stressor_statement': False
        },
        'veteran_status': {
            'combat_veteran': True,
            'has_va_provider': False
        }
    }
    
    engine = EvidenceInferenceEngine()
    result = engine.analyze_evidence_gaps(sample_claim)
    
    import json
    print(json.dumps(result, indent=2))
