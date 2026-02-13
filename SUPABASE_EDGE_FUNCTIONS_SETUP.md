# Supabase Edge Functions Setup Guide

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Supabase project created
3. API keys obtained for:
   - Google Speech-to-Text
   - Google Gemini
   - Resemble AI

## Step 1: Link Your Supabase Project

```bash
supabase link --project-ref hshnsjiewmgwjjpzrclu
```

## Step 2: Set Edge Function Secrets

Navigate to your Supabase Dashboard or use CLI:

### Via Dashboard:
1. Go to https://supabase.com/dashboard/project/hshnsjiewmgwjjpzrclu
2. Navigate to Edge Functions → Secrets
3. Add the following secrets:

```
GOOGLE_STT_API_KEY=your_google_speech_to_text_api_key
GEMINI_API_KEY=your_google_gemini_api_key
RESEMBLE_API_KEY=your_resemble_ai_api_key
RESEMBLE_DEFAULT_PROJECT_ID=your_resemble_project_id
RESEMBLE_DEFAULT_VOICE_ID=your_resemble_voice_id
STRIPE_SECRET_KEY=your_stripe_secret_key
```

### Via CLI:

```bash
# Google STT
supabase secrets set GOOGLE_STT_API_KEY=your_google_speech_to_text_api_key

# Gemini LLM
supabase secrets set GEMINI_API_KEY=your_google_gemini_api_key

# Resemble TTS
supabase secrets set RESEMBLE_API_KEY=your_resemble_ai_api_key
supabase secrets set RESEMBLE_DEFAULT_PROJECT_ID=your_resemble_project_id
supabase secrets set RESEMBLE_DEFAULT_VOICE_ID=your_resemble_voice_id

# Stripe (for payments)
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
```

## Step 3: Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy stt-processing
supabase functions deploy llm-processing
supabase functions deploy tts-processing
supabase functions deploy create-payment-intent
supabase functions deploy confirm-payment
supabase functions deploy process-refund
```

## Step 4: Verify Deployment

Test each function:

```bash
# Test STT
curl -X POST https://hshnsjiewmgwjjpzrclu.supabase.co/functions/v1/stt-processing \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"audio":"base64_encoded_audio","languageCode":"en-US"}'

# Test LLM
curl -X POST https://hshnsjiewmgwjjpzrclu.supabase.co/functions/v1/llm-processing \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello, how are you?"}'

# Test TTS
curl -X POST https://hshnsjiewmgwjjpzrclu.supabase.co/functions/v1/tts-processing \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test"}'
```

## Step 5: Monitor Logs

```bash
# View logs for a specific function
supabase functions logs stt-processing
supabase functions logs llm-processing
supabase functions logs tts-processing
```

## API Key Acquisition Guide

### Google Speech-to-Text API Key

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable "Cloud Speech-to-Text API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key

### Google Gemini API Key

1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Select your Google Cloud project
4. Copy the API key

### Resemble AI API Key

1. Go to https://www.resemble.ai/
2. Sign up or log in
3. Navigate to Settings → API Keys
4. Create a new API key
5. Copy the API key
6. Get your Project ID from Projects page
7. Get your Voice ID from Voices page

### Stripe Secret Key

1. Go to https://dashboard.stripe.com/
2. Navigate to Developers → API Keys
3. Copy the "Secret key" (starts with `sk_test_` or `sk_live_`)

## Security Notes

- Never commit API keys to version control
- Use test keys during development
- Rotate keys periodically
- Monitor usage in respective dashboards
- Set up billing alerts

## Troubleshooting

### Function not responding:
```bash
supabase functions logs <function-name> --tail
```

### Secret not found:
```bash
supabase secrets list
```

### Deployment failed:
```bash
# Check function syntax
deno check supabase/functions/<function-name>/index.ts
```

## Cost Estimates (Approximate)

- **Google STT**: $0.006 per 15 seconds
- **Gemini API**: Free tier available, then $0.00025 per 1K characters
- **Resemble AI**: Varies by plan, typically $0.006 per second
- **Supabase Edge Functions**: 500K invocations free, then $2 per 1M

## Next Steps

1. Test the complete pipeline with your toy hardware
2. Implement error handling in mobile app
3. Add usage analytics
4. Set up monitoring and alerts
5. Optimize chunk sizes for your hardware
