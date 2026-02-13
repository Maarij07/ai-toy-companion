# Deployment Checklist

## Pre-Deployment

### 1. Supabase Setup
- [ ] Supabase project created
- [ ] Database schema deployed (run `supabase_schema.sql`)
- [ ] Row Level Security (RLS) policies enabled
- [ ] Authentication configured

### 2. API Keys Acquired
- [ ] Google Speech-to-Text API key obtained
- [ ] Google Gemini API key obtained
- [ ] Resemble AI API key obtained
- [ ] Resemble Project ID obtained
- [ ] Resemble Voice ID obtained
- [ ] Stripe Secret Key obtained (for payments)

### 3. Supabase Edge Functions
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Project linked (`supabase link --project-ref hshnsjiewmgwjjpzrclu`)
- [ ] Secrets configured in Supabase Dashboard:
  - [ ] `GOOGLE_STT_API_KEY`
  - [ ] `GEMINI_API_KEY`
  - [ ] `RESEMBLE_API_KEY`
  - [ ] `RESEMBLE_DEFAULT_PROJECT_ID`
  - [ ] `RESEMBLE_DEFAULT_VOICE_ID`
  - [ ] `STRIPE_SECRET_KEY`
- [ ] Edge Functions deployed:
  - [ ] `stt-processing`
  - [ ] `llm-processing`
  - [ ] `tts-processing`
  - [ ] `create-payment-intent`
  - [ ] `confirm-payment`
  - [ ] `process-refund`

### 4. Mobile App Configuration
- [ ] `.env` file updated with Supabase URL and Anon Key
- [ ] Google Sign-In Web Client ID configured
- [ ] BLE UUIDs configured for toy hardware
- [ ] Stripe Publishable Key configured

### 5. Hardware/Firmware
- [ ] Toy firmware implements BLE service with correct UUID
- [ ] Audio RX characteristic configured (NOTIFY)
- [ ] Audio TX characteristic configured (WRITE)
- [ ] Microphone captures audio at 16kHz, 16-bit, mono
- [ ] Speaker plays audio at 22.05kHz, 16-bit, mono
- [ ] End marker protocol implemented
- [ ] Base64 encoding/decoding working

## Testing

### 6. Edge Function Testing
- [ ] Test STT Edge Function with sample audio
- [ ] Test LLM Edge Function with sample prompt
- [ ] Test TTS Edge Function with sample text
- [ ] Verify all functions return expected responses
- [ ] Check function logs for errors

### 7. Mobile App Testing
- [ ] App builds successfully for iOS
- [ ] App builds successfully for Android
- [ ] User can sign up with email
- [ ] User can sign in with Google
- [ ] User can connect to toy via BLE
- [ ] Audio chunks received from toy
- [ ] STT transcription works
- [ ] LLM responses generated
- [ ] TTS audio generated
- [ ] Audio chunks sent to toy
- [ ] End-to-end voice pipeline works

### 8. E-commerce Testing
- [ ] Products load from database
- [ ] Cart functionality works
- [ ] Stripe payment flow works
- [ ] Orders saved to database

### 9. Performance Testing
- [ ] Voice pipeline latency < 5 seconds
- [ ] BLE connection stable
- [ ] Audio quality acceptable
- [ ] No memory leaks
- [ ] Battery usage reasonable

## Production Deployment

### 10. Supabase Production
- [ ] Switch to production Supabase project (if different)
- [ ] Update production secrets
- [ ] Enable production database backups
- [ ] Configure production RLS policies
- [ ] Set up monitoring and alerts

### 11. API Keys Production
- [ ] Switch to production API keys:
  - [ ] Google STT production key
  - [ ] Gemini production key
  - [ ] Resemble production key
  - [ ] Stripe live key
- [ ] Set up billing alerts for all services
- [ ] Configure rate limits

### 12. Mobile App Production
- [ ] Update app with production Supabase URL
- [ ] Update app with production Stripe key
- [ ] Remove debug logging
- [ ] Enable crash reporting
- [ ] Test on physical devices
- [ ] Submit to App Store (iOS)
- [ ] Submit to Play Store (Android)

### 13. Hardware Production
- [ ] Flash production firmware to toys
- [ ] Test BLE connectivity at scale
- [ ] Verify audio quality in production
- [ ] Test battery life
- [ ] Quality assurance testing

## Post-Deployment

### 14. Monitoring
- [ ] Set up Supabase monitoring dashboard
- [ ] Monitor Edge Function invocations
- [ ] Monitor API usage and costs:
  - [ ] Google STT usage
  - [ ] Gemini usage
  - [ ] Resemble usage
  - [ ] Stripe transactions
- [ ] Set up error alerting
- [ ] Monitor user feedback

### 15. Documentation
- [ ] User manual created
- [ ] Hardware setup guide created
- [ ] Troubleshooting guide created
- [ ] API documentation updated
- [ ] Support team trained

### 16. Compliance
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] COPPA compliance verified (children's app)
- [ ] Data retention policies implemented
- [ ] GDPR compliance verified (if applicable)

## Cost Monitoring

### Expected Monthly Costs (Approximate)

**Per 1000 interactions:**
- Google STT: ~$0.36 (60 seconds avg @ $0.006/15s)
- Gemini: ~$0.05 (200 chars avg @ $0.00025/1K chars)
- Resemble: ~$0.18 (30 seconds avg @ $0.006/s)
- Supabase: Included in plan
- **Total per 1000 interactions: ~$0.59**

**Monthly estimates:**
- 10K users × 10 interactions/day × 30 days = 3M interactions
- 3M × $0.59/1000 = ~$1,770/month

Set billing alerts at:
- [ ] $500/month
- [ ] $1000/month
- [ ] $2000/month

## Rollback Plan

If issues occur:
1. [ ] Revert Edge Functions to previous version
2. [ ] Rollback mobile app via store
3. [ ] Switch to backup Supabase project
4. [ ] Notify users of maintenance
5. [ ] Document incident for post-mortem

## Success Metrics

Track these KPIs:
- [ ] User sign-ups per day
- [ ] Active toys connected
- [ ] Voice interactions per day
- [ ] Average response latency
- [ ] Error rate < 1%
- [ ] User retention rate
- [ ] Revenue per user (marketplace)

## Support Readiness

- [ ] Support email configured
- [ ] FAQ page created
- [ ] Support ticket system set up
- [ ] Support team has access to logs
- [ ] Escalation process defined
