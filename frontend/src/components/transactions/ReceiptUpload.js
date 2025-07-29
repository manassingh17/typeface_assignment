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
  Chip
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const ReceiptUpload = ({ onTransactionsExtracted }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image (JPEG, PNG) or PDF file');
      return;
    }

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setExtractedData(null);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/transactions/upload-receipt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Receipt processed successfully!');
        setExtractedData(data);
        if (onTransactionsExtracted) {
          onTransactionsExtracted(data);
        }
      } else {
        setError(data.message || 'Failed to process receipt');
      }
    } catch (err) {
      setError('An error occurred while processing the receipt');
    } finally {
      setLoading(false);
    }
  }, [onTransactionsExtracted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handleClear = () => {
    setExtractedData(null);
    setPreviewUrl(null);
    setError('');
    setSuccess('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleSaveTransaction = async () => {
    if (!extractedData || !extractedData.amount) {
      setError('No valid transaction data to save');
      return;
    }

    setSaving(true);
    try {
      const transactionPayload = {
        type: 'expense',
        amount: parseFloat(extractedData.amount),
        category: extractedData.category || 'Other',
        description: extractedData.description || extractedData.merchant || 'Receipt transaction',
        date: extractedData.date || new Date().toISOString(),
        merchant: extractedData.merchant,
        items: extractedData.items || []
      };

      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(transactionPayload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Transaction saved successfully!');
        setTimeout(() => {
          // Navigate to dashboard and trigger a refresh
          navigate('/dashboard', { replace: true });
          window.location.reload(); // Force refresh to show new transaction at top
        }, 1500);
      } else {
        setError(data.message || 'Failed to save transaction');
      }
    } catch (err) {
      setError('An error occurred while saving the transaction');
    } finally {
      setSaving(false);
    }
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

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Upload Receipt
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
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          {isDragActive ? (
            <Typography variant="body1">Drop the file here</Typography>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                Drag and drop a receipt here, or click to select
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Supported formats: JPEG, PNG, PDF
              </Typography>
            </>
          )}
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" my={3}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Processing receipt with AI...
            </Typography>
          </Box>
        )}

        {previewUrl && !loading && (
          <Box mt={3} textAlign="center">
            <Paper
              sx={{
                p: 2,
                display: 'inline-block',
                position: 'relative',
                maxWidth: '100%'
              }}
            >
              <img
                src={previewUrl}
                alt="Receipt preview"
                style={{
                  maxWidth: '300px',
                  maxHeight: '200px',
                  objectFit: 'contain'
                }}
              />
              <IconButton
                onClick={() => setPreviewOpen(true)}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }}
              >
                <ImageIcon />
              </IconButton>
            </Paper>
          </Box>
        )}

        {extractedData && !loading && (
          <Paper sx={{ p: 3, mt: 3, backgroundColor: 'success.light', color: 'success.contrastText' }}>
            <Box display="flex" alignItems="center" mb={2}>
              <CheckCircleIcon sx={{ mr: 1 }} />
              <Typography variant="h6">AI Extraction Results</Typography>
            </Box>
            
            <Stack spacing={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body1" fontWeight="bold">Amount:</Typography>
                <Typography variant="h6" color="success.main">
                  ${extractedData.amount ? parseFloat(extractedData.amount).toFixed(2) : '0.00'}
                </Typography>
              </Box>

              {extractedData.merchant && (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1" fontWeight="bold">Merchant:</Typography>
                  <Typography variant="body1">{extractedData.merchant}</Typography>
                </Box>
              )}

              {extractedData.date && (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1" fontWeight="bold">Date:</Typography>
                  <Typography variant="body1">
                    {format(new Date(extractedData.date), 'MMM dd, yyyy')}
                  </Typography>
                </Box>
              )}

              {extractedData.category && (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1" fontWeight="bold">Category:</Typography>
                  <Chip 
                    label={extractedData.category} 
                    color={getCategoryColor(extractedData.category)}
                    size="small"
                  />
                </Box>
              )}

              {extractedData.description && (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1" fontWeight="bold">Description:</Typography>
                  <Typography variant="body1" sx={{ maxWidth: '200px', textAlign: 'right' }}>
                    {extractedData.description}
                  </Typography>
                </Box>
              )}

              {extractedData.items && extractedData.items.length > 0 && (
                <Box>
                  <Typography variant="body1" fontWeight="bold" mb={1}>Items:</Typography>
                  <List dense>
                    {extractedData.items.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Stack>

            <Box display="flex" gap={2} mt={3}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveTransaction}
                disabled={saving || !extractedData.amount}
                sx={{ flex: 1 }}
              >
                {saving ? 'Saving...' : 'Save Transaction'}
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

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Receipt Preview</DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center">
            <img
              src={previewUrl}
              alt="Receipt preview"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ReceiptUpload; 