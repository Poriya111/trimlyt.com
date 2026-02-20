const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String },
    settings: {
        currency: { type: String, default: '$' },
        monthlyGoal: { type: Number, default: 5000 },
        autoCompleteStatus: { type: String, default: 'finished' },
        theme: { type: String, default: 'light' },
        appointmentGap: { type: Number, default: 60 },
        language: { type: String, default: 'en' }
    },
    googleRefreshToken: { type: String, default: null },
    googleEmail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
