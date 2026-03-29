
-- Deny all INSERT on user_roles (only the handle_new_user trigger should insert)
CREATE POLICY "Deny insert on user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Deny all DELETE on user_roles
CREATE POLICY "Deny delete on user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- Deny all UPDATE on user_roles
CREATE POLICY "Deny update on user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);
