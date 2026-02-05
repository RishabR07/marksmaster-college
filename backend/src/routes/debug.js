const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

// Creates test user, student, attendance to verify saves
router.post('/create-test', async (req, res) => {
  try {
    const name = 'Test User';
    const email = 'testuser@example.com';

    // Ensure test user (do not duplicate)
    let user = await User.findOne({ email });
    if (!user) {
      const password = 'password123';
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      user = new User({ name, email, password: hashed, role: 'teacher' });
      await user.save();
    }

    // Create a student
    const student = new Student({ name: 'Test Student', roll: 'T123', class: '10A', email: 'student@example.com' });
    await student.save();

    // Create an attendance record
    const attendance = new Attendance({ student: student._id, date: new Date(), status: 'present', subject: 'Math', recordedBy: user._id });
    await attendance.save();

    // Populate before returning
    const populatedAttendance = await attendance.populate('student').populate('recordedBy', '-password');

    res.json({ ok: true, user, student, attendance: populatedAttendance });
  } catch (err) {
    console.error('Debug create-test error:', err && err.message ? err.message : err, err && err.errors ? err.errors : '');
    // Return full validation errors if present
    return res.status(500).json({ ok: false, message: 'Create test failed', error: err.message || err, details: err.errors || null });
  }
});

module.exports = router;