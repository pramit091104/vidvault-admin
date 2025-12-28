# 🎥 VidVault Admin Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.0.0-646CFF.svg)](https://vitejs.dev/)

A modern, accessible, and performant admin dashboard for managing video content with YouTube and seamless storage integration. Built with React 18, TypeScript, and shadcn/ui components.

## ✨ Features

### 🎬 Video Management
- Upload and manage videos with seamless storage integration.
- YouTube integration for video publishing.
- Track video status and analytics.

### 🔐 Authentication & Security
- Secure authentication with Role Base Access Control.
- Protected routes and API endpoints.
- Session management.

### 🎨 Modern UI/UX
- Responsive design for all devices
- Dark/light mode support
- Intuitive dashboard layout
- Real-time updates

### ⚡ Performance
- Code splitting and lazy loading
- Optimized asset loading
- Efficient state management
- Fast refresh development experience

## 🚀 Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 4.x
- **State Management**: React Context + TanStack Query
- **Form Handling**: React Hook Form
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide Icons
- **Data Visualization**: Recharts

### Backend
- **Runtime**: Node.js (Express)
- **Authentication**: Firebase Admin SDK
- **Storage**: Seamless cloud storage integration
- **APIs**: YouTube Data API v3

### Development Tools
- **Linting**: ESLint + Prettier
- **Testing**: Jest + React Testing Library
- **Type Checking**: TypeScript
- **Git Hooks**: Husky + lint-staged

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app directory (API routes)
│   └── api/             # API routes
│
├── components/          # Reusable UI components
│   ├── dashboard/       # Dashboard-specific components
│   └── ui/              # shadcn/ui components
│
├── contexts/            # React context providers
├── hooks/               # Custom React hooks
├── integrations/        # Third-party service integrations
│   ├── api/             # API client and services
│   ├── firebase/        # Firebase configuration
│   ├── gcs/             # Google Cloud Storage
│   └── youtube/         # YouTube API integration
│
├── lib/                 # Utility functions and helpers
├── pages/               # Page components
├── router/              # Application routing
├── styles/              # Global styles and Tailwind config
└── test/                # Test files
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Firebase project with Authentication enabled
-   # Cloud storage provider account
- YouTube Data API v3 credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/vidvault-admin.git
   cd vidvault-admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Firebase
   VITE_FIREBASE_API_KEY=your-firebase-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   
   # Storage Configuration
   VITE_STORAGE_BUCKET=your-bucket-name
   VITE_STORAGE_PROJECT_ID=your-project-id
   
   # YouTube API
   VITE_YOUTUBE_API_KEY=your-youtube-api-key
   
   # API Configuration
   VITE_API_URL=http://localhost:3001
   PORT=3001
   NODE_ENV=development
   ```

4. **Start Development Servers**
   ```bash
   # Start both frontend and backend
   npm run dev:all
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001`

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run server` - Start backend server
- `npm run dev:all` - Start both frontend and backend
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm test:watch` - Run tests in watch mode
- `npm run type-check` - Run TypeScript type checking

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🚀 Deployment

### Production Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Environment Variables (Production)

Set these environment variables in your production environment:

```bash
NODE_ENV=production
PORT=3000
VITE_API_URL=https://your-api-domain.com
# Add other production environment variables
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## � License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

For any questions or feedback, please [open an issue](https://github.com/your-username/vidvault-admin/issues) or contact the maintainers.

---