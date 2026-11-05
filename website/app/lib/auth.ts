import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { prisma } from "@/app/lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role as string;
      }

      return token;
    },

    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as string;

      return session;
    },
  },
});
