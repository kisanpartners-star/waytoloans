
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// Serve the same-origin frontend build before CORS checks, which are only
// needed for cross-origin API and upload requests.
const frontendDist = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendDist));

app.use((req, res, next) => {
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  cors({
    origin: (origin, cb) =>
      !origin || origin === requestOrigin || env.clientUrls.includes(origin)
        ? cb(null, true)
        : cb(new Error('Origin not allowed')),
    credentials: true,
  })(req, res, next);
});

if (env.nodeEnv !== 'test') {
  app.use(
    morgan(env.nodeEnv === 'production' ? 'combined' : 'dev')
  );
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.use(sanitize);

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (path.extname(filePath).toLowerCase() === '.svg') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      }
    },
  })
);

// API
app.use('/api', apiLimiter, require('./routes'));

// Frontend routes
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// 404
app.use(notFound);

// Error handler
app.use(errorHandler);

module.exports = app;