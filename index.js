require("dotenv").config();
const express = require("express");
const cors = require("cors")
const { connectDB } = require("./config/db");
const userRoutes = require("./routes/userRoutes")
const app = express();
const corsOptions = {
    origin:"*"
}

connectDB();
app.use(express.json());
app.use(cors(corsOptions));

app.use("/api/auth",userRoutes)

const PORT = process.env.PORT;

app.listen(PORT,()=>{
    console.log(`Server Started at PORT ${PORT}`)
})