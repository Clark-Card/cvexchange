const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const Stripe = require('stripe');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/firestore-to-stripe', async (req, res) => {
  const { walletNumber, amount } = req.body;

  if (!walletNumber || !amount) {
    return res.status(400).json({ error: 'Missing walletNumber or amount.' });
  }

  try {
    const walletRef = db.collection('wallets').doc(walletNumber);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    const walletData = walletDoc.data();
    const currentBalance = walletData.balanceUSD || 0;

    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    // Deduct from Firestore balance
    await walletRef.update({
      balanceUSD: currentBalance - amount
    });

    // Create a Stripe transfer (to connected account or payout to platform)
    const transfer = await stripe.transfers.create({
      amount: amount,
      currency: 'usd',
      destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID, // or omit if using platform
    });

    return res.status(200).json({ success: true, transferId: transfer.id });
  } catch (error) {
    console.error('Transfer Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(port, () => {
  console.log(`CV Exchange backend running on port ${port}`);
});
