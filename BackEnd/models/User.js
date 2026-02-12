const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    settings: {
        currency: { type: String, default: '$' },
        monthlyGoal: { type: Number, default: 5000 },
        autoCompleteStatus: { type: String, default: 'finished' },
        theme: { type: String, default: 'light' }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
