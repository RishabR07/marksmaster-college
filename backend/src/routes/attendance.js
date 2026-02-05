const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

// Add attendance record
router.post('/', auth, async (req, res) => {
  try {
    console.log('POST /attendance body:', req.body);
    let { student, date, status, subject } = req.body;

    // Accept either an id or an object with _id
    const studentId = student && (typeof student === 'object' ? (student._id || student.id) : student);
    if (!studentId) return res.status(400).json({ msg: 'Student id is required' });

    // Verify student exists
    const stu = await Student.findById(studentId);
    if (!stu) return res.status(400).json({ msg: 'Student not found' });

    const record = new Attendance({ student: studentId, date: date || new Date(), status, subject, recordedBy: req.user.id });
    await record.save();

    // Populate before returning so frontend gets full objects
    const populated = await record.populate('student').populate('recordedBy', '-password');
    res.json(populated);
  } catch (err) {
    console.error('Create attendance error:', err && err.message ? err.message : err, err && err.errors ? err.errors : '');
    return res.status(500).json({ msg: 'Server error', error: err.message, details: err.errors || null });
  }
});

// Get records (optionally by student via ?student=id)
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.student) filter.student = req.query.student;
    const records = await Attendance.find(filter).populate('student').populate('recordedBy', '-password').sort({ date: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const rec = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rec) return res.status(404).json({ msg: 'Record not found' });
    res.json(rec);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Attendance removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;