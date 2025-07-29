import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const incomeCategories = [
  'Salary',
  'Freelance',
  'Gift',
  'Investment',
  'Business',
  'Bonus',
  'Commission',
  'Other'
];

const expenseCategories = [
  'Food',
  'Transportation',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Education',
  'Other'
];

const TransactionForm = ({ onTransactionAdded }) => {
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date()
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Reset category when type changes
    if (name === 'type') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        category: '' // Reset category when type changes
      }));
    }
  };

  const handleDateChange = (date) => {
    setFormData({
      ...formData,
      date
    });
  };

  // Get the appropriate categories based on transaction type
  const getCategories = () => {
    return formData.type === 'income' ? incomeCategories : expenseCategories;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Transaction added successfully!');
        setFormData({
          type: 'expense',
          amount: '',
          category: '',
          description: '',
          date: new Date()
        });
        if (onTransactionAdded) {
          onTransactionAdded(data);
        }
      } else {
        setError(data.message || 'Failed to add transaction');
      }
    } catch (err) {
      setError('An error occurred while adding the transaction');
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 500, mx: 'auto', mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Add New Transaction
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <FormControl fullWidth margin="normal">
          <InputLabel>Type</InputLabel>
          <Select
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
          >
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </Select>
        </FormControl>

        <TextField
          margin="normal"
          required
          fullWidth
          label="Amount"
          name="amount"
          type="number"
          value={formData.amount}
          onChange={handleChange}
          inputProps={{ min: "0", step: "0.01" }}
        />

        <FormControl fullWidth margin="normal">
          <InputLabel>Category</InputLabel>
          <Select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            {getCategories().map((category) => (
              <MenuItem key={category} value={category.toLowerCase()}>
                {category}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          margin="normal"
          required
          fullWidth
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
        />

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Date"
            value={formData.date}
            onChange={handleDateChange}
            renderInput={(params) => (
              <TextField {...params} fullWidth margin="normal" required />
            )}
          />
        </LocalizationProvider>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3 }}
        >
          Add Transaction
        </Button>
      </Box>
    </Paper>
  );
};

export default TransactionForm; 