const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Login = require('../models/Login');

function getRequestMeta(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || null;
  const userAgent = req.get('User-Agent') || req.headers['user-agent'] || null;
  return { ip, userAgent };
}

// Store OTP temporarily (in production, use Redis)
const otpStore = new Map();

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({ name, email, password, role });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { id: user.id, role: user.role, email: user.email } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const meta = getRequestMeta(req);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Log failed attempt without user ref
      try { await Login.create({ email, success: false, ip: meta.ip, userAgent: meta.userAgent }); } catch (e) { console.warn('Login logging failed', e.message); }
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      try { await Login.create({ user: user._id, email, success: false, ip: meta.ip, userAgent: meta.userAgent }); } catch (e) { console.warn('Login logging failed', e.message); }
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Successful login: update lastLogin and record event
    user.lastLogin = Date.now();
    await user.save();
    try { await Login.create({ user: user._id, email, success: true, ip: meta.ip, userAgent: meta.userAgent }); } catch (e) { console.warn('Login logging failed', e.message); }

    const payload = { user: { id: user.id, role: user.role, email: user.email } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Send OTP for password reset
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ msg: 'If email exists, OTP will be sent' });
    }

    const otp = generateOTP();
    // Store OTP with 10-minute expiry
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // In production, send email here using nodemailer or similar
    console.log(`OTP for ${email}: ${otp}`);
    
    res.json({ msg: 'OTP sent successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const storedOTP = otpStore.get(email);
    
    if (!storedOTP) {
      return res.status(400).json({ msg: 'OTP not found or expired' });
    }

    if (storedOTP.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ msg: 'OTP has expired' });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    // OTP is valid, clear it
    otpStore.delete(email);

    // Return a temporary verification token that can be used to reset password
    const verificationToken = jwt.sign(
      { email, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '10m' }
    );

    res.json({ msg: 'OTP verified', token: verificationToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { email, newPassword, token } = req.body;

  try {
    // Verify the token if provided
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
        if (decoded.email !== email || decoded.purpose !== 'password-reset') {
          return res.status(400).json({ msg: 'Invalid or expired reset token' });
        }
      } catch (err) {
        return res.status(400).json({ msg: 'Invalid or expired reset token' });
      }
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: 'Password reset successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Change password (for authenticated users)
const auth = require('../middleware/auth');

router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get user info by ID
router.get('/user/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;