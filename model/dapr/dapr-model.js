import mongoose from "mongoose";
const Schema = mongoose.Schema;


const Dapr = new Schema({
  url: { type: String, index: true },
  title: { type: String, index: true },
  author: { type: String, index: true },
  mood: { type: String, index: true },
  fbShares: { type: Number },
  gaViews: { type: Number },
  publishDate: { type: Date, index: true },
  inlineCtr: Object.assign({}, {
    inline_link_click_ctr: Schema.Types.Mixed,
  }),
  adID: { type: Schema.Types.Mixed }
});

export default mongoose.model("Dapr", Dapr);
