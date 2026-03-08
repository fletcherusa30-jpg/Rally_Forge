"""
Veteran Profile Workflow
Analyzes and enriches veteran profiles for claims processing
"""

from typing import Dict, List, Any
from datetime import datetime
import re


class VeteranProfileWorkflow:
    """
    Analyzes veteran profiles to extract relevant information
    for claims strategy generation
    """
    
    @staticmethod
    def validate_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate veteran profile has required fields
        
        Returns:
            {
                'valid': bool,
                'missing_fields': [],
                'warnings': []
            }
        """
        required_fields = [
            'service_history',
            'deployments',
            'current_conditions'
        ]
        
        recommended_fields = [
            'exposures',
            'disability_rating',
            'service_connected_conditions',
            'age'
        ]
        
        missing = [f for f in required_fields if f not in profile]
        missing_recommended = [f for f in recommended_fields if f not in profile]
        
        return {
            'valid': len(missing) == 0,
            'missing_required': missing,
            'missing_recommended': missing_recommended,
            'completeness_score': (
                (len(required_fields) - len(missing) + 
                 len(recommended_fields) - len(missing_recommended)) / 
                (len(required_fields) + len(recommended_fields)) * 100
            )
        }
    
    @staticmethod
    def enrich_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich profile with derived information
        
        Args:
            profile: Raw veteran profile
        
        Returns:
            Enriched profile with additional computed fields
        """
        enriched = profile.copy()
        
        # Detect combat veteran status
        if 'combat_veteran' not in enriched:
            enriched['combat_veteran'] = VeteranProfileWorkflow._detect_combat_status(profile)
        
        # Detect toxic exposures
        if 'exposures' not in enriched:
            enriched['exposures'] = VeteranProfileWorkflow._detect_exposures(profile)
        
        # Calculate service years
        if 'service_years' not in enriched:
            enriched['service_years'] = VeteranProfileWorkflow._calculate_service_years(profile)
        
        # Identify era of service
        enriched['service_era'] = VeteranProfileWorkflow._identify_service_era(profile)
        
        # Risk assessment
        enriched['risk_factors'] = VeteranProfileWorkflow._assess_risk_factors(profile)
        
        return enriched
    
    @staticmethod
    def _detect_combat_status(profile: Dict) -> bool:
        """Detect if veteran likely saw combat"""
        deployments = profile.get('deployments', [])
        
        combat_locations = [
            'iraq', 'afghanistan', 'vietnam', 'korea', 'gulf war',
            'desert storm', 'desert shield', 'oef', 'oif', 'ond'
        ]
        
        for deployment in deployments:
            if any(loc in str(deployment).lower() for loc in combat_locations):
                return True
        
        # Check MOS (combat MOSs)
        mos = profile.get('service_history', {}).get('mos', '')
        combat_mos = ['11', '03', '18', '19']  # Infantry, Special Forces, Armor
        
        if any(mos.startswith(cm) for cm in combat_mos):
            return True
        
        return False
    
    @staticmethod
    def _detect_exposures(profile: Dict) -> List[str]:
        """Detect likely toxic exposures"""
        exposures = []
        deployments = profile.get('deployments', [])
        
        # Burn pit exposure
        burn_pit_locations = ['iraq', 'afghanistan', 'oef', 'oif']
        if any(loc in str(d).lower() for d in deployments for loc in burn_pit_locations):
            exposures.append('burn pit')
        
        # Agent Orange
        if any('vietnam' in str(d).lower() for d in deployments):
            exposures.append('agent orange')
        
        # Gulf War exposures
        if any('gulf' in str(d).lower() or 'desert' in str(d).lower() for d in deployments):
            exposures.extend(['oil well fires', 'pesticides'])
        
        return exposures
    
    @staticmethod
    def _calculate_service_years(profile: Dict) -> float:
        """Calculate years of service"""
        service_history = profile.get('service_history', {})
        dates = service_history.get('dates', '')
        
        # Try to parse dates like "2008-2012" or "Jan 2008 - Dec 2012"
        years_match = re.findall(r'(\d{4})', dates)
        
        if len(years_match) >= 2:
            start_year = int(years_match[0])
            end_year = int(years_match[-1])
            return float(end_year - start_year)
        
        return 0.0
    
    @staticmethod
    def _identify_service_era(profile: Dict) -> str:
        """Identify era of service"""
        service_history = profile.get('service_history', {})
        dates = service_history.get('dates', '')
        
        # Extract year
        years = re.findall(r'(\d{4})', dates)
        if not years:
            return 'Unknown'
        
        start_year = int(years[0])
        
        # Determine era
        if start_year >= 2001:
            return 'Post-9/11'
        elif start_year >= 1990:
            return 'Gulf War'
        elif start_year >= 1975:
            return 'Post-Vietnam'
        elif start_year >= 1964:
            return 'Vietnam Era'
        elif start_year >= 1950:
            return 'Korean War'
        else:
            return 'Pre-1950'
    
    @staticmethod
    def _assess_risk_factors(profile: Dict) -> Dict[str, Any]:
        """Assess health risk factors based on service"""
        risks = {
            'mental_health': [],
            'physical_health': [],
            'exposures': []
        }
        
        # Combat = high PTSD/TBI risk
        if profile.get('combat_veteran'):
            risks['mental_health'].extend(['PTSD', 'TBI', 'Depression', 'Anxiety'])
            risks['physical_health'].extend(['Hearing Loss', 'Tinnitus'])
        
        # Burn pit exposure
        if 'burn pit' in profile.get('exposures', []):
            risks['exposures'].extend([
                'Respiratory conditions',
                'Asthma',
                'Sinusitis',
                'Sleep Apnea'
            ])
        
        # Agent Orange
        if 'agent orange' in profile.get('exposures', []):
            risks['exposures'].extend([
                'Diabetes',
                'Ischemic Heart Disease',
                'Peripheral Neuropathy',
                'Various cancers'
            ])
        
        # Infantry MOS = musculoskeletal issues
        mos = profile.get('service_history', {}).get('mos', '')
        if mos.startswith('11') or mos.startswith('03'):
            risks['physical_health'].extend([
                'Back Pain',
                'Knee Pain',
                'Arthritis'
            ])
        
        return risks
    
    @staticmethod
    def generate_profile_summary(profile: Dict) -> str:
        """Generate human-readable profile summary"""
        enriched = VeteranProfileWorkflow.enrich_profile(profile)
        
        summary = f"""VETERAN PROFILE SUMMARY

Service Information:
- Branch: {enriched.get('service_history', {}).get('branch', 'Unknown')}
- MOS: {enriched.get('service_history', {}).get('mos', 'Unknown')}
- Service Years: {enriched.get('service_years', 0):.1f}
- Era: {enriched.get('service_era', 'Unknown')}
- Combat Veteran: {'Yes' if enriched.get('combat_veteran') else 'No'}

Deployments:
{chr(10).join(['- ' + str(d) for d in enriched.get('deployments', ['None'])])}

Exposures:
{chr(10).join(['- ' + str(e) for e in enriched.get('exposures', ['None identified'])])}

Current Conditions:
{chr(10).join(['- ' + c.get('name', 'Unknown') + f" ({c.get('severity', 'Unknown')} severity)" for c in enriched.get('current_conditions', [])])}

Current VA Rating: {enriched.get('disability_rating', 0)}%

Risk Factors:
- Mental Health: {', '.join(enriched.get('risk_factors', {}).get('mental_health', ['None']))}
- Physical Health: {', '.join(enriched.get('risk_factors', {}).get('physical_health', ['None']))}
- Exposure-Related: {', '.join(enriched.get('risk_factors', {}).get('exposures', ['None']))}
"""
        return summary


def run_profile(veteran_data: dict) -> dict:
    """Execute profile analysis workflow"""
    workflow = VeteranProfileWorkflow()
    
    # Validate
    validation = workflow.validate_profile(veteran_data)
    
    # Enrich
    enriched = workflow.enrich_profile(veteran_data)
    
    # Summary
    summary = workflow.generate_profile_summary(enriched)
    
    return {
        'validation': validation,
        'enriched_profile': enriched,
        'summary': summary
    }


if __name__ == '__main__':
    # Test profile workflow
    test_profile = {
        'service_history': {
            'branch': 'Army',
            'mos': '11B',
            'dates': '2008-2012'
        },
        'deployments': ['Iraq 2010-2011'],
        'current_conditions': [
            {'name': 'PTSD', 'severity': 'SEVERE'},
            {'name': 'Tinnitus', 'severity': 'MODERATE'}
        ],
        'disability_rating': 0
    }
    
    result = run_profile(test_profile)
    
    print("=== VALIDATION ===")
    print(f"Valid: {result['validation']['valid']}")
    print(f"Completeness: {result['validation']['completeness_score']:.1f}%")
    
    print("\n=== SUMMARY ===")
    print(result['summary'])

