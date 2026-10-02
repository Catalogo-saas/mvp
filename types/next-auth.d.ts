import "next-auth";

declare module "next-auth" {
  interface User {
    role: "SUPER_ADMIN" | "MERCHANT";
    authVersion: number;
  }

  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "MERCHANT";
      authVersion: number;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "SUPER_ADMIN" | "MERCHANT";
    authVersion?: number;
  }
}
