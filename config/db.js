const mongoose = require("mongoose");
const CONNECTION_STRING = process.env.MONGODB_URL

exports.connectDB = async(req,res)=>{
    try{
        await mongoose.connect(CONNECTION_STRING)
        console.log("MongoDB Connected")
    }catch(err){
        console.log("Connection Failed",err.message)
    }
}