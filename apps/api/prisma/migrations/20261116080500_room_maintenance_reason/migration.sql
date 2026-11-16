-- Migration sans perte : ajout du motif de mise hors service / maintenance sur les chambres
ALTER TABLE "rooms" ADD COLUMN "maintenance_reason" TEXT;
