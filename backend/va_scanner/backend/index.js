const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'va-scanner-backend' });
});

app.use((err, req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`VA Scanner backend running on port ${PORT}`);
});

