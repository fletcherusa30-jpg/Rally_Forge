"""
Master AI Engine - Claims Strategy Orchestrator
Coordinates all AI components for optimal claims recommendations
"""

from typing import Dict, List, Any
from datetime import datetime
import json

from .claimstrategyengine import ClaimsStrategyEngine
from .cfr_interpreter import CFRInterpreter
from .evidence_inference import EvidenceInferenceEngine
from .secondaryconditionmapper import SecondaryConditionMapper
from .entitlement_engine import EntitlementEngine


class MasterClaimsEngine:
    """
    Orchestrates all claims strategy components
    """
    
    def __init__(self):
        self.strategy_engine = ClaimsStrategyEngine()
        self.cfr_interpreter = CFRInterpreter()
        self.evidence_engine = EvidenceInferenceEngine()
        self.secondary_mapper = SecondaryConditionMapper()
        self.entitlement_engine = EntitlementEngine()
    
    def analyze_veteran_profile(self, veteran_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Complete analysis of veteran profile for optimal claims strategy
        
        Args:
            veteran_data: Complete veteran profile including service history,
                         medical records, exposures, deployments
        
        Returns:
            Comprehensive strategy with prioritized claims, evidence gaps,
            secondary conditions, and estimated benefits
        """
        
        # 1. Generate base strategy
        base_strategy = self.strategy_engine.generate_comprehensive_strategy(veteran_data)
        
        # 2. Identify secondary conditions
        secondaries = self.secondary_mapper.map_all_secondaries(
            base_strategy.get('recommended_claims', [])
        )
        
        # 3. Analyze evidence gaps
        evidence_analysis = self.evidence_engine.analyze_all_claims(
            base_strategy.get('recommended_claims', []),
            veteran_data.get('medical_records', [])
        )
        
        # 4. Check eligibility and calculate benefits
        entitlements = self.entitlement_engine.calculate_total_benefits(
            base_strategy.get('recommended_claims', []),
            veteran_data
        )
        
        # 5. Build final comprehensive strategy
        return {
            'timestamp': datetime.now().isoformat(),
            'veteran_id': veteran_data.get('id'),
            'analysis': {
                'primary_claims': base_strategy.get('recommended_claims', []),
                'secondary_claims': secondaries,
                'total_claims': len(base_strategy.get('recommended_claims', [])) + len(secondaries),
                'success_probability': base_strategy.get('overall_success_rate', 0.0)
            },
            'strategy': base_strategy,
            'evidence_gaps': evidence_analysis,
            'projected_benefits': entitlements,
            'next_steps': self._generate_action_plan(base_strategy, evidence_analysis),
            'timeline': self._estimate_timeline(base_strategy)
        }
    
    def _generate_action_plan(self, strategy: Dict, evidence: Dict) -> List[Dict]:
        """Generate prioritized action plan"""
        actions = []
        
        # Critical evidence gathering
        for gap in evidence.get('critical_gaps', []):
            actions.append({
                'priority': 'CRITICAL',
                'action': f"Obtain {gap['evidence_type']}",
                'for_claim': gap['claim'],
                'deadline': '30 days'
            })
        
        # File high-probability claims first
        for claim in strategy.get('recommended_claims', []):
            if claim.get('success_probability', 0) > 0.75:
                actions.append({
                    'priority': 'HIGH',
                    'action': f"File claim for {claim['condition']}",
                    'success_rate': f"{claim.get('success_probability', 0)*100:.0f}%",
                    'deadline': '60 days'
                })
        
        return sorted(actions, key=lambda x: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2}.get(x['priority'], 3))
    
    def _estimate_timeline(self, strategy: Dict) -> Dict:
        """Estimate timeline for claims process"""
        claim_count = len(strategy.get('recommended_claims', []))
        
        return {
            'evidence_gathering': '1-3 months',
            'nexus_letters': '1-2 months',
            'filing': '1 week',
            'va_review': '3-12 months',
            'total_estimate': '6-18 months',
            'expedited_options': claim_count <= 3
        }


def run_engine(veteran_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for claims strategy engine
    
    Args:
        veteran_data: Complete veteran profile
        
    Returns:
        Comprehensive claims strategy and recommendations
    """
    engine = MasterClaimsEngine()
    return engine.analyze_veteran_profile(veteran_data)

