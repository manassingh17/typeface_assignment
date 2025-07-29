const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
    }
  }
});

// Get all transactions with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const type = req.query.type;
    const category = req.query.category;

    const query = { user: req.user._id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    if (type) query.type = type;
    if (category) query.category = category;

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1, date: -1 }) // Sort by creation time first, then by date
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
});

// Add new transaction
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating transaction with data:', req.body);
    
    // Convert items array from strings to objects if needed
    let items = req.body.items || [];
    if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'string') {
      items = items.map(item => ({ description: item, amount: 0 }));
    }
    
    const transaction = new Transaction({
      ...req.body,
      user: req.user._id,
      date: req.body.date || new Date(), // Use current date if not provided
      category: req.body.category ? req.body.category.toLowerCase() : 'other', // Ensure category is lowercase
      items: items // Use the converted items array
    });

    console.log('Transaction object before save:', transaction);
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Error creating transaction', error: error.message });
  }
});

// Get single transaction by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transaction', error: error.message });
  }
});

// Upload and process receipt
router.post('/upload-receipt', auth, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let extractedText = '';
    const filePath = req.file.path;

    // Process based on file type
    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else {
      const { data: { text } } = await Tesseract.recognize(filePath);
      extractedText = text;
    }

    // Use Gemini AI to extract structured data from receipt
    let extractedData = {
      amount: null,
      date: null,
      merchant: null,
      category: null,
      description: null,
      items: []
    };

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'Gemini API key not configured. Please configure the API key to use receipt upload.' });
    }

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = `
      You are a receipt data extraction expert. Extract the following information from this receipt text in JSON format:
      {
        "amount": "total amount (number only, no currency symbol)",
        "date": "date in YYYY-MM-DD format",
        "merchant": "store/merchant name",
        "category": "one of: Food, Transportation, Housing, Utilities, Entertainment, Healthcare, Shopping, Education, Other",
        "description": "brief description of the purchase",
        "items": ["list of items purchased"]
      }

      Receipt text:
      ${extractedText}

      Return only the JSON object, no additional text.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Try to parse the JSON response
      try {
        // Handle markdown-formatted JSON responses
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const aiExtracted = JSON.parse(jsonText);
        extractedData = {
          amount: aiExtracted.amount ? parseFloat(aiExtracted.amount) : null,
          date: aiExtracted.date ? new Date(aiExtracted.date) : new Date(),
          merchant: aiExtracted.merchant || null,
          category: aiExtracted.category ? aiExtracted.category.toLowerCase() : 'other',
          description: aiExtracted.description || 'Receipt purchase',
          items: aiExtracted.items || []
        };
      } catch (parseError) {
        console.log('Failed to parse AI response:', text);
        return res.status(500).json({ message: 'Failed to parse AI response. Please try again.' });
      }
    } catch (aiError) {
      console.log('AI extraction failed:', aiError.message);
      return res.status(500).json({ message: 'AI extraction failed. Please try again.' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Use current date for new transactions instead of extracted date
    extractedData.date = new Date().toISOString();
    
    res.json(extractedData);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error processing receipt', error: error.message });
  }
});

// Upload and process PDF transaction history
router.post('/upload-pdf-transactions', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Please upload a valid PDF file' });
    }

    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const extractedText = data.text;

    console.log('Extracted PDF text:', extractedText.substring(0, 500)); // Log first 500 chars

    let transactions = [];

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'Gemini API key not configured. Please configure the API key to use PDF upload.' });
    }

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = `
      You are a financial data extraction expert. Analyze this PDF text and extract ALL unique financial transactions.

      IMPORTANT: Be FLEXIBLE and handle ANY format:
      - Tables, lists, paragraphs, scattered data
      - Any currency symbols ($, ₹, €, £, etc.)
      - Any date formats (convert to YYYY-MM-DD)
      - Any amount formats (numbers, decimals, etc.)
      - Any description formats (titles, details, etc.)

      Extraction Rules:
      1. Find UNIQUE transactions only (no duplicates)
      2. If information is missing, use defaults:
         - Missing date → use current date
         - Missing description → use "Transaction"
         - Missing amount → skip (don't create transaction)
         - Missing type → guess based on context
         - Missing category → use "Other"
      3. Handle ANY structure - don't expect specific formats
      4. Look for patterns but don't require them
      5. Be creative in finding financial data

      For each UNIQUE transaction found, create:
      {
        "date": "YYYY-MM-DD (current date if not found)",
        "description": "any text describing the transaction (or 'Transaction' if unclear)",
        "amount": "number only (skip if no amount found)",
        "type": "income or expense (guess based on context)",
        "category": "Food, Transportation, Housing, Utilities, Entertainment, Healthcare, Shopping, Education, Other"
      }

      Guidelines:
      - If you see the same transaction multiple times, include it ONCE only
      - If amount is unclear or missing, skip that transaction
      - If description is unclear, use "Transaction" + amount
      - If type is unclear, default to "expense"
      - If category is unclear, use "Other"
      - Don't create transactions without amounts
      - Don't duplicate transactions

      PDF text to analyze:
      ${extractedText}

      Return ONLY a JSON array of UNIQUE transactions. If no valid transactions found, return empty array.
      Focus on quality over quantity - better to extract fewer accurate transactions than many duplicates.
      `;

      console.log('Sending prompt to Gemini AI...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini AI response:', text.substring(0, 500)); // Log first 500 chars
      
      try {
        // Handle markdown-formatted JSON responses
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const aiExtracted = JSON.parse(jsonText);
        if (Array.isArray(aiExtracted)) {
          // Deduplicate transactions based on amount and description
          const uniqueTransactions = [];
          const seen = new Set();
          
          aiExtracted.forEach((transaction, index) => {
            if (transaction.amount) {
              const key = `${transaction.amount}-${transaction.description}`;
              if (!seen.has(key)) {
                seen.add(key);
                uniqueTransactions.push({
                  ...transaction,
                  amount: transaction.amount ? parseFloat(transaction.amount) : 0,
                  date: transaction.date ? new Date(transaction.date).toISOString() : new Date().toISOString(),
                  type: transaction.type || 'expense',
                  category: transaction.category ? transaction.category.toLowerCase() : 'other',
                  tempId: `ai-${index}`
                });
              }
            }
          });
          
          transactions = uniqueTransactions;
          console.log(`Successfully extracted ${transactions.length} unique transactions (removed ${aiExtracted.length - transactions.length} duplicates)`);
        } else {
          console.log('AI response is not an array:', typeof aiExtracted);
          return res.status(500).json({ message: 'AI response format is invalid. Please try again.' });
        }
      } catch (parseError) {
        console.log('Failed to parse AI response:', text);
        console.log('Parse error:', parseError.message);
        return res.status(500).json({ message: 'Failed to parse AI response. Please try again.' });
      }
    } catch (aiError) {
      console.log('AI extraction failed:', aiError.message);
      return res.status(500).json({ message: 'AI extraction failed. Please try again.' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ transactions });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error processing PDF', error: error.message });
  }
});

// Bulk create transactions
router.post('/bulk-create', auth, async (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ message: 'No transactions provided' });
    }

    // Validate and clean each transaction
    const validTransactions = [];
    const invalidTransactions = [];

    transactions.forEach((transaction, index) => {
      try {
        // Ensure amount is a valid number
        const amount = parseFloat(transaction.amount);
        if (isNaN(amount) || amount <= 0) {
          invalidTransactions.push({ index, reason: 'Invalid amount' });
          return;
        }

        // Ensure description exists and is not empty
        const description = transaction.description?.trim();
        if (!description || description.length === 0) {
          invalidTransactions.push({ index, reason: 'Missing description' });
          return;
        }

        // Validate date
        let date;
        try {
          date = transaction.date ? new Date(transaction.date) : new Date();
          if (isNaN(date.getTime())) {
            date = new Date();
          }
        } catch (dateError) {
          date = new Date();
        }

        // Validate type
        const type = ['income', 'expense'].includes(transaction.type) ? transaction.type : 'expense';

        // Validate category
        const validCategories = ['Food', 'Transportation', 'Housing', 'Utilities', 'Entertainment', 'Healthcare', 'Shopping', 'Education', 'Other'];
        const category = validCategories.includes(transaction.category) ? transaction.category : 'Other';

        // Validate items array
        let items = transaction.items || [];
        if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'string') {
          items = items.map(item => ({ description: item, amount: 0 }));
        }

        validTransactions.push({
          user: req.user._id,
          amount: amount,
          description: description,
          date: date.toISOString(),
          type: type,
          category: category.toLowerCase(),
          merchant: transaction.merchant || null,
          items: items
        });
      } catch (error) {
        invalidTransactions.push({ index, reason: 'Invalid transaction data' });
      }
    });

    if (validTransactions.length === 0) {
      return res.status(400).json({ 
        message: 'No valid transactions to save',
        invalidTransactions 
      });
    }

    console.log(`Saving ${validTransactions.length} valid transactions, ${invalidTransactions.length} invalid transactions skipped`);

    const savedTransactions = await Transaction.insertMany(validTransactions);

    res.json({ 
      message: 'Transactions saved successfully',
      savedCount: savedTransactions.length,
      invalidCount: invalidTransactions.length,
      transactions: savedTransactions,
      invalidTransactions
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ message: 'Error saving transactions', error: error.message });
  }
});

// Update transaction
router.put('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error updating transaction', error: error.message });
  }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction', error: error.message });
  }
});

module.exports = router; 