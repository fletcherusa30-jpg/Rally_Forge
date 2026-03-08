"""
AI Core Utilities
Core functions for AI/LLM interactions, prompt management, and response processing
"""

from typing import Dict, List, Any, Optional
import json
import re
from datetime import datetime


class PromptBuilder:
    """Build structured prompts for LLM interactions"""
    
    @staticmethod
    def build_claims_analysis_prompt(veteran_data: Dict[str, Any]) -> str:
        """
        Build prompt for comprehensive claims analysis
        
        Args:
            veteran_data: Veteran profile with service history, conditions, deployments
        
        Returns:
            Formatted prompt for LLM
        """
        prompt = f"""You are an expert VA claims strategist with deep knowledge of 38 CFR Parts 3 & 4.

VETERAN PROFILE:
- Service Branch: {veteran_data.get('service_history', {}).get('branch', 'Unknown')}
- MOS/Rating: {veteran_data.get('service_history', {}).get('mos', 'Unknown')}
- Service Dates: {veteran_data.get('service_history', {}).get('dates', 'Unknown')}
- Deployments: {', '.join(veteran_data.get('deployments', ['None']))}
- Combat Veteran: {'Yes' if veteran_data.get('combat_veteran') else 'No'}
- Current VA Rating: {veteran_data.get('disability_rating', 0)}%

CURRENT CONDITIONS:
{"".join([f"- {c.get('name', 'Unknown')}: {c.get('severity', 'Unknown')} severity" for c in veteran_data.get('current_conditions', [])])}

EXPOSURES:
{', '.join(veteran_data.get('exposures', ['None']))}

TASK: Analyze this veteran's profile and identify:
1. All potential VA claims (primary, secondary, presumptive)
2. Success probability for each claim
3. Required evidence
4. Strategic filing order
5. Estimated combined rating
6. Projected monthly compensation

Provide comprehensive claims strategy in JSON format.
"""
        return prompt
    
    @staticmethod
    def build_nexus_prompt(primary_condition: str, secondary_condition: str, 
                          veteran_context: str = '') -> str:
        """
        Build prompt for medical nexus letter generation
        
        Args:
            primary_condition: Service-connected primary condition
            secondary_condition: Claimed secondary condition
            veteran_context: Additional veteran-specific context
        
        Returns:
            Prompt for nexus letter generation
        """
        prompt = f"""You are a medical expert specializing in VA disability claims nexus letters.

PRIMARY CONDITION (Service-Connected): {primary_condition}
SECONDARY CONDITION (Claimed): {secondary_condition}

{veteran_context}

Write a professional medical nexus opinion letter explaining:
1. Medical causation linking primary to secondary condition
2. Pathophysiology of the connection
3. Research/literature supporting the connection
4. Opinion statement: "It is at least as likely as not that {secondary_condition} is caused or aggravated by {primary_condition}"

Use professional medical language appropriate for VA review.
"""
        return prompt
    
    @staticmethod
    def build_evidence_gap_prompt(claim: Dict[str, Any]) -> str:
        """
        Build prompt for evidence gap analysis
        
        Args:
            claim: Claim data with existing evidence
        
        Returns:
            Prompt for evidence analysis
        """
        condition = claim.get('condition', 'Unknown')
        existing = claim.get('existing_evidence', {})
        
        evidence_status = "\n".join([
            f"- {key}: {'✓ Available' if val else '✗ Missing'}"
            for key, val in existing.items()
        ])
        
        prompt = f"""Analyze evidence gaps for VA claim:

CONDITION: {condition}
SERVICE CONNECTION TYPE: {claim.get('service_connection_type', 'DIRECT')}

CURRENT EVIDENCE:
{evidence_status}

Identify:
1. Critical missing evidence (claim will fail without this)
2. High-priority evidence (significantly improves approval odds)
3. Supporting evidence (strengthens claim)
4. How to obtain each piece of evidence
5. Cost and timeline estimates

Provide detailed evidence acquisition strategy.
"""
        return prompt


