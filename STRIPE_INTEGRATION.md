# Stripe Connect & Age Verification Integration Guide

This document explains the Stripe Connect and Age Verification implementation in the GayTradies application.

## Overview

The application now includes:
1. **Stripe Connect** - For tradie payment processing and payouts
2. **Stripe Identity** - For age verification (18+ requirement)
3. **Enhanced Payment UI** - Modern payment management interface

## Frontend Implementation ✅

The following frontend components have been implemented:

### Files Created/Modified:
- `stripe.ts` - Stripe configuration and API helper functions
- `admin-settings.tsx` - Enhanced PaymentsCredits component with Stripe
- UI components enhanced with modern styling

### Features Implemented:
- ✅ Stripe Connect account onboarding flow
- ✅ Age verification (18+) interface
- ✅ Payment method selection (Stripe/Bank/Crypto)
- ✅ Withdrawal management with Stripe option
- ✅ Connection status indicators
- ✅ Visual enhancements across all payment pages

## Backend Requirements 🔧

To complete the Stripe integration, you need to set up the following backend API endpoints:

### 1. Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret
```

### 2. Required API Endpoints

#### Create Stripe Connect Account
```
POST /api/stripe/create-connect-account
Body: {
  userId: string,
  email: string,
  type: 'express' | 'standard',
  capabilities: object
}
Response: {
  accountId: string,
  success: boolean
}
```

#### Create Account Onboarding Link
```
POST /api/stripe/create-account-link
Body: {
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
  type: 'account_onboarding'
}
Response: {
  url: string
}
```

#### Create Payment Intent
```
POST /api/stripe/create-payment-intent
Body: {
  amount: number, // in cents
  currency: string,
  applicationFeeAmount: number, // platform commission
  transferData: {
    destination: string // tradie's Stripe account
  },
  metadata: object
}
Response: {
  clientSecret: string,
  paymentIntentId: string
}
```

#### Create Payout
```
POST /api/stripe/create-payout
Body: {
  accountId: string,
  amount: number, // in cents
  currency: string
}
Response: {
  payoutId: string,
  status: string
}
```

#### Create Identity Verification
```
POST /api/stripe/create-identity-verification
Body: {
  userId: string,
  email: string,
  type: 'document',
  options: object
}
Response: {
  verificationId: string,
  clientSecret: string,
  url: string
}
```

#### Get Identity Verification Status
```
GET /api/stripe/identity-verification/:verificationId
Response: {
  status: 'verified' | 'requires_input' | 'canceled',
  verifiedAge: number,
  verified: boolean
}
```

#### Get Account Details
```
GET /api/stripe/account/:accountId
Response: {
  accountId: string,
  chargesEnabled: boolean,
  payoutsEnabled: boolean,
  detailsSubmitted: boolean
}
```

### 3. Webhook Handler

Set up a webhook endpoint to handle Stripe events:

```
POST /api/stripe/webhook
Headers: {
  stripe-signature: string
}
```

Handle these events:
- `account.updated` - Update tradie's Stripe connection status
- `payment_intent.succeeded` - Process successful payments
- `payment_intent.payment_failed` - Handle failed payments
- `payout.paid` - Update payout status
- `payout.failed` - Handle failed payouts
- `identity.verification_session.verified` - Update age verification status
- `identity.verification_session.requires_input` - Request additional info

### 4. Firebase Configuration

Add to your Firebase config (set via window variables):

```javascript
window.__stripe_publishable_key = 'pk_test_...';
```

## Database Schema Updates 📊

Update user profiles in Firebase to include:

```javascript
{
  stripeAccountId: string | null,
  stripeConnected: boolean,
  stripeOnboardingCompleted: Timestamp | null,
  ageVerified: boolean,
  ageVerifiedAt: Timestamp | null,
  finances: {
    onHoldBalance: number,
    availableBalance: number,
    totalEarnings: number,
    totalCommissionPaid: number
  }
}
```

Update transactions collection:

```javascript
{
  tradieUid: string,
  type: 'payment' | 'withdrawal' | 'commission',
  amount: number,
  method: 'stripe' | 'bank' | 'crypto',
  status: 'pending' | 'completed' | 'failed',
  stripeAccountId: string | null,
  stripePayoutId: string | null,
  createdAt: Timestamp
}
```

## Testing 🧪

### Stripe Test Cards
Use these test card numbers:
- `4242 4242 4242 4242` - Successful payment
- `4000 0000 0000 9995` - Declined payment
- `4000 0025 0000 3155` - Requires authentication

### Test Mode Setup
1. Create a Stripe test account
2. Enable Stripe Connect in test mode
3. Set up test webhook endpoints
4. Use test API keys

## Security Considerations 🔒

1. **Never expose secret keys** - Keep them server-side only
2. **Verify webhooks** - Always verify Stripe webhook signatures
3. **Validate amounts** - Double-check payment amounts server-side
4. **Rate limiting** - Implement rate limiting on API endpoints
5. **Audit logs** - Log all payment operations
6. **PCI compliance** - Never store card details directly

## Implementation Steps 📝

1. **Set up Stripe account**
   - Create a Stripe account at stripe.com
   - Enable Stripe Connect
   - Enable Stripe Identity
   - Get API keys

2. **Configure backend**
   - Set environment variables
   - Implement API endpoints
   - Set up webhook handler
   - Test in Stripe test mode

3. **Configure Firebase**
   - Add Stripe publishable key to config
   - Update security rules for new fields
   - Create Cloud Functions for Stripe operations

4. **Test integration**
   - Test Connect onboarding
   - Test age verification
   - Test payments
   - Test payouts
   - Verify webhooks

5. **Go live**
   - Switch to live API keys
   - Update webhook URLs
   - Monitor transactions
   - Set up alerts

## Support & Documentation 📚

- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Stripe Identity Docs](https://stripe.com/docs/identity)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)

## Commission Structure 💰

The platform takes a **15% commission** on all transactions:
- Job payment: Client pays £100
- Platform fee: £15
- Tradie receives: £85

This is configured in the payment intent creation.

## Age Verification Requirements 🔞

- Users must be 18+ to use the platform
- Verification via Stripe Identity
- Document verification with selfie
- Verification status stored in user profile
- UI updates to show verified status

## Next Steps ✅

1. Set up Stripe account
2. Implement backend API endpoints
3. Configure webhooks
4. Test in development
5. Deploy to production
6. Monitor transactions

---

For questions or issues, refer to the Stripe documentation or contact the development team.
