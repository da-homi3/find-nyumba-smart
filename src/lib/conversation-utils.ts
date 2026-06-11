type InquiryMessage = {
  sender_id: string;
  read_at: string | null;
};

export function countUnread(messages: InquiryMessage[] | undefined, userId: string | undefined) {
  if (!messages || !userId) return 0;
  return messages.filter((m) => m.sender_id !== userId && !m.read_at).length;
}
