const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

async function getAnalyticsSummary(req, res) {
  try {
    const userObjectId = new mongoose.Types.ObjectId(String(req.user._id));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const results = await Invoice.aggregate([
      {
        $match: {
          user: userObjectId
        }
      },
      {
        $group: {
          _id: null,
          totalRevenueCents: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$totalCents', 0]
            }
          },
          outstandingCents: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$totalCents', 0]
            }
          },
          draftCents: {
            $sum: {
              $cond: [{ $eq: ['$status', 'draft'] }, '$totalCents', 0]
            }
          },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, 1, 0]
            }
          },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          draftCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'draft'] }, 1, 0]
            }
          },
          mrrCents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $gte: ['$paidAt', thirtyDaysAgo] }
                  ]
                },
                '$totalCents',
                0
              ]
            }
          }
        }
      }
    ]);

    const summary = results[0] || {
      totalRevenueCents: 0,
      outstandingCents: 0,
      draftCents: 0,
      paidCount: 0,
      pendingCount: 0,
      draftCount: 0,
      mrrCents: 0
    };

    return res.status(200).json({
      totalRevenueCents: Math.trunc(summary.totalRevenueCents || 0),
      outstandingCents: Math.trunc(summary.outstandingCents || 0),
      draftCents: Math.trunc(summary.draftCents || 0),
      paidCount: Math.trunc(summary.paidCount || 0),
      pendingCount: Math.trunc(summary.pendingCount || 0),
      draftCount: Math.trunc(summary.draftCount || 0),
      mrrCents: Math.trunc(summary.mrrCents || 0)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getAnalyticsSummary
};
