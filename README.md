# VidVault Admin Dashboard

A modern, accessible, and performant admin dashboard for managing video content with YouTube integration. Built with React, TypeScript, and shadcn/ui components.

## ✨ Features

- **Video Management**
  - Upload videos to YouTube
  - Track video status and analytics
  - Manage video metadata and settings

- **User Authentication**
  - Secure login with Firebase Authentication
  - Role-based access control
  - Session management

- **Responsive Design**
  - Fully responsive layout
  - Mobile-friendly interface
  - Dark/light mode support

- **Accessibility**
  - WCAG 2.1 AA compliant
  - Keyboard navigation
  - Screen reader support
  - Focus management

## 🚀 Tech Stack

- **Frontend**
  - React 18 with TypeScript
  - Vite (Build Tool)
  - React Router (Routing)
  - React Hook Form (Form Management)
  - TanStack Query (Data Fetching)
  - Sonner (Toasts)

- **UI Components**
  - shadcn/ui (Radix UI + Tailwind CSS)
  - Tailwind CSS (Styling)
  - Lucide Icons
  - Recharts (Data Visualization)

- **Backend**
  - Express.js
  - Firebase Admin SDK
  - YouTube Data API v3

- **Development**
  - ESLint + Prettier (Code Quality)
  - TypeScript (Type Checking)
  - Vite (Development Server)

## 📦 Prerequisites

- Node.js 18+ and npm 9+
- Firebase project with Authentication enabled
- YouTube Data API v3 credentials
- Google OAuth 2.0 client ID

## 🛠️ Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/vidvault-admin.git
   cd vidvault-admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Firebase
   VITE_FIREBASE_API_KEY=your-firebase-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   
   # YouTube API
   VITE_YOUTUBE_API_KEY=your-youtube-api-key
   
   # Server
   VITE_API_URL=http://localhost:3001
   PORT=3001
   NODE_ENV=development
   ```

4. **Start the development server**
   ```bash
   # Start frontend and backend in development mode
   npm run dev:all
   ```

   This will start:
   - Frontend at `http://localhost:5173`
   - Backend at `http://localhost:3001`

## 🏗️ Project Structure

```
src/
├── assets/            # Static assets
├── components/        # Reusable UI components
│   ├── dashboard/     # Dashboard specific components
│   ├── ui/            # shadcn/ui components
│   └── ...
├── contexts/          # React contexts
├── hooks/             # Custom React hooks
├── integrations/      # Third-party integrations
│   └── youtube/       # YouTube API service
├── lib/               # Utility functions
├── pages/             # Page components
├── styles/            # Global styles
└── types/             # TypeScript type definitions
```

## 🔧 Available Scripts

- `npm run dev` - Start the Vite development server
- `npm run server` - Start the Express backend server
- `npm run dev:all` - Start both frontend and backend in development mode
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint

## 🧪 Testing

To run tests:

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## 🌍 Production Deployment

### Building for Production

```bash
# Build the frontend
npm run build

# Start the production server
npm start
```

### Environment Variables for Production

Make sure to set the following environment variables in your production environment:

- `NODE_ENV=production`
- `PORT=3000` (or your preferred port)
- Firebase production credentials
- YouTube API production key

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

## 📄 Documentation

For detailed documentation, please refer to the [Wiki](https://github.com/your-username/vidvault-admin/wiki).

## 📬 Contact

For any questions or feedback, please open an issue or contact the maintainers.
