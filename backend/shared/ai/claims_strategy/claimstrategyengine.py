"""
Advanced Claims Strategy Engine
Uses AI/ML to generate optimal VA claims strategies
"""

from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
import re


@dataclass
class ClaimRecommendation:
    """Recommended VA claim with supporting analysis"""
    condition: str
    rating_estimate: int
    success_probability: float
    evidence_strength: str  # 'STRONG', 'MODERATE', 'WEAK'
    service_connection_type: str  # 'DIRECT', 'SECONDARY', 'PRESUMPTIVE'
    nexus_required: bool
    priority_score: float  # 0-100
    reasoning: List[str]
    required_evidence: List[str]
    timeline_estimate: str


class ClaimsStrategyEngine:
    """
    Advanced AI-powered claims strategy engine
    Analyzes veteran profile to recommend optimal claims
    """
    
    # VA rating percentages for common conditions
    RATING_SCALE = {
        'PTSD': [0, 10, 30, 50, 70, 100],
        'Tinnitus': [10],
        'Hearing Loss': [0, 10],
        'Back Pain': [10, 20, 40, 60],
        'Knee Pain': [10, 20, 30, 40, 50],
        'Sleep Apnea': [0, 30, 50, 100],
        'Headaches/Migraines': [0, 10, 30, 50],
        'TBI': [0, 10, 40, 70, 100],
        'Hypertension': [10, 20, 40, 60],
        'Diabetes': [10, 20, 40, 60, 100],
        'IBS': [10, 30],
        'Depression': [0, 10, 30, 50, 70, 100],
        'Anxiety': [0, 10, 30, 50, 70, 100]
    }
    
    # Toxic exposure presumptives
    BURN_PIT_CONDITIONS = [
        'Asthma', 'Rhinitis', 'Sinusitis', 'Chronic Bronchitis',
        'COPD', 'Constrictive Bronchiolitis', 'Emphysema',
        'Granulomatous Disease', 'ILD', 'Pleuritis', 'Pulmonary Fibrosis',
        'Sarcoidosis', 'Head/Neck Cancer', 'Brain Cancer', 'Gastrointestinal Cancer',
        'Glioblastoma', 'Kidney Cancer', 'Lymphoma', 'Melanoma',
        'Pancreatic Cancer', 'Reproductive Cancer', 'Respiratory Cancer'
    ]
    
    AGENT_ORANGE_CONDITIONS = [
        'AL Amyloidosis', 'Chloracne', 'Chronic B-cell Leukemia',
        'Diabetes Type 2', 'Hodgkin\'s Disease', 'Ischemic Heart Disease',
        'Multiple Myeloma', 'Non-Hodgkin\'s Lymphoma', 'Parkinson\'s Disease',
        'Peripheral Neuropathy', 'Porphyria Cutanea Tarda', 'Prostate Cancer',
        'Respiratory Cancers', 'Soft Tissue Sarcomas'
    ]
    
    def generate_comprehensive_strategy(self, veteran_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate complete claims strategy with AI-powered analysis
        
        Args:
            veteran_data: {
                'service_history': {...},
                'medical_records': [...],
                'deployments': [...],
                'exposures': [...],
                'current_conditions': [...],
                'disability_rating': int,
                'service_connected_conditions': [...]
            }
        
        Returns:
            Comprehensive strategy with prioritized recommendations
        """
        
        recommendations = []
        
        # 1. Analyze current symptoms for potential claims
        recommendations.extend(self._analyze_current_symptoms(veteran_data))
        
        # 2. Check for presumptive conditions
        recommendations.extend(self._check_presumptives(veteran_data))
        
        # 3. Identify rating increases for existing conditions
        recommendations.extend(self._identify_increases(veteran_data))
        
        # 4. Analyze service records for additional connections
        recommendations.extend(self._analyze_service_connections(veteran_data))
        
        # 5. Prioritize all recommendations
        prioritized = self._prioritize_claims(recommendations)
        
        # 6. Calculate overall success metrics
        success_rate = self._calculate_overall_success(prioritized)
        combined_rating = self._estimate_combined_rating(prioritized)
        
        return {
            'recommended_claims': [self._claim_to_dict(c) for c in prioritized],
            'total_claims': len(prioritized),
            'high_priority_count': len([c for c in prioritized if c.priority_score >= 80]),
            'overall_success_rate': success_rate,
            'estimated_combined_rating': combined_rating,
            'current_rating': veteran_data.get('disability_rating', 0),
            'potential_increase': combined_rating - veteran_data.get('disability_rating', 0),
            'strategy_confidence': 'HIGH' if success_rate > 0.7 else 'MODERATE' if success_rate > 0.5 else 'LOW',
            'analysis_timestamp': datetime.now().isoformat()
        }
    
    def _analyze_current_symptoms(self, veteran_data: Dict) -> List[ClaimRecommendation]:
        """Analyze current symptoms and medical records for claimable conditions"""
        claims = []
        symptoms = veteran_data.get('current_conditions', [])
        
        for symptom in symptoms:
            condition = symptom.get('name', '')
            
            # Check if condition is ratable
            if condition in self.RATING_SCALE:
                severity = symptom.get('severity', 'MODERATE')
                evidence = symptom.get('medical_documentation', [])
                
                # Estimate rating based on severity
                rating = self._estimate_rating(condition, severity)
                
                # Calculate success probability
                success = self._calculate_success_probability(
                    evidence_count=len(evidence),
                    in_service_event=bool(symptom.get('in_service_event')),
                    continuity_of_treatment=bool(symptom.get('treatment_history'))
                )
                
                claims.append(ClaimRecommendation(
                    condition=condition,
                    rating_estimate=rating,
                    success_probability=success,
                    evidence_strength='STRONG' if len(evidence) >= 3 else 'MODERATE' if len(evidence) >= 1 else 'WEAK',
                    service_connection_type='DIRECT',
                    nexus_required=not symptom.get('in_service_event'),
                    priority_score=self._calculate_priority(rating, success),
                    reasoning=[
                        f"Current diagnosis of {condition}",
                        f"Estimated {rating}% rating based on {severity} severity",
                        f"{'Evidence on file' if evidence else 'Evidence needed'}"
                    ],
                    required_evidence=self._get_required_evidence(condition),
                    timeline_estimate='4-8 months'
                ))
        
        return claims
    
    def _check_presumptives(self, veteran_data: Dict) -> List[ClaimRecommendation]:
        """Check for presumptive conditions based on exposures"""
        claims = []
        exposures = veteran_data.get('exposures', [])
        deployments = veteran_data.get('deployments', [])
        
        # Check burn pit exposure
        if any('burn pit' in str(e).lower() or 'iraq' in str(d).lower() or 'afghanistan' in str(d).lower() 
               for e in exposures for d in deployments):
            
            # Automatically qualify for burn pit conditions
            for condition in self.BURN_PIT_CONDITIONS:
                if self._veteran_has_symptoms(veteran_data, condition):
                    claims.append(ClaimRecommendation(
                        condition=condition,
                        rating_estimate=self._get_default_rating(condition),
                        success_probability=0.95,  # Presumptive = high success
                        evidence_strength='STRONG',
                        service_connection_type='PRESUMPTIVE',
                        nexus_required=False,
                        priority_score=95.0,
                        reasoning=[
                            f"PACT Act presumptive condition",
                            f"Burn pit exposure documented",
                            f"No nexus required - automatic service connection"
                        ],
                        required_evidence=[
                            'Current diagnosis',
                            'Deployment records (already qualifying)'
                        ],
                        timeline_estimate='3-6 months'
                    ))
        
        # Check Agent Orange exposure
        if any('vietnam' in str(d).lower() or 'agent orange' in str(e).lower() 
               for e in exposures for d in deployments):
            
            for condition in self.AGENT_ORANGE_CONDITIONS:
                if self._veteran_has_symptoms(veteran_data, condition):
                    claims.append(ClaimRecommendation(
                        condition=condition,
                        rating_estimate=self._get_default_rating(condition),
                        success_probability=0.95,
                        evidence_strength='STRONG',
                        service_connection_type='PRESUMPTIVE',
                        nexus_required=False,
                        priority_score=95.0,
                        reasoning=[
                            f"Agent Orange presumptive condition",
                            f"Vietnam service documented",
                            f"Automatic service connection"
                        ],
                        required_evidence=['Current diagnosis'],
                        timeline_estimate='3-6 months'
                    ))
        
        return claims
    
    def _identify_increases(self, veteran_data: Dict) -> List[ClaimRecommendation]:
        """Identify potential rating increases for existing service-connected conditions"""
        claims = []
        existing = veteran_data.get('service_connected_conditions', [])
        
        for condition in existing:
            current_rating = condition.get('current_rating', 0)
            condition_name = condition.get('name')
            
            # Check if symptoms have worsened
            if condition.get('symptoms_worsened', False):
                # Estimate higher rating
                possible_ratings = self.RATING_SCALE.get(condition_name, [])
                higher_ratings = [r for r in possible_ratings if r > current_rating]
                
                if higher_ratings:
                    new_rating = higher_ratings[0]
                    
                    claims.append(ClaimRecommendation(
                        condition=f"{condition_name} (Increase)",
                        rating_estimate=new_rating,
                        success_probability=0.75,
                        evidence_strength='MODERATE',
                        service_connection_type='INCREASE',
                        nexus_required=False,
                        priority_score=85.0,
                        reasoning=[
                            f"Current {current_rating}% rating",
                            f"Symptoms worsened",
                            f"May qualify for {new_rating}%"
                        ],
                        required_evidence=[
                            'Recent medical exams showing worsening',
                            'Doctor statement on increased limitations',
                            'Employment/daily life impact documentation'
                        ],
                        timeline_estimate='6-12 months'
                    ))
        
        return claims
    
    def _analyze_service_connections(self, veteran_data: Dict) -> List[ClaimRecommendation]:
        """Analyze service records for additional potential connections"""
        claims = []
        
        # Check for combat-related conditions
        if veteran_data.get('combat_veteran', False):
            combat_conditions = ['PTSD', 'TBI', 'Tinnitus', 'Hearing Loss']
            
            for condition in combat_conditions:
                if self._veteran_has_symptoms(veteran_data, condition):
                    claims.append(ClaimRecommendation(
                        condition=condition,
                        rating_estimate=self._get_default_rating(condition),
                        success_probability=0.85,
                        evidence_strength='STRONG',
                        service_connection_type='DIRECT',
                        nexus_required=False,  # Combat vet credibility
                        priority_score=90.0,
                        reasoning=[
                            f"Combat veteran status",
                            f"Combat-related {condition}",
                            f"High approval rate for combat vets"
                        ],
                        required_evidence=[
                            'DD-214 showing combat',
                            'Current diagnosis',
                            'Lay statement'
                        ],
                        timeline_estimate='4-8 months'
                    ))
        
        return claims
    
    def _prioritize_claims(self, claims: List[ClaimRecommendation]) -> List[ClaimRecommendation]:
        """Sort claims by priority score"""
        return sorted(claims, key=lambda x: x.priority_score, reverse=True)
    
    def _calculate_priority(self, rating: int, success_prob: float) -> float:
        """Calculate priority score (0-100)"""
        return (rating * 0.4) + (success_prob * 100 * 0.6)
    
    def _estimate_rating(self, condition: str, severity: str) -> int:
        """Estimate VA rating based on condition and severity"""
        ratings = self.RATING_SCALE.get(condition, [0])
        
        severity_map = {
            'MILD': 0.2,
            'MODERATE': 0.5,
            'SEVERE': 0.8,
            'VERY_SEVERE': 1.0
        }
        
        index = int(len(ratings) * severity_map.get(severity, 0.5))
        index = min(index, len(ratings) - 1)
        
        return ratings[index]
    
    def _calculate_success_probability(self, evidence_count: int, in_service_event: bool, 
                                      continuity_of_treatment: bool) -> float:
        """Calculate probability of claim success (0-1)"""
        base = 0.3
        
        if evidence_count >= 3:
            base += 0.3
        elif evidence_count >= 1:
            base += 0.15
        
        if in_service_event:
            base += 0.25
        
        if continuity_of_treatment:
            base += 0.15
        
        return min(base, 0.99)
    
    def _calculate_overall_success(self, claims: List[ClaimRecommendation]) -> float:
        """Calculate overall success rate"""
        if not claims:
            return 0.0
        return sum(c.success_probability for c in claims) / len(claims)
    
    def _estimate_combined_rating(self, claims: List[ClaimRecommendation]) -> int:
        """Estimate combined VA rating using VA math"""
        if not claims:
            return 0
        
        ratings = sorted([c.rating_estimate for c in claims], reverse=True)
        combined = ratings[0]
        
        for rating in ratings[1:]:
            combined = combined + (rating * (100 - combined) / 100)
        
        # Round to nearest 10
        return int(round(combined / 10) * 10)
    
    def _get_required_evidence(self, condition: str) -> List[str]:
        """Get required evidence for condition"""
        common = [
            'Current diagnosis from VA or private doctor',
            'Medical records showing treatment',
            'Lay statement describing symptoms'
        ]
        
        condition_specific = {
            'PTSD': ['Stressor statement', 'Mental health records', 'Buddy statements'],
            'Tinnitus': ['Audiology exam', 'Loud noise exposure documentation'],
            'Sleep Apnea': ['Sleep study results', 'CPAP prescription'],
            'TBI': ['Head injury documentation', 'Neurological exam results']
        }
        
        return common + condition_specific.get(condition, [])
    
    def _get_default_rating(self, condition: str) -> int:
        """Get typical starting rating for condition"""
        ratings = self.RATING_SCALE.get(condition, [10])
        return ratings[len(ratings) // 2] if len(ratings) > 1 else ratings[0]
    
    def _veteran_has_symptoms(self, veteran_data: Dict, condition: str) -> bool:
        """Check if veteran reports symptoms of condition"""
        symptoms = veteran_data.get('current_conditions', [])
        condition_lower = condition.lower()
        
        return any(condition_lower in str(s.get('name', '')).lower() 
                  for s in symptoms)
    
    def _claim_to_dict(self, claim: ClaimRecommendation) -> Dict:
        """Convert claim recommendation to dictionary"""
        return {
            'condition': claim.condition,
            'rating_estimate': claim.rating_estimate,
            'success_probability': claim.success_probability,
            'evidence_strength': claim.evidence_strength,
            'service_connection_type': claim.service_connection_type,
            'nexus_required': claim.nexus_required,
            'priority_score': claim.priority_score,
            'reasoning': claim.reasoning,
            'required_evidence': claim.required_evidence,
            'timeline_estimate': claim.timeline_estimate
        }


# Legacy function for backward compatibility
def generate_strategy(veteran_data: dict) -> dict:
    """Legacy interface - use ClaimsStrategyEngine directly"""
    engine = ClaimsStrategyEngine()
    return engine.generate_comprehensive_strategy(veteran_data)


if __name__ == '__main__':
    # Test with sample data
    sample_data = {
        'service_history': {'branch': 'Army', 'mos': '11B'},
        'medical_records': [],
        'deployments': ['Iraq 2010-2011'],
        'exposures': ['burn pit'],
        'current_conditions': [
            {'name': 'Tinnitus', 'severity': 'MODERATE', 'in_service_event': True},
            {'name': 'PTSD', 'severity': 'SEVERE', 'medical_documentation': ['doc1', 'doc2']},
        ],
        'disability_rating': 0,
        'service_connected_conditions': [],
        'combat_veteran': True
    }
    
    engine = ClaimsStrategyEngine()
    result = engine.generate_comprehensive_strategy(sample_data)
    
    import json
    print(json.dumps(result, indent=2))
