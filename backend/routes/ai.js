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

// Fallback responses when AI is not available
function getFallbackResponse(message, summary) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('savings') || lowerMessage.includes('save')) {
    return `Based on your current financial situation:
    - Total Income: $${summary.totalIncome.toFixed(2)}
    - Total Expenses: $${summary.totalExpenses.toFixed(2)}
    - Current Balance: $${summary.balance.toFixed(2)}
    
    To improve your savings, I recommend:
    1. Create a budget and track your expenses
    2. Set aside 20% of your income for savings
    3. Look for areas to reduce spending
    4. Consider setting up automatic transfers to a savings account
    5. Build an emergency fund of 3-6 months of expenses`;
  }
  
  if (lowerMessage.includes('spending') || lowerMessage.includes('expense')) {
    const topCategories = Object.entries(summary.categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    return `Your spending analysis:
    - Total Expenses: $${summary.totalExpenses.toFixed(2)}
    - Top spending categories: ${topCategories.map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`).join(', ')}
    
    Recommendations:
    1. Review your highest spending categories
    2. Set monthly limits for each category
    3. Look for ways to reduce costs in high-spend areas
    4. Consider using the 50/30/20 rule (50% needs, 30% wants, 20% savings)`;
  }
  
  if (lowerMessage.includes('budget') || lowerMessage.includes('budgeting')) {
    return `Budgeting tips for your situation:
    - Current Income: $${summary.totalIncome.toFixed(2)}
    - Current Expenses: $${summary.totalExpenses.toFixed(2)}
    
    Budgeting strategies:
    1. 50/30/20 Rule: 50% needs, 30% wants, 20% savings
    2. Zero-based budgeting: assign every dollar a purpose
    3. Envelope method: use cash for different categories
    4. Track all expenses for at least one month
    5. Set specific, achievable financial goals`;
  }
  
  return `I can help you with financial advice! Your current financial summary:
  - Total Income: $${summary.totalIncome.toFixed(2)}
  - Total Expenses: $${summary.totalExpenses.toFixed(2)}
  - Current Balance: $${summary.balance.toFixed(2)}
  
  Ask me about:
  - Improving your savings
  - Analyzing spending patterns
  - Budgeting tips
  - Financial planning advice`;
}

// Chat endpoint
router.post('/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const summary = await getFinancialSummary(req.user._id);

    console.log('Chat request received:', message);
    console.log('Gemini AI available:', !!genAI);
    console.log('Financial summary:', summary);

    // If no API key is configured, use fallback responses
    if (!genAI) {
      console.log('Using fallback response - Gemini not available');
      const fallbackResponse = getFallbackResponse(message, summary);
      return res.json({ response: fallbackResponse });
    }

    console.log('Using Gemini AI for response');

    // Create a context-aware prompt
    const prompt = `You are an expert financial advisor with deep knowledge of personal finance, budgeting, investing, and financial planning. 

USER'S FINANCIAL PROFILE:
- Total Income: $${summary.totalIncome.toFixed(2)}
- Total Expenses: $${summary.totalExpenses.toFixed(2)}
- Current Balance: $${summary.balance.toFixed(2)}
- Expense Breakdown: ${Object.entries(summary.categories)
  .sort(([,a], [,b]) => b - a)
  .map(([category, amount]) => `${category}: $${amount.toFixed(2)}`)
  .join(', ')}
- Savings Rate: ${summary.totalIncome > 0 ? ((summary.balance / summary.totalIncome) * 100).toFixed(1) : 0}%
- Monthly Surplus/Deficit: $${summary.balance.toFixed(2)}

ANALYSIS INSTRUCTIONS:
1. Analyze their spending patterns and identify areas of concern
2. Calculate their savings rate and compare to recommended 20%
3. Identify their highest spending categories and suggest optimizations
4. Provide specific, actionable recommendations based on their unique situation
5. Consider their income level and suggest appropriate strategies
6. If they have a deficit, focus on expense reduction strategies
7. If they have surplus, suggest investment and savings strategies
8. Use their actual numbers in your analysis

USER QUESTION: ${message}

RESPONSE GUIDELINES:
- Be specific and use their actual financial numbers
- Provide 3-5 actionable steps they can take immediately
- Explain the reasoning behind your recommendations
- Consider their income level when suggesting strategies
- If they're overspending, suggest specific categories to reduce
- If they're saving well, suggest investment opportunities
- Be encouraging but realistic about their financial situation
- Use a helpful, professional tone

Please provide a comprehensive, personalized financial analysis and actionable advice:`;

    // Get response from Gemini
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      console.log('Gemini model created, generating content...');
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      console.log('Gemini response received successfully');
      res.json({ response: response.text() });
    } catch (geminiError) {
      console.error('Gemini API Error:', geminiError);
      console.log('Falling back to basic response due to Gemini error');
      
      const fallbackResponse = getFallbackResponse(message, summary);
      res.json({ response: fallbackResponse });
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    
    // If there's an API error, fall back to basic responses
    if (error.message.includes('API key') || error.message.includes('400')) {
      const summary = await getFinancialSummary(req.user._id);
      const fallbackResponse = getFallbackResponse(req.body.message, summary);
      return res.json({ response: fallbackResponse });
    }
    
    res.status(500).json({ 
      message: 'Error processing your request',
      error: error.message 
    });
  }
});

module.exports = router; 