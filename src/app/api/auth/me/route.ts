import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/libs/auth';
import { getAllUsers } from '@/libs/db';

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const allUsers = getAllUsers();
  const contacts = allUsers.filter((u) => u.id !== session.id);

  return NextResponse.json({
    authenticated: true,
    user: session,
    contacts,
  });
}
