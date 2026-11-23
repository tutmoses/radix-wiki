-- Time on page: the seconds a view's page was in a visible tab, capped at an hour (wiki-formant 0.133.0).
ALTER TABLE "View" ADD COLUMN "seconds" INTEGER;
