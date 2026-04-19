-- 1) Tighten realtime topic policy on public.messages
DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON public.messages;

CREATE POLICY "Authenticated users can subscribe to own topics"
ON public.messages
FOR SELECT
TO authenticated
USING (
  -- Per-user counters
  realtime.topic() = ('unread-counter-' || auth.uid()::text)
  OR realtime.topic() = ('messages-list-' || auth.uid()::text)
  -- Chat channels: chat-<uidA>-<uidB> with sorted UIDs; the auth user must be a participant
  OR (
    realtime.topic() ~ ('^chat-[0-9a-f-]{36}-[0-9a-f-]{36}$')
    AND realtime.topic() LIKE ('%' || auth.uid()::text || '%')
  )
);

-- 2) Harden has_role: remove the unconditional self-check shortcut.
--    Always go through user_roles so the function cannot return true for a role
--    that doesn't actually exist in the table.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Non-coaches may only check their own roles (prevents role probing).
  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'coach'::public.app_role
  ) THEN
    RETURN false;
  END IF;

  -- Single source of truth: the user_roles table.
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;