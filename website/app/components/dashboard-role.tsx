import { auth } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";

export default async function DashboardContent() {
  const session = await auth();

  // Authentication
  if (!session?.user) {
    redirect("/");
  }

  // // Authorization
  // if (session.user.role !== "ADMIN") {
  //   redirect("/user/dashboard");
  // }

  return (
    <Dashboard
      user={{
        name: session.user.name ?? "",
        role: session.user.role,
        email: session.user.email ?? "",
      }}
    />
  );
}
