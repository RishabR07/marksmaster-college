const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Enrollment = require('../models/Enrollment');

// Create enrollment
router.post('/', auth, async (req, res) => {
  try {
    const { student, subject } = req.body;
    
    // Check if already enrolled
    let enrollment = await Enrollment.findOne({ student, subject });
    if (enrollment) {
      return res.status(400).json({ msg: 'Student already enrolled in this subject' });
    }

    enrollment = new Enrollment({ student, subject });
    await enrollment.save();
    
    res.json(enrollment);
  } catch (err) {
    console.error('Create enrollment error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get enrollments
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.student) filter.student = req.query.student;
    if (req.query.subject) filter.subject = req.query.subject;

    const enrollments = await Enrollment.find(filter)
      .populate('student')
      .populate('subject')
      .sort({ enrolledAt: -1 });

    res.json(enrollments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update enrollment
router.put('/:id', auth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!enrollment) return res.status(404).json({ msg: 'Enrollment not found' });
    res.json(enrollment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete enrollment
router.delete('/:id', auth, async (req, res) => {
  try {
    await Enrollment.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Enrollment removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
