import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  CircularProgress,
  Divider,
  useTheme,
  Avatar,
  Chip
} from '@mui/material';
import { useTheme as useCustomTheme } from '../../contexts/ThemeContext';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  AttachMoney,
  TrendingUp,
  Assessment
} from '@mui/icons-material';

const suggestedQuestions = [
  {
    text: "How can I improve my savings?",
    icon: <TrendingUp fontSize="small" />
  },
  {
    text: "Analyze my spending patterns",
    icon: <Assessment fontSize="small" />
  },
  {
    text: "Tips for budgeting",
    icon: <AttachMoney fontSize="small" />
  }
];

const AIChat = () => {
  const theme = useTheme();
  const { theme: customTheme } = useCustomTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = text.trim();
    setInput('');
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setLoading(true);

    try {
      const response = await fetch('https://typeface-assignment-sryt.onrender.com/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, { text: data.response, sender: 'ai' }]);
      } else {
        setMessages(prev => [...prev, { 
          text: 'Sorry, I encountered an error. Please try again.',
          sender: 'ai',
          error: true
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MessageBubble = ({ message, sender }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        mb: 2,
        flexDirection: sender === 'user' ? 'row-reverse' : 'row'
      }}
    >
      <Avatar
        sx={{
          bgcolor: sender === 'user' ? 'primary.main' : 'secondary.main',
          width: 32,
          height: 32
        }}
      >
        {sender === 'user' ? <PersonIcon /> : <BotIcon />}
      </Avatar>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          maxWidth: '70%',
          borderRadius: 3,
          backgroundColor: sender === 'user' ? 'primary.main' : 'background.paper',
          color: sender === 'user' ? 'white' : 'text.primary',
          ...(message.error && {
            backgroundColor: 'error.light',
            color: 'error.contrastText'
          })
        }}
      >
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {message.text}
        </Typography>
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ 
      height: 'calc(100vh - 64px)', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        backgroundColor: 'primary.main', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexShrink: 0,
        minHeight: 64
      }}>
        <BotIcon />
        <Typography variant="h6">
          Financial Assistant
        </Typography>
      </Box>
      
      {/* Messages Area */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2, 
        backgroundColor: customTheme.palette.background.default,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', height: '100%' }}>
          {messages.length === 0 && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
              height: '100%',
              textAlign: 'center',
              py: 4
            }}>
              <Typography variant="h4" gutterBottom sx={{ mb: 2, color: customTheme.palette.text.primary }}>
                👋 Welcome to Your Financial Assistant
              </Typography>
              <Typography variant="body1" sx={{ mb: 4, maxWidth: 600, color: customTheme.palette.text.secondary }}>
                I can help you analyze your finances, provide budgeting advice, and answer your money-related questions.
              </Typography>
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ mb: 2, color: customTheme.palette.text.primary }}>
                  Try asking:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {suggestedQuestions.map((question, index) => (
                    <Chip
                      key={index}
                      label={question.text}
                      icon={question.icon}
                      onClick={() => handleSend(question.text)}
                      sx={{ 
                        mb: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          color: 'primary.contrastText'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          )}
          
          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} sender={message.sender} />
          ))}
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Box>
      
      {/* Input Area */}
      <Box sx={{ 
        p: 2, 
        backgroundColor: customTheme.palette.background.paper,
        flexShrink: 0,
        borderTop: `1px solid ${customTheme.palette.divider}`,
        minHeight: 80
      }}>
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          maxWidth: 800,
          mx: 'auto'
        }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Ask me anything about your finances..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            multiline
            maxRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              }
            }}
          />
          <IconButton 
            color="primary" 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled',
              },
              width: 56,
              height: 56,
              borderRadius: 3,
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default AIChat; 