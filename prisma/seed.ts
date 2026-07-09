import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // ---- Usuario administrador ----
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nido.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@nido.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✔ Usuario admin listo: ${admin.email} (contraseña: admin123)`);

  // ---- Espacios de ejemplo ----
  const spaces = [
    {
      name: 'Sala Ceiba',
      description: 'Sala de reuniones con proyector y pizarra.',
      location: 'Piso 1, Ala Norte',
      capacity: 8,
      type: 'SALA',
    },
    {
      name: 'Sala Pinares',
      description: 'Sala pequeña ideal para llamadas o entrevistas.',
      location: 'Piso 2, Ala Sur',
      capacity: 4,
      type: 'SALA',
    },
    {
      name: 'Escritorio 12',
      description: 'Escritorio individual cerca de la ventana.',
      location: 'Piso 1, Zona Abierta',
      capacity: 1,
      type: 'ESCRITORIO',
    },
    {
      name: 'Escritorio 13',
      description: 'Escritorio individual con monitor externo.',
      location: 'Piso 1, Zona Abierta',
      capacity: 1,
      type: 'ESCRITORIO',
    },
    {
      name: 'Auditorio Principal',
      description: 'Espacio para presentaciones y eventos grandes.',
      location: 'Piso 3',
      capacity: 60,
      type: 'AUDITORIO',
    },
  ];

  for (const space of spaces) {
    const existing = await prisma.space.findFirst({ where: { name: space.name } });
    if (existing) {
      console.log(`↷ Ya existía: ${space.name}`);
      continue;
    }
    await prisma.space.create({ data: space });
    console.log(`✔ Espacio creado: ${space.name}`);
  }
}

main()
  .catch((err) => {
    console.error('Error corriendo el seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
