import { db, communityRoomsTable, pool } from "@workspace/db";

/**
 * Seed/upsert the canonical community rooms (by slug). Rooms are warm,
 * loss-shaped support spaces. Descriptions are calm and non-clinical.
 */

type RoomSeed = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
};

const ROOMS: RoomSeed[] = [
  {
    slug: "new-here",
    name: "New here",
    description: "A gentle first room. Introduce yourself if you like, or simply sit with others who understand.",
    sortOrder: 0,
  },
  {
    slug: "loss-of-a-partner",
    name: "Loss of a partner",
    description: "For those grieving a husband, wife, or partner. A place to speak of the life you shared.",
    sortOrder: 1,
  },
  {
    slug: "loss-of-a-parent",
    name: "Loss of a parent",
    description: "For those who have lost a mother or father, at any age and in any way.",
    sortOrder: 2,
  },
  {
    slug: "loss-of-a-child",
    name: "Loss of a child",
    description: "A tender space held for parents grieving a child. You are among people who understand.",
    sortOrder: 3,
  },
  {
    slug: "sibling-loss",
    name: "Sibling loss",
    description: "For those grieving a brother or sister and the shared history you carry forward.",
    sortOrder: 4,
  },
  {
    slug: "pet-loss",
    name: "Loss of a companion animal",
    description: "For the quiet, real grief of losing a beloved animal who was family.",
    sortOrder: 5,
  },
];

async function main() {
  for (const r of ROOMS) {
    await db
      .insert(communityRoomsTable)
      .values({
        slug: r.slug,
        name: r.name,
        description: r.description,
        sortOrder: r.sortOrder,
      })
      .onConflictDoUpdate({
        target: communityRoomsTable.slug,
        set: {
          name: r.name,
          description: r.description,
          sortOrder: r.sortOrder,
        },
      });
    console.log(`seeded room ${r.slug}`);
  }
  console.log(`\nSeeded ${ROOMS.length} community rooms.`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
