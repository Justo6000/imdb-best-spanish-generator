// generate.js - Generador automático de Top IMDb en español

import fetch from "node-fetch";
import fs from "fs/promises";

const TRAKT = process.env.TRAKT_CLIENT_ID;
const OMDB = process.env.OMDB_KEY;

if (!TRAKT || !OMDB) {
  console.error("Faltan variables de entorno: TRAKT_CLIENT_ID u OMDB_KEY");
  process.exit(1);
}

async function fetchTrakt(limit = 300) {
  const res = await fetch(`https://api.trakt.tv/movies/popular?limit=${limit}`, {
    headers: {
      "Trakt-Api-Version": "2",
      "Trakt-Api-Key": TRAKT,
    },
  });
  return res.ok ? await res.json() : [];
}

async function getOmdb(imdbId) {
  const r = await fetch(`https://www.omdbapi.com/?apikey=${OMDB}&i=${imdbId}&plot=short`);
  return r.ok ? await r.json() : null;
}

async function main() {
  const trakt = await fetchTrakt(350);
  const seen = new Map();
  const results = [];

  for (const item of trakt) {
    const imdb = item.ids?.imdb;
    if (!imdb || seen.has(imdb)) continue;
    seen.set(imdb, true);

    const om = await getOmdb(imdb);
    if (!om || om.Response !== "True") continue;

    const lang = (om.Language || "").toLowerCase();
    const rating = parseFloat(om.imdbRating) || 0;

    if (lang.includes("spanish") && rating > 0) {
      results.push({
        id: om.imdbID,
        title: om.Title,
        year: parseInt(om.Year) || null,
        poster: om.Poster && om.Poster !== "N/A" ? om.Poster : null,
        plot: om.Plot && om.Plot !== "N/A" ? om.Plot : "",
        rating,
      });
    }

    await new Promise((r) => setTimeout(r, 350)); // pausa entre llamadas
  }

  results.sort((a, b) => b.rating - a.rating);
  const top = results.slice(0, 150);

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(
    "data/imdb_top_spanish.json",
    JSON.stringify(
      {
        metas: top.map((p) => ({
          id: p.id,
          type: "movie",
          name: p.title,
          year: p.year,
          poster: p.poster || "https://www.moviesindetail.com/icon-192.webp",
          description: `${p.plot} ⭐ IMDb ${p.rating}`,
        })),
      },
      null,
      2
    )
  );

  console.log("✅ Top IMDb en español generado con", top.length, "películas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
