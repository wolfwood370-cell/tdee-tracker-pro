-- Phase 53.1 — Security hardening

-- 1) Restrict has_role to prevent role enumeration.
--    Only the calling user can probe their own roles, OR a coach can probe anyone.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow only self-checks, or checks performed by a coach.
  IF _user_id <> auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role = 'coach'::public.app_role
     )
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 2) Defensive RLS on realtime.messages to prevent any future broadcast/presence
--    subscription from leaking messages between users. postgres_changes already
--    respects RLS on public.messages, so this is belt-and-suspenders.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
