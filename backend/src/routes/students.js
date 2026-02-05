const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Student = require('../models/Student');

// Create student
router.post('/', auth, async (req, res) => {
  const { name, roll, class: cls, email } = req.body;
  try {
    console.log('POST /students body:', req.body);
    const student = new Student({ name, roll, class: cls, email });
    await student.save();
    res.json(student);
  } catch (err) {
    console.error('Create student error:', err && err.message ? err.message : err, err && err.errors ? err.errors : '');
    return res.status(500).json({ msg: 'Server error', error: err.message, details: err.errors || null });
  }
});

// Get all students
router.get('/', auth, async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get student by id
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ msg: 'Student not found' });
    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update student
router.put('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ msg: 'Student not found' });
    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete student
router.delete('/:id', auth, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Student removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;