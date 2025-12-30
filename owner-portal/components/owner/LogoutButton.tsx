"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/owner/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      className="text-xs text-neutral-400 hover:text-red-400"
    >
      Logout
    </button>
  );
}
