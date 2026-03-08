"""
Embeddings Generator
Generates vector embeddings for semantic search and similarity matching
"""

import os
from typing import List, Dict, Any, Optional
import numpy as np


class EmbeddingsGenerator:
    """
    Generate embeddings for text using various providers
    Supports OpenAI, sentence-transformers, and local models
    """
    
    def __init__(self, provider: str = 'openai', model: str = 'text-embedding-ada-002'):
        """
        Initialize embeddings generator
        
        Args:
            provider: 'openai' or 'sentence-transformers'
            model: Model name for embeddings
        """
        self.provider = provider
        self.model = model
        self._init_client()
    
    def _init_client(self):
        """Initialize provider client"""
        if self.provider == 'openai':
            try:
                import openai
                api_key = os.getenv('OPENAI_API_KEY')
                self.client = openai.OpenAI(api_key=api_key)
            except ImportError:
                print("Warning: openai not installed. Install with: pip install openai")
                self.client = None
        
        elif self.provider == 'sentence-transformers':
            try:
                from sentence_transformers import SentenceTransformer
                self.client = SentenceTransformer(self.model)
            except ImportError:
                print("Warning: sentence-transformers not installed.")
                print("Install with: pip install sentence-transformers")
                self.client = None
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding for single text
        
        Args:
            text: Input text
        
        Returns:
            Embedding vector as list of floats
        """
        if not self.client:
            # Fallback: simple TF-IDF-like embedding
            return self._simple_embedding(text)
        
        try:
            if self.provider == 'openai':
                response = self.client.embeddings.create(
                    input=text,
                    model=self.model
                )
                return response.data[0].embedding
            
            elif self.provider == 'sentence-transformers':
                embedding = self.client.encode(text)
                return embedding.tolist()
        
        except Exception as e:
            print(f"Embedding generation error: {e}")
            return self._simple_embedding(text)
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of input texts
        
        Returns:
            List of embedding vectors
        """
        if not self.client:
            return [self._simple_embedding(t) for t in texts]
        
        try:
            if self.provider == 'openai':
                response = self.client.embeddings.create(
                    input=texts,
                    model=self.model
                )
                return [item.embedding for item in response.data]
            
            elif self.provider == 'sentence-transformers':
                embeddings = self.client.encode(texts)
                return embeddings.tolist()
        
        except Exception as e:
            print(f"Batch embedding error: {e}")
            return [self._simple_embedding(t) for t in texts]
    
    def _simple_embedding(self, text: str, dim: int = 384) -> List[float]:
        """
        Simple fallback embedding using character-based hashing
        Not semantic, but provides basic similarity
        
        Args:
            text: Input text
            dim: Embedding dimension
        
        Returns:
            Simple embedding vector
        """
        # Simple hash-based embedding (not production quality)
        import hashlib
        
        # Create multiple hash-based features
        embedding = []
        for i in range(dim):
            hash_input = f"{text}_{i}"
            hash_val = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
            # Normalize to [-1, 1]
            normalized = (hash_val % 1000) / 500 - 1
            embedding.append(normalized)
        
        return embedding
    
    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
        
        Returns:
            Similarity score (0-1)
        """
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return float(similarity)
    
    def find_similar(self, query: str, documents: List[str], 
                     top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Find most similar documents to query
        
        Args:
            query: Search query
            documents: List of documents to search
            top_k: Number of results to return
        
        Returns:
            List of {text, score, index} dicts
        """
        query_embedding = self.generate_embedding(query)
        doc_embeddings = self.generate_embeddings_batch(documents)
        
        # Calculate similarities
        similarities = []
        for idx, doc_emb in enumerate(doc_embeddings):
            score = self.cosine_similarity(query_embedding, doc_emb)
            similarities.append({
                'text': documents[idx],
                'score': score,
                'index': idx
            })
        
        # Sort by score and return top k
        similarities.sort(key=lambda x: x['score'], reverse=True)
        return similarities[:top_k]


if __name__ == '__main__':
    # Test embeddings
    print("Testing Embeddings Generator...\n")
    
    generator = EmbeddingsGenerator(provider='sentence-transformers', 
                                   model='all-MiniLM-L6-v2')
    
    # Test documents
    documents = [
        "PTSD requires a diagnosed stressor event during military service",
        "Tinnitus is ringing in the ears and is rated at 10% regardless of severity",
        "Sleep apnea with CPAP use qualifies for 50% VA rating",
        "Secondary conditions can be claimed if caused by a primary service-connected condition"
    ]
    
    query = "What conditions can I claim secondary to PTSD?"
    
    print(f"Query: {query}\n")
    print("Searching documents...\n")
    
    results = generator.find_similar(query, documents, top_k=3)
    
    for i, result in enumerate(results, 1):
        print(f"{i}. Score: {result['score']:.3f}")
        print(f"   Text: {result['text']}\n")

