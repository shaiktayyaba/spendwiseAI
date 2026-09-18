require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { verifyFirebaseToken } = require('./auth');
const { handleGenerateInsights } = require('./insights');
const { handleChatQuery } = require('./chat');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SpendWise AI Gemini Backend',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timestamp: Date.now()
  });
});

// Authenticated AI Insights generation
app.post('/api/ai/insights', verifyFirebaseToken, handleGenerateInsights);

// Authenticated AI Chat assistant
app.post('/api/ai/chat', verifyFirebaseToken, handleChatQuery);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SpendWise AI Backend listening on port ${PORT}`);
});
