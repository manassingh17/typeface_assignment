import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Stack,
  Alert
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  AddCircle,
  Receipt
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import TransactionList from '../transactions/TransactionList';
import { useTheme } from '../../contexts/ThemeContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF99CC', '#99CCFF'];

const Dashboard = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    type: 'all',
    category: 'all',
    search: ''
  });
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Apply filters whenever transactions or filters change
  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  // Recalculate summary when filtered transactions change
  useEffect(() => {
    calculateSummary(transactions);
  }, [filteredTransactions]);

  // Refresh transactions when component comes into focus (e.g., after uploading receipt)
  useEffect(() => {
    const handleFocus = () => {
      fetchTransactions();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const applyFilters = () => {
    let filtered = [...transactions];

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(transaction => 
        new Date(transaction.date) >= new Date(filters.startDate)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(transaction => 
        new Date(transaction.date) <= new Date(filters.endDate)
      );
    }

    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(transaction => 
        transaction.type === filters.type
      );
    }

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(transaction => 
        transaction.category.toLowerCase() === filters.category.toLowerCase()
      );
    }

    // Filter by search term (description)
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.description.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredTransactions(filtered);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const fetchTransactions = async () => {
    try {
      setError('');
      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/transactions?limit=1000', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log(`Fetched ${data.transactions.length} transactions from backend`);
        setTransactions(data.transactions);
        calculateSummary(data.transactions);
      } else {
        setError(data.message || 'Failed to fetch transactions');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('An error occurred while fetching transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      setError('');
      const response = await fetch(`https://typeface-assignment-sryt.onrender.com/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh the transactions list
        fetchTransactions();
      } else {
        setError(data.message || 'Failed to delete transaction');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setError('An error occurred while deleting the transaction');
    }
  };

  const handleEditTransaction = (transaction) => {
    // Navigate to edit page with transaction data
    navigate(`/edit-transaction/${transaction._id}`, { 
      state: { transaction } 
    });
  };

  const calculateSummary = (transactions) => {
    const transactionsToUse = filters.startDate || filters.endDate || filters.type !== 'all' || filters.category !== 'all' || filters.search.trim() 
      ? filteredTransactions 
      : transactions;
    
    const income = transactionsToUse
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactionsToUse
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    setSummary({
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses
    });
  };

  const getCategoryData = () => {
    const transactionsToUse = filters.startDate || filters.endDate || filters.type !== 'all' || filters.category !== 'all' || filters.search.trim() 
      ? filteredTransactions 
      : transactions;
    
    const categoryMap = {};
    transactionsToUse
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const category = transaction.category;
        categoryMap[category] = (categoryMap[category] || 0) + transaction.amount;
      });

    return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  };

  const getMonthlyData = () => {
    const transactionsToUse = filters.startDate || filters.endDate || filters.type !== 'all' || filters.category !== 'all' || filters.search.trim() 
      ? filteredTransactions 
      : transactions;
    
    const monthlyMap = {};
    transactionsToUse.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap[monthYear]) {
        monthlyMap[monthYear] = { income: 0, expense: 0 };
      }
      
      if (transaction.type === 'income') {
        monthlyMap[monthYear].income += transaction.amount;
      } else {
        monthlyMap[monthYear].expense += transaction.amount;
      }
    });

    return Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        ...data
      }));
  };

  const SummaryCard = ({ title, amount, icon, color, bgColor }) => (
    <Box
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: bgColor,
        minHeight: 120,
        flex: 1,
        borderRadius: 3,
        border: `1px solid ${color}15`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          backgroundColor: color,
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Box
          sx={{
            backgroundColor: `${color}10`,
            borderRadius: 1.5,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1.5
          }}
        >
          {icon}
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color, mb: 0 }}>
        ${amount.toFixed(2)}
      </Typography>
    </Box>
  );

  if (loading) {
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
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Welcome back! Here's an overview of your finances.
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Box sx={{ px: 4, mb: 2 }}>
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Quick Actions */}
      <Box sx={{ px: 4, mb: 4 }}>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            size="medium"
            startIcon={<AddCircle />}
            onClick={() => navigate('/add-transaction')}
            sx={{ 
              px: 4, 
              py: 1.5,
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Add Transaction
          </Button>
          <Button
            variant="outlined"
            size="medium"
            startIcon={<Receipt />}
            onClick={() => navigate('/upload-receipt')}
            sx={{ 
              px: 4, 
              py: 1.5,
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Upload Receipt
          </Button>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ px: 4, mb: 6 }}>
        <Box sx={{ display: 'flex', gap: 4, width: '100%' }}>
          <SummaryCard
            title="Total Income"
            amount={summary.totalIncome}
            icon={<TrendingUp sx={{ color: theme.palette.success.main, fontSize: 20 }} />}
            color={theme.palette.success.main}
            bgColor={theme.palette.mode === 'dark' ? '#1b2e1b' : '#f8fff8'}
          />
          <SummaryCard
            title="Total Expenses"
            amount={summary.totalExpenses}
            icon={<TrendingDown sx={{ color: theme.palette.error.main, fontSize: 20 }} />}
            color={theme.palette.error.main}
            bgColor={theme.palette.mode === 'dark' ? '#2e1b1b' : '#fff8f8'}
          />
          <SummaryCard
            title="Current Balance"
            amount={summary.balance}
            icon={<AccountBalance sx={{ color: theme.palette.primary.main, fontSize: 20 }} />}
            color={theme.palette.primary.main}
            bgColor={theme.palette.mode === 'dark' ? '#1b1b2e' : '#f8f9ff'}
          />
        </Box>
      </Box>

      {/* Charts Section */}
      <Box sx={{ px: 4, mb: 6 }}>
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Box sx={{ p: 3, height: 400, flex: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Monthly Overview
            </Typography>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getMonthlyData()}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'dark' ? '#333' : '#f8f9fa'} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme.palette.background.paper, 
                      border: `1px solid ${theme.palette.divider}`, 
                      borderRadius: 8,
                      boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)',
                      color: theme.palette.text.primary
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: 10 }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="income" 
                    fill={theme.palette.success.main} 
                    name="Income" 
                    radius={[4, 4, 0, 0]}
                    cursor="default"
                  />
                  <Bar 
                    dataKey="expense" 
                    fill={theme.palette.error.main} 
                    name="Expense" 
                    radius={[4, 4, 0, 0]}
                    cursor="default"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          <Box sx={{ p: 3, height: 400, flex: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Expenses by Category
            </Typography>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getCategoryData()}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    cursor="default"
                    labelLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                    labelStyle={{ fontSize: '13px', fontWeight: '500', fill: theme.palette.text.primary }}
                  >
                    {getCategoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme.palette.background.paper, 
                      border: `1px solid ${theme.palette.divider}`, 
                      borderRadius: 8,
                      boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)',
                      color: theme.palette.text.primary
                    }}
                    cursor="default"
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Recent Transactions */}
      <Box sx={{ px: 4, pb: 4 }}>
        <Box sx={{ p: 4, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Recent Transactions
          </Typography>
        </Box>
        <Box sx={{ p: 4 }}>
          <TransactionList 
            refreshTrigger={filteredTransactions} 
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard; 