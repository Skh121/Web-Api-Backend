// __mocks__/authenticateUser.js

exports.authorizedUser = (req, res, next) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (token === "userToken") {
    req.user = {
      _id: "507f1f77bcf86cd799439011",
      role: "user",
      email: "user@example.com",
    };
    return next();
  } else if (token === "adminToken") {
    req.user = {
      _id: "507f191e810c19729de860ea",
      role: "admin",
      email: "admin@example.com",
    };
    return next();
  } else {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Admin privilage required" });
};

exports.isMemberAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "member")) {
    return next();
  }
  return res
    .status(403)
    .json({ message: "Admin or Member privilage required" });
};
