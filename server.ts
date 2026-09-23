import http from 'http';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { router as apiRouter } from './server/routes.ts';
import { realtime } from './server/ws.ts';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded media
app.use('/api/uploads', express.static(uploadsDir));

// Mount API routes
app.use('/api', apiRouter);

// Initialize Real-time WebSockets
realtime.init(server);

// Vite middleware for development or static serving for production
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`[Aether Messenger] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
