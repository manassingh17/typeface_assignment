# Personal Finance Assistant

A comprehensive full-stack application for managing personal finances with AI-powered insights and receipt scanning capabilities.

## Features

- **User Authentication**: Secure registration and login system
- **Transaction Management**: Add, edit, and delete income and expense transactions
- **Dashboard**: Visual representation of financial data with charts and summaries
- **Receipt Processing**: Upload and automatically extract information from receipts (images/PDFs)
- **AI Assistant**: Get personalized financial advice based on your transaction history
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- React.js
- Material-UI
- Recharts for data visualization
- Axios for API calls
- React Router for navigation

### Backend
- Node.js & Express
- MongoDB with Mongoose
- JWT for authentication
- Tesseract.js for OCR
- Google's Generative AI for financial advice
- Multer for file uploads

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Google Cloud API key for Generative AI

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd personal-finance-assistant
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Create a .env file in the backend directory:
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
```

4. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

The application will be available at `http://localhost:3000`

## Features in Detail

### Transaction Management
- Add income and expenses
- Categorize transactions
- Add notes and descriptions
- Upload receipt images
- View transaction history with filtering and pagination

### Dashboard
- Total income and expenses overview
- Current balance display
- Monthly spending trends
- Expense breakdown by category
- Interactive charts and graphs

### Receipt Processing
- Upload receipts as images (JPEG, PNG) or PDFs
- Automatic extraction of:
  - Total amount
  - Date
  - Merchant name
  - Individual items (where possible)

### AI Financial Assistant
- Get personalized financial advice
- Analyze spending patterns
- Receive budgeting suggestions
- Ask questions about your finances

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- Material-UI for the beautiful components
- Recharts for the charting library
- Tesseract.js for OCR capabilities
- Google's Generative AI for powering the financial assistant # typeface_assignment
