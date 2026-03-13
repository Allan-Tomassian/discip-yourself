function normalizedMessage(error) {
  return String(error?.message || "").trim().toLowerCase();
}

function normalizedCode(error) {
  return String(error?.code || "").trim().toUpperCase();
}

export function isSupabaseSchemaError(error) {
  const code = normalizedCode(error);
  const message = normalizedMessage(error);
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

export function buildSchemaErrorReply(requestId, error = "BACKEND_SCHEMA_MISSING") {
  return {
    error,
    message: "Required Supabase tables are missing. Apply migrations before enabling AI.",
    requestId,
  };
}
