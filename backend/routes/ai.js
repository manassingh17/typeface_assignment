const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Initialize Generative AI with your API key
let genAI = null;
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);

if (process.env.GEMINI_API_KEY && 
    process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here' && 
    process.env.GEMINI_API_KEY.length > 10) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini AI initialized successfully');
  } catch (error) {
    console.error('Error initializing Gemini AI:', error);
    genAI = null;
  }
} else {
  console.log('Gemini AI not initialized - invalid or missing API key');
}

// Helper function to get user's financial summary
async function getFinancialSummary(userId) {
  const transactions = await Transaction.find({ user: userId }).sort({ date: -1 }).limit(100);
  
  const summary = transactions.reduce((acc, transaction) => {
    if (transaction.type === 'income') {
      acc.totalIncome += transaction.amount;
    } else {
      acc.totalExpenses += transaction.amount;
      acc.categories[transaction.category] = (acc.categories[transaction.category] || 0) + transaction.amount;
    }
    return acc;
  }, { totalIncome: 0, totalExpenses: 0, categories: {} });

  summary.balance = summary.totalIncome - summary.totalExpenses;
  return summary;
}

// Chat endpoint
router.post('/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const summary = await getFinancialSummary(req.user._id);

    console.log('Chat request received:', message);
    console.log('Gemini AI available:', !!genAI);
    console.log('Financial summary:', summary);

    // If no API key is configured, return error
    if (!genAI) {
      console.log('Gemini AI not available - API key not configured');
      return res.status(500).json({ 
        message: 'AI service not available. Please configure Gemini API key.' 
      });
    }

    console.log('Using Gemini AI for response');

    // Create a context-aware prompt
    const prompt = `You are a helpful AI assistant. You can help with general questions and provide financial advice when relevant.

USER'S FINANCIAL PROFILE (for financial questions only):
- Total Income: $${summary.totalIncome.toFixed(2)}
- Total Expenses: $${summary.totalExpenses.toFixed(2)}
- Current Balance: $${summary.balance.toFixed(2)}
- Expense Breakdown: ${Object.entries(summary.categories)
  .sort(([,a], [,b]) => b - a)
  .map(([category, amount]) => `${category}: $${amount.toFixed(2)}`)
  .join(', ')}
- Savings Rate: ${summary.totalIncome > 0 ? ((summary.balance / summary.totalIncome) * 100).toFixed(1) : 0}%
- Monthly Surplus/Deficit: $${summary.balance.toFixed(2)}

INSTRUCTIONS:
1. If the user asks a general question (not financial), answer it directly and helpfully
2. If the user asks about finances, money, budgeting, spending, or savings, provide personalized financial advice using their data
3. Be conversational, helpful, and accurate
4. For financial questions, provide specific, actionable recommendations
5. For general questions, be informative and engaging

USER QUESTION: ${message}

Please provide a helpful response:`;

    // Get response from Gemini
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      console.log('Gemini model created, generating content...');
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      console.log('Gemini response received successfully');
      res.json({ response: response.text() });
    } catch (geminiError) {
      console.error('Gemini API Error:', geminiError);
      res.status(500).json({ 
        message: 'AI service temporarily unavailable. Please try again later.',
        error: geminiError.message 
      });
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      message: 'Error processing your request',
      error: error.message 
    });
  }
});

module.exports = router; 