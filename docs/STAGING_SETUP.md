# Staging Environment Setup Guide

This guide explains how to set up the staging environment with RLS (Row Level Security) and OCR/photo upload functionality.

## Prerequisites

- Supabase project (staging)
- Service role key for admin operations
- Storage buckets configured

## Environment Variables

Create a `.env.staging` file:

```bash
# Supabase Configuration (Staging)
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Disable TEST_MODE for staging
TEST_MODE=false

# Test User Credentials (stored securely in secrets manager)
TEST_USER_A_EMAIL=userA-staging@test.com
TEST_USER_A_PASSWORD=<from-secrets-manager>
TEST_USER_B_EMAIL=userB-staging@test.com
TEST_USER_B_PASSWORD=<from-secrets-manager>
TEST_USER_C_EMAIL=userC-staging@test.com
TEST_USER_C_PASSWORD=<from-secrets-manager>
```

## Setup Steps

### 1. Apply RLS Policies

Run the RLS policies SQL in Supabase SQL Editor:

```bash
# Connect to Supabase and run:
psql -h db.your-staging-project.supabase.co -U postgres -d postgres -f supabase/rls-policies.sql
```

Or paste the contents of `supabase/rls-policies.sql` into the Supabase SQL Editor.

### 2. Create Storage Buckets

The RLS policies script creates these buckets:
- `food-labels` - Private bucket for food label photos
- `progress-photos` - Private bucket for progress photos

### 3. Create Test Users

Create test users via Supabase Auth API or Dashboard:

```javascript
// Using Supabase JS client
const { data, error } = await supabase.auth.signUp({
  email: 'userA-staging@test.com',
  password: '<secure-password>',
  options: {
    data: {
      name: 'Test User A',
    },
  },
});
```

### 4. Verify RLS is Working

Test that userB cannot access userA's data:

```bash
# Login as userA, create a food log entry
# Login as userB, try to access userA's entry - should fail

curl -X GET "https://your-staging-project.supabase.co/rest/v1/food_logs?user_id=eq.<userA-id>" \
  -H "Authorization: Bearer <userB-access-token>" \
  -H "apikey: your-anon-key"
# Should return empty array or 403
```

## OCR/Photo Upload Testing

### Test Photo Upload Flow

1. **Upload Food Label Photo**

```bash
# Get presigned URL
curl -X POST "https://staging.example.com/api/storage/presign" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"bucket":"food-labels","path":"<user-id>/label-test.jpg"}'

# Upload to returned URL
curl -X PUT "<presigned-url>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test-label.jpg
```

2. **Trigger OCR Processing**

```bash
curl -X POST "https://staging.example.com/api/analyze-photo" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"<uploaded-url>","type":"food-label"}'
```

3. **Verify OCR Results**

The OCR endpoint should return:
- Extracted nutrition data
- Confidence scores
- Pre-filled food entry form

### Test Scenarios

| Test | Expected Result |
|------|-----------------|
| Upload valid food label | OCR extracts nutrition data |
| Upload blurry photo | Low confidence, manual entry suggested |
| Upload non-food image | Error: Unable to detect nutrition panel |
| Upload to another user's folder | 403 Forbidden |
| Access another user's photo | 403 Forbidden |

## Running Staging Tests

```bash
# Set environment
export TEST_MODE=false
export SUPABASE_URL=https://your-staging-project.supabase.co

# Run tests
npx playwright test tests/e2e/foods.spec.ts --project=chromium
```

## Security Checklist

- [ ] RLS enabled on all user-scoped tables
- [ ] Storage bucket policies configured
- [ ] Test users created
- [ ] User isolation verified
- [ ] Token revocation tested
- [ ] Deleted account behavior verified

## Troubleshooting

### RLS Policy Not Working

1. Check that RLS is enabled:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

2. Check policy exists:
```sql
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'food_logs';
```

### Storage Upload Fails

1. Check bucket exists:
```sql
SELECT * FROM storage.buckets WHERE name = 'food-labels';
```

2. Check policy:
```sql
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%food labels%';
```

### OCR Processing Slow

1. Check image size (should be < 5MB)
2. Check image format (JPEG, PNG supported)
3. Check API rate limits
