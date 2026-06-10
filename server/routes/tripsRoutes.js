const express = require('express');
const { listTrips, getTrip, saveTrip, updateTrip, deleteTrip } = require('../controllers/tripsController');

const router = express.Router();

router.get('/', listTrips);
router.get('/:id', getTrip);
router.post('/', saveTrip);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);

module.exports = router;
