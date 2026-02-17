const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Service = require('../models/Service');

// @route   GET api/services
// @desc    Get all services for user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const services = await Service.find({ userId: req.user.id }).sort({ name: 1 });
        res.json(services);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/services
// @desc    Add a new service
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { name, price } = req.body;
        if (!name || !price) {
            return res.status(400).json({ msg: 'Please enter both name and price' });
        }

        const newService = new Service({
            userId: req.user.id,
            name,
            price
        });
        const service = await newService.save();
        res.json(service);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/services/:id
// @desc    Delete service
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ msg: 'Service not found' });
        if (service.userId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

        await service.deleteOne();
        res.json({ msg: 'Service removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
