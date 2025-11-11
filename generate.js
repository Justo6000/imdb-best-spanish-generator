// generate.js — Generador automático del Top IMDb en Español (Trakt + OMDb) con reintentos

import fetch from "node-fetch";
import fs from "fs/promises";

const TRAKT = process.env.TRAKT_CLIENT_ID;
const OMDB = process.env.OMDB_KEY;

if (!TRAKT || !OMDB) {
  console.error("❌ Faltan las variables de entorno TRAKT_CLIENT_ID u OMDB_KEY");
  process.exit(1);
}

// ---- Función con reintentos y pausa ----
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      console.warn(`⚠️ Petición fallida (${res.status}), intento ${i + 1}/${retries}`);
    } catch (err) {
      console.warn(`⚠️ Error de red (${err.message}), intento ${i + 1}/${retries}`);
    }
    await new Promise((r) => setTimeout(r, delay)); // espera entre intentos
  }
  console.error(`❌ Fallo definitivo en ${url}`);
  return null;
}

async function fetchTrakt(limit = 200) {
  const res = await fetchWithRetry(
    `https://api.trakt.tv/movies/popular?limit=${limit}`,
    {
      headers: {
        "Trakt-Api-Version": "2",
        "Trakt-Api-Key": TRAKT,
      },
    },
    3,
    1500
  );
  return Array.isArray(res) ? res : [];
}

async function main() {
  console.log("🚀 Generando catálogo IMDb en Español...");
  const traktMovies = await fetchTrakt(250);
  const seen = new Set();
  const results = [];

  for (const movie of traktMovies) {
    const imdb = movie?.ids?.imdb;
    if (!imdb || seen.has(imdb)) continue;
    seen.add(imdb);

    const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB}&i=${imdb}&plot=short`;
    const omdb = await fetchWithRetry(omdbUrl, {}, 3, 2000);
    if (!omdb || omdb.Response !== "True") continue;

    const lang = (omdb.Language || "").toLowerCase();
    const rating = parseFloat(omdb.imdbRating) || 0;

    if (lang.includes("spanish") && rating > 0) {
      results.push({
        id: omdb.imdbID,
        type: "movie",
        name: omdb.Title,
        year: parseInt(omdb.Year) || null,
        poster:
          omdb.Poster && omdb.Poster !== "N/A"
            ? omdb.Poster
            : "https://www.moviesindetail.com/icon-192.webp",
        description: `${omdb.Plot || "Película hablada en español"} ⭐ IMDb ${rating}`,
        rating,
      });
      console.log(`✅ ${omdb.Title} (${omdb.imdbRating})`);
    }

    // pausa entre peticiones para evitar bloqueo (1 req/seg)
    await new Promise((r) => setTimeout(r, 1000));
  }

  results.sort((a, b) => b.rating - a.rating);
  const top = results.slice(0, 150);

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/imdb_top_spanish.json", JSON.stringify({ metas: top }, null, 2));

  console.log(`🎉 Catálogo generado con ${top.length} películas.`);
}

main().catch((err) => {
  console.error("❌ Error inesperado:", err);
  process.exit(1);
});
