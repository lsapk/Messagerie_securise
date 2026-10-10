import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/libs/auth';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 Mo

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 15 Mo)' }, { status: 400 });
    }

    const extension = ALLOWED_MIME_TYPES[file.type.toLowerCase()];
    if (!extension) {
      return NextResponse.json(
        { error: 'Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WEBP, GIF, HEIC' },
        { status: 400 }
      );
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Génération d'un nom de fichier sécurisé non devinable (UUID)
    const uniqueName = `${crypto.randomUUID()}${extension}`;
    const targetFilePath = path.join(uploadDir, uniqueName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(targetFilePath, buffer);

    const mediaPath = `/api/uploads/${uniqueName}`;

    return NextResponse.json({
      success: true,
      mediaPath,
      filename: uniqueName,
      size: file.size,
    });
  } catch (error) {
    console.error('Erreur API Upload:', error);
    return NextResponse.json({ error: 'Échec de l’enregistrement du fichier' }, { status: 500 });
  }
}
