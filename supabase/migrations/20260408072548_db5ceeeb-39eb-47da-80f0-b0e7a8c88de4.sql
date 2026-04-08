
ALTER TABLE public.daily_metrics
  ADD COLUMN smm numeric NULL,
  ADD COLUMN bfm numeric NULL,
  ADD COLUMN pbf numeric NULL,
  ADD COLUMN vfa numeric NULL,
  ADD COLUMN bmr_inbody integer NULL;
