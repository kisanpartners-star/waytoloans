const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
(async () => {
  await connectDB();
  app.listen(env.port, () => console.log(`Banks Zone API listening on :${env.port}`));
})().catch((e) => { console.error('Failed to start', e); process.exit(1); });
process.on('unhandledRejection', (e) => console.error('Unhandled rejection', e));
