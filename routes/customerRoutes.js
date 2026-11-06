const express = require('express');
const router = express.Router();
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const { authGuard } = require('../middleware/authGuard');
const rateLimiter = require('../middleware/rateLimiter');
const requireScope = require('../middleware/requireScope');

router.use(authGuard, rateLimiter);

router
  .route('/')
  .get(requireScope('customers:read'), getCustomers)
  .post(requireScope('customers:write'), createCustomer);

router
  .route('/:id')
  .get(requireScope('customers:read'), getCustomerById)
  .put(requireScope('customers:write'), updateCustomer)
  .delete(requireScope('customers:write'), deleteCustomer);

module.exports = router;
