const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const subjectSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  credits: { type: Number, default: 4 },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  semester: { type: Number },
  branch: { type: String },
  year: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
