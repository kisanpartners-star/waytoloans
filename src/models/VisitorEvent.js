const mongoose = require('mongoose');

const visitorEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  visitorId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  path: { type: String, required: true, index: true },
  pageTitle: { type: String, default: '' },
  device: { type: String, enum: ['mobile', 'tablet', 'desktop', 'other'], default: 'other', index: true },
  browser: { type: String, default: 'Other', index: true },
  durationSeconds: { type: Number, min: 0, default: 0 },
  visitedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

visitorEventSchema.index({ path: 1, visitedAt: -1 });
visitorEventSchema.index({ sessionId: 1, visitedAt: -1 });

module.exports = mongoose.model('VisitorEvent', visitorEventSchema);
