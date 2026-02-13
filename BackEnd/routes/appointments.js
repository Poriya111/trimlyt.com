const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Appointment = require('../models/Appointment');

// @route   POST api/appointments
// @desc    Add a new appointment
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { service, price, date, extras } = req.body;

        const newAppointment = new Appointment({
            userId: req.user.id,
            service,
            price,
            date,
            extras
        });

        const appointment = await newAppointment.save();
        res.json(appointment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/appointments
// @desc    Get all appointments for user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ userId: req.user.id }).sort({ date: -1 });
        res.json(appointments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});
module.exports = router;
