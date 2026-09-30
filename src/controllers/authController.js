import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SECRET_KEY = process.env.JWT_SECRET || 'secret123';

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });

  try {
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Email tidak ditemukan.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.encrypted_password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Password salah.' });
    }

    const latestReport = await prisma.client_reports.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      select: {
        station_id: true,
        module_app_id: true,
      },
    });
    
    const moduleAppUser = await prisma.module_app_users.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });

    let category = null;

    if (moduleAppUser?.module_app_id) {
      const moduleApp = await prisma.module_apps.findUnique({
        where: { id: moduleAppUser.module_app_id },
        select: { category: true },
      });
      category = moduleApp?.category || null;
    }

    const tokenPayload = {
      id: user.id.toString(),
      email: user.email,
      station_id: latestReport?.station_id?.toString() || user.station_id?.toString() || null,
      module_app_id: latestReport?.module_app_id?.toString() || user.module_app_id?.toString() || null,
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '1h' });

    res.json({
      token,
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        role_id: user.role_id?.toString(),
        station_id: latestReport?.station_id?.toString() || null,
        module_app_id: latestReport?.module_app_id?.toString() || null,
        category,
      },
    });

  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}
