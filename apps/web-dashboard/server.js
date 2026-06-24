/**
 * Quantum Hub Web Dashboard — Static Server
 * Serves the dashboard HTML/JS/CSS from the public directory.
 */

'use strict';

const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Quantum Hub Dashboard running at http://localhost:${PORT}`);
});
