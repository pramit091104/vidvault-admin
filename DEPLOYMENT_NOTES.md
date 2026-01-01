# Deployment Architecture Notes

## Local Development vs Production

### Local Development
- **Express Server** (`server.js`) runs on port 3001
- **Vite Dev Server** runs on port 8080 with proxy to Express
- All API endpoints handled by Express server

### Vercel Production
- **Static Frontend** served by Vercel CDN
- **API Endpoints** run as individual serverless functions
- No Express server needed - each API file is a standalone function

## File Structure for Vercel

```
api/
├── subscription/
│   └── status.js          # Serverless function
├── clients/
│   ├── validate.js        # Serverless function
│   └── create.js          # Serverless function
├── gcs/
│   ├── simple-upload.js   # Serverless function
│   └── validate-upload.js # Serverless function
└── lib/
    └── subscriptionValidator.js # Shared utility

dist/                      # Built frontend (generated)
src/                       # Frontend source code
vercel.json               # Vercel configuration
```

## Key Differences

### Express Server (Local)
- Single process handling all routes
- Shared database connections
- Middleware applied globally

### Vercel Serverless (Production)
- Each API endpoint is a separate function
- Cold starts for each function
- No shared state between functions
- Firebase Admin initialized per function

## Environment Variables

### Local Development
- Loaded from `.env` file
- Available to Express server process

### Vercel Production
- Set in Vercel dashboard
- Available to each serverless function
- Encrypted and secure

## Benefits of Serverless Architecture

1. **Scalability**: Each function scales independently
2. **Cost**: Pay only for actual usage
3. **Performance**: Functions run close to users globally
4. **Reliability**: Isolated functions reduce failure impact
5. **Security**: Each function is sandboxed

## Considerations

1. **Cold Starts**: First request to a function may be slower
2. **Stateless**: No shared memory between requests
3. **Timeouts**: Functions have execution time limits
4. **Size Limits**: Function code and dependencies have size limits

The current implementation is optimized for both local development and Vercel production deployment.