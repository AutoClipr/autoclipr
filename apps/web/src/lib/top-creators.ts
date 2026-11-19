// Rank lookup — ordered list matches CREATORS_META
export const CREATOR_RANKS: Record<string, number> = {
  "mrbeast": 1, "t-series": 2, "cocomelon": 3, "set india": 4,
  "vlad and niki": 5, "stokes twins": 6, "kids diana show": 7, "like nastya": 8,
  "zee music company": 9, "5-minute crafts": 10, "blackpink": 11, "justin bieber": 12,
  "mark rober": 13, "dude perfect": 14, "nicki minaj": 15, "shakira": 16,
  "abp news": 17, "beatboxjcop": 18, "toys and colors": 19, "alan's universe": 20,
};

/** URL slugs for /top-creators/[channel], matching the list page's links. */
export const TOP_CREATOR_SLUGS = Object.keys(CREATOR_RANKS).map((name) =>
  encodeURIComponent(name.replace(/\s+/g, "-")),
);
