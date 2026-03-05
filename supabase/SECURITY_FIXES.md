# Supabase Security Fixes

## Applied Fixes (via migration)

### 1. Function Search Path - `handle_new_user` ✅ FIXED
**Issue**: Function had mutable search_path, vulnerable to search path attacks.

**Fix**: Added `SET search_path = public` to the function definition.

### 2. Function Search Path - `handle_updated_at` ✅ FIXED
**Issue**: Function had mutable search_path, vulnerable to search path attacks.

**Fix**: Added `SET search_path = public` to the function definition.

---

## Manual Fix Required (Supabase Dashboard)

### 3. Leaked Password Protection - Auth ⚠️ MANUAL ACTION REQUIRED

**Issue**: Supabase Auth does not check passwords against HaveIBeenPwned breach database.

**Fix**: Enable this setting in Supabase Dashboard:

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication → Policies**
3. Find: **"Enable password checking against leaked passwords"**
4. Toggle it **ON**
5. Click **Save**

**Benefits**:
- Prevents users from using passwords that have been exposed in known data breaches
- Checks against HaveIBeenPwned.org database
- Enhances account security significantly

---

## How to Apply the Migration

### Option 1: Supabase CLI
```bash
supabase db push
```

### Option 2: Supabase Dashboard SQL Editor
1. Go to: **SQL Editor** in your Supabase Dashboard
2. Copy the contents of `supabase/migrations/20240101000000_fix_function_search_path.sql`
3. Paste and run the SQL

### Option 3: Direct Database Connection
Run the migration file against your Supabase database using psql or your preferred PostgreSQL client.

---

## Verification

After applying the fixes, verify in Supabase Dashboard:

1. **Database → Functions** - Both functions should show `search_path = public`
2. **Authentication → Policies** - Leaked password protection should be enabled

---

## Security Impact

| Issue | Severity | Status |
|-------|----------|--------|
| Mutable search_path on functions | Medium | ✅ Fixed via migration |
| Leaked password protection disabled | Medium | ⚠️ Requires manual action |
