"""
Vector Store
Stores and retrieves document embeddings for semantic search
Supports in-memory, FAISS, and ChromaDB backends
"""

import os
import json
from typing import List, Dict, Any, Optional
import pickle
from datetime import datetime


class VectorStore:
    """
    Vector database for storing and querying embeddings
    Supports multiple backends: in-memory, FAISS, ChromaDB
    """
    
    def __init__(self, backend: str = 'memory', persist_directory: Optional[str] = None):
        """
        Initialize vector store
        
        Args:
            backend: 'memory', 'faiss', or 'chroma'
            persist_directory: Directory to save/load index
        """
        self.backend = backend
        self.persist_directory = persist_directory or '.vectorstore'
        self.documents = []
        self.embeddings = []
        self.metadata = []
        
        # Initialize backend
        if backend == 'faiss':
            self._init_faiss()
        elif backend == 'chroma':
            self._init_chroma()
        else:
            self.index = None
    
    def _init_faiss(self):
        """Initialize FAISS index"""
        try:
            import faiss
            self.faiss = faiss
            self.index = None  # Will be created on first add
        except ImportError:
            print("Warning: faiss not installed. Using in-memory backend.")
            print("Install with: pip install faiss-cpu")
            self.backend = 'memory'
            self.index = None
    
    def _init_chroma(self):
        """Initialize ChromaDB"""
        try:
            import chromadb
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            self.collection = self.client.get_or_create_collection(
                name="claims_strategy_docs"
            )
        except ImportError:
            print("Warning: chromadb not installed. Using in-memory backend.")
            print("Install with: pip install chromadb")
            self.backend = 'memory'
            self.index = None
    
    def add_documents(self, documents: List[str], embeddings: List[List[float]],
                     metadata: Optional[List[Dict]] = None):
        """
        Add documents with embeddings to store
        
        Args:
            documents: List of text documents
            embeddings: List of embedding vectors
            metadata: Optional metadata for each document
        """
        if metadata is None:
            metadata = [{} for _ in documents]
        
        if self.backend == 'memory':
            self.documents.extend(documents)
            self.embeddings.extend(embeddings)
            self.metadata.extend(metadata)
        
        elif self.backend == 'faiss':
            import numpy as np
            
            # Convert to numpy array
            emb_array = np.array(embeddings, dtype='float32')
            
            # Create index if doesn't exist
            if self.index is None:
                dim = len(embeddings[0])
                self.index = self.faiss.IndexFlatL2(dim)
            
            # Add to FAISS
            self.index.add(emb_array)
            
            # Store documents and metadata separately
            self.documents.extend(documents)
            self.metadata.extend(metadata)
        
        elif self.backend == 'chroma':
            # Add to ChromaDB
            ids = [f"doc_{len(self.documents) + i}" for i in range(len(documents))]
            
            self.collection.add(
                embeddings=embeddings,
                documents=documents,
                metadatas=metadata,
                ids=ids
            )
            
            self.documents.extend(documents)
            self.metadata.extend(metadata)
    
    def search(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for similar documents
        
        Args:
            query_embedding: Query vector
            top_k: Number of results to return
        
        Returns:
            List of {text, metadata, score} dicts
        """
        if self.backend == 'memory':
            return self._search_memory(query_embedding, top_k)
        
        elif self.backend == 'faiss':
            return self._search_faiss(query_embedding, top_k)
        
        elif self.backend == 'chroma':
            return self._search_chroma(query_embedding, top_k)
        
        return []
    
    def _search_memory(self, query_embedding: List[float], top_k: int) -> List[Dict]:
        """Search in-memory store"""
        import numpy as np
        
        if not self.embeddings:
            return []
        
        # Calculate cosine similarities
        query_vec = np.array(query_embedding)
        similarities = []
        
        for idx, emb in enumerate(self.embeddings):
            doc_vec = np.array(emb)
            
            # Cosine similarity
            dot_product = np.dot(query_vec, doc_vec)
            norm_query = np.linalg.norm(query_vec)
            norm_doc = np.linalg.norm(doc_vec)
            
            if norm_query > 0 and norm_doc > 0:
                similarity = dot_product / (norm_query * norm_doc)
            else:
                similarity = 0.0
            
            similarities.append({
                'text': self.documents[idx],
                'metadata': self.metadata[idx],
                'score': float(similarity),
                'index': idx
            })
        
        # Sort and return top k
        similarities.sort(key=lambda x: x['score'], reverse=True)
        return similarities[:top_k]
    
    def _search_faiss(self, query_embedding: List[float], top_k: int) -> List[Dict]:
        """Search FAISS index"""
        import numpy as np
        
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # Convert query to numpy array
        query_vec = np.array([query_embedding], dtype='float32')
        
        # Search
        distances, indices = self.index.search(query_vec, top_k)
        
        # Format results (FAISS returns L2 distances, convert to similarity)
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.documents):
                # Convert L2 distance to similarity score (inverse)
                similarity = 1.0 / (1.0 + distances[0][i])
                
                results.append({
                    'text': self.documents[idx],
                    'metadata': self.metadata[idx],
                    'score': float(similarity),
                    'index': int(idx)
                })
        
        return results
    
    def _search_chroma(self, query_embedding: List[float], top_k: int) -> List[Dict]:
        """Search ChromaDB"""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        
        # Format results
        formatted = []
        for i in range(len(results['documents'][0])):
            formatted.append({
                'text': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'score': 1.0 - results['distances'][0][i],  # Convert distance to similarity
                'index': i
            })
        
        return formatted
    
    def save(self, filepath: Optional[str] = None):
        """Save vector store to disk"""
        if filepath is None:
            filepath = os.path.join(self.persist_directory, 'vectorstore.pkl')
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        data = {
            'backend': self.backend,
            'documents': self.documents,
            'embeddings': self.embeddings,
            'metadata': self.metadata,
            'timestamp': datetime.now().isoformat()
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
        
        # Save FAISS index separately if using FAISS
        if self.backend == 'faiss' and self.index is not None:
            index_path = filepath.replace('.pkl', '_faiss.index')
            self.faiss.write_index(self.index, index_path)
    
    def load(self, filepath: Optional[str] = None):
        """Load vector store from disk"""
        if filepath is None:
            filepath = os.path.join(self.persist_directory, 'vectorstore.pkl')
        
        if not os.path.exists(filepath):
            print(f"No saved store found at {filepath}")
            return
        
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
        
        self.backend = data.get('backend', 'memory')
        self.documents = data.get('documents', [])
        self.embeddings = data.get('embeddings', [])
        self.metadata = data.get('metadata', [])
        
        # Load FAISS index if exists
        if self.backend == 'faiss':
            index_path = filepath.replace('.pkl', '_faiss.index')
            if os.path.exists(index_path):
                self.index = self.faiss.read_index(index_path)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics"""
        return {
            'backend': self.backend,
            'total_documents': len(self.documents),
            'embedding_dimension': len(self.embeddings[0]) if self.embeddings else 0,
            'metadata_keys': list(set(k for meta in self.metadata for k in meta.keys()))
        }


if __name__ == '__main__':
    # Test vector store
    print("Testing Vector Store...\n")
    
    store = VectorStore(backend='memory')
    
    # Sample documents
    docs = [
        "PTSD requires a diagnosed stressor",
        "Sleep apnea secondary to PTSD",
        "Tinnitus rated at 10%"
    ]
    
    # Mock embeddings (in production, use EmbeddingsGenerator)
    import random
    embeddings = [[random.random() for _ in range(384)] for _ in docs]
    
    metadata = [
        {'type': 'condition', 'name': 'PTSD'},
        {'type': 'secondary', 'primary': 'PTSD'},
        {'type': 'condition', 'name': 'Tinnitus'}
    ]
    
    # Add documents
    store.add_documents(docs, embeddings, metadata)
    
    print(f"Added {len(docs)} documents")
    print(f"Stats: {store.get_stats()}")
    
    # Search
    query_emb = [random.random() for _ in range(384)]
    results = store.search(query_emb, top_k=2)
    
    print("\nSearch Results:")
    for i, result in enumerate(results, 1):
        print(f"{i}. {result['text']} (score: {result['score']:.3f})")

