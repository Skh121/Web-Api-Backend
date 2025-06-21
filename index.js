require("dotenv").config();
const express = require("express");
const cors = require("cors")
const { connectDB } = require("./config/db");
const userRoutes = require("./routes/userRoutes")
const paymentRoutes = require("./routes/paymentRoutes")
const checkoutRoutes = require("./routes/checkoutRoutes")
const subscriptionRoutes = require("./routes/subscriptionRoutes")
const adminRoutes = require("./routes/admin/adminRoutes")
const logRoutes = require("./routes/admin/logRoutes")
const path = require("path");
const app = express();
const corsOptions = {
    origin:"*"
}

connectDB();
app.use(express.json());
app.use(cors(corsOptions));
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

app.use("/api/auth",userRoutes)
app.use("/api/auth/payment",paymentRoutes)
app.use("/api/auth/checkout",checkoutRoutes)
app.use("/api/auth/subscription",subscriptionRoutes)
app.use("/api/admin/user",adminRoutes)

////////////////////////// Log Management /////////////////////////////////////////////

app.use("/api/admin/log",logRoutes)

const PORT = process.env.PORT;

app.listen(PORT,()=>{
    console.log(`Server Started at PORT ${PORT}`)
})