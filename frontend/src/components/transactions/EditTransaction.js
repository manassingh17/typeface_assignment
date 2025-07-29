import React, { useState, useEffect } from 'react';
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
  Alert,
  CircularProgress
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

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

const EditTransaction = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date()
  });

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      setLoading(true);
      const response = await fetch(`https://typeface-assignment-sryt.onrender.com/api/transactions/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setFormData({
          type: data.type,
          amount: data.amount.toString(),
          category: data.category,
          description: data.description,
          date: new Date(data.date).toISOString().split('T')[0]
        });
      } else {
        setError(data.message || 'Failed to fetch transaction');
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
      setError('An error occurred while fetching the transaction');
    } finally {
      setLoading(false);
    }
  };

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
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://typeface-assignment-sryt.onrender.com/api/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Transaction updated successfully!');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setError(data.message || 'Failed to update transaction');
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      setError('An error occurred while updating the transaction');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100vh', overflow: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ p: 4, pb: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          Edit Transaction
        </Typography>
        <Typography variant="h6" color="textSecondary">
          Update your transaction details below.
        </Typography>
      </Box>

      <Box sx={{ px: 4, pb: 4 }}>
        <Paper sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

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

            <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button
                type="button"
                variant="outlined"
                onClick={() => navigate('/dashboard')}
                sx={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ flex: 1 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Update Transaction'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default EditTransaction; 