
-- Add CASCADE delete from profiles to auth.users
-- First, ensure profiles has a proper FK to auth.users
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure daily_metrics cascades on profile delete
ALTER TABLE public.daily_metrics
  DROP CONSTRAINT IF EXISTS daily_metrics_user_id_fkey,
  ADD CONSTRAINT daily_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure weekly_analytics cascades
ALTER TABLE public.weekly_analytics
  DROP CONSTRAINT IF EXISTS weekly_analytics_user_id_fkey,
  ADD CONSTRAINT weekly_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure biofeedback_logs cascades
ALTER TABLE public.biofeedback_logs
  DROP CONSTRAINT IF EXISTS biofeedback_logs_user_id_fkey,
  ADD CONSTRAINT biofeedback_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure user_roles cascades
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
  ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
