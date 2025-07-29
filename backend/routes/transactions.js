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
    const transaction = new Transaction({
      ...req.body,
      user: req.user._id,
      date: req.body.date || new Date() // Use current date if not provided
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
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

    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        Extract the following information from this receipt text in JSON format:
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
          const aiExtracted = JSON.parse(text);
          extractedData = {
            amount: aiExtracted.amount ? parseFloat(aiExtracted.amount) : null,
            date: aiExtracted.date ? new Date(aiExtracted.date) : new Date(),
            merchant: aiExtracted.merchant || null,
            category: aiExtracted.category || 'Other',
            description: aiExtracted.description || 'Receipt purchase',
            items: aiExtracted.items || []
          };
        } catch (parseError) {
          console.log('Failed to parse AI response:', text);
          // Fall back to basic extraction
        }
      } catch (aiError) {
        console.log('AI extraction failed, using fallback:', aiError.message);
        // Fall back to basic extraction
      }
    }

    // Fallback to basic extraction if AI fails or is not available
    if (!extractedData.amount) {
      const amountMatch = extractedText.match(/\$?\s*\d+\.\d{2}/);
      const dateMatch = extractedText.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/);
      const merchantMatch = extractedText.match(/^[A-Z\s]+/m);

      extractedData = {
        amount: amountMatch ? parseFloat(amountMatch[0].replace('$', '')) : null,
        date: dateMatch ? new Date(dateMatch[0]) : new Date(),
        merchant: merchantMatch ? merchantMatch[0].trim() : null,
        category: 'Other',
        description: 'Receipt purchase',
        items: []
      };
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

    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
          const aiExtracted = JSON.parse(text);
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
                    category: transaction.category || 'Other',
                    tempId: `ai-${index}`
                  });
                }
              }
            });
            
            transactions = uniqueTransactions;
            console.log(`Successfully extracted ${transactions.length} unique transactions (removed ${aiExtracted.length - transactions.length} duplicates)`);
          } else {
            console.log('AI response is not an array:', typeof aiExtracted);
          }
        } catch (parseError) {
          console.log('Failed to parse AI response:', text);
          console.log('Parse error:', parseError.message);
        }
      } catch (aiError) {
        console.log('AI extraction failed:', aiError.message);
      }
    } else {
      console.log('GEMINI_API_KEY not found, skipping AI processing');
    }

    // Fallback: If AI didn't extract any transactions, try basic text parsing
    if (transactions.length === 0) {
      console.log('No transactions found by AI, trying selective fallback parsing...');
      
      // Look for patterns in the text
      const lines = extractedText.split('\n').filter(line => line.trim());
      const potentialTransactions = [];
      const seen = new Set(); // Track seen transactions to avoid duplicates
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for amounts with currency symbols first (more likely to be transactions)
        const currencyMatches = line.match(/[\$₹€£]\s*(\d+\.?\d*)/g);
        if (currencyMatches) {
          for (let j = 0; j < currencyMatches.length; j++) {
            const amount = parseFloat(currencyMatches[j].replace(/[\$₹€£\s]/g, ''));
            if (amount > 0.01) {
              let description = line.replace(/[\$₹€£]\s*\d+\.?\d*/g, '').trim();
              if (!description) {
                if (i > 0) description = lines[i-1].trim();
                if (!description && i < lines.length - 1) description = lines[i+1].trim();
              }
              
              description = description.replace(/[^\w\s]/g, '').trim();
              if (description.length > 50) description = description.substring(0, 50);
              if (!description) description = `Transaction ${amount}`;
              
              const key = `${amount}-${description}`;
              if (!seen.has(key)) {
                seen.add(key);
                potentialTransactions.push({
                  date: new Date().toISOString(),
                  description: description,
                  amount: amount,
                  type: 'expense',
                  category: 'Other',
                  tempId: `currency-${i}-${j}`
                });
              }
            }
          }
        }
        
        // Look for standalone numbers that could be amounts (less aggressive)
        const amountMatches = line.match(/\b(\d+\.?\d*)\b/g);
        if (amountMatches) {
          for (let j = 0; j < amountMatches.length; j++) {
            const amount = parseFloat(amountMatches[j]);
            
            // Only include reasonable amounts (not too small, not too large)
            if (amount > 1 && amount < 100000) {
              let description = line.replace(/\d+\.?\d*/g, '').trim();
              if (!description) {
                if (i > 0) description = lines[i-1].trim();
                if (!description && i < lines.length - 1) description = lines[i+1].trim();
              }
              
              description = description.replace(/[^\w\s]/g, '').trim();
              if (description.length > 50) description = description.substring(0, 50);
              if (!description) description = `Transaction ${amount}`;
              
              const key = `${amount}-${description}`;
              if (!seen.has(key)) {
                seen.add(key);
                potentialTransactions.push({
                  date: new Date().toISOString(),
                  description: description,
                  amount: amount,
                  type: 'expense',
                  category: 'Other',
                  tempId: `amount-${i}-${j}`
                });
              }
            }
          }
        }
      }
      
      if (potentialTransactions.length > 0) {
        console.log(`Found ${potentialTransactions.length} unique potential transactions using selective fallback method`);
        transactions = potentialTransactions;
      }
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

        validTransactions.push({
          user: req.user._id,
          amount: amount,
          description: description,
          date: date.toISOString(),
          type: type,
          category: category.toLowerCase(),
          merchant: transaction.merchant || null,
          items: transaction.items || []
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