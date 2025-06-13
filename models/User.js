const mongoose = require("mongoose");

const UserSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role:{
      type:String,
      enum:["user","member","admin"],
      default:"user"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
