import { NextResponse } from 'next/server';
import { getSessionFromRequest, hashPassword, verifyPassword } from '@/libs/auth';
import { getUserById, updateUserPassword } from '@/libs/db';
import { changePasswordSchema } from '@/validations/auth';

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mot de passe invalide' }, { status: 400 });
  }

  const user = getUserById(session.id);
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password_hash))) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  updateUserPassword(user.id, passwordHash);

  return NextResponse.json({ success: true });
}