"""
CFR Interpreter - VA Code of Federal Regulations Engine
Interprets 38 CFR Parts 3 & 4 for disability ratings and eligibility
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import re


@dataclass
class RatingCriteria:
    """VA rating criteria for a condition"""
    diagnostic_code: str
    condition_name: str
    ratings: List[int]
    criteria_by_rating: Dict[int, str]
    special_considerations: List[str]
    bilateral_factor: bool = False
    pyramiding_concerns: List[str] = None


class CFRInterpreter:
    """
    Interprets VA Code of Federal Regulations (38 CFR)
    Provides rating criteria, eligibility rules, and legal guidance
    """
    
    # 38 CFR Part 4 - Schedule for Rating Disabilities
    DIAGNOSTIC_CODES = {
        # Mental Disorders (7000-7999)
        '9411': RatingCriteria(
            diagnostic_code='9411',
            condition_name='PTSD',
            ratings=[0, 10, 30, 50, 70, 100],
            criteria_by_rating={
                0: 'Diagnosed but symptoms not severe enough for compensable rating',
                10: 'Occupational/social impairment with mild/transient symptoms',
                30: 'Occasional decrease in work efficiency and periods of inability to perform occupational tasks',
                50: 'Occupational/social impairment with reduced reliability and productivity',
                70: 'Occupational/social impairment with deficiencies in most areas',
                100: 'Total occupational and social impairment'
            },
            special_considerations=[
                'Stressor verification required',
                'Combat veteran stressor verification liberalized',
                'MST claims have special evidentiary considerations'
            ]
        ),
        '6260': RatingCriteria(
            diagnostic_code='6260',
            condition_name='Tinnitus',
            ratings=[10],
            criteria_by_rating={
                10: 'Recurrent tinnitus'
            },
            special_considerations=[
                'Only one rating regardless of severity',
                'Bilateral tinnitus still rated at 10%',
                'Cannot be pyramided with hearing loss'
            ],
            bilateral_factor=False
        ),
        '6100': RatingCriteria(
            diagnostic_code='6100',
            condition_name='Hearing Loss',
            ratings=[0, 10],
            criteria_by_rating={
                0: 'Pure tone threshold not meeting minimum criteria',
                10: 'Pure tone threshold meeting Table VI criteria'
            },
            special_considerations=[
                'Requires audiology exam',
                'Bilateral hearing loss uses Table VI',
                'Speech recognition important'
            ],
            bilateral_factor=True
        ),
        '5003': RatingCriteria(
            diagnostic_code='5003',
            condition_name='='Arthritis (Degenerative)',
            ratings=[10, 20, 30, 40, 50, 60],
            criteria_by_rating={
                10: 'Limitation of motion of affected joint',
                20: 'Limitation of motion with pain on use',
                30: 'Limitation of motion with severe pain',
                40: 'Ankylosis or severe limitation',
                50: 'Ankylosis of major joint in unfavorable position',
                60: 'Unfavorable ankylosis of two major joints'
            },
            special_considerations=[
                'Measured by range of motion',
                'Pain on use increases rating',
                'Flare-ups considered'
            ],
            bilateral_factor=True
        ),
        '6847': RatingCriteria(
            diagnostic_code='6847',
            condition_name='Sleep Apnea',
            ratings=[0, 30, 50, 100],
            criteria_by_rating={
                0: 'Asymptomatic but with documented sleep disorder',
                30: 'Chronic daytime hypersomnolence',
                50: 'Requires use of breathing assistance device (CPAP)',
                100: 'Chronic respiratory failure with carbon dioxide retention or cor pulmonale'
            },
            special_considerations=[
                'Sleep study required',
                'CPAP use automatically qualifies for 50%',
                'Can be secondary to PTSD, obesity, etc.'
            ]
        ),
        '8045': RatingCriteria(
            diagnostic_code='8045',
            condition_name='Residuals of TBI',
            ratings=[0, 10, 40, 70, 100],
            criteria_by_rating={
                0: 'Normal neurological exam',
                10: 'Subjective symptoms only',
                40: 'Neurobehavioral effects with moderate impairment',
                70: 'Neurobehavioral effects with severe impairment',
                100: 'Total impairment with inability to communicate or care for self'
            },
            special_considerations=[
                'Requires neurological exam',
                'Cognitive testing important',
                'Multiple residuals can be rated separately'
            ]
        )
    }
    
    # Secondary condition medical causation chains
    SECONDARY_CAUSATION = {
        'PTSD': [
            {'condition': 'Sleep Apnea', 'causation': 'Hyperarousal and stress increase apnea risk', 'nexus_strength': 'STRONG'},
            {'condition': 'Hypertension', 'causation': 'Chronic stress elevates blood pressure', 'nexus_strength': 'MODERATE'},
            {'condition': 'IBS', 'causation': 'Stress affects gut-brain axis', 'nexus_strength': 'MODERATE'},
            {'condition': 'Erectile Dysfunction', 'causation': 'PTSD medications and psychological factors', 'nexus_strength': 'MODERATE'},
            {'condition': 'Obesity', 'causation': 'Reduced activity from avoidance behaviors', 'nexus_strength': 'WEAK'}
        ],
        'Diabetes': [
            {'condition': 'Peripheral Neuropathy', 'causation': 'Diabetes damages peripheral nerves', 'nexus_strength': 'STRONG'},
            {'condition': 'Retinopathy', 'causation': 'Diabetes damages retinal blood vessels', 'nexus_strength': 'STRONG'},
            {'condition': 'Erectile Dysfunction', 'causation': 'Vascular damage from diabetes', 'nexus_strength': 'STRONG'},
            {'condition': 'Nephropathy', 'causation': 'Diabetes damages kidney function', 'nexus_strength': 'STRONG'}
        ],
        'Back Pain': [
            {'condition': 'Radiculopathy', 'causation': 'Nerve compression from spine issues', 'nexus_strength': 'STRONG'},
            {'condition': 'Hip Pain', 'causation': 'Altered gait mechanics', 'nexus_strength': 'MODERATE'},
            {'condition': 'Knee Pain', 'causation': 'Compensatory movement patterns', 'nexus_strength': 'MODERATE'}
        ],
        'Knee Injury': [
            {'condition': 'Hip Pain', 'causation': 'Altered biomechanics', 'nexus_strength': 'MODERATE'},
            {'condition': 'Back Pain', 'causation': 'Compensatory posture changes', 'nexus_strength': 'MODERATE'},
            {'condition': 'Arthritis', 'causation': 'Joint instability leads to degeneration', 'nexus_strength': 'STRONG'}
        ]
    }
    
    # 38 CFR 3.350 - Special Monthly Compensation
    SMC_RULES = {
        'SMC-K': 'Loss or loss of use of creative organ',
        'SMC-L': 'Loss or loss of use of one foot or hand',
        'SMC-M': 'Loss or loss of use of both feet, hands, or combination',
        'SMC-S': 'Aid and Attendance - housebound'
    }
    
    def get_rating_criteria(self, condition: str) -> Optional[RatingCriteria]:
        """Get VA rating criteria for condition"""
        # Search by condition name
        for code, criteria in self.DIAGNOSTIC_CODES.items():
            if condition.lower() in criteria.condition_name.lower():
                return criteria
        return None
    
    def check_eligibility(self, condition: str, service_connection_type: str, 
                         veteran_data: Dict) -> Dict[str, Any]:
        """
        Check eligibility for VA compensation
        
        Returns:
            {
                'eligible': bool,
                'requirements_met': [...],
                'requirements_missing': [...],
                'legal_basis': str
            }
        """
        criteria = self.get_rating_criteria(condition)
        if not criteria:
            return {'eligible': False, 'reason': 'Condition not in rating schedule'}
        
        requirements_met = []
        requirements_missing = []
        
        # Check for current diagnosis
        if veteran_data.get('has_diagnosis'):
            requirements_met.append('Current diagnosis confirmed')
        else:
            requirements_missing.append('Current diagnosis required')
        
        # Check service connection requirements
        if service_connection_type == 'DIRECT':
            if veteran_data.get('in_service_event'):
                requirements_met.append('In-service injury/event documented')
            else:
                requirements_missing.append('In-service injury/event')
            
            if veteran_data.get('nexus'):
                requirements_met.append('Medical nexus established')
            else:
                requirements_missing.append('Medical nexus (IMO/DBQ)')
        
        elif service_connection_type == 'PRESUMPTIVE':
            requirements_met.append('Presumptive service connection applies')
            requirements_missing = []  # Presumptives don't need nexus
        
        elif service_connection_type == 'SECONDARY':
            if veteran_data.get('primary_service_connected'):
                requirements_met.append('Primary condition is service-connected')
            else:
                requirements_missing.append('Primary condition must be service-connected')
            
            if veteran_data.get('medical_causation'):
                requirements_met.append('Medical causation established')
            else:
                requirements_missing.append('Medical opinion on causation')
        
        eligible = len(requirements_missing) == 0
        
        return {
            'eligible': eligible,
            'requirements_met': requirements_met,
            'requirements_missing': requirements_missing,
            'legal_basis': f'38 CFR 4.{criteria.diagnostic_code}',
            'diagnostic_code': criteria.diagnostic_code
        }
    
    def get_secondary_conditions(self, primary_condition: str) -> List[Dict]:
        """Get potential secondary conditions for primary condition"""
        return self.SECONDARY_CAUSATION.get(primary_condition, [])
    
    def calculate_bilateral_factor(self, ratings: List[int]) -> int:
        """
        Calculate bilateral factor (38 CFR 4.26)
        Adds 10% of combined value when bilateral disabilities
        """
        if len(ratings) < 2:
            return 0
        
        # Combine bilateral ratings
        combined = ratings[0]
        for rating in ratings[1:]:
            combined = combined + (rating * (100 - combined) / 100)
        
        # Add 10% of combined value
        bilateral_factor = int(combined * 0.10)
        return bilateral_factor
    
    def interpret_cfr(self, cfr_section: str, context: str = '') -> Dict[str, Any]:
        """Parse and interpret CFR text"""
        # Extract rating percentages
        ratings = [int(x) for x in re.findall(r'(\d+)%', cfr_section)]
        
        # Extract diagnostic codes
        dc_matches = re.findall(r'Diagnostic Code (\d+)', cfr_section)
        
        return {
            'ratings_found': ratings,
            'diagnostic_codes': dc_matches,
            'interpretation': 'CFR section parsed',
            'context': context
        }


if __name__ == '__main__':
    # Test the interpreter
    interpreter = CFRInterpreter()
    
    # Test 1: Get rating criteria
    ptsd_criteria = interpreter.get_rating_criteria('PTSD')
    print(f"PTSD Ratings: {ptsd_criteria.ratings}")
    print(f"70% Criteria: {ptsd_criteria.criteria_by_rating[70]}")
    
    # Test 2: Check eligibility
    veteran = {
        'has_diagnosis': True,
        'in_service_event': True,
        'nexus': False
    }
    eligibility = interpreter.check_eligibility('PTSD', 'DIRECT', veteran)
    print(f"\nEligibility: {eligibility}")
    
    # Test 3: Secondary conditions
    secondaries = interpreter.get_secondary_conditions('PTSD')
    print(f"\nPTSD Secondary Conditions:")
    for sec in secondaries:
        print(f"  - {sec['condition']}: {sec['causation']}")
