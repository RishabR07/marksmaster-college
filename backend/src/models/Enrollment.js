const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const enrollmentSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  enrolledAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'dropped', 'completed'], default: 'active' }
}, { timestamps: true });

// Ensure unique enrollment
enrollmentSchema.index({ student: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
