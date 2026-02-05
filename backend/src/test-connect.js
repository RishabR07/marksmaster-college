const mongoose = require('mongoose');
const uri = 'mongodb+srv://rishab:rishab%40123@mesnaldo.muz5ney.mongodb.net/portal';

(async () => {
  try {
    console.log('Attempting to connect with URI:', uri);
    await mongoose.connect(uri);
    console.log('Connected successfully');
    process.exit(0);
  } catch (err) {
    console.error('Connect error:', err);
    process.exit(1);
  }
})();