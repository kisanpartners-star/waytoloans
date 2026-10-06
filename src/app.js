// const path = require('path');
// const express = require('express');
// const helmet = require('helmet');
// const cors = require('cors');
// const morgan = require('morgan');
// const cookieParser = require('cookie-parser');
// const env = require('./config/env');
// const sanitize = require('./middleware/sanitize');
// const { apiLimiter } = require('./middleware/rateLimit');
// const { notFound, errorHandler } = require('./middleware/error');

// const app = express();
// app.set('trust proxy', 1);
// app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// app.use(cors({
//   origin: (origin, cb) => (!origin || env.clientUrls.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed'))),
//   credentials: true,
// }));


// app.use(express.static(path.join(__dirname, 'dist')));

// app.get(/^(?!\/api).*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });


// if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
// app.use(express.json({ limit: '1mb' }));
// app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// app.use(cookieParser());
// app.use(sanitize);
// app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));
// app.use('/api', apiLimiter, require('./routes'));
// app.use(notFound);
// app.use(errorHandler);
// module.exports = app;

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

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || env.clientUrls.includes(origin)
        ? cb(null, true)
        : cb(new Error('Origin not allowed')),
    credentials: true,
  })
);

// Serve frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Frontend routes
app.use(express.static(path.join(__dirname, 'dist')));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
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
    setHeaders: (res) =>
      res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

// API
app.use('/api', apiLimiter, require('./routes'));

// 404
app.use(notFound);

// Error handler
app.use(errorHandler);

module.exports = app;