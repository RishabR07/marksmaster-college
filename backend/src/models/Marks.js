const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const marksSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  ia1: { type: Number, default: 0 },
  ia2: { type: Number, default: 0 },
  ia3: { type: Number, default: 0 },
  ia4: { type: Number, default: 0 },
  ia5: { type: Number, default: 0 },
  courseCompletion: { type: Number, default: 0 },
  activitySubmission: { type: Number, default: 0 },
  synopsisSubmission: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  grade: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Marks', marksSchema);
