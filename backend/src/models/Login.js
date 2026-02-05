const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const loginSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  email: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  success: { type: Boolean, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Login', loginSchema);