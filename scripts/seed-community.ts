// Uso:
//   node --no-warnings --loader ts-node/esm scripts/seed-community.ts
//
// Puebla la parte comunitaria: campanas publicadas, jornadas de voluntariado
// abiertas y el material recolectado en una de ellas. Es idempotente: las
// campanas se buscan por slug y las jornadas por titulo, y las recolecciones
// solo se crean si la jornada todavia no tiene ninguna.
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity.js';
import { Product } from '../src/products/entities/product.entity.js';
import { ProductCategory } from '../src/products/entities/product-category.entity.js';
import { ProductImage } from '../src/products/entities/product-image.entity.js';
import { Entrepreneur } from '../src/entrepreneurs/entities/entrepreneur.entity.js';
import { Campaign, CampaignStatus } from '../src/campaigns/entities/campaign.entity.js';
import {
  CollectionUnit,
  MaterialCollection,
  MaterialType,
  VolunteerActivity,
  VolunteerSignup,
  VolunteerStatus,
} from '../src/volunteer/entities/volunteer.entity.js';
import { postgresSslOptions } from '../src/database/postgres-ssl.js';

// Fotos reales (Wikimedia Commons). Las portadas se piden a 1200px.
const WM = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;

const IMG = {
  rioGrupo: WM('September 15, 2012 Volunteers at Anacostia River cleanup in Washington, D.C. (8165233850).jpg'),
  rioCancha: WM('River cleanup (53625668820).jpg'),
  arbolesCampo: WM('Community tree planting scheme - geograph.org.uk - 5141416.jpg'),
  siembraAerea: WM('Hands planting hope.jpg'),
  tallerPlastico: WM('Plastic recycling workshop, Lodz Design Festival.jpg'),
  tallerTextil: WM('Adana Textile recycling workshop 2014 4566.jpg'),
  huerta: WM('Parkdale Community garden volunteer day.JPG'),
};

const DAY = 24 * 60 * 60 * 1000;

