import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ChatInterface from "@/components/ChatInterface";

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <ChatInterface userName={session.name} />;
}
