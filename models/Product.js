const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  size: { type: String },
  color: { type: String },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  images: [String],
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  variants: { type: [VariantSchema], validate: v => v.length > 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

ProductSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