/** Fechas relativas para que las jornadas sigan siendo futuras al resembrar. */
function inDays(days: number, hour = 8): Date {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

interface SeedCampaign {
  title: string;
  slug: string;
  summary: string;
  description: string;
  imageUrl: string;
  goalCents: number;
  startsInDays: number;
  endsInDays: number;
}

const CAMPAIGNS: SeedCampaign[] = [
  {
    title: 'Río Vivo: recuperemos la ribera',
    slug: 'rio-vivo-recuperemos-la-ribera',
    summary: 'Limpieza y reforestación de la ribera con las comunidades del río.',
    description:
      'Tres meses de trabajo con las comunidades que viven junto al río: retiramos residuos de la ribera, sembramos especies nativas y dejamos el sendero señalizado para que cualquiera pueda recorrerlo. Cada aporte se destina a herramientas, guantes y al vivero comunitario.',
    imageUrl: IMG.rioGrupo,
    goalCents: 800000000,
    startsInDays: -18,
    endsInDays: 62,
  },
  {
    title: 'Mil árboles para la cordillera',
    slug: 'mil-arboles-para-la-cordillera',
    summary: 'Viveros comunitarios para sembrar mil árboles nativos este año.',
    description:
      'Los viveros de la cordillera ya tienen la tierra preparada: falta llevar los mil árboles nativos a las laderas que perdieron cobertura. La campaña cubre el material del vivero, el transporte y el acompañamiento técnico de las siembras.',
    imageUrl: IMG.arbolesCampo,
    goalCents: 1200000000,
    startsInDays: -6,
    endsInDays: 120,
  },
  {
    title: 'Taller abierto de plástico reciclado',
    slug: 'taller-abierto-de-plastico-reciclado',
    summary: 'Máquinas y formación para transformar plástico recuperado en objetos útiles.',
    description:
      'Queremos que el taller deje de depender de préstamos: con esta campaña compramos la trituradora y la inyectora, y abrimos cupos de formación para que más personas del barrio aprendan a transformar el plástico que hoy se entierra.',
    imageUrl: IMG.tallerPlastico,
    goalCents: 500000000,
    startsInDays: -32,
    endsInDays: 45,
  },
];

interface SeedActivity {
  title: string;
  description: string;
  location: string;
  imageUrl: string;
  startsInDays: number;
  hours: number;
  slots: number;
}

const ACTIVITIES: SeedActivity[] = [
  {
    title: 'Limpieza de la ribera del río',
    description:
      'Salimos a retirar residuos del tramo bajo del río. Lleva ropa que se pueda mojar, guantes propios si tienes y una botella reutilizable; nosotros ponemos bolsas, pinzas y refrigerio. Nos encontramos en la entrada del sendero.',
    location: 'Sendero de la ribera, entrada norte',
    imageUrl: IMG.rioCancha,
    startsInDays: 5,
    hours: 4,
    slots: 25,
  },
  {
    title: 'Siembra de árboles nativos',
    description:
      'Jornada de siembra con el vivero comunitario: abrimos huecos, plantamos y dejamos el riego armado. Ideal para familias; hay tareas para todas las edades y te explicamos la técnica antes de empezar.',
    location: 'Vivero comunitario, vereda La Loma',
    imageUrl: IMG.siembraAerea,
    startsInDays: 12,
    hours: 5,
    slots: 30,
  },
  {
    title: 'Taller de retazos y costura',
    description:
      'Taller de dos horas para convertir retazos de tela en bolsas y neceseres. Trae tu máquina si tienes; prestamos cinco máquinas y todo el material de costura. Salimos con una pieza terminada cada participante.',
    location: 'Casa de la comunidad, salón 2',
    imageUrl: IMG.tallerTextil,
    startsInDays: 19,
    hours: 3,
    slots: 12,
  },
  {
    title: 'Huerta comunitaria: cosecha y compost',
    description:
      'Cerramos el ciclo de la huerta: cosechamos lo sembrado, preparamos las camas para la próxima siembra y montamos las pilas de compost con los residuos de la jornada. Terminamos compartiendo un almuerzo comunitario.',
    location: 'Huerta comunitaria del barrio',
    imageUrl: IMG.huerta,
    startsInDays: 26,
    hours: 4,
    slots: 20,
  },
];

interface SeedCollection {
  material: MaterialType;
  quantity: number;
  unit: CollectionUnit;
  notes: string;
}

// Material recolectado en la primera jornada (se muestra en su ficha publica).
const COLLECTIONS: SeedCollection[] = [
  { material: MaterialType.PET, quantity: 45500, unit: CollectionUnit.KG, notes: 'Botellas lavadas y prensadas.' },
  { material: MaterialType.VIDRIO, quantity: 12400, unit: CollectionUnit.KG, notes: 'Frascos enteros, sin trizas.' },
  { material: MaterialType.ALUMINIO, quantity: 3100, unit: CollectionUnit.KG, notes: 'Latas compactadas.' },
  { material: MaterialType.PLASTICO_RIGIDO, quantity: 480, unit: CollectionUnit.UNIDAD, notes: 'Tapas y envases de limpieza.' },
];

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? 'reseed',
    password: process.env.POSTGRES_PASSWORD ?? 'reseed',
    database: process.env.POSTGRES_DB ?? 'reseed',
    ...postgresSslOptions(),
    // Las relaciones (creador, producto de materia prima) exigen registrar
    // tambien las entidades a las que apuntan.
    entities: [
      User,
      Entrepreneur,
      Product,
      ProductCategory,
      ProductImage,
      Campaign,
      VolunteerActivity,
      VolunteerSignup,
      MaterialCollection,
    ],
    synchronize: false,
  });
  await ds.initialize();

  const campaigns = ds.getRepository(Campaign);
  const activities = ds.getRepository(VolunteerActivity);
  const collections = ds.getRepository(MaterialCollection);

  let createdCampaigns = 0;
  let updatedCampaigns = 0;
  for (const seed of CAMPAIGNS) {
    const patch = {
      title: seed.title,
      summary: seed.summary,
      description: seed.description,
      imageUrl: seed.imageUrl,
      goalCents: String(seed.goalCents),
      status: CampaignStatus.ACTIVE,
      startsAt: inDays(seed.startsInDays, 9),
      endsAt: inDays(seed.endsInDays, 20),
    };

    const found = await campaigns.findOne({ where: { slug: seed.slug } });
    if (!found) {
      await campaigns.save(campaigns.create({ ...patch, slug: seed.slug }));
      createdCampaigns += 1;
      console.log(`+ campana ${seed.title}`);
      continue;
    }

    found.title = patch.title;
    found.summary = patch.summary;
    found.description = patch.description;
    found.imageUrl = patch.imageUrl;
    found.goalCents = patch.goalCents;
    found.status = patch.status;
    found.startsAt = patch.startsAt;
    found.endsAt = patch.endsAt;
    await campaigns.save(found);
    updatedCampaigns += 1;
  }

  let createdActivities = 0;
  let createdCollections = 0;
  for (const seed of ACTIVITIES) {
    const startsAt = inDays(seed.startsInDays, 8);
    const endsAt = new Date(startsAt.getTime() + seed.hours * 60 * 60 * 1000);

    const activity = await activities.findOne({ where: { title: seed.title } });
    if (!activity) {
      const created = await activities.save(
        activities.create({
          title: seed.title,
          description: seed.description,
          location: seed.location,
          imageUrl: seed.imageUrl,
          startsAt,
          endsAt,
          slots: seed.slots,
          status: VolunteerStatus.OPEN,
        }),
      );
      createdActivities += 1;
      console.log(`+ jornada ${seed.title}`);

      // Las recolecciones se enganchan a la primera jornada y solo si aun no
      // tiene ninguna: volver a correr el script no duplica el material.
      if (seed === ACTIVITIES[0]) {
        const existing = await collections.count({ where: { activityId: created.id } });
        if (existing === 0) {
          const rows = COLLECTIONS.map((c) =>
            collections.create({
              activityId: created.id,
              material: c.material,
              quantity: c.quantity,
              unit: c.unit,
              collectedAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
              notes: c.notes,
            }),
          );
          await collections.save(rows);
          createdCollections += rows.length;
          console.log(`+ ${rows.length} recolecciones para ${seed.title}`);
        }
      }
      continue;
    }

    activity.description = seed.description;
    activity.location = seed.location;
    activity.imageUrl = seed.imageUrl;
    activity.startsAt = startsAt;
    activity.endsAt = endsAt;
    activity.slots = seed.slots;
    activity.status = VolunteerStatus.OPEN;
    await activities.save(activity);
  }

  const totalCampaigns = await campaigns.count({ where: { status: CampaignStatus.ACTIVE } });
  const totalActivities = await activities.count({ where: { status: VolunteerStatus.OPEN } });
  const totalCollections = await collections.count();

  console.log('\nListo.');
  console.log(`  campanas nuevas:        ${createdCampaigns}`);
  console.log(`  campanas actualizadas:  ${updatedCampaigns}`);
  console.log(`  jornadas nuevas:        ${createdActivities}`);
  console.log(`  recolecciones nuevas:   ${createdCollections}`);
  console.log(`  campanas activas:       ${totalCampaigns}`);
  console.log(`  jornadas abiertas:      ${totalActivities}`);
  console.log(`  recolecciones totales:  ${totalCollections}`);

  await ds.destroy();
}

void main().catch((err) => {
  console.error('Error:', err?.message ?? err);
  process.exit(1);
});
