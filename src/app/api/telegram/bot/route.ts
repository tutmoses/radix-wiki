// src/app/api/telegram/bot/route.ts — Telegram bot webhook

import { prisma } from '@/lib/prisma/client';
import { json } from '@/lib/api';
import { sendMessage } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const update = await request.json();
    const message = update?.message;
    if (!message?.text || !message?.chat?.id) return json({ ok: true });

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Handle /start <token>
    if (text.startsWith('/start ')) {
      const token = text.slice(7).trim();
      if (!token) return json({ ok: true });

      const challenge = await prisma.challenge.findUnique({ where: { challenge: token } });
      if (!challenge || challenge.expiresAt < new Date()) {
        await sendMessage(chatId, 'This link has expired. Please generate a new one from the wiki.');
        if (challenge) await prisma.challenge.delete({ where: { id: challenge.id } }).catch(() => {});
        return json({ ok: true });
      }

      const parts = token.split('_');
      if (parts.length < 3 || parts[0] !== 'tg') {
        await sendMessage(chatId, 'Invalid link. Please try again from the wiki.');
        return json({ ok: true });
      }
      const userId = parts[1];

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } });
      if (!user) {
        await sendMessage(chatId, 'User not found. Please try again from the wiki.');
        return json({ ok: true });
      }

      // Check if user already has any TelegramLink — update chatId on all if so
      const existingLinks = await prisma.telegramLink.findMany({ where: { userId } });

      if (existingLinks.length > 0) {
        // Update chatId on all existing subscriptions
        await prisma.telegramLink.updateMany({
          where: { userId },
          data: { chatId, active: true },
        });
      } else {
        // First connection: create a connection-only record (no scope = no notifications yet)
        await prisma.telegramLink.create({
          data: { userId, chatId, events: [], tagPath: '', pageSlug: '' },
        });
      }

      await prisma.challenge.delete({ where: { id: challenge.id } }).catch(() => {});

      const name = user.displayName || 'there';
      await sendMessage(chatId, `✅ Connected! Hi ${name}, you can now subscribe to pages and sections on the wiki.\n\nSend /stop to pause all notifications.`);
      return json({ ok: true });
    }

    // Handle /start without token
    if (text === '/start') {
      await sendMessage(chatId, 'Welcome to RADIX Wiki notifications!\n\nTo connect, click the "Connect Telegram" button in your wiki profile settings. That will give you a link back here.');
      return json({ ok: true });
    }

    // Handle /stop
    if (text === '/stop') {
      const updated = await prisma.telegramLink.updateMany({
        where: { chatId },
        data: { active: false },
      });
      if (updated.count > 0) {
        await sendMessage(chatId, '🔕 All notifications paused. Re-subscribe from any wiki page to resume.');
      } else {
        await sendMessage(chatId, 'No active subscriptions found.');
      }
      return json({ ok: true });
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Telegram bot webhook error:', error);
    return json({ ok: true });
  }
}
