const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Event = require('../models/Event');

// Create event
router.post('/', auth, async (req, res) => {
  try {
    const evt = new Event({ ...req.body, createdBy: req.user.id });
    await evt.save();
    res.json(evt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// List events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const evt = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!evt) return res.status(404).json({ msg: 'Event not found' });
    res.json(evt);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Event removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;