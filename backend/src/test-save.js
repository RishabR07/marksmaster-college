require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Student = require('./models/Student');
const Attendance = require('./models/Attendance');

const uri = process.env.MONGO_URI;
(async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected for test-save');

    // Create user
    const email = 'testsave@example.com';
    let user = await User.findOne({ email });
    if (!user) {
      const pw = await bcrypt.hash('pw123456', 10);
      user = new User({ name: 'Save Test', email, password: pw });
      await user.save();
      console.log('User saved:', user._id.toString());
    } else {
      console.log('User already exists:', user._id.toString());
    }

    // Create student
    const student = new Student({ name: 'Save Student', roll: 'S-001', class: '11B', email: 'save-student@example.com' });
    await student.save();
    console.log('Student saved:', student._id.toString());

    // Create attendance
    const attendance = new Attendance({ student: student._id, date: new Date(), status: 'present', subject: 'Science', recordedBy: user._id });
    await attendance.save();
    console.log('Attendance saved:', attendance._id.toString());

    process.exit(0);
  } catch (err) {
    console.error('Test-save error:', err && err.message ? err.message : err, err && err.errors ? err.errors : '');
    process.exit(1);
  }
})();