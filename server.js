require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripePackage = require('stripe');
const admin = require('firebase-admin');

// FIREBASE SETUP
const serviceAccount = {
  type: "service_account",
  project_id: "the-clark-card",
  private_key_id: "8b59b125a271e2c24bc89d74ec4734de5b2bd9b8",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQCfNwD32a2JqdC1\npIaiDCGExPMf04ngSBKECoYhhede2nH1Ud/bpI3+JnFYQdgYX2y+Dngg/fcAg+dO\nkFdfns9wcp9FjKkDJkli57BLSSD1PCagOBDSrysf0mSUmS6XJEnMijhQ8dNrPYni\nD1VqrTC6pxBQvoP1f3vk7WUEIX0Xj2UMq7BBZEWgc5ky66RK8gDfj3d5oRbWiVY8\nnMylP8WIvrITPniczRZCiV3/3CVQznb3uxunHdnXT9322VEV37mYldE3rQ3rtDmJ\nLMRatebtWzxd9IWDzmDAURQjYRsgqvNbPTExEDRx+SyMddnSuhj4SRvkzY8v+RgJ\nkPZz+pKdAgMBAAECgf9IB7GuQVhwBsDCspUfGADMPtm/XcYaDt5RmJ/QXDh/POBR\nkIpwdxk6nCnCfjX/uYlKRCpDfP9ZmWqAfbWVXnJMPqZbiupgJU88tZUMemZAL1N4\ny7YWg7TQU6TQT8LEQRrznQkjOKGzVwytOStro0wLVEPez2meBJqUPS92Ud7RseL7\nVJxJQNnteZBd574eo595WH7+ZmP50UwciXLRQaL8k/hNwogMy0qgkwxC+g7OsCog\n8Ow0jW3rirjNFSGGmfumlDjn6rTQ6zy9R1TQ/8CvwbUgSgyY/LiUbR7W0xr9BYQp\notvkQcblg1Y+yq0iE0sW6RcK/QGfhbeyYBPkJEkCgYEAyqNo66UYC5xDd8P76Jnm\nxiyy8qiqAhJpg9jynwZl2X0VNMYn+39e1j9+pt3CKORh79Hs1AAAAkIEjiWgfTQW\nd1ztKMZ5jS9X/VrtX8LEPP4dNRMUu3tewnWt+liVOKmtyPSS9rk+9T7logtbWA5O\neDB0/TG3Khr84Kgfy51CMPMCgYEAySRCdrBKhCpzKdIrXzQEkHOiT9IzHfuGtADE\nEU7tAzgy1CsfflbIhZx0uhud5swH6wTRlRgAG0LFRWn332XLJfIT1v5bV7st5ofu\n3CUULHAgOMhE4JZr5mHSYb7ce/7yZ67eOYCahP0vjw6vLSLPKA1OTDciV6yIUtPG\nD7mzki8CgYBoQUab5mbGonD7z3NtqrDWyOyQeEJvqnVrBlVdh/civH4KluC/PjrW\n0/gfdfyM+WOB9Wl5cT6P6tNZJva5M/FTHBZQYjzrbK5ChWOXXyeDkeIJCnYiN0j7\nl3wZTzYG3xWwTFTIZ2qC1wdiJaGrXkD1CUlHcyqfmR79nsItCg2iDQKBgEuPFnSV\nlvh9JdPhAq/5z3kgJyoLEW7C7QAzhXPnDTv3YYi4RlVkbmFau7Kp6zAnFxZfMgfr\nAyc6dvazbwz5pU202WUbGd8kDoMaL019lE15NXF/MfiYKSJbPve/Bf6CcDcoxowd\nVm582d/IqV+wQteN4Arbb0g2JOPQcAe6P827AoGBAKwZoRtDMn51AqEhunbH5qhv\nodHdtD9SUreZpiwA7lfIDZyrgcHe5DMr3A3g3NuGX/q0HP3SHdTQAkuB+GcKnfJW\nS7/eHRtdNtmEh8RKkx+77aISv8Q0wPFe9aMzC4K8wOvOUmloCKJpIa2DBa96fR9P\nLNU6VaKUvkuM6Vo4Wg3o\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-tges9@the-clark-card.iam.gserviceaccount.com",
  client_id: "114217158047124493381",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-tges9%40the-clark-card.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// STRIPE SETUP
const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);

// EXPRESS SETUP
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ROUTES
app.post('/charge', async (req, res) => {
  try {
    const { walletNumber, amount, recipientCard, expiryDate, cvv } = req.body;

    const walletRef = db.collection('giftCards').doc(walletNumber);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const walletData = walletDoc.data();
    const currentBalance = walletData.balance || 0;

    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const [exp_month, exp_year_suffix] = expiryDate.split('/');
    const exp_year = `20${exp_year_suffix}`;

    const token = await stripe.tokens.create({
      card: {
        number: recipientCard,
        exp_month,
        exp_year,
        cvc: cvv
      }
    });

    const charge = await stripe.charges.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      source: token.id,
      description: `CV Exchange Live Payment from Wallet ${walletNumber}`
    });

    await walletRef.update({ balance: currentBalance - amount });

    await db.collection('transactions').add({
      walletNumber,
      amount,
      stripeChargeId: charge.id,
      timestamp: new Date().toISOString(),
      status: 'Completed'
    });

    console.log(`Charged $${amount} from wallet ${walletNumber} to card ending in ${recipientCard.slice(-4)}`);
    res.json({ success: true, message: 'Payment processed successfully' });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
