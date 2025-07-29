import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

import MainLayout from './components/layouts/MainLayout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import TransactionForm from './components/transactions/TransactionForm';
import EditTransaction from './components/transactions/EditTransaction';
import ReceiptUpload from './components/transactions/ReceiptUpload';
import PdfTransactionUpload from './components/transactions/PdfTransactionUpload';
import AIChat from './components/ai/AIChat';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

const App = () => {
  const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <CircularProgress />
        </Box>
      );
    }

    return user ? children : <Navigate to="/login" />;
  };

  return (
    <ThemeProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Dashboard />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/add-transaction"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <TransactionForm />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/edit-transaction/:id"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <EditTransaction />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/upload-receipt"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <ReceiptUpload />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/upload-pdf-transactions"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <PdfTransactionUpload />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/ai-chat"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <AIChat />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </AuthProvider>
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default App;
