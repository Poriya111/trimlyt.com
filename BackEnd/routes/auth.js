const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Register Route
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({
            email,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({ msg: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        // Create Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, user: { 
            id: user._id, 
            email: user.email, 
            settings: user.settings,
            avatar: user.avatar
        } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Settings
router.put('/settings', auth, async (req, res) => {
    try {
        const { currency, monthlyGoal, autoCompleteStatus, theme, appointmentGap, language } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (currency) user.settings.currency = currency;
        if (monthlyGoal) user.settings.monthlyGoal = monthlyGoal;
        if (autoCompleteStatus) user.settings.autoCompleteStatus = autoCompleteStatus;
        if (theme) user.settings.theme = theme;
        if (appointmentGap !== undefined) user.settings.appointmentGap = appointmentGap;
        if (language) user.settings.language = language;

        await user.save();
        res.json(user.settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile (Password, Avatar)
router.put('/profile', auth, async (req, res) => {
    try {
        const { password, avatar } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        if (avatar) user.avatar = avatar;

        await user.save();
        res.json({ msg: 'Profile updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;