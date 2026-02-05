const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Marks = require('../models/Marks');
const Student = require('../models/Student');
const Subject = require('../models/Subject');

// Create or update marks
router.post('/', auth, async (req, res) => {
  try {
    const { student, subject, ia1, ia2, ia3, ia4, ia5, courseCompletion, activitySubmission, synopsisSubmission } = req.body;

    let marks = await Marks.findOne({ student, subject });

    if (marks) {
      // Update existing
      marks.ia1 = ia1 || marks.ia1;
      marks.ia2 = ia2 || marks.ia2;
      marks.ia3 = ia3 || marks.ia3;
      marks.ia4 = ia4 || marks.ia4;
      marks.ia5 = ia5 || marks.ia5;
      marks.courseCompletion = courseCompletion || marks.courseCompletion;
      marks.activitySubmission = activitySubmission || marks.activitySubmission;
      marks.synopsisSubmission = synopsisSubmission || marks.synopsisSubmission;
    } else {
      // Create new
      marks = new Marks({
        student,
        subject,
        ia1: ia1 || 0,
        ia2: ia2 || 0,
        ia3: ia3 || 0,
        ia4: ia4 || 0,
        ia5: ia5 || 0,
        courseCompletion: courseCompletion || 0,
        activitySubmission: activitySubmission || 0,
        synopsisSubmission: synopsisSubmission || 0,
        recordedBy: req.user.id
      });
    }

    await marks.save();
    res.json(marks);
  } catch (err) {
    console.error('Create marks error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Upsert marks (insert or update)
router.post('/upsert', auth, async (req, res) => {
  try {
    const { student, subject, ...markData } = req.body;

    const marks = await Marks.findOneAndUpdate(
      { student, subject },
      { ...markData, recordedBy: req.user.id },
      { new: true, upsert: true }
    );

    res.json(marks);
  } catch (err) {
    console.error('Upsert marks error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get all marks
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.student) filter.student = req.query.student;
    if (req.query.subject) filter.subject = req.query.subject;

    const marks = await Marks.find(filter)
      .populate('student')
      .populate('subject')
      .populate('recordedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(marks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update marks
router.put('/:id', auth, async (req, res) => {
  try {
    const marks = await Marks.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!marks) return res.status(404).json({ msg: 'Marks not found' });
    res.json(marks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete marks
router.delete('/:id', auth, async (req, res) => {
  try {
    await Marks.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Marks removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
