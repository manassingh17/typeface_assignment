require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

// Routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const aiRoutes = require('./routes/ai');

// Debug environment variables
console.log('Environment variables after dotenv.config():');
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// MongoDB Connection with proper error handling
const connectDB = async () => {
  try {
    // For now, use local MongoDB for development
    const mongoURI = 'mongodb://127.0.0.1:27017/finance_assistant';
    console.log('Connecting to local MongoDB for development...');
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to local MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 