const mongoose = require('mongoose');

const MunicipalCorporationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Municipal Corporation name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Municipal Corporation code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    // GeoJSON Polygon boundary — NOTE: This is DEMO DATA, not official government boundaries
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
      },
      coordinates: {
        type: [[[Number]]],
        default: undefined,
      },
    },
    isDemo: {
      type: Boolean,
      default: true, // Flag all boundaries as demo
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for geospatial boundary queries
MunicipalCorporationSchema.index({ boundary: '2dsphere' });
MunicipalCorporationSchema.index({ isActive: 1 });

module.exports = mongoose.model('MunicipalCorporation', MunicipalCorporationSchema);
