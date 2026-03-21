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

      // Token format: tg_<userId>_<random>
      const challenge = await prisma.challenge.findUnique({ where: { challenge: token } });
      if (!challenge || challenge.expiresAt < new Date()) {
        await sendMessage(chatId, 'This link has expired. Please generate a new one from the wiki.');
        if (challenge) await prisma.challenge.delete({ where: { id: challenge.id } }).catch(() => {});
        return json({ ok: true });
      }

      // Extract userId from token
      const parts = token.split('_');
      if (parts.length < 3 || parts[0] !== 'tg') {
        await sendMessage(chatId, 'Invalid link. Please try again from the wiki.');
        return json({ ok: true });
      }
      const userId = parts[1];

      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } });
      if (!user) {
        await sendMessage(chatId, 'User not found. Please try again from the wiki.');
        return json({ ok: true });
      }

      // Upsert TelegramLink
      await prisma.telegramLink.upsert({
        where: { userId },
        create: { userId, chatId, events: ['page.created', 'page.updated'] },
        update: { chatId, active: true },
      });

      // Clean up the challenge
      await prisma.challenge.delete({ where: { id: challenge.id } }).catch(() => {});

      const name = user.displayName || 'there';
      await sendMessage(chatId, `✅ Connected! Hi ${name}, you'll now receive wiki notifications here.\n\nSend /stop to unsubscribe.`);
      return json({ ok: true });
    }

    // Handle /start without token
    if (text === '/start') {
      await sendMessage(chatId, 'Welcome to RADIX Wiki notifications!\n\nTo connect, click the "Connect Telegram" button in your wiki profile settings. That will give you a link back here.');
      return json({ ok: true });
    }

    // Handle /stop
    if (text === '/stop') {
      const link = await prisma.telegramLink.findFirst({ where: { chatId } });
      if (link) {
        await prisma.telegramLink.update({ where: { id: link.id }, data: { active: false } });
        await sendMessage(chatId, '🔕 Notifications disabled. You can re-enable from the wiki.');
      } else {
        await sendMessage(chatId, 'No active subscription found.');
      }
      return json({ ok: true });
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Telegram bot webhook error:', error);
    return json({ ok: true });
  }
}
