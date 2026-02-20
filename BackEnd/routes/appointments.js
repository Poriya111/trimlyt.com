const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const auth = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

// Helper to get authenticated Google Client
const getGoogleClient = (user) => {
    if (!user.googleRefreshToken) return null;
    
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
    return oauth2Client;
};

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

        // --- Google Calendar Sync (Create) ---
        try {
            const user = await User.findById(req.user.id);
            if (user.googleRefreshToken && appointment.status === 'Scheduled') {
                const authClient = getGoogleClient(user);
                const calendar = google.calendar({ version: 'v3', auth: authClient });
                
                const duration = user.settings.appointmentGap || 60;
                const endTime = new Date(new Date(appointment.date).getTime() + duration * 60000);

                const event = {
                    summary: `Trimlyt: ${appointment.service}`,
                    description: appointment.extras || '',
                    start: { dateTime: new Date(appointment.date).toISOString() },
                    end: { dateTime: endTime.toISOString() }
                };

                const googleEvent = await calendar.events.insert({ calendarId: 'primary', resource: event });
                appointment.googleEventId = googleEvent.data.id;
                await appointment.save();
                console.log(`Google Calendar: Created event for "${appointment.service}" (${appointment.googleEventId})`);
            }
        } catch (syncErr) {
            console.error('Google Calendar Sync Error (Create):', syncErr.message);
        }

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

        // --- Google Calendar Sync (Delete) ---
        try {
            const user = await User.findById(req.user.id);
            if (user.googleRefreshToken && appointment.googleEventId) {
                const authClient = getGoogleClient(user);
                const calendar = google.calendar({ version: 'v3', auth: authClient });
                await calendar.events.delete({ calendarId: 'primary', eventId: appointment.googleEventId });
            }
        } catch (syncErr) {
            console.error('Google Calendar Sync Error (Delete):', syncErr.message);
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

        // --- Google Calendar Sync (Update) ---
        try {
            const user = await User.findById(req.user.id);
            if (user.googleRefreshToken) {
                const authClient = getGoogleClient(user);
                const calendar = google.calendar({ version: 'v3', auth: authClient });

                // If canceled or no-show, remove from calendar
                if (appointment.status === 'Canceled' || appointment.status === 'No Show') {
                    if (appointment.googleEventId) {
                        await calendar.events.delete({ calendarId: 'primary', eventId: appointment.googleEventId });
                        appointment.googleEventId = null;
                        await appointment.save();
                        console.log(`Google Calendar: Deleted event for "${appointment.service}"`);
                    }
                } else if (appointment.status === 'Scheduled') {
                    if (appointment.googleEventId) {
                        // Update existing event
                        const duration = user.settings.appointmentGap || 60;
                        const endTime = new Date(new Date(appointment.date).getTime() + duration * 60000);

                        await calendar.events.patch({
                            calendarId: 'primary',
                            eventId: appointment.googleEventId,
                            resource: {
                                summary: `Trimlyt: ${appointment.service}`,
                                description: appointment.extras || '',
                                start: { dateTime: new Date(appointment.date).toISOString() },
                                end: { dateTime: endTime.toISOString() }
                            }
                        });
                        console.log(`Google Calendar: Updated event for "${appointment.service}"`);
                    } else {
                        // If it was previously unsynced (e.g. created before Google auth), create it now
                        const duration = user.settings.appointmentGap || 60;
                        const endTime = new Date(new Date(appointment.date).getTime() + duration * 60000);

                        const event = {
                            summary: `Trimlyt: ${appointment.service}`,
                            description: appointment.extras || '',
                            start: { dateTime: new Date(appointment.date).toISOString() },
                            end: { dateTime: endTime.toISOString() }
                        };

                        const googleEvent = await calendar.events.insert({ calendarId: 'primary', resource: event });
                        appointment.googleEventId = googleEvent.data.id;
                        await appointment.save();
                        console.log(`Google Calendar: Created event for previously unsynced appointment "${appointment.service}" (${appointment.googleEventId})`);
                    }
                }
            }
        } catch (syncErr) {
            console.error('Google Calendar Sync Error (Update):', syncErr.message);
        }

        res.json(appointment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/appointments/sync-google
// @desc    Sync appointments from Google Calendar
// @access  Private
router.post('/sync-google', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.googleRefreshToken) {
            return res.status(400).json({ msg: 'Google account not connected' });
        }

        const authClient = getGoogleClient(user);
        if (!authClient) {
             return res.status(400).json({ msg: 'Google account not connected' });
        }
        
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        // Fetch events from 1 month ago to 3 months ahead
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 3);

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];
        let importedCount = 0;

        // Helper to parse event title for "TL Service Price" pattern
        const parseTrimlytEvent = (title) => {
            if (!title) return null;
            
            // Match pattern: TL followed by service name and price
            // Example: "TL Haircut 25" → { service: "Haircut", price: 25 }
            const match = title.match(/^TL\s+(.+?)\s+(\d+(?:\.\d{1,2})?)$/i);
            if (match) {
                return {
                    service: match[1].trim(),
                    price: parseFloat(match[2])
                };
            }
            return null;
        };

        for (const event of events) {
            if (!event.start || (!event.start.dateTime && !event.start.date)) continue;
            
            // Parse event title for "TL Service Price" pattern
            const parsed = parseTrimlytEvent(event.summary);
            
            // Skip events that don't match the Trimlyt pattern
            if (!parsed) {
                console.log(`Skipping event "${event.summary}" - does not match TL pattern`);
                continue;
            }
            
            // Skip if already imported (check googleEventId)
            const existing = await Appointment.findOne({ 
                userId: req.user.id, 
                googleEventId: event.id 
            });

            if (!existing) {
                const appointmentDate = event.start.dateTime || event.start.date;
                
                const newApp = new Appointment({
                    userId: req.user.id,
                    service: parsed.service,
                    price: parsed.price,
                    date: appointmentDate,
                    extras: event.description || '',
                    status: new Date(appointmentDate) < new Date() ? 'Finished' : 'Scheduled',
                    googleEventId: event.id
                });
                
                await newApp.save();
                importedCount++;
                console.log(`Imported: ${parsed.service} ($${parsed.price}) on ${appointmentDate}`);
            }
        }

        res.json({ msg: `Synced ${importedCount} new appointments from Google Calendar` });

    } catch (err) {
        console.error('Google Sync Error:', err);

        // Detect invalid/expired refresh tokens (common cause of sync failures)
        const msg = (err && err.message) || 'Server Error during sync';
        const lower = String(msg).toLowerCase();
        const isInvalidGrant = lower.includes('invalid_grant') || lower.includes('invalid grant') || lower.includes('invalid_token') || (err && err.code === 401);

        if (isInvalidGrant) {
            // Clear stored tokens for the user so the frontend shows disconnected state
            try {
                await User.findByIdAndUpdate(req.user.id, { $unset: { googleRefreshToken: 1, googleEmail: 1 } });
            } catch (uerr) {
                console.error('Error clearing user Google tokens after invalid grant:', uerr);
            }
            return res.status(400).json({ msg: 'Google token invalid. Please reconnect your account.' });
        }

        return res.status(500).json({ msg });
    }
});

module.exports = router;
