export const authUseSecureCookies =
  process.env.NEXTAUTH_URL?.startsWith("https://") ?? Boolean(process.env.VERCEL);
