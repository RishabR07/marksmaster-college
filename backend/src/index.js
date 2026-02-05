require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

console.log('MONGO_URI (masked):', process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:(.*)@/, ':*****@') : 'not set');

connectDB();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/events', require('./routes/events'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/marks', require('./routes/marks'));
app.use('/api/enrollments', require('./routes/enrollments'));

// Debug endpoints (server must be running with proper env)
app.use('/api/debug', require('./routes/debug'));

app.get('/', (req, res) => res.send('Portal Backend Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));