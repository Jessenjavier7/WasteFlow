"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Recycle, Leaf, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await signIn("google", {
        callbackUrl: "/dashboard/",
      });
    } catch {
      setError("Unable to sign in with Google. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#edf5d9] via-[#dcf7e9] to-[#cef3e5] p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1400px] overflow-hidden rounded-[30px] bg-white shadow-2xl shadow-emerald-900/5 lg:grid-cols-2">
        {/* LEFT SIDE */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#eff8e9] p-12 lg:flex xl:p-16">
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
              <Recycle size={24} />
            </div>

            <span className="text-xl font-extrabold tracking-tight">
              WASTE<span className="text-emerald-600">FLOW</span>
            </span>
          </div>

          <div className="relative z-10 max-w-lg">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-emerald-700">
              <Leaf size={14} />
              SMART WASTE MANAGEMENT
            </span>

            <h1 className="text-5xl font-extrabold leading-[1.15] tracking-tight text-gray-950 xl:text-6xl">
              Make Our
              <br />
              Environment
              <br />
              <span className="text-emerald-600">Cleaner.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-gray-500">
              A smarter way to report, monitor, and manage waste. Together, we
              can create a cleaner and more sustainable environment for
              everyone.
            </p>

            <div className="mt-10 flex items-center gap-5">
              <div className="flex -space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#eff8e9] bg-emerald-200">
                  <Leaf size={17} className="text-emerald-700" />
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#eff8e9] bg-amber-200">
                  <Recycle size={17} className="text-amber-700" />
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#eff8e9] bg-lime-200">
                  <ShieldCheck size={17} className="text-lime-700" />
                </div>
              </div>

              <p className="text-xs font-medium text-gray-500">
                Building a cleaner future together
              </p>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -bottom-24 -right-20 h-96 w-96 rounded-full border-[45px] border-emerald-200/40" />
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full border-[25px] border-lime-200/50" />

          <p className="relative z-10 text-xs text-gray-400">
            © 2026 WasteFlow. All rights reserved.
          </p>
        </section>

        {/* RIGHT SIDE */}
        <section className="flex items-center justify-center px-6 py-12 md:px-12 lg:px-16">
          <div className="w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="mb-14 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                <Recycle size={22} />
              </div>

              <span className="text-lg font-extrabold tracking-tight">
                WASTE<span className="text-emerald-600">FLOW</span>
              </span>
            </div>

            {/* Login Heading */}
            <div className="mb-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck size={28} />
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight text-gray-950">
                Welcome Back!
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-400">
                Sign in to your account and start making a difference in your
                environment.
              </p>
            </div>

            {/* Google Login */}
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-5 w-5"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5h6.5c3.8-3.5 6.1-8.6 6.1-14.7Z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.5-5c-1.8 1.2-4 2-6.7 2-5.2 0-9.6-3.5-11.2-8.2H6.1v5.1C9.4 39.6 16.2 44 24 44Z"
                    />
                    <path
                      fill="#1976D2"
                      d="M12.8 28c-.4-1.2-.7-2.6-.7-4s.3-2.8.7-4v-5.1H6.1C4.7 17.7 4 20.8 4 24s.7 6.3 2.1 9.1l6.7-5.1Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M24 11.8c2.9 0 5.5 1 7.5 3l5.7-5.7C33.8 5.9 29.4 4 24 4 16.2 4 9.4 8.4 6.1 14.9l6.7 5.1c1.6-4.7 6-8.2 11.2-8.2Z"
                    />
                  </svg>
                )}

                {loading ? "Connecting to Google..." : "Sign In with Google"}

                {!loading && <ArrowRight size={17} className="ml-auto" />}
              </button>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            {/* Footer Information */}
            <p className="mt-8 text-center text-xs leading-6 text-gray-400">
              By continuing, you agree to use WasteFlow in accordance with our
              platform policies.
            </p>

            <p className="mt-12 text-center text-xs text-gray-400">
              © 2026 WasteFlow · Smart Waste Management System
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
