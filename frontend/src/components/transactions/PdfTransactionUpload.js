import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  PictureAsPdf as PdfIcon,
  Save as SaveIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const PdfTransactionUpload = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [extractedTransactions, setExtractedTransactions] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setExtractedTransactions([]);
    setSelectedTransactions([]);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/transactions/upload-pdf-transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully extracted ${data.transactions.length} transactions from PDF!`);
        setExtractedTransactions(data.transactions);
        // Select all transactions by default
        setSelectedTransactions(data.transactions.map((t, index) => t._id || t.tempId || `temp-${index}`));
      } else {
        setError(data.message || 'Failed to process PDF');
      }
    } catch (err) {
      setError('An error occurred while processing the PDF');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handleClear = () => {
    setExtractedTransactions([]);
    setSelectedTransactions([]);
    setError('');
    setSuccess('');
  };

  const handleSaveTransactions = async () => {
    if (selectedTransactions.length === 0) {
      setError('Please select at least one transaction to save');
      return;
    }

    setSaving(true);
    try {
      const transactionsToSave = extractedTransactions.filter(t => {
        const index = extractedTransactions.indexOf(t);
        const tempId = t._id || t.tempId || `temp-${index}`;
        return selectedTransactions.includes(tempId);
      });

      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/transactions/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ transactions: transactionsToSave })
      });

      const data = await response.json();

      if (response.ok) {
        const message = data.invalidCount > 0 
          ? `Successfully saved ${data.savedCount} transactions! (${data.invalidCount} invalid transactions skipped)`
          : `Successfully saved ${data.savedCount} transactions!`;
        
        setSuccess(message);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
          window.location.reload();
        }, 1500);
      } else {
        if (data.invalidTransactions && data.invalidTransactions.length > 0) {
          const invalidDetails = data.invalidTransactions.map(inv => 
            `Transaction ${inv.index + 1}: ${inv.reason}`
          ).join(', ');
          setError(`Failed to save transactions: ${data.message}. Invalid transactions: ${invalidDetails}`);
        } else {
          setError(data.message || 'Failed to save transactions');
        }
      }
    } catch (err) {
      setError('An error occurred while saving the transactions');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = () => {
    const allTransactionIds = extractedTransactions.map((t, index) => t._id || t.tempId || `temp-${index}`);
    const allSelected = allTransactionIds.every(id => selectedTransactions.includes(id));
    
    if (allSelected) {
      // If all are selected, deselect all
      setSelectedTransactions([]);
    } else {
      // If not all are selected, select all
      setSelectedTransactions(allTransactionIds);
    }
  };

  const handleSelectTransaction = (transactionId) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Food': 'success',
      'Transportation': 'info',
      'Housing': 'warning',
      'Utilities': 'secondary',
      'Entertainment': 'primary',
      'Healthcare': 'error',
      'Shopping': 'default',
      'Education': 'info',
      'Other': 'default'
    };
    return colors[category] || 'default';
  };

  const getTypeColor = (type) => {
    return type === 'income' ? 'success' : 'error';
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Upload PDF Transaction History
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Upload a PDF containing transaction history in tabular format. The AI will extract and categorize each transaction.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover'
            }
          }}
        >
          <input {...getInputProps()} />
          <PdfIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          {isDragActive ? (
            <Typography variant="body1">Drop the PDF file here</Typography>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                Drag and drop a PDF transaction history here, or click to select
              </Typography>
              <Typography variant="body2" color="textSecondary">
                The PDF should contain transaction data in a table format
              </Typography>
            </>
          )}
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" my={3}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Processing PDF with AI...
            </Typography>
          </Box>
        )}

        {extractedTransactions.length > 0 && !loading && (
          <Paper sx={{ p: 3, mt: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" alignItems="center">
                <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
                <Typography variant="h6">Extracted Transactions</Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleSelectAll}
              >
                {(() => {
                  const allTransactionIds = extractedTransactions.map(t => t._id || t.tempId);
                  const allSelected = allTransactionIds.every(id => selectedTransactions.includes(id));
                  return allSelected ? 'Deselect All' : 'Select All';
                })()}
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <input
                        type="checkbox"
                        checked={(() => {
                          const allTransactionIds = extractedTransactions.map(t => t._id || t.tempId);
                          return allTransactionIds.every(id => selectedTransactions.includes(id));
                        })()}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {extractedTransactions.map((transaction, index) => {
                    const tempId = transaction._id || transaction.tempId || `temp-${index}`;
                    const isSelected = selectedTransactions.includes(tempId);
                    
                    return (
                      <TableRow 
                        key={tempId}
                        hover
                        selected={isSelected}
                        onClick={() => handleSelectTransaction(tempId)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectTransaction(tempId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          {transaction.date ? format(new Date(transaction.date), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>
                          <Chip 
                            label={transaction.category} 
                            color={getCategoryColor(transaction.category)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={transaction.type}
                            color={getTypeColor(transaction.type)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              color: transaction.type === 'income' ? 'success.main' : 'error.main',
                              fontWeight: 600
                            }}
                          >
                            ${transaction.amount ? parseFloat(transaction.amount).toFixed(2) : '0.00'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Box display="flex" gap={2} mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveTransactions}
                disabled={saving || selectedTransactions.length === 0}
                sx={{ flex: 1 }}
              >
                {saving ? 'Saving...' : `Save ${selectedTransactions.length} Transaction${selectedTransactions.length !== 1 ? 's' : ''}`}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClear}
                disabled={saving}
              >
                Clear
              </Button>
            </Box>
          </Paper>
        )}
      </Paper>
    </Stack>
  );
};

export default PdfTransactionUpload;