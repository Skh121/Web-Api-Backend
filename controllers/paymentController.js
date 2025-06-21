const Payment = require('../models/Payment');

exports.getMyPaymentHistory = async (req, res) => {
    try {
        // We get the user ID from the authentication middleware (e.g., req.user.id)
        const payments = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });

        if (!payments || payments.length === 0) {
            return res.status(404).json({ message: 'No payment history found.' });
        }

        res.status(200).json(payments);

    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.handlePaymentWebhook = async (req, res) => {
    // In a real application, you would verify a signature from the payment gateway
    // to ensure the request is legitimate.
    const event = req.body;

    // Handle the event
    switch (event.type) {
        case 'invoice.payment_succeeded':
            // This is for a successful recurring payment.
            const subscriptionId = event.data.object.subscription;
            
            // Find the subscription in your DB and create a new payment record.
            // You might also extend the subscription's 'endDate'.
            console.log(`Recurring payment succeeded for subscription: ${subscriptionId}`);
            // TODO: Add logic to create a new Payment record and update the Subscription's endDate.
            break;
            
        case 'invoice.payment_failed':
            // The payment failed.
            const failedSubscriptionId = event.data.object.subscription;
            // You should notify the user that their payment failed and update their
            // subscription status to 'expired' or 'past_due'.
            console.log(`Recurring payment failed for subscription: ${failedSubscriptionId}`);
            // TODO: Add logic to update Subscription status and notify user.
            break;
        
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};
