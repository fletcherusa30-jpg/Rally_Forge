"""
Evidence Workflow
Orchestrates evidence gathering, validation, and organization for claims
"""

from typing import Dict, List, Any
from datetime import datetime
import os


class EvidenceWorkflow:
    """
    Manages evidence collection and organization for VA claims
    """
    
    @staticmethod
    def categorize_evidence(evidence_files: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Categorize evidence documents by type
        
        Args:
            evidence_files: List of {'filename': str, 'path': str, 'type': str}
        
        Returns:
            Categorized evidence by type
        """
        categories = {
            'medical_records': [],
            'service_records': [],
            'nexus_letters': [],
            'buddy_statements': [],
            'diagnostic_tests': [],
            'treatment_records': [],
            'other': []
        }
        
        for file in evidence_files:
            filename = file.get('filename', '').lower()
            doc_type = file.get('type', '').lower()
            
            # Categorize by filename/type
            if any(term in filename for term in ['medical', 'doctor', 'physician', 'hospital']):
                categories['medical_records'].append(file)
            elif any(term in filename for term in ['dd214', 'service', 'military', 'str']):
                categories['service_records'].append(file)
            elif any(term in filename for term in ['nexus', 'imo', 'medical opinion']):
                categories['nexus_letters'].append(file)
            elif any(term in filename for term in ['buddy', 'statement', 'witness']):
                categories['buddy_statements'].append(file)
            elif any(term in filename for term in ['lab', 'test', 'xray', 'mri', 'ct', 'scan']):
                categories['diagnostic_tests'].append(file)
            elif any(term in filename for term in ['prescription', 'rx', 'treatment']):
                categories['treatment_records'].append(file)
            else:
                categories['other'].append(file)
        
        return categories
    
    @staticmethod
    def validate_evidence(evidence: Dict, claim_condition: str) -> Dict[str, Any]:
        """
        Validate evidence is sufficient for claim
        
        Args:
            evidence: Categorized evidence
            claim_condition: Condition being claimed
        
        Returns:
            Validation report
        """
        validation = {
            'sufficient': True,
            'missing': [],
            'warnings': [],
            'recommendations': []
        }
        
        # Check for current diagnosis
        if not evidence.get('medical_records'):
            validation['sufficient'] = False
            validation['missing'].append('Current medical diagnosis')
            validation['recommendations'].append(
                'Schedule exam with VA or private provider to obtain current diagnosis'
            )
        
        # Check for service connection evidence
        if not evidence.get('service_records'):
            validation['warnings'].append('No service records found')
            validation['recommendations'].append(
                'Request Service Treatment Records (STRs) from National Archives'
            )
        
        # Check for nexus if not presumptive
        if not evidence.get('nexus_letters'):
            validation['warnings'].append('No medical nexus opinion found')
            validation['recommendations'].append(
                'Consider obtaining Independent Medical Opinion (IMO) to link condition to service'
            )
        
        # Condition-specific checks
        if claim_condition == 'PTSD':
            if not evidence.get('buddy_statements'):
                validation['warnings'].append('No buddy statements for PTSD stressor')
                validation['recommendations'].append(
                    'Obtain buddy statements from service members who witnessed stressor event'
                )
        
        elif claim_condition == 'Tinnitus':
            if not evidence.get('diagnostic_tests'):
                validation['warnings'].append('No audiology exam found')
                validation['recommendations'].append(
                    'Schedule audiology examination to document tinnitus'
                )
        
        return validation
    
    @staticmethod
    def generate_evidence_checklist(claim_type: str, condition: str) -> List[Dict]:
        """
        Generate evidence checklist for claim
        
        Args:
            claim_type: 'DIRECT', 'SECONDARY', 'PRESUMPTIVE', 'INCREASE'
            condition: Claimed condition
        
        Returns:
            Checklist items with priority and status
        """
        checklist = []
        
        # Universal requirements
        checklist.append({
            'item': 'Current medical diagnosis',
            'priority': 'CRITICAL',
            'description': f'Current diagnosis of {condition} from VA or private provider',
            'how_to_obtain': 'Schedule medical examination',
            'estimated_cost': 'FREE (VA) or $100-500 (private)',
            'status': 'PENDING'
        })
        
        if claim_type == 'DIRECT':
            checklist.extend([
                {
                    'item': 'Service Treatment Records (STRs)',
                    'priority': 'HIGH',
                    'description': 'In-service medical records showing injury/illness',
                    'how_to_obtain': 'Request from National Archives via eVetRecs',
                    'estimated_cost': 'FREE',
                    'status': 'PENDING'
                },
                {
                    'item': 'Medical Nexus Letter',
                    'priority': 'HIGH',
                    'description': 'Doctor opinion linking current condition to service',
                    'how_to_obtain': 'Request IMO from VA or private doctor',
                    'estimated_cost': 'FREE (VA) or $1500-3000 (private IMO)',
                    'status': 'PENDING'
                },
                {
                    'item': 'Lay Statement',
                    'priority': 'MEDIUM',
                    'description': 'Personal statement describing onset and progression',
                    'how_to_obtain': 'Write detailed statement',
                    'estimated_cost': 'FREE',
                    'status': 'PENDING'
                }
            ])
        
        elif claim_type == 'SECONDARY':
            checklist.extend([
                {
                    'item': 'Primary condition documentation',
                    'priority': 'CRITICAL',
                    'description': 'Proof primary condition is service-connected',
                    'how_to_obtain': 'VA rating decision or award letter',
                    'estimated_cost': 'FREE',
                    'status': 'PENDING'
                },
                {
                    'item': 'Medical Causation Opinion',
                    'priority': 'CRITICAL',
                    'description': f'Doctor opinion explaining how primary caused {condition}',
                    'how_to_obtain': 'Obtain nexus letter from specialist',
                    'estimated_cost': '$2000-3500 (IMO recommended)',
                    'status': 'PENDING'
                }
            ])
        
        elif claim_type == 'PRESUMPTIVE':
            checklist.extend([
                {
                    'item': 'Deployment records',
                    'priority': 'HIGH',
                    'description': 'DD-214 or orders showing qualifying deployment',
                    'how_to_obtain': 'Copy from DD-214 or request from NPRC',
                    'estimated_cost': 'FREE',
                    'status': 'PENDING'
                },
                {
                    'item': 'Current diagnosis only',
                    'priority': 'CRITICAL',
                    'description': 'Presumptive claims do not require nexus',
                    'how_to_obtain': 'Medical exam confirming diagnosis',
                    'estimated_cost': 'FREE (VA)',
                    'status': 'PENDING'
                }
            ])
        
        elif claim_type == 'INCREASE':
            checklist.extend([
                {
                    'item': 'Recent medical exams',
                    'priority': 'CRITICAL',
                    'description': 'Recent exams showing worsened symptoms',
                    'how_to_obtain': 'Schedule C&P exam or private evaluation',
                    'estimated_cost': 'FREE (VA)',
                    'status': 'PENDING'
                },
                {
                    'item': 'Impact statement',
                    'priority': 'HIGH',
                    'description': 'Statement on how worsening affects daily life/work',
                    'how_to_obtain': 'Write detailed personal statement',
                    'estimated_cost': 'FREE',
                    'status': 'PENDING'
                }
            ])
        
        # Condition-specific evidence
        if condition == 'PTSD':
            checklist.append({
                'item': 'Stressor statement',
                'priority': 'CRITICAL',
                'description': 'Detailed description of traumatic event(s)',
                'how_to_obtain': 'Write personal statement with dates, locations, details',
                'estimated_cost': 'FREE',
                'status': 'PENDING'
            })
        
        elif condition == 'Sleep Apnea':
            checklist.append({
                'item': 'Sleep study results',
                'priority': 'CRITICAL',
                'description': 'Polysomnography showing AHI score',
                'how_to_obtain': 'Schedule sleep study at VA or private clinic',
                'estimated_cost': 'FREE (VA) or $1000+ (private)',
                'status': 'PENDING'
            })
        
        return checklist
    
    @staticmethod
    def track_evidence_status(checklist: List[Dict]) -> Dict[str, Any]:
        """
        Track progress on evidence gathering
        
        Returns:
            Progress report
        """
        total = len(checklist)
        completed = len([item for item in checklist if item.get('status') == 'COMPLETED'])
        pending = len([item for item in checklist if item.get('status') == 'PENDING'])
        
        critical_pending = [
            item for item in checklist 
            if item.get('priority') == 'CRITICAL' and item.get('status') == 'PENDING'
        ]
        
        return {
            'total_items': total,
            'completed': completed,
            'pending': pending,
            'progress_percentage': (completed / total * 100) if total > 0 else 0,
            'critical_blockers': len(critical_pending),
            'ready_to_file': len(critical_pending) == 0,
            'next_steps': [item['item'] for item in critical_pending]
        }


def run_evidence(claim_data: dict) -> dict:
    """Execute evidence workflow"""
    workflow = EvidenceWorkflow()
    
    claim_type = claim_data.get('claim_type', 'DIRECT')
    condition = claim_data.get('condition', 'Unknown')
    evidence_files = claim_data.get('evidence_files', [])
    
    # Categorize existing evidence
    categorized = workflow.categorize_evidence(evidence_files)
    
    # Validate evidence
    validation = workflow.validate_evidence(categorized, condition)
    
    # Generate checklist
    checklist = workflow.generate_evidence_checklist(claim_type, condition)
    
    # Track status
    status = workflow.track_evidence_status(checklist)
    
    return {
        'categorized_evidence': categorized,
        'validation': validation,
        'checklist': checklist,
        'status': status
    }


if __name__ == '__main__':
    # Test evidence workflow
    test_claim = {
        'claim_type': 'DIRECT',
        'condition': 'PTSD',
        'evidence_files': [
            {'filename': 'medical_diagnosis_ptsd.pdf', 'path': '/docs/med.pdf'},
            {'filename': 'dd214_discharge.pdf', 'path': '/docs/dd214.pdf'}
        ]
    }
    
    result = run_evidence(test_claim)
    
    print("=== EVIDENCE CATEGORIZATION ===")
    for category, files in result['categorized_evidence'].items():
        if files:
            print(f"\n{category.upper()}:")
            for f in files:
                print(f"  - {f['filename']}")
    
    print("\n=== VALIDATION ===")
    print(f"Sufficient: {result['validation']['sufficient']}")
    if result['validation']['missing']:
        print(f"Missing: {', '.join(result['validation']['missing'])}")
    
    print("\n=== PROGRESS ===")
    print(f"Progress: {result['status']['progress_percentage']:.0f}%")
    print(f"Ready to file: {result['status']['ready_to_file']}")

