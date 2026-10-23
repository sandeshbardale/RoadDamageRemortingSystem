const mongoose = require('mongoose');

const DAMAGE_CATEGORIES = ['POTHOLE', 'CRACK', 'EDGE_FAILURE', 'WATERLOGGING', 'SURFACE_DAMAGE', 'OTHER'];
const STATUSES = ['REPORTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const ComplaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      required: true,
    },
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Citizen ID is required'],
    },
    image: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },
    damageCategory: {
      type: String,
      enum: DAMAGE_CATEGORIES,
      required: [true, 'Damage category is required'],
    },
    customDamageType: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    // GeoJSON Point — coordinates MUST be [longitude, latitude]
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function (coords) {
            return (
              Array.isArray(coords) &&
              coords.length === 2 &&
              coords[0] >= -180 && coords[0] <= 180 &&
              coords[1] >= -90 && coords[1] <= 90
            );
          },
          message: 'Coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },
    address: {
      formatted: { type: String, default: '' },
      road: { type: String, default: '' },
      area: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postcode: { type: String, default: '' },
    },
    municipalCorporationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MunicipalCorporation',
      default: null,
    },
    assignmentStatus: {
      type: String,
      enum: ['ASSIGNED', 'UNASSIGNED'],
      default: 'UNASSIGNED',
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'REPORTED',
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },
    duplicateDistance: {
      type: Number,
      default: null,
    },
    // ── Gemini AI image analysis result ──────────────────────────────────────
    aiAnalysis: {
      available:         { type: Boolean, default: false },
      severity:          { type: String, default: null },
      damageType:        { type: String, default: null },
      estimatedSize:     { type: String, default: null },
      safetyRisk:        { type: String, default: null },
      recommendedAction: { type: String, default: null },
      additionalNotes:   { type: String, default: null },
      rawText:           { type: String, default: null },
      analyzedAt:        { type: String, default: null },
      message:           { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for geospatial queries — REQUIRED for $near, $geoNear, $geoIntersects
ComplaintSchema.index({ location: '2dsphere' });
// complaintId unique index already declared via unique:true in schema field
ComplaintSchema.index({ citizenId: 1 });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ damageCategory: 1 });
ComplaintSchema.index({ municipalCorporationId: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ isDuplicate: 1 });

module.exports = mongoose.model('Complaint', ComplaintSchema);
module.exports.DAMAGE_CATEGORIES = DAMAGE_CATEGORIES;
module.exports.STATUSES = STATUSES;
