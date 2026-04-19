
-- 1) Lock down profiles UPDATE: clients cannot change subscription_status / trial_ends_at.
-- Replace permissive client UPDATE policy with a column-protecting trigger.

-- Trigger that blocks non-coach updates to billing-sensitive fields.
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_coach boolean;
BEGIN
  -- Service role / no JWT → allow (used by stripe-webhook with service_role key).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'coach'::public.app_role
  ) INTO is_coach;

  IF is_coach THEN
    RETURN NEW;
  END IF;

  -- Block tampering on billing fields by non-coach users.
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Non autorizzato: subscription_status è gestito dal sistema di pagamento.';
  END IF;

  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Non autorizzato: trial_ends_at è gestito dal sistema.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_fields_trg ON public.profiles;
CREATE TRIGGER protect_subscription_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_subscription_fields();

-- 2) Harden has_role(): remove self-check, only coaches and SECURITY DEFINER callers can probe.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only coaches can query roles directly. Other callers get false.
  -- (Internal SECURITY DEFINER calls bypass auth.uid() checks because they run with elevated privileges anyway.)
  IF auth.uid() IS NULL THEN
    -- service-role / internal call
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  END IF;

  IF NOT EXISTS (
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
