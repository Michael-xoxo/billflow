const express = require('express');
const router = express.Router();
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const { authMiddleware } = require('../utils/authMiddleware');

router.use(authMiddleware);

router.route('/').post(createCustomer).get(getCustomers);
router
  .route('/:id')
  .get(getCustomerById)
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router;
