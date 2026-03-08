const documents = [];

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function addDocument(id, text, embedding) {
  if (!id) {
    throw new Error('id is required');
  }

  if (typeof text !== 'string') {
    throw new Error('text must be a string');
  }

  if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === 'number')) {
    throw new Error('embedding must be a numeric vector');
  }

  const existingIndex = documents.findIndex((doc) => doc.id === id);
  const nextDocument = { id, text, embedding };

  if (existingIndex >= 0) {
    documents[existingIndex] = nextDocument;
  } else {
    documents.push(nextDocument);
  }
}

export function search(queryEmbedding, limit = 5) {
  if (!Array.isArray(queryEmbedding) || !queryEmbedding.every((value) => typeof value === 'number')) {
    throw new Error('queryEmbedding must be a numeric vector');
  }

  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;

  const scored = documents
    .map((doc) => ({
      id: doc.id,
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, safeLimit);

  return scored;
}

// In-memory implementation for now.
// Future upgrade path: swap documents[] with persistent vector database adapter.
