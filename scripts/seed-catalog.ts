// Uso:
//   pnpm exec tsx scripts/seed-catalog.ts
//
// Puebla el catalogo publico con categorias, socios (emprendimientos aprobados)
// y productos publicados con imagenes. Es idempotente: los productos se buscan
// por nombre + emprendimiento y no se duplican al volver a correrlo.
import { config } from 'dotenv';
config();

import { DataSource, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import {
  Entrepreneur,
  EntrepreneurStatus,
} from '../src/entrepreneurs/entities/entrepreneur.entity.js';
import { Product, ProductStatus } from '../src/products/entities/product.entity.js';
import { ProductCategory } from '../src/products/entities/product-category.entity.js';
import { ProductImage } from '../src/products/entities/product-image.entity.js';
import { postgresSslOptions } from '../src/database/postgres-ssl.js';

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'IzecoDemo123';

// Imagenes reales (Wikimedia Commons + StockSnap), servidas a 900px de ancho.
const IMG = {
  miel: 'https://commons.wikimedia.org/wiki/Special:FilePath/Jars_of_Honey_on_Display_at_the_Fair_(42128624510).jpg?width=900',
  cera: 'https://commons.wikimedia.org/wiki/Special:FilePath/Beeswax_wrap_covering_bowl.jpg?width=900',
  polen: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bee_Pollen_IMG_8873.jpg?width=900',
  jabon: 'https://commons.wikimedia.org/wiki/Special:FilePath/Nature_Bar_handmade_soap_bar.jpg?width=900',
  balsamo: 'https://commons.wikimedia.org/wiki/Special:FilePath/EOS_lip_balm_8.jpg?width=900',
  cosmeticos: 'https://cdn.stocksnap.io/img-thumbs/960w/QYF5HNIQ7Z.jpg',
  cesta: 'https://commons.wikimedia.org/wiki/Special:FilePath/Wicker_basket_-_Slovakia_(2).jpg?width=900',
  mermelada: 'https://commons.wikimedia.org/wiki/Special:FilePath/Strawberry_jam_on_a_dish.JPG?width=900',
  cafe: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coffee_beans_-_ziarna_kawy.jpg?width=900',
  chocolate: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dark_chocolate_bar.jpg?width=900',
  vela: 'https://commons.wikimedia.org/wiki/Special:FilePath/7candles.JPG?width=900',
  tote: 'https://commons.wikimedia.org/wiki/Special:FilePath/Canvas_tote_bag_from_Books_%26_Books%2C_Miami%2C_Florida%2C_USA_-_20130912.jpg?width=900',
};

// Logos de los socios: fotos reales de Wikimedia Commons servidas a 400px.
const COMMONS = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`;

const LOGO = {
  colmena: COMMONS('Fresh honeycomb dripping honey India.jpg'),
  raiz: COMMONS('Handmade soap.jpg'),
  manos: COMMONS('Stack of 6 woven baskets.jpg'),
  cafe: COMMONS('Roasted coffee beans.jpg'),
  artesania: COMMONS('Pottery artisan.jpg'),
};

// Socios que ya existian en la base con un logo de relleno: se corrigen por slug
// para no dejar imagenes rotas en el directorio.
const EXTRA_LOGOS: Record<string, string> = {
  'taller-manos-del-rio': LOGO.artesania,
};

// Objetos hechos con material recuperado (botellas, tela, palets, latas).
const WM = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=900`;

const REUSE = {
  lampara: WM('Melkflessenlamp.jpg'),
  manta: WM('Green patchwork quilt sewn by hand.jpg'),
  mochila: WM('005Aa. Lightweight fabric backpack (2).jpg'),
  mueblePalets: WM('2019-12-24 11-14-44 meuble-palettes.jpg'),
  neceser: WM('002Аа. Japanese patchwork candy bag.jpg'),
  terrario: WM('Bottle garden.jpg'),
  mosqueton: WM('Precious Plastic carabiner.jpg'),
  hornillo: WM('Homemade alcohol stove.jpg'),
  peluche: WM('002g. Soft toy.jpg'),
};

const CATEGORIES = [
  { name: 'Alimentos', slug: 'alimentos' },
  { name: 'Cuidado personal', slug: 'cuidado-personal' },
  { name: 'Hogar', slug: 'hogar' },
  { name: 'Artesanía', slug: 'artesania' },
];

interface SeedProduct {
  name: string;
  description: string;
  priceCents: number;
  stock: number | null;
  images: string[];
}

interface SeedEntrepreneur {
  name: string;
  slug: string;
  description: string;
  category: string;
  /** Logo del socio (foto real, cuadrada al recortarse en la tarjeta). */
  logo: string;
  /** Solo se usa si el emprendimiento hay que crearlo desde cero. */
  owner?: { name: string; email: string };
  products: SeedProduct[];
}

const ENTREPRENEURS: SeedEntrepreneur[] = [
  {
    name: 'Colmena Viva',
    slug: 'colmena-viva',
    description: 'Apicultura regenerativa y alimentos de la montaña.',
    category: 'Alimentos',
    logo: LOGO.colmena,
    owner: { name: 'Lucía Moreno', email: 'colmena.viva@izeco.test' },
    products: [
      {
        name: 'Miel de montaña',
        description:
          'Miel cruda de flores de montaña, cosechada sin pasteurizar por apicultores de Cundinamarca.',
        priceCents: 2800000,
        stock: 40,
        images: [IMG.miel],
      },
      {
        name: 'Polen de abeja',
        description: 'Polen multicolor deshidratado a baja temperatura, cosechado al amanecer.',
        priceCents: 3200000,
        stock: 25,
        images: [IMG.polen],
      },
      {
        name: 'Cera de abejas natural',
        description: 'Láminas de cera de abejas pura para conservar alimentos sin plástico.',
        priceCents: 1800000,
        stock: 60,
        images: [IMG.cera],
      },
    ],
  },
  {
    name: 'Raíz Serena',
    slug: 'raiz-serena',
    description: 'Cosmética natural hecha a mano con plantas de la región.',
    category: 'Cuidado personal',
    logo: LOGO.raiz,
    owner: { name: 'Camila Torres', email: 'raiz.serena@izeco.test' },
    products: [
      {
        name: 'Kit de baño natural',
        description:
          'Jabón, exfoliante y aceite corporal elaborados con ingredientes vegetales y envases reutilizables.',
        priceCents: 4650000,
        stock: 18,
        images: [IMG.cosmeticos],
      },
      {
        name: 'Jabón de caléndula',
        description: 'Jabón artesanal con caléndula y aceite de oliva, ideal para piel sensible.',
        priceCents: 1200000,
        stock: 80,
        images: [IMG.jabon],
      },
      {
        name: 'Bálsamo labial',
        description: 'Bálsamo reparador de manteca de karité y cera de abejas, sin fragancias.',
        priceCents: 950000,
        stock: 120,
        images: [IMG.balsamo],
      },
    ],
  },
  {
    name: 'Manos Circulares',
    slug: 'manos-circulares',
    description: 'Tejidos y objetos hechos con materiales recuperados.',
    category: 'Hogar',
    logo: LOGO.manos,
    owner: { name: 'Andrés Beltrán', email: 'manos.circulares@izeco.test' },
    products: [
      {
        name: 'Cesta de fibra natural',
        description: 'Cesta tejida a mano con fibra natural, resistente y compostable.',
        priceCents: 5200000,
        stock: 12,
        images: [IMG.cesta],
      },
      {
        name: 'Bolsa de tela reutilizable',
        description: 'Bolsa de tela gruesa cosida con retazos recuperados de talleres locales.',
        priceCents: 3500000,
        stock: 45,
        images: [IMG.tote],
      },
      {
        name: 'Vela de cera de abejas',
        description: 'Velas de cera de abejas sin parafina, con mecha de algodón.',
        priceCents: 2400000,
        stock: 30,
        images: [IMG.vela],
      },
      {
        name: 'Lámpara de botella recuperada',
        description:
          'Lámpara de mesa hecha con botellas de vidrio recuperadas y cable textil, montada por manos del taller.',
        priceCents: 6800000,
        stock: 8,
        images: [REUSE.lampara],
      },
      {
        name: 'Manta de retazos',
        description:
          'Manta acolchada cosida a mano con retazos de tela de otros talleres; cada pieza es distinta.',
        priceCents: 8900000,
        stock: 10,
        images: [REUSE.manta],
      },
      {
        name: 'Mochila de retazos',
        description:
          'Mochila ligera de cordón, cosida con sobrantes de tela y refuerzos recuperados.',
        priceCents: 3900000,
        stock: 25,
        images: [REUSE.mochila],
      },
      {
        name: 'Mueble de palets recuperados',
        description:
          'Estantería armada con palets de obra recuperados, lijados y terminados con aceite natural.',
        priceCents: 12500000,
        stock: 5,
        images: [REUSE.mueblePalets],
      },
    ],
  },
  {
    name: 'Taller Manos del Rio',
    slug: 'taller-manos-del-rio',
    description: 'Artesanías recicladas de la comunidad del río.',
    category: 'Artesanía',
    logo: LOGO.artesania,
    products: [
      {
        name: 'Neceser de retazos de tela',
        description:
          'Neceser acolchado cosido a mano con retazos de tela de camisas y cortinas recuperadas.',
        priceCents: 2200000,
        stock: 30,
        images: [REUSE.neceser],
      },
      {
        name: 'Terrario en botella reutilizada',
        description:
          'Jardín en miniatura dentro de una botella de vidrio reutilizada, con plantas de la ribera.',
        priceCents: 4200000,
        stock: 12,
        images: [REUSE.terrario],
      },
      {
        name: 'Mosquetón de plástico reciclado',
        description:
          'Mosquetón utilitario moldeado con plástico rígido reciclado, resistente al agua.',
        priceCents: 900000,
        stock: 60,
        images: [REUSE.mosqueton],
      },
      {
        name: 'Hornillo de lata reciclada',
        description:
          'Hornillo de alcohol armado con latas de bebida reutilizadas; funciona con alcohol de farmacia.',
        priceCents: 1800000,
        stock: 20,
        images: [REUSE.hornillo],
      },
      {
        name: 'Peluche artesanal de retazos',
        description:
          'Muñeco de apego tejido y cosido con restos de lana y tela de la comunidad del río.',
        priceCents: 2600000,
        stock: 18,
        images: [REUSE.peluche],
      },
    ],
  },
  {
    name: 'Tierra Viva',
    slug: 'tierra-viva',
    description: 'Café y derivados de fincas familiares de la cordillera.',
    category: 'Alimentos',
    logo: LOGO.cafe,
    owner: { name: 'Julián Ríos', email: 'tierra.viva@izeco.test' },
    products: [
      {
        name: 'Café de altura',
        description: 'Café de especialidad tostado medio, cultivado a 1.900 msnm por familias caficultoras.',
        priceCents: 3800000,
        stock: 50,
        images: [IMG.cafe],
      },
      {
        name: 'Chocolate artesanal',
        description: 'Chocolate oscuro 70% elaborado con cacao de fincas familiares y panela.',
        priceCents: 4200000,
        stock: 35,
        images: [IMG.chocolate],
      },
      {
        name: 'Mermelada artesanal',
        description: 'Mermelada de fresa cocida en pequeños lotes, sin conservantes añadidos.',
        priceCents: 2600000,
        stock: 40,
        images: [IMG.mermelada],
      },
    ],
  },
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
    entities: [User, Entrepreneur, Product, ProductCategory, ProductImage],
    synchronize: false,
  });
  await ds.initialize();

  const users = ds.getRepository(User);
  const entrepreneurs = ds.getRepository(Entrepreneur);
  const categories = ds.getRepository(ProductCategory);
  const products = ds.getRepository(Product);
  const images = ds.getRepository(ProductImage);

  const categoryIdBySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    let cat = await categories.findOne({ where: { slug: c.slug } });
    if (!cat) {
      cat = await categories.save(categories.create({ name: c.name, slug: c.slug, isActive: true }));
      console.log(`+ categoria ${c.name}`);
    }
    categoryIdBySlug.set(c.slug, cat.id);
  }

  const slugByCategoryName: Record<string, string> = {
    Alimentos: 'alimentos',
    'Cuidado personal': 'cuidado-personal',
    Hogar: 'hogar',
    Artesanía: 'artesania',
  };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let createdProducts = 0;
  let createdImages = 0;
  let updatedLogos = 0;

  // Los logos se aplican por slug: cubre tanto los socios sembrados aqui como los
  // que ya existian (p. ej. uno con logo de relleno "https://ejemplo.com/logo.png").
  for (const [slug, url] of new Map<string, string>([
    ...ENTREPRENEURS.map((e) => [e.slug, e.logo] as const),
    ...Object.entries(EXTRA_LOGOS),
  ])) {
    const found = await entrepreneurs.findOne({ where: { slug } });
    if (!found || found.logoUrl === url) continue;
    found.logoUrl = url;
    await entrepreneurs.save(found);
    updatedLogos += 1;
    console.log(`~ logo de ${found.name}`);
  }

  for (const seed of ENTREPRENEURS) {
    let entrepreneur = await entrepreneurs.findOne({ where: { slug: seed.slug } });
    if (!entrepreneur) {
      // Solo al crear el emprendimiento hace falta el dueño: los socios que ya
      // existen conservan el suyo y no se crean cuentas sueltas.
      if (!seed.owner) throw new Error(`Falta dueño para ${seed.name}`);
      let owner = await users.findOne({ where: { email: seed.owner.email } });
      if (!owner) {
        owner = await users.save(
          users.create({
            email: seed.owner.email,
            name: seed.owner.name,
            passwordHash,
            role: UserRole.ENTREPRENEUR,
            isActive: true,
            emailVerifiedAt: new Date(),
          }),
        );
        console.log(`+ socio dueño ${seed.owner.email}`);
      }

      entrepreneur = await entrepreneurs.save(
        entrepreneurs.create({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          category: seed.category,
          logoUrl: seed.logo,
          status: EntrepreneurStatus.APPROVED,
          ownerId: owner.id,
        }),
      );
      console.log(`+ emprendimiento ${seed.name}`);
    } else if (entrepreneur.status !== EntrepreneurStatus.APPROVED) {
      entrepreneur.status = EntrepreneurStatus.APPROVED;
      await entrepreneurs.save(entrepreneur);
    }

    const categorySlug = slugByCategoryName[seed.category];
    const categoryId = categoryIdBySlug.get(categorySlug);
    if (!categoryId) throw new Error(`Categoria no sembrada: ${seed.category}`);

    for (const p of seed.products) {
      let product = await products.findOne({
        where: { name: p.name, entrepreneurId: entrepreneur.id },
      });

      if (!product) {
        product = await products.save(
          products.create({
            name: p.name,
            description: p.description,
            priceCents: p.priceCents,
            stock: p.stock,
            isActive: true,
            status: ProductStatus.PUBLISHED,
            categoryId,
            entrepreneurId: entrepreneur.id,
          }),
        );
        createdProducts += 1;
      }

      await images.delete({ productId: product.id });
      const rows = p.images.slice(0, 8).map((url, position) =>
        images.create({ url, position, isPrimary: position === 0, productId: product!.id }),
      );
      if (rows.length) {
        await images.save(rows);
        createdImages += rows.length;
      }
    }
  }

  const totalProducts = await products.count({ where: { status: ProductStatus.PUBLISHED } });
  const totalEntrepreneurs = await entrepreneurs.count();
  const withoutLogo = await entrepreneurs.count({ where: { logoUrl: IsNull() } });

  console.log('\nListo.');
  console.log(`  productos nuevos:      ${createdProducts}`);
  console.log(`  imagenes enlazadas:    ${createdImages}`);
  console.log(`  logos actualizados:    ${updatedLogos}`);
  console.log(`  productos publicados:  ${totalProducts}`);
  console.log(`  emprendimientos:       ${totalEntrepreneurs}`);
  if (withoutLogo) console.log(`  sin logo todavia:      ${withoutLogo}`);
  console.log(`  contrasena de los socios demo: ${DEMO_PASSWORD}`);

  await ds.destroy();
}

void main().catch((err) => {
  console.error('Error:', err?.message ?? err);
  process.exit(1);
});
