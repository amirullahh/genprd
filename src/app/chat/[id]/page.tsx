import { ChatApp } from "@/components/chat-app";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatApp key={id} threadId={id} />;
}
