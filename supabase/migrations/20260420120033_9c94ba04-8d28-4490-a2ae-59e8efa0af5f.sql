DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('unread-counter-' || auth.uid()::text)
  OR realtime.topic() = ('messages-list-' || auth.uid()::text)
  OR (
    realtime.topic() ~ '^chat-[0-9a-f-]{36}-[0-9a-f-]{36}$'
    AND (
      (
        split_part(realtime.topic(), '-', 2) || '-' ||
        split_part(realtime.topic(), '-', 3) || '-' ||
        split_part(realtime.topic(), '-', 4) || '-' ||
        split_part(realtime.topic(), '-', 5) || '-' ||
        split_part(realtime.topic(), '-', 6)
      ) = auth.uid()::text
      OR
      (
        split_part(realtime.topic(), '-', 7) || '-' ||
        split_part(realtime.topic(), '-', 8) || '-' ||
        split_part(realtime.topic(), '-', 9) || '-' ||
        split_part(realtime.topic(), '-', 10) || '-' ||
        split_part(realtime.topic(), '-', 11)
      ) = auth.uid()::text
    )
  )
);