"""
Secondary Condition Mapper
Maps primary service-connected conditions to potential secondary conditions
Calculates combined ratings and identifies SMC eligibility
"""

from typing import Dict, List, Any, Tuple
from dataclasses import dataclass


@dataclass
class SecondaryCondition:
    """Potential secondary condition from primary"""
    condition_name: str
    medical_causation: str
    nexus_strength: str  # 'STRONG', 'MODERATE', 'WEAK'
    research_citations: List[str]
    typical_rating: int
    success_probability: float
    required_evidence: List[str]


class SecondaryConditionMapper:
    """
    Maps primary conditions to potential secondary conditions
    Provides medical causation chains and evidence requirements
    """
    
    # Comprehensive secondary condition mappings with medical causation
    SECONDARY_MAP = {
        'PTSD': [
            SecondaryCondition(
                condition_name='Sleep Apnea',
                medical_causation='PTSD causes hyperarousal and chronic stress, leading to disrupted sleep patterns and increased risk of obstructive sleep apnea. Nightmares and hypervigilance prevent deep restorative sleep.',
                nexus_strength='STRONG',
                research_citations=[
                    'Sleep and PTSD: Links and Mutual Maintenance (Journal of Clinical Sleep Medicine 2018)',
                    'VA recognizes PTSD-Sleep Apnea connection (BVA decisions)'
                ],
                typical_rating=50,  # CPAP use
                success_probability=0.80,
                required_evidence=[
                    'Sleep study showing sleep apnea',
                    'Mental health records documenting PTSD',
                    'Nexus letter linking PTSD to sleep disruption',
                    'CPAP prescription if using'
                ]
            ),
            SecondaryCondition(
                condition_name='Hypertension',
                medical_causation='Chronic stress from PTSD activates sympathetic nervous system, elevating blood pressure. Hyperarousal state maintains elevated BP even at rest.',
                nexus_strength='MODERATE',
                research_citations=[
                    'PTSD and Cardiovascular Disease (Circulation 2013)',
                    'Stress-induced hypertension pathways'
                ],
                typical_rating=10,
                success_probability=0.65,
                required_evidence=[
                    'Blood pressure readings showing hypertension',
                    'Cardiology records',
                    'Nexus explaining stress-BP connection',
                    'Timeline showing hypertension after PTSD'
                ]
            ),
            SecondaryCondition(
                condition_name='IBS (Irritable Bowel Syndrome)',
                medical_causation='Gut-brain axis: PTSD affects enteric nervous system. Chronic stress alters gut motility and increases visceral sensitivity.',
                nexus_strength='MODERATE',
                research_citations=[
                    'Gut-brain axis in PTSD (Neurogastroenterology 2017)',
                    'IBS prevalence in PTSD veterans'
                ],
                typical_rating=10,
                success_probability=0.60,
                required_evidence=[
                    'GI diagnosis (IBS)',
                    'Gastroenterologist records',
                    'Nexus linking stress to GI symptoms'
                ]
            ),
            SecondaryCondition(
                condition_name='Erectile Dysfunction',
                medical_causation='PTSD medications (SSRIs) commonly cause ED. Psychological factors (anxiety, depression) also contribute. Autonomic dysfunction from chronic stress.',
                nexus_strength='MODERATE',
                research_citations=[
                    'SSRI-induced sexual dysfunction (JAMA Psychiatry)',
                    'PTSD and sexual health (J Sexual Medicine)'
                ],
                typical_rating=0,  # Usually SMC-K
                success_probability=0.70,
                required_evidence=[
                    'Urologist diagnosis',
                    'Medication list showing SSRIs',
                    'Nexus linking PTSD/meds to ED'
                ]
            ),
            SecondaryCondition(
                condition_name='Migraine Headaches',
                medical_causation='PTSD-related stress and muscle tension trigger migraines. Sleep disruption is migraine trigger. Comorbid with TBI in many veterans.',
                nexus_strength='MODERATE',
                research_citations=[
                    'Migraine prevalence in PTSD (Headache Journal)',
                    'Stress as migraine trigger'
                ],
                typical_rating=30,
                success_probability=0.65,
                required_evidence=[
                    'Migraine diagnosis',
                    'Headache frequency logs',
                    'Nexus linking PTSD stress to headaches'
                ]
            )
        ],
        
        'Diabetes Type 2': [
            SecondaryCondition(
                condition_name='Peripheral Neuropathy',
                medical_causation='Diabetes damages peripheral nerves through chronic hyperglycemia. Leads to numbness, tingling, pain in extremities.',
                nexus_strength='STRONG',
                research_citations=[
                    'Diabetic neuropathy pathophysiology (Diabetes Care)',
                    'VA presumes diabetic neuropathy'
                ],
                typical_rating=20,
                success_probability=0.95,
                required_evidence=[
                    'Neuropathy diagnosis',
                    'EMG/nerve conduction studies',
                    'Diabetes treatment records'
                ]
            ),
            SecondaryCondition(
                condition_name='Diabetic Retinopathy',
                medical_causation='Diabetes damages retinal blood vessels, leading to vision impairment or blindness.',
                nexus_strength='STRONG',
                research_citations=['Diabetic retinopathy guidelines (AAO)'],
                typical_rating=30,
                success_probability=0.95,
                required_evidence=[
                    'Ophthalmology exam showing retinopathy',
                    'Retinal photos/scans',
                    'Diabetes treatment records'
                ]
            ),
            SecondaryCondition(
                condition_name='Erectile Dysfunction',
                medical_causation='Diabetes causes vascular and nerve damage affecting erectile function.',
                nexus_strength='STRONG',
                research_citations=['Diabetes and ED (J Urology)'],
                typical_rating=0,  # SMC-K
                success_probability=0.90,
                required_evidence=['Urologist diagnosis', 'Diabetes records']
            ),
            SecondaryCondition(
                condition_name='Chronic Kidney Disease',
                medical_causation='Diabetes damages kidney filtering units (nephrons), leading to progressive kidney dysfunction.',
                nexus_strength='STRONG',
                research_citations=['Diabetic nephropathy (KDIGO guidelines)'],
                typical_rating=40,
                success_probability=0.95,
                required_evidence=[
                    'Nephrology records',
                    'GFR/creatinine labs showing kidney damage',
                    'Diabetes treatment history'
                ]
            )
        ],
        
        'Knee Injury/Arthritis': [
            SecondaryCondition(
                condition_name='Hip Arthritis',
                medical_causation='Altered gait from knee injury causes abnormal hip biomechanics, accelerating hip joint degeneration.',
                nexus_strength='MODERATE',
                research_citations=['Compensatory gait patterns (J Orthopedic Research)'],
                typical_rating=20,
                success_probability=0.70,
                required_evidence=[
                    'Hip X-rays showing arthritis',
                    'Orthopedic exam',
                    'Gait analysis or biomechanics assessment',
                    'Nexus linking knee injury to hip problems'
                ]
            ),
            SecondaryCondition(
                condition_name='Lower Back Pain',
                medical_causation='Altered biomechanics from knee injury causes compensatory lumbar spine stress and muscle imbalance.',
                nexus_strength='MODERATE',
                research_citations=['Kinetic chain dysfunction'],
                typical_rating=20,
                success_probability=0.65,
                required_evidence=[
                    'Spine X-rays/MRI',
                    'Physical therapy records showing compensatory patterns',
                    'Nexus opinion'
                ]
            )
        ],
        
        'Back Injury/Arthritis': [
            SecondaryCondition(
                condition_name='Radiculopathy',
                medical_causation='Nerve root compression from spine degeneration causes radiating pain, numbness, weakness in arms/legs.',
                nexus_strength='STRONG',
                research_citations=['Lumbar radiculopathy pathophysiology'],
                typical_rating=20,
                success_probability=0.85,
                required_evidence=[
                    'MRI showing nerve compression',
                    'EMG/nerve conduction studies',
                    'Neurology exam'
                ]
            ),
            SecondaryCondition(
                condition_name='Hip Pain',
                medical_causation='Altered gait mechanics from back pain lead to hip joint stress.',
                nexus_strength='MODERATE',
                research_citations=['Lumbopelvic biomechanics'],
                typical_rating=20,
                success_probability=0.60,
                required_evidence=['Hip imaging', 'Gait assessment', 'Nexus opinion']
            )
        ],
        
        'TBI (Traumatic Brain Injury)': [
            SecondaryCondition(
                condition_name='Migraine Headaches',
                medical_causation='Post-traumatic headaches are common TBI residual. Brain injury damages pain regulation pathways.',
                nexus_strength='STRONG',
                research_citations=['Post-concussive syndrome (Neurology)'],
                typical_rating=30,
                success_probability=0.90,
                required_evidence=[
                    'Headache diagnosis',
                    'TBI medical records',
                    'Frequency/severity logs'
                ]
            ),
            SecondaryCondition(
                condition_name='Cognitive Dysfunction',
                medical_causation='TBI causes memory, concentration, and executive function deficits.',
                nexus_strength='STRONG',
                research_citations=['TBI cognitive sequelae'],
                typical_rating=30,
                success_probability=0.85,
                required_evidence=[
                    'Neuropsychological testing',
                    'Cognitive assessment scores',
                    'TBI documentation'
                ]
            ),
            SecondaryCondition(
                condition_name='Depression/Anxiety',
                medical_causation='TBI affects emotional regulation centers. Organic brain changes cause mood disorders.',
                nexus_strength='STRONG',
                research_citations=['TBI and mental health comorbidity'],
                typical_rating=30,
                success_probability=0.80,
                required_evidence=[
                    'Mental health diagnosis',
                    'Psychiatric records',
                    'TBI medical records'
                ]
            )
        ]
    }
    
    def map_secondary_conditions(self, primary_condition: str, 
                                 primary_rating: int = 0) -> Dict[str, Any]:
        """
        Map primary condition to potential secondary conditions
        
        Args:
            primary_condition: Service-connected primary condition
            primary_rating: Current rating for primary (0-100)
        
        Returns:
            Dictionary with secondary conditions and combined rating estimate
        """
        # Find matching primary
        secondaries = []
        for key, conditions in self.SECONDARY_MAP.items():
            if primary_condition.lower() in key.lower():
                secondaries = conditions
                break
        
        if not secondaries:
            return {
                'primary_condition': primary_condition,
                'secondary_conditions': [],
                'message': 'No common secondary conditions found for this primary'
            }
        
        # Sort by success probability
        secondaries.sort(key=lambda x: x.success_probability, reverse=True)
        
        # Calculate potential combined rating
        all_ratings = [primary_rating] + [s.typical_rating for s in secondaries]
        combined = self.calculate_combined_rating(all_ratings)
        
        return {
            'primary_condition': primary_condition,
            'primary_rating': primary_rating,
            'secondary_conditions': [self._secondary_to_dict(s) for s in secondaries],
            'total_secondary_count': len(secondaries),
            'high_probability_count': len([s for s in secondaries if s.success_probability > 0.75]),
            'potential_combined_rating': combined,
            'rating_increase_potential': combined - primary_rating,
            'recommendations': self._generate_secondary_recommendations(secondaries)
        }
    
    def calculate_combined_rating(self, ratings: List[int]) -> int:
        """
        Calculate VA combined rating using VA math (38 CFR 4.25)
        Combines multiple disability ratings into single rating
        """
        if not ratings or all(r == 0 for r in ratings):
            return 0
        
        # Filter out zeros and sort descending
        non_zero = sorted([r for r in ratings if r > 0], reverse=True)
        
        if not non_zero:
            return 0
        
        # Start with highest rating
        combined = non_zero[0]
        
        # VA math: each additional rating adds to the "efficiency" remaining
        for rating in non_zero[1:]:
            efficiency_remaining = 100 - combined
            combined += (rating * efficiency_remaining / 100)
        
        # Round to nearest 10
        return int(round(combined / 10) * 10)
    
    def calculate_bilateral_factor(self, left_rating: int, right_rating: int) -> int:
        """
        Calculate bilateral factor (38 CFR 4.26)
        When same body parts on both sides are affected
        """
        # First combine the bilateral ratings
        combined = self.calculate_combined_rating([left_rating, right_rating])
        
        # Add 10% of combined value as bilateral factor
        bilateral_bonus = int(combined * 0.10)
        
        # Add bonus to combined
        final = combined + bilateral_bonus
        
        # Round to nearest 10
        return int(round(final / 10) * 10)
    
    def _generate_secondary_recommendations(self, secondaries: List[SecondaryCondition]) -> List[str]:
        """Generate action recommendations"""
        recs = []
        
        high_prob = [s for s in secondaries if s.success_probability > 0.75]
        if high_prob:
            recs.append(f'PRIORITY: File for {high_prob[0].condition_name} - {high_prob[0].nexus_strength} medical connection')
        
        strong_nexus = [s for s in secondaries if s.nexus_strength == 'STRONG']
        if strong_nexus:
            recs.append(f'{len(strong_nexus)} condition(s) with STRONG medical causation - excellent approval odds')
        
        recs.append('Get Independent Medical Opinion (IMO) to establish causation for secondary claims')
        recs.append('File secondaries as separate claims referencing primary condition')
        
        return recs
    
    def _secondary_to_dict(self, sec: SecondaryCondition) -> Dict:
        """Convert SecondaryCondition to dict"""
        return {
            'condition': sec.condition_name,
            'medical_causation': sec.medical_causation,
            'nexus_strength': sec.nexus_strength,
            'research_support': sec.research_citations,
            'typical_rating': sec.typical_rating,
            'success_probability': sec.success_probability,
            'required_evidence': sec.required_evidence
        }


if __name__ == '__main__':
    # Test the mapper
    mapper = SecondaryConditionMapper()
    
    # Test 1: PTSD secondaries
    result = mapper.map_secondary_conditions('PTSD', primary_rating=70)
    import json
    print("PTSD Secondary Mapping:")
    print(json.dumps(result, indent=2))
    
    # Test 2: Combined rating calculation
    ratings = [70, 50, 30, 10, 10]
    combined = mapper.calculate_combined_rating(ratings)
    print(f"\nCombined Rating for {ratings}: {combined}%")
    
    # Test 3: Bilateral factor
    bilateral = mapper.calculate_bilateral_factor(30, 20)
    print(f"\nBilateral Factor (30% + 20%): {bilateral}%")
