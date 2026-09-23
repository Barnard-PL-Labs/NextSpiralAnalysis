// Server-only. Do NOT import this from a Client Component: the whole point is
// that the superuser list never reaches the browser bundle.
//
// Reads SUPERUSER_EMAILS (server-only). The NEXT_PUBLIC_* names are kept as a
// fallback so the app keeps working until that variable is retired in Vercel;
// they are safe to read here because this module is only ever imported by
// server code, so Next never inlines them into client output.
const parseList = (raw) =>
  (raw || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export function superuserEmails() {
  return parseList(
    process.env.SUPERUSER_EMAILS ||
      process.env.NEXT_PUBLIC_SUPERUSER_EMAILS ||
      process.env.NEXT_PUBLIC_SUPERUSER_EMAIL ||
      ""
  );
}

export function isSuperuserEmail(email) {
  if (!email) return false;
  return superuserEmails().includes(email.toLowerCase());
}
