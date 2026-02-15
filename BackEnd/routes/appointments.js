const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

// @route   POST api/appointments
// @desc    Add a new appointment
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { service, price, date, extras, status } = req.body;

        // Check for time conflicts based on user settings
        if (status !== 'Canceled') {
            const user = await User.findById(req.user.id);
            const gapMinutes = user.settings.appointmentGap !== undefined ? user.settings.appointmentGap : 60;

            if (gapMinutes > 0) {
                const gapMs = gapMinutes * 60 * 1000;
                const newTime = new Date(date).getTime();
                const conflict = await Appointment.findOne({
                    userId: req.user.id,
                    status: { $ne: 'Canceled' },
                    date: { $gt: new Date(newTime - gapMs), $lt: new Date(newTime + gapMs) }
                });

                if (conflict) {
                    return res.status(400).json({ msg: `Time conflict! Minimum gap is ${gapMinutes} minutes.` });
                }
            }
        }

        const newAppointment = new Appointment({
            userId: req.user.id,
            service,
            price,
            date,
            extras,
            status: status || 'Scheduled'
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
        // 1. Auto-Complete Logic
        const user = await User.findById(req.user.id);
        const autoCompleteSetting = user.settings.autoCompleteStatus || 'finished';
        
        let targetStatus = 'Finished';
        if (autoCompleteSetting === 'canceled') targetStatus = 'Canceled';
        if (autoCompleteSetting === 'noshow') targetStatus = 'No Show';

        // Cutoff time: 1 hour ago
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        await Appointment.updateMany(
            { 
                userId: req.user.id, 
                status: 'Scheduled', 
                date: { $lt: oneHourAgo } 
            },
            { $set: { status: targetStatus } }
        );

        // 2. Fetch Appointments with Filters & Pagination
        const { type, page, limit } = req.query;
        const now = new Date();
        let query = { userId: req.user.id };
        let sort = { date: -1 };

        if (type === 'upcoming') {
            query.date = { $gte: now };
            sort = { date: 1 }; // Ascending for upcoming
        } else if (type === 'past') {
            query.date = { $lt: now };
            sort = { date: -1 }; // Descending for past
        }

        let queryObj = Appointment.find(query).sort(sort);
        if (page && limit) queryObj = queryObj.limit(parseInt(limit)).skip((parseInt(page) - 1) * parseInt(limit));
        const appointments = await queryObj;
        res.json(appointments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/appointments/:id
// @desc    Delete appointment
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ msg: 'Appointment not found' });
        }

        // Make sure user owns appointment
        if (appointment.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await appointment.deleteOne();
        res.json({ msg: 'Appointment removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/appointments/:id
// @desc    Update appointment
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const { service, price, date, extras, status } = req.body;

    // Build appointment object
    const appointmentFields = {};
    if (service) appointmentFields.service = service;
    if (price) appointmentFields.price = price;
    if (date) appointmentFields.date = date;
    if (extras) appointmentFields.extras = extras;
    if (status) appointmentFields.status = status;

    try {
        // Check for time conflicts if date is being updated
        if (date && status !== 'Canceled') {
            const user = await User.findById(req.user.id);
            const gapMinutes = user.settings.appointmentGap !== undefined ? user.settings.appointmentGap : 60;

            if (gapMinutes > 0) {
                const gapMs = gapMinutes * 60 * 1000;
                const newTime = new Date(date).getTime();
                const conflict = await Appointment.findOne({
                    userId: req.user.id,
                    _id: { $ne: req.params.id }, // Exclude current appointment
                    status: { $ne: 'Canceled' },
                    date: { $gt: new Date(newTime - gapMs), $lt: new Date(newTime + gapMs) }
                });

                if (conflict) {
                    return res.status(400).json({ msg: `Time conflict! Minimum gap is ${gapMinutes} minutes.` });
                }
            }
        }

        let appointment = await Appointment.findById(req.params.id);

        if (!appointment) return res.status(404).json({ msg: 'Appointment not found' });

        // Make sure user owns appointment
        if (appointment.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { $set: appointmentFields },
            { new: true }
        );

        res.json(appointment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
