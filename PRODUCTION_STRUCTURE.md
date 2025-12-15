# Production-Ready Project Structure

This project is now organized for production deployment. Key structure:

- `/server.js` — Express backend entrypoint (file upload API, static serving)
- `/uploads/` — Uploaded files (auto-created, gitignored)
- `/src/` — Frontend React code (components, integrations, pages, hooks, etc)
- `/public/` — Static assets (favicon, etc)
- `/config/` — (Optional) Add for environment-specific configs if needed
- `.env` — Environment variables (never commit secrets)
- `.gitignore` — Ignores node_modules, uploads, .env, etc
- `README.md` — Project usage and setup instructions

## Recommendations
- Deploy backend and frontend separately or together as needed
- Use a process manager (PM2, Docker, etc) for backend in production
- Serve frontend with a CDN or static server
- Regularly clear `/uploads` or move to persistent storage if needed
- Set secure CORS and helmet policies for production
- Use HTTPS in production

## Example Directory Layout

```
/ (project root)
|-- server.js
|-- uploads/           # (auto-created, gitignored)
|-- src/               # React app source
|-- public/            # Static assets
|-- .env
|-- .gitignore
|-- README.md
|-- package.json
|-- ...
```

See README.md for setup and deployment details.
