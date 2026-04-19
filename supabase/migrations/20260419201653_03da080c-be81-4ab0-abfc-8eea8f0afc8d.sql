-- 1) Harden has_role: remove the dangerous NULL-auth bypass.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No session => no privilege. Internal callers needing role checks
  -- must pass through SECURITY DEFINER wrappers that explicitly query user_roles.
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Only coaches can probe other users' roles. Self-checks always allowed.
  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'coach'::public.app_role
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 2) Defense-in-depth: rebuild profiles self-update policy with WITH CHECK
-- that forbids changing billing fields. Trigger remains as a second line of defense.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.profiles'::regclass
      AND polcmd = 'w' -- UPDATE
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.polname);
  END LOOP;
END$$;

-- Coaches: full update access
CREATE POLICY "Coaches can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'coach'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

-- Users: can update own profile, but cannot change billing fields.
CREATE POLICY "Users can update own profile (no billing fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND subscription_status = (SELECT subscription_status FROM public.profiles WHERE id = auth.uid())
  AND trial_ends_at = (SELECT trial_ends_at FROM public.profiles WHERE id = auth.uid())
);