import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Typography,
  Box,
  Chip,
  TextField,
  MenuItem,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  FilterList as FilterIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useTheme } from '../../contexts/ThemeContext';

const categories = [
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

const TransactionList = ({ onEdit, onDelete, refreshTrigger, filters, onFilterChange }) => {
  const { theme } = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem('transactionListRowsPerPage');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters || {
    startDate: null,
    endDate: null,
    type: 'all',
    category: 'all',
    search: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Sync local filters with parent filters
  useEffect(() => {
    if (filters) {
      setLocalFilters(filters);
    }
  }, [filters]);

  // Reset page to 0 when data changes
  useEffect(() => {
    setPage(0);
  }, [refreshTrigger]);

  // Ensure page doesn't exceed available data
  useEffect(() => {
    const maxPage = Math.ceil((refreshTrigger?.length || 0) / rowsPerPage) - 1;
    if (page > maxPage && maxPage >= 0) {
      setPage(maxPage);
    }
  }, [refreshTrigger, rowsPerPage, page]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    localStorage.setItem('transactionListRowsPerPage', newRowsPerPage.toString());
    setPage(0);
  };

  const handleFilterChange = (field) => (event) => {
    const newFilters = {
      ...localFilters,
      [field]: event.target.value
    };
    setLocalFilters(newFilters);
  };

  const handleDateChange = (field) => (date) => {
    const newFilters = {
      ...localFilters,
      [field]: date
    };
    setLocalFilters(newFilters);
  };

  const handleApplyFilters = () => {
    if (onFilterChange) {
      onFilterChange(localFilters);
    }
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      startDate: null,
      endDate: null,
      type: 'all',
      category: 'all',
      search: ''
    };
    setLocalFilters(clearedFilters);
    if (onFilterChange) {
      onFilterChange(clearedFilters);
    }
    setFilterOpen(false);
  };

  const handleDeleteClick = (transaction) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedTransaction && onDelete) {
      onDelete(selectedTransaction._id);
    }
    setDeleteDialogOpen(false);
    setSelectedTransaction(null);
  };

  const getStatusColor = (type) => {
    return type === 'income' ? 'success' : 'error';
  };

  const FilterDialog = () => (
    <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Filter Transactions</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={localFilters.startDate}
              onChange={handleDateChange('startDate')}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
            <DatePicker
              label="End Date"
              value={localFilters.endDate}
              onChange={handleDateChange('endDate')}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>

          <TextField
            select
            label="Type"
            value={localFilters.type}
            onChange={handleFilterChange('type')}
            fullWidth
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </TextField>

          <TextField
            select
            label="Category"
            value={localFilters.category}
            onChange={handleFilterChange('category')}
            fullWidth
          >
            <MenuItem value="all">All Categories</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category} value={category.toLowerCase()}>
                {category}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Search"
            value={localFilters.search}
            onChange={handleFilterChange('search')}
            fullWidth
            placeholder="Search by description..."
            InputProps={{
              endAdornment: <SearchIcon color="action" />
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClearFilters}>Clear Filters</Button>
        <Button onClick={() => setFilterOpen(false)}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleApplyFilters}
        >
          Apply Filters
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Transaction History</Typography>
        <Button
          startIcon={<FilterIcon />}
          onClick={() => setFilterOpen(true)}
          variant="outlined"
          size="small"
        >
          Filter
        </Button>
      </Box>
      
      <TableContainer sx={{ maxHeight: 500 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ 
                fontWeight: 600, 
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#fafafa' 
              }}>
                Date
              </TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#fafafa' 
              }}>
                Description
              </TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#fafafa' 
              }}>
                Category
              </TableCell>
              <TableCell sx={{ 
                fontWeight: 600, 
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#fafafa' 
              }}>
                Type
              </TableCell>
              <TableCell align="right" sx={{ 
                fontWeight: 600, 
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#fafafa' 
              }}>
                Amount
              </TableCell>
              <TableCell align="center" sx={{ 
                fontWeight: 600, 
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#fafafa' 
              }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(refreshTrigger) && refreshTrigger.length > 0 ? (
              refreshTrigger
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((transaction) => (
                <TableRow hover key={transaction._id}>
                  <TableCell>
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{transaction.description}</TableCell>
                  <TableCell>
                    <Chip 
                      label={transaction.category} 
                      size="small"
                      sx={{ 
                        textTransform: 'capitalize',
                        fontWeight: 500,
                        backgroundColor: theme.palette.primary.light,
                        color: theme.palette.primary.contrastText
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.type}
                      color={getStatusColor(transaction.type)}
                      size="small"
                      sx={{ 
                        textTransform: 'capitalize',
                        fontWeight: 600
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      component="span"
                      sx={{
                        color: transaction.type === 'income' ? 'success.main' : 'error.main',
                        fontWeight: 700,
                        fontSize: '1rem'
                      }}
                    >
                      ${transaction.amount.toFixed(2)}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(transaction)}
                      sx={{ 
                        mr: 1,
                        color: theme.palette.primary.main,
                        '&:hover': {
                          backgroundColor: theme.palette.primary.light,
                          color: theme.palette.primary.contrastText
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(transaction)}
                      color="error"
                      sx={{
                        '&:hover': {
                          backgroundColor: theme.palette.error.light,
                          color: theme.palette.error.contrastText
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    {Array.isArray(refreshTrigger) && refreshTrigger.length > 0 
                      ? 'No transactions on this page.' 
                      : 'No transactions found. Add your first transaction to get started!'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {Array.isArray(refreshTrigger) && refreshTrigger.length > 0 && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={refreshTrigger.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ 
            mt: 2,
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              color: theme.palette.text.primary
            }
          }}
        />
      )}

      <FilterDialog />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this transaction? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TransactionList; 