"use client";

import { SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { user, isLoaded } = useUser();
  const router = useRouter();


  useEffect(() => {
    if (isLoaded && user?.primaryEmailAddress?.emailAddress === "talentsphere06@gmail.com") {
      router.push("/admin/dashboard");
    }
  }, [isLoaded, user, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === "talentsphere06@gmail.com" && password === "admin") {
      localStorage.setItem("isLoggedIn", "true");
      router.push("/admin/dashboard");
      router.refresh();
    } else {
      alert("Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-xl w-full border border-slate-200 shadow-slate-500 shadow-2xl bg-white px-16 py-6 space-y-5">
        <form onSubmit={handleLogin} className="space-y-5">
          <h1 className="text-3xl font-bold text-center">Admin Login</h1>
          <div className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-2 border rounded border-black"
            />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-2 border rounded border-black"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-8 py-2 w-full rounded-md transition hover:bg-blue-700"
          >
            Login
          </button>
        </form>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="bg-green-600 text-white w-full px-8 py-2 rounded-md transition hover:bg-green-700">
              Login with Clerk
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );
};

export default AdminLogin;