import Image from "next/image";
import Link from "next/link";
import {
  SET_NAME_TO_ID,
  SetName,
  SET_ERA_MAP,
} from "@/features/catalog/constants";
import { Card, CardContent } from "@/components/ui/card";
import placeholderImage from "@/public/assets/placeholder-pokemon-back.png";

const SET_THUMBNAILS: {
  id: string;
  name: SetName;
  imagePath: string;
  releaseDate: string;
}[] = [
  {
    id: SET_NAME_TO_ID["Black Bolt"],
    name: "Black Bolt",
    imagePath: "/assets/home/sv-black-bolt.png",
    releaseDate: "2025-07-18",
  },
  {
    id: SET_NAME_TO_ID["White Flare"],
    name: "White Flare",
    imagePath: "/assets/home/sv-white-flare.png",
    releaseDate: "2025-07-18",
  },
  {
    id: SET_NAME_TO_ID["Destined Rivals"],
    name: "Destined Rivals",
    imagePath: "/assets/home/sv-destined-rivals.png",
    releaseDate: "2025-02-14",
  },
  {
    id: SET_NAME_TO_ID["Journey Together"],
    name: "Journey Together",
    imagePath: "/assets/home/sv-journey-together.png",
    releaseDate: "2025-01-17",
  },
  {
    id: SET_NAME_TO_ID["Prismatic Evolutions"],
    name: "Prismatic Evolutions",
    imagePath: "/assets/home/sv-prismatic-evolution.png",
    releaseDate: "2025-01-17",
  },
  {
    id: SET_NAME_TO_ID["Surging Sparks"],
    name: "Surging Sparks",
    imagePath: "/assets/home/sv-surging-sparks.png",
    releaseDate: "2024-11-08",
  },
  {
    id: SET_NAME_TO_ID["Stellar Crown"],
    name: "Stellar Crown",
    imagePath: "/assets/home/sv-stellar-crown.png",
    releaseDate: "2024-09-13",
  },
  {
    id: SET_NAME_TO_ID["Shrouded Fable"],
    name: "Shrouded Fable",
    imagePath: "/assets/home/sv-shrouded-fable.png",
    releaseDate: "2024-08-02",
  },
  {
    id: SET_NAME_TO_ID["Twilight Masquerade"],
    name: "Twilight Masquerade",
    imagePath: "/assets/home/sv-twilight-masquerade.png",
    releaseDate: "2024-05-24",
  },
  {
    id: SET_NAME_TO_ID["Temporal Forces"],
    name: "Temporal Forces",
    imagePath: "/assets/home/sv-temporal-forces.png",
    releaseDate: "2024-03-22",
  },
  {
    id: SET_NAME_TO_ID["Paldean Fates"],
    name: "Paldean Fates",
    imagePath: "/assets/home/sv-paldean-fates.png",
    releaseDate: "2024-01-26",
  },
  {
    id: SET_NAME_TO_ID["Paradox Rift"],
    name: "Paradox Rift",
    imagePath: "/assets/home/sv-paradox-rift.png",
    releaseDate: "2023-11-03",
  },
  {
    id: SET_NAME_TO_ID["Scarlet & Violet 151"],
    name: "Scarlet & Violet 151",
    imagePath: "/assets/home/sv-151.png",
    releaseDate: "2023-09-22",
  },
  {
    id: SET_NAME_TO_ID["Obsidian Flames"],
    name: "Obsidian Flames",
    imagePath: "/assets/home/sv-obsidian-flames.png",
    releaseDate: "2023-08-11",
  },
  {
    id: SET_NAME_TO_ID["Paldea Evolved"],
    name: "Paldea Evolved",
    imagePath: "/assets/home/sv-paldea-evolved.png",
    releaseDate: "2023-06-09",
  },
  {
    id: SET_NAME_TO_ID["Scarlet & Violet Base Set"],
    name: "Scarlet & Violet Base Set",
    imagePath: "/assets/home/sv-base.png",
    releaseDate: "2023-03-31",
  },
  {
    id: SET_NAME_TO_ID["Mega Evolution"],
    name: "Mega Evolution",
    imagePath: "/assets/home/mega-base.png",
    releaseDate: "2025-08-01",
  },
];

export function Home() {
  // Group sets by era
  const groupedSets = SET_THUMBNAILS.reduce<
    Record<string, typeof SET_THUMBNAILS>
  >((acc, set) => {
    const era = SET_ERA_MAP[set.id] || "Other";
    if (!acc[era]) {
      acc[era] = [];
    }
    acc[era].push(set);
    return acc;
  }, {});

  // Sort eras by the most recent release date within each era
  const sortedEras = Object.entries(groupedSets).sort(
    ([, setsA], [, setsB]) => {
      const mostRecentA = Math.max(
        ...setsA.map((s) => new Date(s.releaseDate).getTime())
      );
      const mostRecentB = Math.max(
        ...setsB.map((s) => new Date(s.releaseDate).getTime())
      );
      return mostRecentB - mostRecentA;
    }
  );

  return (
    <div className="p-8">
      <div className="space-y-8">
        {sortedEras.map(([era, sets]) => (
          <section key={era}>
            <h2 className="text-2xl font-bold mb-4 tracking-wide">{era}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {sets.map((set) => (
                <Link key={set.id} href={`/market/set/${set.id}`}>
                  <Card className="cursor-pointer group overflow-hidden transition-all duration-300 hover:shadow-lg w-full pb-0 pt-0">
                    <CardContent className="pt-3 px-3 pb-2">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative rounded-md w-full h-auto transition-transform duration-300">
                          <div className="relative w-full aspect-[3/1] bg-muted rounded-md">
                            <Image
                              src={set.imagePath}
                              alt={set.name}
                              width={240}
                              height={80}
                              className="w-full h-auto rounded-md border-[1px] shadow-2xl"
                              placeholder="blur"
                              blurDataURL={placeholderImage.blurDataURL}
                            />
                          </div>

                          <p className="font-medium text-xs tracking-wider text-center pt-1">
                            {set.name}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
