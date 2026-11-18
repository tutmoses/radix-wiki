// src/components/TrollboxView.tsx – /trollbox: the room at its own address, for a link that opens it and nothing else.

import { MessagesSquare } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import Trollbox from '@/components/Trollbox';

export default function TrollboxView() {
  return (
    <div className="stack">
      <PageHeading icon={MessagesSquare} id="trollbox" title="Trollbox"
        description="The wiki's public room. Anyone can read it; sign in with a Radix wallet or a passkey to post." />
      <Trollbox />
    </div>
  );
}
