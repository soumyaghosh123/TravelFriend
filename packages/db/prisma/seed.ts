// Seeds reference data: the mock providers and the default child-pricing rules.
// Idempotent — safe to run repeatedly. Destination content is seeded in later milestones.
import { PrismaClient } from '@prisma/client';
import { DEFAULT_PRICING_RULES } from '@tripsaver/domain';

const prisma = new PrismaClient();

const MOCK_PROVIDERS = [
  { id: 'mock-train', name: 'Sample trains', mode: 'train' },
  { id: 'mock-bus', name: 'Sample buses', mode: 'bus' },
  { id: 'mock-flight', name: 'Sample flights', mode: 'flight' },
  { id: 'mock-hotels', name: 'Sample hotels', mode: 'hotel' },
  { id: 'mock-calendar', name: 'Sample calendar', mode: 'calendar' },
  { id: 'mock-weather', name: 'Sample climate', mode: 'weather' },
] as const;

async function main(): Promise<void> {
  for (const p of MOCK_PROVIDERS) {
    await prisma.provider.upsert({
      where: { id: p.id },
      update: { name: p.name, mode: p.mode },
      create: { ...p, kind: 'mock' },
    });
  }

  // Default rules (providerId = null) are replaced wholesale so they always match the domain constants.
  await prisma.$transaction([
    prisma.pricingRule.deleteMany({ where: { providerId: null } }),
    prisma.pricingRule.createMany({ data: DEFAULT_PRICING_RULES.map((r) => ({ ...r })) }),
  ]);

  const [providers, rules] = await Promise.all([prisma.provider.count(), prisma.pricingRule.count()]);
  console.log(`Seeded ${providers} providers, ${rules} pricing rules.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
