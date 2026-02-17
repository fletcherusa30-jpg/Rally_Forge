const { query } = require('../db');

exports.registerDocument = async (req, res, next) => {
  try {
    const { veteran_id, claim_id, document_type, source, source_reference, checksum_sha256, storage_uri, mime_type, page_count, received_at, indexed_at, metadata } = req.body;
    const result = await query(
      `INSERT INTO cp.documents (veteran_id, claim_id, document_type, source, source_reference, checksum_sha256, storage_uri, mime_type, page_count, received_at, indexed_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [veteran_id, claim_id, document_type, source, source_reference, checksum_sha256, storage_uri, mime_type, page_count, received_at, indexed_at, JSON.stringify(metadata || {})]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const result = await query('SELECT * FROM cp.documents WHERE document_id = $1', [documentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
