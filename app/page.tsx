"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionsStore } from "../store/sessionsStore";

/**
 * Home page at /. Redirects to the chat view for the selected (or first) session
 * so all chat/mind-map usage goes through /chat/[id].
 */
export default function HomePage() {
  const router = useRouter();
  const selectedId = useSessionsStore((s) => s.selectedId);
  const sessions = useSessionsStore((s) => s.sessions);

  useEffect(() => {
    const id = selectedId ?? sessions[0]?.id;
    if (id) router.replace(`/chat/${id}`);
  }, [router, selectedId, sessions]);

  return null;
}
