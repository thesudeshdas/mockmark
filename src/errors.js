export function cleanError(error) {
  if (
    error &&
    typeof error === "object" &&
    typeof error.data === "string" &&
    error.data.trim()
  )
    return error.data.trim();
  const message = error instanceof Error ? error.message : String(error);
  const matches = [...message.matchAll(/(?:Uncaught )?ConvexError:\s*([^\n]+)/g)];
  const convex = matches[matches.length - 1]?.[1];
  return (convex ?? message.split("\n")[0]).replace(
    /^Uncaught ConvexError:\s*/,
    "",
  );
}
