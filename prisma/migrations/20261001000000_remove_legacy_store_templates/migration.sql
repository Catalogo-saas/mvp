UPDATE "Store"
SET "template" = 'roma',
    "theme" = jsonb_set(COALESCE("theme", '{}'::jsonb), '{useTemplateColors}', 'false'::jsonb, true)
WHERE "template" NOT IN ('roma', 'dana', 'vene');

ALTER TABLE "Store"
ALTER COLUMN "menuConfig" SET DEFAULT '{"header":[{"label":"Inicio","href":"/"},{"label":"Productos","href":"/productos"},{"label":"Contacto","href":"/contacto"}],"footer":[]}'::jsonb;
