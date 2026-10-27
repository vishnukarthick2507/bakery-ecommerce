import mongoose, { Schema, Document } from "mongoose";

export interface ISettings extends Document {
  onlineOrdersEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  closedMessage: string;
  reopenAt: Date | null;
}

const settingsSchema = new Schema<ISettings>(
  {
    onlineOrdersEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },

    deliveryEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },

    pickupEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },

    closedMessage: {
      type: String,
      trim: true,
      default:
        "We are currently not accepting online orders. Please check back soon.",
      required: true,
    },

    reopenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/*
|--------------------------------------------------------------------------
| SINGLETON SETTINGS
|--------------------------------------------------------------------------
| There is exactly one settings document for the bakery.
| getSingleton() returns the existing document or creates one with defaults.
|--------------------------------------------------------------------------
*/

settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const Settings = mongoose.model<ISettings>("Settings", settingsSchema);
