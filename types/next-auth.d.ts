import "next-auth";

declare module "next-auth" {
  interface User {
    role: "SUPER_ADMIN" | "MERCHANT";
  }

  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "MERCHANT";
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
  }
}
