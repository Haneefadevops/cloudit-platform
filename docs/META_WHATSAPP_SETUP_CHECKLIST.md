# Meta WhatsApp Business API Setup Checklist

This checklist is for setting up one client (one WhatsApp business number) in Meta.

## Before you start

- [ ] New SIM card purchased
- [ ] Phone available for WhatsApp Business registration
- [ ] Meta Business account created: https://business.facebook.com
- [ ] Meta Developer account created: https://developers.facebook.com

## Step 1: Prepare the phone number

- [ ] Insert new SIM into phone
- [ ] Install **WhatsApp Business** app (not regular WhatsApp)
- [ ] Register the number in WhatsApp Business app
- [ ] Complete OTP verification
- [ ] Set basic business profile (name, category)
- [ ] Do NOT use this number for personal chats

## Step 2: Create Meta app

- [ ] Go to https://developers.facebook.com/apps
- [ ] Click **Create App**
- [ ] Select **Business** type
- [ ] Fill app name (e.g., "TheReplyte - Client Name")
- [ ] Select your Meta Business Account
- [ ] Click **Create**

## Step 3: Add WhatsApp product

- [ ] In app dashboard, click **Add Product**
- [ ] Find **WhatsApp** and click **Set Up**
- [ ] Accept terms

## Step 4: Add phone number to WhatsApp Business Platform

- [ ] Go to **WhatsApp → Getting Started** or **WhatsApp → Configuration**
- [ ] Click **Add Phone Number**
- [ ] Select country and enter phone number
- [ ] Verify by OTP or voice call
- [ ] Complete 2FA if required

## Step 5: Collect required IDs and tokens

After setup, collect these values:

| Value | Where to find |
|---|---|
| **Phone Number ID** | WhatsApp → Getting Started |
| **WhatsApp Business Account ID** | WhatsApp → Getting Started |
| **Permanent Access Token** | Business Settings → System Users → Generate Token |

### How to generate permanent token

1. Go to https://business.facebook.com/settings/system-users
2. Click **Add** to create a system user
3. Assign **Admin** role
4. Select your app
5. Click **Generate Token**
6. Select permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
7. Copy and save the token securely

## Step 6: Configure webhook

- [ ] Go to **WhatsApp → Configuration**
- [ ] Click **Edit** next to Webhook
- [ ] Callback URL: `https://api.thereplyte.com/api/webhooks/whatsapp`
- [ ] Verify token: same as `META_VERIFY_TOKEN` in your `.env`
- [ ] Click **Verify and Save**
- [ ] Subscribe to `messages` field
- [ ] Click **Save**

## Step 7: Add payment method

- [ ] Go to Meta Business Settings → Payments
- [ ] Add credit/debit card
- [ ] This is required for WhatsApp conversation-based billing

## Step 8: Add client to TheReplyte

Use these values when creating a client in TheReplyte dashboard or API:

```json
{
  "name": "Sunrise Grocery",
  "whatsappNumber": "+94751234567",
  "whatsappPhoneNumberId": "YOUR_PHONE_NUMBER_ID",
  "metaAccessToken": "YOUR_PERMANENT_ACCESS_TOKEN",
  "businessProfile": {
    "address": "Colombo",
    "hours": "8AM - 6PM",
    "phone": "+94751234567"
  },
  "products": [
    { "name": "Rice 5kg", "price": 450, "stock": 10 }
  ],
  "systemPrompt": "You are the AI assistant for Sunrise Grocery."
}
```

## Step 9: Test end-to-end

- [ ] Send WhatsApp message from your personal number to client number
- [ ] Verify AI replies
- [ ] Send handoff keyword like "human" or "complaint"
- [ ] Verify conversation appears in Chatwoot
- [ ] Agent replies in Chatwoot
- [ ] Verify reply reaches your WhatsApp

## Troubleshooting

| Problem | Solution |
|---|---|
| Webhook verification fails | Check `META_VERIFY_TOKEN` matches exactly |
| Messages not received | Confirm `messages` field is subscribed |
| Cannot send messages | Check Meta payment method is added |
| Token expired | Generate a new permanent token |
| Number already in use | Must remove from personal WhatsApp Business app first |

## Security reminder

- Never commit Meta tokens to Git
- Store tokens in environment variables or database encrypted
- Rotate tokens periodically
