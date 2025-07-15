const Notification = require('../../models/Notification');

const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 }).limit(30).populate('sender', 'fullName');
        res.json(notifications);
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
};

const markNotificationsAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user.id, isRead: false }, { isRead: true });
        res.json({ message: 'Notifications marked as read.' });
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
};

module.exports = { getMyNotifications, markNotificationsAsRead };