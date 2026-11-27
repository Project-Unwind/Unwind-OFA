import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

import authRoutes from './routes/authRoutes';

const app = express();

app.set('trust proxy', 'loopback');

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '20kb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'unwind-ofa-api',
    message: 'Unwind OFA API is running!',
  });
});

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Unwind OFA API running on port ${PORT}`);
});