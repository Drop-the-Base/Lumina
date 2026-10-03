import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import placesRouter from './routes/places';
import reportsRouter from './routes/reports';
import routeRouter from './routes/route';
import sosRouter from './routes/sos';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/places', placesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/route', routeRouter);
app.use('/api/sos', sosRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

export default app;
