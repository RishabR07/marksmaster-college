const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');

// Create subject
router.post('/', auth, async (req, res) => {
  try {
    const { name, code, description, credits, semester, branch, year } = req.body;
    const subject = new Subject({
      name,
      code,
      description,
      credits,
      semester,
      branch,
      year,
      teacher: req.user.id
    });
    await subject.save();
    res.json(subject);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all subjects (optionally filter by teacher)
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.teacher) {
      filter.teacher = req.query.teacher;
    }
    const subjects = await Subject.find(filter).populate('teacher', 'name email').sort({ createdAt: -1 });
    res.json(subjects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get subject by id
router.get('/:id', auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('teacher', 'name email');
    if (!subject) return res.status(404).json({ msg: 'Subject not found' });
    res.json(subject);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update subject
router.put('/:id', auth, async (req, res) => {
  try {
    let subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ msg: 'Subject not found' });

    // Check authorization
    if (subject.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to update this subject' });
    }

    subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(subject);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete subject
router.delete('/:id', auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ msg: 'Subject not found' });

    // Check authorization
    if (subject.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized to delete this subject' });
    }

    await Subject.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Subject removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
