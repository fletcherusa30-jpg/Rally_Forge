"""
OCR Workflow
Optical Character Recognition for extracting text from documents
(DD-214, medical records, etc.)
"""

import os
from typing import Dict, List, Any, Optional
import re
from datetime import datetime


class OCRWorkflow:
    """
    Extracts text and data from scanned documents
    Supports PDF, images, and form recognition
    """
    
    def __init__(self):
        """Initialize OCR engines"""
        self._init_tesseract()
        self._init_pdf_reader()
    
    def _init_tesseract(self):
        """Initialize Tesseract OCR"""
        try:
            import pytesseract
            from PIL import Image
            self.tesseract = pytesseract
            self.Image = Image
            self.has_tesseract = True
        except ImportError:
            print("Warning: pytesseract not installed. OCR will be limited.")
            print("Install with: pip install pytesseract pillow")
            self.has_tesseract = False
    
    def _init_pdf_reader(self):
        """Initialize PDF reader"""
        try:
            import PyPDF2
            self.PyPDF2 = PyPDF2
            self.has_pdf_reader = True
        except ImportError:
            print("Warning: PyPDF2 not installed.")
            print("Install with: pip install PyPDF2")
            self.has_pdf_reader = False
    
    def process_document(self, file_path: str) -> Dict[str, Any]:
        """
        Process document and extract text
        
        Args:
            file_path: Path to document file
        
        Returns:
            {
                'text': str,
                'document_type': str,
                'extracted_data': {},
                'confidence': float
            }
        """
        if not os.path.exists(file_path):
            return {'error': 'File not found', 'text': '', 'extracted_data': {}}
        
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Extract text based on file type
        if file_ext == '.pdf':
            text = self._extract_from_pdf(file_path)
        elif file_ext in ['.jpg', '.jpeg', '.png', '.tiff']:
            text = self._extract_from_image(file_path)
        else:
            return {
                'error': f'Unsupported file type: {file_ext}',
                'text': '',
                'extracted_data': {}
            }
        
        # Identify document type
        doc_type = self._identify_document_type(text)
        
        # Extract structured data based on type
        extracted_data = self._extract_structured_data(text, doc_type)
        
        return {
            'text': text,
            'document_type': doc_type,
            'extracted_data': extracted_data,
            'confidence': 0.85,  # Placeholder
            'processed_at': datetime.now().isoformat()
        }
    
    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF"""
        if not self.has_pdf_reader:
            return "[PDF reader not available]"
        
        try:
            with open(file_path, 'rb') as file:
                reader = self.PyPDF2.PdfReader(file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            return f"[PDF extraction error: {e}]"
    
    def _extract_from_image(self, file_path: str) -> str:
        """Extract text from image using OCR"""
        if not self.has_tesseract:
            return "[OCR not available]"
        
        try:
            image = self.Image.open(file_path)
            text = self.tesseract.image_to_string(image)
            return text
        except Exception as e:
            return f"[OCR error: {e}]"
    
    def _identify_document_type(self, text: str) -> str:
        """Identify type of document from text"""
        text_lower = text.lower()
        
        # DD-214 (discharge papers)
        if 'dd form 214' in text_lower or 'certificate of release' in text_lower:
            return 'DD-214'
        
        # Medical records
        if any(term in text_lower for term in ['medical record', 'patient', 'diagnosis', 'treatment']):
            return 'Medical Record'
        
        # Nexus letter
        if 'nexus' in text_lower or 'medical opinion' in text_lower:
            return 'Nexus Letter'
        
        # Buddy statement
        if 'statement' in text_lower and 'witness' in text_lower:
            return 'Buddy Statement'
        
        # VA rating decision
        if 'rating decision' in text_lower or 'department of veterans affairs' in text_lower:
            return 'VA Rating Decision'
        
        return 'Unknown'
    
    def _extract_structured_data(self, text: str, doc_type: str) -> Dict:
        """Extract structured data based on document type"""
        if doc_type == 'DD-214':
            return self._extract_dd214_data(text)
        elif doc_type == 'Medical Record':
            return self._extract_medical_data(text)
        elif doc_type == 'Nexus Letter':
            return self._extract_nexus_data(text)
        else:
            return {}
    
    def _extract_dd214_data(self, text: str) -> Dict:
        """Extract data from DD-214"""
        data = {}
        
        # Extract name
        name_match = re.search(r'NAME[:\s]+(\w+,?\s+\w+)', text, re.IGNORECASE)
        if name_match:
            data['name'] = name_match.group(1)
        
        # Extract service dates
        date_pattern = r'(\d{2}[/-]\d{2}[/-]\d{4})'
        dates = re.findall(date_pattern, text)
        if dates:
            data['service_dates'] = dates
        
        # Extract branch
        branches = ['army', 'navy', 'air force', 'marine', 'coast guard', 'space force']
        for branch in branches:
            if branch in text.lower():
                data['branch'] = branch.title()
                break
        
        # Extract character of discharge
        if 'honorable' in text.lower():
            data['discharge_type'] = 'Honorable'
        elif 'general' in text.lower():
            data['discharge_type'] = 'General'
        
        # Extract MOS/Rating
        mos_match = re.search(r'MOS[:\s]+(\w+)', text, re.IGNORECASE)
        if mos_match:
            data['mos'] = mos_match.group(1)
        
        return data
    
    def _extract_medical_data(self, text: str) -> Dict:
        """Extract data from medical records"""
        data = {}
        
        # Extract diagnoses
        diagnosis_patterns = [
            r'DIAGNOSIS[:\s]+(.+?)(?:\n|$)',
            r'ICD[\-\s]?10[:\s]+([A-Z]\d+\.?\d*)',
        ]
        
        diagnoses = []
        for pattern in diagnosis_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            diagnoses.extend(matches)
        
        if diagnoses:
            data['diagnoses'] = diagnoses
        
        # Extract dates
        date_match = re.search(r'DATE[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})', text, re.IGNORECASE)
        if date_match:
            data['visit_date'] = date_match.group(1)
        
        # Extract provider
        provider_match = re.search(r'PROVIDER[:\s]+([A-Z][\w\s,]+(?:MD|DO|NP|PA))', text, re.IGNORECASE)
        if provider_match:
            data['provider'] = provider_match.group(1)
        
        return data
    
    def _extract_nexus_data(self, text: str) -> Dict:
        """Extract data from nexus letter"""
        data = {}
        
        # Extract opinion statement
        opinion_patterns = [
            r'(it is (?:at least )?as likely as not.+?)\.',
            r'(in my medical opinion.+?)\.',
        ]
        
        for pattern in opinion_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                data['opinion_statement'] = match.group(1)
                break
        
        # Extract conditions mentioned
        conditions = []
        common_conditions = ['ptsd', 'tinnitus', 'sleep apnea', 'diabetes', 'hypertension']
        for condition in common_conditions:
            if condition in text.lower():
                conditions.append(condition.upper() if condition == 'ptsd' else condition.title())
        
        if conditions:
            data['conditions_mentioned'] = conditions
        
        return data
    
    def batch_process(self, file_paths: List[str]) -> List[Dict]:
        """Process multiple documents"""
        results = []
        
        for path in file_paths:
            result = self.process_document(path)
            result['file_path'] = path
            result['file_name'] = os.path.basename(path)
            results.append(result)
        
        return results


def run_ocr(file_path: str) -> dict:
    """Execute OCR workflow on single document"""
    workflow = OCRWorkflow()
    return workflow.process_document(file_path)


if __name__ == '__main__':
    print("OCR Workflow Module")
    print("This module requires: pip install pytesseract pillow PyPDF2")
    print("And Tesseract-OCR installed on system")
    
    # Test with mock data
    mock_dd214_text = """
    DD FORM 214
    CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
    
    NAME: SMITH, JOHN A
    BRANCH: ARMY
    SERVICE DATES: 01/15/2008 - 12/31/2012
    MOS: 11B
    CHARACTER OF DISCHARGE: HONORABLE
    """
    
    workflow = OCRWorkflow()
    doc_type = workflow._identify_document_type(mock_dd214_text)
    data = workflow._extract_dd214_data(mock_dd214_text)
    
    print(f"\nDocument Type: {doc_type}")
    print(f"Extracted Data: {data}")

