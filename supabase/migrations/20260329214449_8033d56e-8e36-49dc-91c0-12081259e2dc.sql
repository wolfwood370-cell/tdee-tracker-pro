-- Fix 1: Replace PERMISSIVE deny policies with RESTRICTIVE on user_roles
DROP POLICY IF EXISTS "Deny insert on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny delete on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny update on user_roles" ON public.user_roles;

CREATE POLICY "Restrict insert on user_roles"
ON public.user_roles AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Restrict delete on user_roles"
ON public.user_roles AS RESTRICTIVE
FOR DELETE TO authenticated
USING (false);

CREATE POLICY "Restrict update on user_roles"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (false);

-- Fix 2: Add INSERT policy for profiles
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);