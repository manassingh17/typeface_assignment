const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Input validation middleware
const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid input types' });
  }
  next();
};

const validateRegisterInput = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid input types' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  next();
};

// Register
router.post('/register', validateRegisterInput, async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password // Password will be hashed by the pre-save middleware
    });

    await user.save();
    console.log('User registered successfully:', email);

    // Create token for immediate login
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response with token and user data
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ 
      message: 'Error registering user', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', validateLoginInput, async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.email);
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('Login failed - user not found:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Login failed - invalid password:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful:', email);

    // Send response
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Error logging in', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 