class ResponseParser:
    """Parse and validate LLM responses"""
    
    @staticmethod
    def parse_json_response(response: str) -> Optional[Dict]:
        """
        Extract JSON from LLM response
        Handles responses with markdown code blocks or extra text
        
        Args:
            response: Raw LLM response
        
        Returns:
            Parsed JSON dict or None if parsing fails
        """
        # Try direct JSON parse
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # Try extracting from code block
        json_match = re.search(r'```json\s*(.+?)\s*```', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try extracting any JSON-like structure
        json_match = re.search(r'\{.+\}', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        return None
    
    @staticmethod
    def validate_claims_response(response: Dict) -> bool:
        """
        Validate claims analysis response structure
        
        Args:
            response: Parsed response dict
        
        Returns:
            True if valid structure
        """
        required_keys = ['recommended_claims', 'total_claims', 'overall_success_rate']
        return all(key in response for key in required_keys)
    
    @staticmethod
    def extract_rating_estimate(text: str) -> Optional[int]:
        """
        Extract VA rating percentage from text
        
        Args:
            text: Text containing rating mention
        
        Returns:
            Rating as integer (0-100) or None
        """
        # Look for patterns like "70%", "70 percent", "rating of 70"
        patterns = [
            r'(\d+)\s*%',
            r'(\d+)\s*percent',
            r'rating\s+of\s+(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                rating = int(match.group(1))
                if 0 <= rating <= 100:
                    return rating
        
        return None


class AILogger:
    """Logging for AI operations"""
    
    @staticmethod
    def log_prompt(prompt: str, model: str, timestamp: str = None) -> Dict:
        """
        Log LLM prompt for debugging/analysis
        
        Returns:
            Log entry dict
        """
        return {
            'timestamp': timestamp or datetime.now().isoformat(),
            'type': 'prompt',
            'model': model,
            'content': prompt,
            'length': len(prompt)
        }
    
    @staticmethod
    def log_response(response: str, model: str, success: bool, 
                    processing_time: float = None) -> Dict:
        """
        Log LLM response
        
        Returns:
            Log entry dict
        """
        return {
            'timestamp': datetime.now().isoformat(),
            'type': 'response',
            'model': model,
            'success': success,
            'content': response,
            'length': len(response),
            'processing_time_seconds': processing_time
        }


class TokenEstimator:
    """Estimate token usage for cost calculations"""
    
    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Rough token estimation (1 token ≈ 4 characters)
        
        Args:
            text: Input text
        
        Returns:
            Estimated token count
        """
        return len(text) // 4
    
    @staticmethod
    def estimate_cost(prompt_tokens: int, completion_tokens: int,
                     model: str = 'gpt-4') -> float:
        """
        Estimate API cost
        
        Args:
            prompt_tokens: Input tokens
            completion_tokens: Output tokens
            model: Model name
        
        Returns:
            Estimated cost in USD
        """
        # 2024 pricing estimates
        pricing = {
            'gpt-4': {'input': 0.03 / 1000, 'output': 0.06 / 1000},
            'gpt-3.5-turbo': {'input': 0.0015 / 1000, 'output': 0.002 / 1000},
            'claude-3-opus': {'input': 0.015 / 1000, 'output': 0.075 / 1000}
        }
        
        rates = pricing.get(model, pricing['gpt-4'])
        cost = (prompt_tokens * rates['input']) + (completion_tokens * rates['output'])
        return round(cost, 4)


if __name__ == '__main__':
    # Test prompt building
    builder = PromptBuilder()
    
    test_veteran = {
        'service_history': {'branch': 'Army', 'mos': '11B'},
        'deployments': ['Iraq 2010-2011'],
        'combat_veteran': True,
        'current_conditions': [
            {'name': 'PTSD', 'severity': 'SEVERE'},
            {'name': 'Tinnitus', 'severity': 'MODERATE'}
        ],
        'exposures': ['burn pit'],
        'disability_rating': 0
    }
    
    prompt = builder.build_claims_analysis_prompt(test_veteran)
    print("Claims Analysis Prompt:")
    print(prompt)
    print(f"\nEstimated tokens: {TokenEstimator.estimate_tokens(prompt)}")

