const mongoose = require('mongoose');

const ComplaintStatusHistorySchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      enum: ['REPORTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', null],
      default: null,
    },
    newStatus: {
      type: String,
      enum: ['REPORTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

ComplaintStatusHistorySchema.index({ complaintId: 1, createdAt: -1 });

module.exports = mongoose.model('ComplaintStatusHistory', ComplaintStatusHistorySchema);
