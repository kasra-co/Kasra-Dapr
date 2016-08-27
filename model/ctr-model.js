import mongoose from "mongoose";
const Schema = mongoose.Schema;


const FacebookCtr = new Schema({
  slug: { type: String, index: true },
  title: { type: String, index: true },
  inlineCtr: Object.assign({}, {
    inline_link_click_ctr: Schema.Types.Mixed,
  })
});

export default mongoose.model("Ctr", FacebookCtr);
