const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String },
    patientName: { type: String },
    reportType: { type: String },
    healthScore: { type: Number },
    alertLevel: { type: String },
    parsedCount: { type: Number },
    diseaseCount: { type: Number },
    rawText: { type: String }
  },
  { timestamps: true }
);

// The frontend expects "id" (not "_id") and doesn't need the internals
reportSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.user;
    return ret;
  }
});

module.exports = mongoose.model('Report', reportSchema);
