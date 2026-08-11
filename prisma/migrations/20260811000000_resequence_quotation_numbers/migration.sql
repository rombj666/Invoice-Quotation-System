DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Quotation" WHERE "quotationNo" = 'Q00002')
     AND EXISTS (SELECT 1 FROM "Quotation" WHERE "quotationNo" = 'Q00030') THEN
    RAISE EXCEPTION 'Quotation number conflict: Q00030 already exists; Q00002 was not changed.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Quotation" WHERE "quotationNo" = 'Q00003')
     AND EXISTS (SELECT 1 FROM "Quotation" WHERE "quotationNo" = 'Q00031') THEN
    RAISE EXCEPTION 'Quotation number conflict: Q00031 already exists; Q00003 was not changed.';
  END IF;
END $$;

UPDATE "Quotation"
SET "quotationNo" = CASE "quotationNo"
  WHEN 'Q00002' THEN 'Q00030'
  WHEN 'Q00003' THEN 'Q00031'
END
WHERE "quotationNo" IN ('Q00002', 'Q00003');

-- Keep copied quotation references in sync while preserving old Cloudinary URLs/public IDs.
UPDATE "Quotation"
SET "metadata" = jsonb_set("metadata", '{quotationNo}', to_jsonb("quotationNo"), true)
WHERE "quotationNo" IN ('Q00030', 'Q00031')
  AND jsonb_typeof("metadata") = 'object'
  AND "metadata"->>'quotationNo' IS DISTINCT FROM "quotationNo";
