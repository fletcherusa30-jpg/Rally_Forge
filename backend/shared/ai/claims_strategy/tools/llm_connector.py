"""
LLM Connector
Connects to various LLM providers (OpenAI, Anthropic, local models)
"""

import os
import json
from typing import Dict, List, Any, Optional
import time
from enum import Enum


class LLMProvider(Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"
    AZURE_OPENAI = "azure_openai"


class LLMConnector:
    """
    Universal LLM connector supporting multiple providers
    Handles retries, rate limiting, and error handling
    """
    
    def __init__(self, 
                 provider: LLMProvider = LLMProvider.OPENAI,
                 api_key: Optional[str] = None,
                 model: str = "gpt-4",
                 max_retries: int = 3,
                 timeout: int = 60):
        """
        Initialize LLM connector
        
        Args:
            provider: LLM provider to use
            api_key: API key (reads from env if not provided)
            model: Model name
            max_retries: Max retry attempts on failure
            timeout: Request timeout in seconds
        """
        self.provider = provider
        self.model = model
        self.max_retries = max_retries
        self.timeout = timeout
        
        # Get API key from env if not provided
        if api_key is None:
            if provider == LLMProvider.OPENAI:
                api_key = os.getenv('OPENAI_API_KEY')
            elif provider == LLMProvider.ANTHROPIC:
                api_key = os.getenv('ANTHROPIC_API_KEY')
            elif provider == LLMProvider.AZURE_OPENAI:
                api_key = os.getenv('AZURE_OPENAI_KEY')
        
        self.api_key = api_key
        
        # Initialize provider client
        self._init_client()
    
    def _init_client(self):
        """Initialize provider-specific client"""
        if self.provider == LLMProvider.OPENAI:
            try:
                import openai
                self.client = openai.OpenAI(api_key=self.api_key)
            except ImportError:
                print("Warning: openai package not installed. Install with: pip install openai")
                self.client = None
        
        elif self.provider == LLMProvider.ANTHROPIC:
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                print("Warning: anthropic package not installed. Install with: pip install anthropic")
                self.client = None
        
        elif self.provider == LLMProvider.LOCAL:
            # Local model (Ollama, LM Studio, etc.)
            self.client = None  # Will use HTTP requests
            self.base_url = os.getenv('LOCAL_LLM_URL', 'http://localhost:11434')
        
        else:
            self.client = None
    
    def generate(self, 
                prompt: str,
                system_prompt: Optional[str] = None,
                temperature: float = 0.7,
                max_tokens: int = 2000,
                json_mode: bool = False) -> Dict[str, Any]:
        """
        Generate completion from LLM
        
        Args:
            prompt: User prompt
            system_prompt: System prompt for context
            temperature: Sampling temperature (0-1)
            max_tokens: Max tokens in response
            json_mode: Force JSON response format
        
        Returns:
            {
                'content': str,
                'model': str,
                'usage': {'prompt_tokens': int, 'completion_tokens': int},
                'success': bool,
                'error': Optional[str]
            }
        """
        for attempt in range(self.max_retries):
            try:
                if self.provider == LLMProvider.OPENAI:
                    return self._generate_openai(prompt, system_prompt, temperature, 
                                                 max_tokens, json_mode)
                
                elif self.provider == LLMProvider.ANTHROPIC:
                    return self._generate_anthropic(prompt, system_prompt, temperature, 
                                                    max_tokens)
                
                elif self.provider == LLMProvider.LOCAL:
                    return self._generate_local(prompt, system_prompt, temperature, 
                                                max_tokens)
                
                else:
                    return {
                        'content': '',
                        'model': self.model,
                        'usage': {'prompt_tokens': 0, 'completion_tokens': 0},
                        'success': False,
                        'error': f'Unsupported provider: {self.provider}'
                    }
            
            except Exception as e:
                if attempt == self.max_retries - 1:
                    return {
                        'content': '',
                        'model': self.model,
                        'usage': {'prompt_tokens': 0, 'completion_tokens': 0},
                        'success': False,
                        'error': str(e)
                    }
                
                # Exponential backoff
                time.sleep(2 ** attempt)
        
        return {
            'content': '',
            'model': self.model,
            'usage': {'prompt_tokens': 0, 'completion_tokens': 0},
            'success': False,
            'error': 'Max retries exceeded'
        }
    
    def _generate_openai(self, prompt: str, system_prompt: Optional[str],
                        temperature: float, max_tokens: int, 
                        json_mode: bool) -> Dict[str, Any]:
        """Generate using OpenAI API"""
        if not self.client:
            return {
                'content': '',
                'model': self.model,
                'usage': {'prompt_tokens': 0, 'completion_tokens': 0},
                'success': False,
                'error': 'OpenAI client not initialized'
            }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        params = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if json_mode:
            params["response_format"] = {"type": "json_object"}
        
        response = self.client.chat.completions.create(**params)
        
        return {
            'content': response.choices[0].message.content,
            'model': response.model,
            'usage': {
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens
            },
            'success': True,
            'error': None
        }
    
    def _generate_anthropic(self, prompt: str, system_prompt: Optional[str],
                           temperature: float, max_tokens: int) -> Dict[str, Any]:
        """Generate using Anthropic API"""
        if not self.client:
            return {
                'content': '',
                'model': self.model,
                'usage': {'prompt_tokens': 0, 'completion_tokens': 0},
                'success': False,
                'error': 'Anthropic client not initialized'
            }
        
        message = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or "",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return {
            'content': message.content[0].text,
            'model': message.model,
            'usage': {
                'prompt_tokens': message.usage.input_tokens,
                'completion_tokens': message.usage.output_tokens
            },
            'success': True,
            'error': None
        }
    
    def _generate_local(self, prompt: str, system_prompt: Optional[str],
                       temperature: float, max_tokens: int) -> Dict[str, Any]:
        """Generate using local LLM (Ollama, etc.)"""
        try:
            import requests
            
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                },
                timeout=self.timeout
            )
            
            response.raise_for_status()
            result = response.json()
            
            return {
                'content': result.get('response', ''),
                'model': self.model,
                'usage': {
                    'prompt_tokens': result.get('prompt_eval_count', 0),
                    'completion_tokens': result.get('eval_count', 0)
                },
                'success': True,
                'error': None
            }
        
        except Exception as e:
            return {
                'content': '',
                'model': self.model,
                'usage': {'prompt_tokens': 0, 'completion_tokens': 0},
                'success': False,
                'error': f'Local LLM error: {str(e)}'
            }
    
    def generate_stream(self, prompt: str, system_prompt: Optional[str] = None,
                       temperature: float = 0.7) -> Any:
        """
        Generate streaming response
        
        Args:
            prompt: User prompt
            system_prompt: System prompt
            temperature: Sampling temperature
        
        Yields:
            Content chunks as they arrive
        """
        # Streaming implementation for real-time UI updates
        # Would require async implementation for production
        raise NotImplementedError("Streaming not yet implemented")


if __name__ == '__main__':
    # Test the connector
    print("Testing LLM Connector...\n")
    
    # Test with mock (no actual API calls unless keys are set)
    connector = LLMConnector(
        provider=LLMProvider.OPENAI,
        model="gpt-4"
    )
    
    test_prompt = "What are the 3 main requirements for VA service connection?"
    
    print(f"Provider: {connector.provider.value}")
    print(f"Model: {connector.model}")
    print(f"API Key Set: {'Yes' if connector.api_key else 'No'}")
    
    if connector.api_key:
        result = connector.generate(test_prompt, temperature=0.3)
        print(f"\nSuccess: {result['success']}")
        if result['success']:
            print(f"Response: {result['content'][:200]}...")
            print(f"Tokens: {result['usage']}")
        else:
            print(f"Error: {result['error']}")
    else:
        print("\nNo API key set - skipping actual API call")
        print("Set OPENAI_API_KEY environment variable to test")

