const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  lastLogin: { type: Date, default: null },
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);