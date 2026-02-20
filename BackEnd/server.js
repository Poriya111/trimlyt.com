require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { google } = require('googleapis');
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const serviceRoutes = require('./routes/services');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', serviceRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../FrontEnd')));

// Handle SPA or default route (Serve index.html for root)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../FrontEnd/index.html'));
});

// --- Google OAuth 2.0 Configuration ---
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`
);

// --- Integration Routes ---

// 1. Generate Auth URL
app.get('/api/auth/google/url', authMiddleware, (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.events'
    ];
    
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for getting a refresh token
        prompt: 'consent',      // Force consent to ensure we get a refresh token
        scope: scopes,
        state: req.user.id || req.user._id      // Pass user ID to identify them in the callback
    });

    res.json({ url });
});

// 2. Handle Callback
app.get('/api/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user email for display purposes
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const User = mongoose.model('User');
        await User.findByIdAndUpdate(state, {
            googleRefreshToken: tokens.refresh_token,
            googleEmail: userInfo.data.email
        });

        // Redirect back to settings with success flag
        res.redirect('/settings.html?google_auth=success');
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.redirect('/settings.html?google_auth=error');
    }
});

// 3. Get Connection Status
app.get('/api/auth/google/status', authMiddleware, async (req, res) => {
    try {
        const User = mongoose.model('User');
        const user = await User.findById(req.user.id).select('googleEmail');
        res.json({ 
            connected: !!user.googleEmail, 
            email: user.googleEmail 
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// 4. Disconnect
app.delete('/api/auth/google', authMiddleware, async (req, res) => {
    try {
        const User = mongoose.model('User');
        await User.findByIdAndUpdate(req.user.id, {
            $unset: { googleRefreshToken: 1, googleEmail: 1 }
        });
        res.json({ msg: 'Disconnected successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// Reminder emails have been disabled for Version1 to reduce scope and permissions.

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});