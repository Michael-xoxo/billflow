const Customer = require('../models/Customer');

async function createCustomer(req, res) {
  try {
    const { name, email, company } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Customer name and email are required' });
    }

    const customer = await Customer.create({
      user: req.user._id,
      name,
      email,
      company: company || ''
    });

    return res.status(201).json(customer);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getCustomers(req, res) {
  try {
    const customers = await Customer.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json(customers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getCustomerById(req, res) {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    return res.status(200).json(customer);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateCustomer(req, res) {
  try {
    const { name, email, company } = req.body;
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { name, email, company },
      { new: true, runValidators: true }
    );
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    return res.status(200).json(customer);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function deleteCustomer(req, res) {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    return res.status(200).json({ message: 'Customer deleted' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
};
