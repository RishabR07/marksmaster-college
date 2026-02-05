const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }

  // Enable debug to log queries and model operations (helpful for tracing saves)
  mongoose.set('debug', true);

  try {
    const conn = await mongoose.connect(uri, { keepAlive: true });
    console.log('MongoDB connected to', conn.connection.name, 'host:', conn.connection.host);
  } catch (err) {
    console.error('MongoDB connection error:', err && err.message ? err.message : err);
    process.exit(1);
  }
};