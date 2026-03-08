"""
Claims Strategy Workflow
Orchestrates the complete claims analysis pipeline
"""

from typing import Dict, List, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from claimstrategyengine import ClaimsStrategyEngine
from cfr_interpreter import CFRInterpreter
from evidence_inference import EvidenceInferenceEngine
from secondaryconditionmapper import SecondaryConditionMapper
from entitlement_engine import EntitlementEngine


class ClaimsStrategyWorkflow:
    """
    Complete workflow for VA claims strategy generation
    Orchestrates all engines in proper sequence
    """
    
    def __init__(self):
        """Initialize all engines"""
        self.strategy_engine = ClaimsStrategyEngine()
        self.cfr_interpreter = CFRInterpreter()
        self.evidence_engine = EvidenceInferenceEngine()
        self.secondary_mapper = SecondaryConditionMapper()
        self.entitlement_engine = EntitlementEngine()
    
    def execute(self, veteran_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute complete claims strategy workflow
        
        Args:
            veteran_data: Complete veteran profile
        
        Returns:
            Comprehensive claims strategy report
        """
        # Phase 1: Generate initial claims strategy
        strategy = self.strategy_engine.generate_comprehensive_strategy(veteran_data)
        
        # Phase 2: Enrich with CFR details
        strategy = self._enrich_with_cfr(strategy, veteran_data)
        
        # Phase 3: Identify secondary conditions
        strategy = self._add_secondary_conditions(strategy, veteran_data)
        
        # Phase 4: Analyze evidence gaps
        strategy = self._analyze_evidence_gaps(strategy, veteran_data)
        
        # Phase 5: Calculate benefits
        strategy = self._calculate_benefits(strategy, veteran_data)
        
        # Phase 6: Generate action plan
        strategy = self._generate_action_plan(strategy)
        
        return strategy
    
    def _enrich_with_cfr(self, strategy: Dict, veteran_data: Dict) -> Dict:
        """Add CFR regulatory details to recommendations"""
        for claim in strategy.get('recommended_claims', []):
            condition = claim.get('condition')
            service_type = claim.get('service_connection_type')
            
            # Get rating criteria
            criteria = self.cfr_interpreter.get_rating_criteria(condition)
            if criteria:
                claim['diagnostic_code'] = criteria.diagnostic_code
                claim['rating_criteria'] = criteria.criteria_by_rating
                claim['special_considerations'] = criteria.special_considerations
            
            # Check eligibility
            eligibility = self.cfr_interpreter.check_eligibility(
                condition, 
                service_type,
                {
                    'has_diagnosis': True,
                    'in_service_event': veteran_data.get('combat_veteran', False),
                    'nexus': False
                }
            )
            claim['eligibility_status'] = eligibility
        
        return strategy
    
    def _add_secondary_conditions(self, strategy: Dict, veteran_data: Dict) -> Dict:
        """Identify potential secondary conditions"""
        # Get existing service-connected conditions
        existing = veteran_data.get('service_connected_conditions', [])
        
        # Also consider high-probability claims from strategy
        potential_primaries = [
            claim for claim in strategy.get('recommended_claims', [])
            if claim.get('success_probability', 0) > 0.75
        ]
        
        all_secondaries = []
        
        for primary in existing + potential_primaries:
            condition_name = primary.get('name') or primary.get('condition')
            primary_rating = primary.get('current_rating', 0) or primary.get('rating_estimate', 0)
            
            # Map secondaries
            secondary_analysis = self.secondary_mapper.map_secondary_conditions(
                condition_name,
                primary_rating
            )
            
            if secondary_analysis.get('secondary_conditions'):
                all_secondaries.extend(secondary_analysis['secondary_conditions'])
        
        strategy['secondary_conditions_analysis'] = {
            'total_secondary_opportunities': len(all_secondaries),
            'high_probability_secondaries': [
                s for s in all_secondaries if s.get('success_probability', 0) > 0.75
            ],
            'all_secondaries': all_secondaries
        }
        
        return strategy
    
    def _analyze_evidence_gaps(self, strategy: Dict, veteran_data: Dict) -> Dict:
        """Analyze evidence gaps for all recommended claims"""
        evidence_analyses = []
        
        for claim in strategy.get('recommended_claims', []):
            # Mock existing evidence (in production, this comes from document analysis)
            claim_data = {
                'condition': claim.get('condition'),
                'service_connection_type': claim.get('service_connection_type'),
                'existing_evidence': {
                    'medical_records': False,
                    'nexus_letter': False,
                    'service_records': False,
                    'buddy_statements': False,
                    'dbq': False,
                    'diagnostic_tests': False
                },
                'veteran_status': {
                    'combat_veteran': veteran_data.get('combat_veteran', False),
                    'has_va_provider': veteran_data.get('has_va_provider', False),
                    'private_insurance': veteran_data.get('private_insurance', False)
                }
            }
            
            gap_analysis = self.evidence_engine.analyze_evidence_gaps(claim_data)
            evidence_analyses.append({
                'condition': claim.get('condition'),
                'evidence_gaps': gap_analysis
            })
        
        strategy['evidence_gap_analysis'] = evidence_analyses
        
        return strategy
    
    def _calculate_benefits(self, strategy: Dict, veteran_data: Dict) -> Dict:
        """Calculate projected compensation"""
        current_rating = veteran_data.get('disability_rating', 0)
        projected_rating = strategy.get('estimated_combined_rating', 0)
        
        has_spouse = veteran_data.get('marital_status') == 'married'
        num_children = len(veteran_data.get('dependents', {}).get('children', []))
        
        # Current compensation
        current_comp = self.entitlement_engine.calculate_compensation(
            current_rating,
            has_spouse,
            num_children
        )
        
        # Projected compensation
        projected_comp = self.entitlement_engine.calculate_compensation(
            projected_rating,
            has_spouse,
            num_children
        )
        
        # Comparison
        comparison = self.entitlement_engine.calculate_benefit_comparison(
            current_rating,
            projected_rating,
            has_spouse,
            num_children
        )
        
        # Lifetime value
        veteran_age = veteran_data.get('age', 40)
        lifetime = self.entitlement_engine.calculate_lifetime_value(
            projected_comp.total_monthly,
            veteran_age
        )
        
        strategy['financial_analysis'] = {
            'current_compensation': self.entitlement_engine.to_dict(current_comp),
            'projected_compensation': self.entitlement_engine.to_dict(projected_comp),
            'comparison': comparison,
            'lifetime_value': lifetime
        }
        
        return strategy
    
    def _generate_action_plan(self, strategy: Dict) -> Dict:
        """Generate prioritized action plan"""
        actions = []
        
        # Action 1: Gather critical evidence
        critical_gaps = []
        for evidence_analysis in strategy.get('evidence_gap_analysis', []):
            gaps = evidence_analysis.get('evidence_gaps', {}).get('evidence_gaps', [])
            critical = [g for g in gaps if g.get('priority') == 'CRITICAL']
            if critical:
                critical_gaps.extend([
                    {
                        'condition': evidence_analysis.get('condition'),
                        'evidence': g.get('evidence_type'),
                        'how_to_obtain': g.get('how_to_obtain')
                    }
                    for g in critical
                ])
        
        if critical_gaps:
            actions.append({
                'priority': 'CRITICAL',
                'phase': 1,
                'action': 'Gather Critical Evidence',
                'tasks': critical_gaps,
                'timeline': '2-8 weeks'
            })
        
        # Action 2: File high-probability claims
        high_prob_claims = [
            claim for claim in strategy.get('recommended_claims', [])
            if claim.get('success_probability', 0) > 0.80
        ]
        
        if high_prob_claims:
            actions.append({
                'priority': 'HIGH',
                'phase': 2,
                'action': 'File High-Probability Claims',
                'tasks': [
                    {
                        'condition': c.get('condition'),
                        'success_rate': f"{c.get('success_probability') * 100:.0f}%",
                        'estimated_rating': f"{c.get('rating_estimate')}%"
                    }
                    for c in high_prob_claims
                ],
                'timeline': '1-2 weeks to file'
            })
        
        # Action 3: Develop secondary claims
        secondaries = strategy.get('secondary_conditions_analysis', {}).get('high_probability_secondaries', [])
        if secondaries:
            actions.append({
                'priority': 'MEDIUM',
                'phase': 3,
                'action': 'Develop Secondary Condition Claims',
                'tasks': [
                    {
                        'condition': s.get('condition'),
                        'primary': 'Requires primary to be service-connected first',
                        'nexus_strength': s.get('nexus_strength')
                    }
                    for s in secondaries[:3]  # Top 3
                ],
                'timeline': '4-12 months (after primary approval)'
            })
        
        strategy['action_plan'] = {
            'total_actions': len(actions),
            'phases': len(actions),
            'actions': actions,
            'estimated_total_timeline': '6-18 months'
        }
        
        return strategy


def run_strategy(veteran_data: dict) -> dict:
    """Execute claims strategy workflow"""
    workflow = ClaimsStrategyWorkflow()
    return workflow.execute(veteran_data)


if __name__ == '__main__':
    # Test workflow
    test_veteran = {
        'service_history': {
            'branch': 'Army',
            'mos': '11B',
            'dates': '2008-2012'
        },
        'deployments': ['Iraq 2010-2011'],
        'exposures': ['burn pit'],
        'combat_veteran': True,
        'current_conditions': [
            {'name': 'PTSD', 'severity': 'SEVERE', 'in_service_event': True},
            {'name': 'Tinnitus', 'severity': 'MODERATE', 'in_service_event': True}
        ],
        'disability_rating': 0,
        'service_connected_conditions': [],
        'marital_status': 'married',
        'dependents': {'children': [{'age': 10}, {'age': 7}]},
        'age': 35,
        'has_va_provider': False
    }
    
    workflow = ClaimsStrategyWorkflow()
    result = workflow.execute(test_veteran)
    
    import json
    print(json.dumps(result, indent=2))

