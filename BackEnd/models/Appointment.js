const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: String, required: true },
    price: { type: Number, required: true },
    date: { type: Date, required: true },
    extras: { type: String },
    status: { 
        type: String, 
        enum: ['Scheduled', 'Finished', 'Canceled', 'No Show'], 
        default: 'Scheduled' 
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
