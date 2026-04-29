const server = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = server();
app.use(cors());
app.use(server.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'deforestazioneVeneto',
  password: '12345678',
  port: 5432,
});

app.get('/', (req, res) => {
  res.send('Server Express attivo');
});

app.get('/api/test', (req, res) => {
  res.json({ ok: true, message: 'API attiva' });
});

// Endpoint per i confini del Veneto (interroga direttamente il database permanente)
app.get('/api/confini_veneto', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(c.geometry)::jsonb,
              'properties', jsonb_build_object(
                'id', c.id,
                'nome', c.nome
              )
            )
          ),
          '[]'::jsonb
        )
      ) AS geojson
      FROM confini_veneto c;
    `;

    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('Errore /api/confini_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});

// Poligoni catastali
app.get('/api/mappe_veneto_official', async (req, res) => {
  try {
    const minLng = Number.parseFloat(req.query.minLng);
    const minLat = Number.parseFloat(req.query.minLat);
    const maxLng = Number.parseFloat(req.query.maxLng);
    const maxLat = Number.parseFloat(req.query.maxLat);
    const zoom = Number.parseInt(req.query.zoom, 10) || 8;

    if ([minLng, minLat, maxLng, maxLat].some(v => Number.isNaN(v))) {
      return res.status(400).json({ error: 'BBox non valida' });
    }

    if (zoom < 14) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
      });
    }

    let dettagliMappe = 0.0015;
    let recordMappe = 2000;

    if (zoom >= 10) {
      dettagliMappe = 0.0005;
      recordMappe = 4000;
    }
    if (zoom >= 12) {
      dettagliMappe = 0.00015;
      recordMappe = 7000;
    }
    if (zoom >= 14) {
      dettagliMappe = 0.00005;
      recordMappe = 12000;
    }

const query = `
  WITH bbox AS (
    SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
  ),
  filtered AS (
    SELECT
      m.id_db,
      m.nome_zona,
      m.nome_livello,
      m.provincia,
      m.sigla_provincia,
      m.nome_comune,
      m.codice_catastale,
      ST_SimplifyPreserveTopology(m.geometry, $5) AS geom
    FROM mappe_veneto_official m, bbox
    WHERE ST_Intersects(m.geometry, bbox.geom)
    LIMIT $6
  )
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::jsonb,
          'properties', jsonb_build_object(
            'id', id_db,
            'nome_livello', nome_livello,
            'provincia', provincia,
            'sigla_provincia', sigla_provincia,
            'comune', nome_comune,
            'codice_catastale', codice_catastale
          )
        )
      ),
      '[]'::jsonb
    )
  ) AS geojson
  FROM filtered;
`;

    const result = await pool.query(query, [
      minLng, minLat, maxLng, maxLat, dettagliMappe, recordMappe,
    ]);

    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('Errore /api/mappe_veneto_official:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/particelle_veneto_official', async (req, res) => {
  try {
    const minLng = Number.parseFloat(req.query.minLng);
    const minLat = Number.parseFloat(req.query.minLat);
    const maxLng = Number.parseFloat(req.query.maxLng);
    const maxLat = Number.parseFloat(req.query.maxLat);
    const zoom = Number.parseInt(req.query.zoom, 10) || 8;

    if ([minLng, minLat, maxLng, maxLat].some(v => Number.isNaN(v))) {
      return res.status(400).json({ error: 'BBox non valida' });
    }

    if (zoom < 14) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
      });
    }

    let dettagliParticelle = 0.00012;
    let recordParticelle = 1500;

    if (zoom >= 15) {
      dettagliParticelle = 0.00006;
      recordParticelle = 2500;
    }

    if (zoom >= 16) {
      dettagliParticelle = 0.00003;
      recordParticelle = 4000;
    }

    const query = `
      WITH bbox AS (
        SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
      ),
      filtered AS (
        SELECT
          p.id_db,
          p.nome_particella,
          p.codice_catastale,
          p.nome_comune,
          p.provincia,
          p.sigla_provincia,
          p.nome_mappa,
          ST_Area(ST_Transform(p.geometry, 32632)) AS area_mq,
          ST_SimplifyPreserveTopology(p.geometry, $5) AS geom
        FROM particelle_veneto_official p, bbox
        WHERE ST_Intersects(p.geometry, bbox.geom)
        LIMIT $6
      )
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::jsonb,
              'properties', jsonb_build_object(
                'id', id_db,
                'label', nome_particella,
                'nome_mappa', replace(nome_mappa, '_ple', ''),
                'comune', nome_comune,
                'provincia', provincia,
                'sigla_provincia', sigla_provincia,
                'codice_catastale', codice_catastale,
                'area_mq', ROUND(area_mq::numeric, 2)
              )
            )
          ),
          '[]'::jsonb
        )
      ) AS geojson
      FROM filtered;
    `;

    const result = await pool.query(query, [
      minLng,
      minLat,
      maxLng,
      maxLat,
      dettagliParticelle,
      recordParticelle,
    ]);

    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('Errore /api/particelle_veneto_official:', err);
    res.status(500).json({ error: err.message });
  }
});



app.post('/api/analizza_poligono', async (req, res) => {
  try {
    const { geojson } = req.body;

    if (!geojson || !geojson.geometry) {
      return res.status(400).json({ error: 'GeoJSON non valido' });
    }

    const geometry = JSON.stringify(geojson.geometry);

    const checkQuery = `
      WITH drawn AS (
        SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom
      )
      SELECT EXISTS (
        SELECT 1
        FROM confini_veneto c
        CROSS JOIN drawn d
        WHERE ST_CoveredBy(d.geom, c.geometry)
      ) AS dentro_confine;
    `;

    const checkResult = await pool.query(checkQuery, [geometry]);

    if (!checkResult.rows[0].dentro_confine) {
      return res.status(400).json({
        error: 'Ridisegna il poligono entro i confini del Veneto.'
      });
    }
  const summaryQuery = `
    WITH drawn AS (
      SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom
    ),
    intersezioni AS (
      SELECT
        p.nome_particella,
        p.nome_mappa,
        p.nome_comune,
        p.provincia,
        p.sigla_provincia,
        ST_Area(
          ST_Intersection(
            ST_Transform(p.geometry, 32632),
            ST_Transform(d.geom, 32632)
          )
        ) AS area_intersezione_mq
      FROM particelle_veneto_official p
      CROSS JOIN drawn d
      WHERE p.geometry && d.geom
        AND ST_Intersects(p.geometry, d.geom)
    )
    SELECT
      ROUND(
        ST_Area(ST_Transform((SELECT geom FROM drawn), 32632))::numeric,
        2
      ) AS area_poligono_mq,

      COUNT(*)::int AS numero_particelle_intersecate,

      ROUND(
        COALESCE(SUM(area_intersezione_mq), 0)::numeric,
        2
      ) AS area_intersezione_totale_mq,

      (
        SELECT nome_comune
        FROM intersezioni
        GROUP BY nome_comune
        ORDER BY SUM(area_intersezione_mq) DESC
        LIMIT 1
      ) AS comune,

      (
        SELECT provincia
        FROM intersezioni
        GROUP BY provincia
        ORDER BY SUM(area_intersezione_mq) DESC
        LIMIT 1
      ) AS provincia,

      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'nome_particella', nome_particella,
            'nome_mappa', replace(nome_mappa, '_ple', ''),
            'comune', nome_comune,
            'provincia', provincia,
            'area_intersezione_mq', ROUND(area_intersezione_mq::numeric, 2)
          )
          ORDER BY area_intersezione_mq DESC
        )
        FROM intersezioni
      ) AS elenco_particelle

    FROM intersezioni;
  `;

    const summaryResult = await pool.query(summaryQuery, [geometry]);
    const riepilogoPoligono = summaryResult.rows[0];

    const intersectQuery = `
      WITH drawn AS (
        SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom
      ),
      candidates AS (
        SELECT
          p.id_db,
          p.nome_particella,
          p.codice_catastale,
          p.nome_comune,
          p.provincia,
          p.sigla_provincia,
          p.nome_mappa,
          p.geometry,
          d.geom AS drawn_geom
        FROM particelle_veneto_official p
        CROSS JOIN drawn d
        WHERE p.geometry && d.geom
          AND ST_Intersects(p.geometry, d.geom)
        LIMIT 5000
      ),
      intersections AS (
        SELECT
          id_db,
          nome_particella,
          codice_catastale,
          nome_comune,
          provincia,
          sigla_provincia,
          nome_mappa,
          geometry,
          ST_Area(
            ST_Intersection(
              ST_Transform(geometry, 32632),
              ST_Transform(drawn_geom, 32632)
            )
          ) AS area_intersezione_mq
        FROM candidates
      ),
      top_intersections AS (
        SELECT *
        FROM intersections
        ORDER BY area_intersezione_mq DESC
        LIMIT 20
      )
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(
                ST_SimplifyPreserveTopology(geometry, 0.00001)
              )::jsonb,
              'properties', jsonb_build_object(
                'tipo', 'particella',
                'id', id_db,
                'label', nome_particella,
                'nome_mappa', replace(nome_mappa, '_ple', ''),
                'comune', nome_comune,
                'provincia', provincia,
                'sigla_provincia', sigla_provincia,
                'codice_catastale', codice_catastale,
                'area_intersezione_mq', ROUND(area_intersezione_mq::numeric, 2)
              )
            )
            ORDER BY area_intersezione_mq DESC
          ),
          '[]'::jsonb
        )
      ) AS geojson
      FROM top_intersections;
    `;

    const intersectResult = await pool.query(intersectQuery, [geometry]);

    return res.json({
      ok: true,
      message: 'Poligono analizzato correttamente',
      poligono: geojson,
      riepilogoPoligono,
      particelleIntersecate: intersectResult.rows[0].geojson
    });
  } catch (err) {
    console.error('Errore /api/analizza_poligono:', err);
    return res.status(500).json({
      error: err.message || 'Errore nell’analisi del poligono'
    });
  }
});

async function avviaServer() {
  app.listen(3001, () => {
    console.log('Server pronto sulla porta 3001!');
  });
}

avviaServer();


// menù laterale selezione provincia e comune
app.get('/api/province_mappe_veneto', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT provincia, sigla_provincia
      FROM confini_province_veneto
      WHERE provincia IS NOT NULL 
        AND sigla_provincia IS NOT NULL
      ORDER BY provincia ASC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/province_mappe_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/province_particelle_veneto', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT provincia, sigla_provincia
      FROM confini_province_veneto
      WHERE provincia IS NOT NULL 
        AND sigla_provincia IS NOT NULL
      ORDER BY provincia ASC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/province_particelle_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comuni_mappe_veneto', async (req, res) => {
  try {
    const { provincia } = req.query;

    let query = `
      SELECT DISTINCT nome_comune AS comune, provincia, sigla_provincia
      FROM confini_comuni_veneto
      WHERE nome_comune IS NOT NULL
    `;
    const values = [];

    if (provincia) {
      query += ` AND provincia = $1`;
      values.push(provincia);
    }

    query += ` ORDER BY nome_comune ASC;`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/comuni_mappe_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comuni_particelle_veneto', async (req, res) => {
  try {
    const { provincia } = req.query;

    let query = `
      SELECT DISTINCT nome_comune AS comune, provincia, sigla_provincia
      FROM confini_comuni_veneto
      WHERE nome_comune IS NOT NULL
    `;
    const values = [];

    if (provincia) {
      query += ` AND provincia = $1`;
      values.push(provincia);
    }

    query += ` ORDER BY nome_comune ASC;`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/comuni_particelle_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});



// zoom mappa dopo la ricerca dal menu laterale
app.get('/api/ricerca_mappa', async (req, res) => {
  try {
    const { provincia, comune, identificatore } = req.query;

    // CASO 1: SOLO PROVINCIA
    if (provincia && !comune && !identificatore) {
      const query = `
        SELECT DISTINCT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'Feature',
              'id', 'mappa_prov_' || sigla_provincia,
              'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.001))::jsonb,
                'properties', jsonb_build_object(
                  'contesto', 'mappa',
                  'tipo', 'provincia',
                  'provincia', provincia,
                  'sigla_provincia', sigla_provincia
                )
              )
            ),
            '[]'::jsonb
          )
        ) AS geojson
        FROM confini_province_veneto
        WHERE provincia = $1;
      `;

      const result = await pool.query(query, [provincia]);
      return res.json(result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] });
    }

    // CASO 2: PROVINCIA + COMUNE
    if (provincia && comune && !identificatore) {
      const query = `
        SELECT DISTINCT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.0001))::jsonb,
              'id', 'mappa_com_' || codice_catastale,
              'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0001))::jsonb,
                'properties', jsonb_build_object(
                  'tipo', 'comune',
                  'contesto', 'mappa',
                'contesto', 'mappa',
                  'comune', nome_comune,
                  'provincia', provincia,
                  'sigla_provincia', sigla_provincia,
                  'codice_catastale', codice_catastale,
                  'area_mq', ROUND(ST_Area(ST_Transform(geometry, 32632))::numeric, 2)
                )
              )
            ),
            '[]'::jsonb
          )
        ) AS geojson
        FROM confini_comuni_veneto
        WHERE provincia = $1
          AND nome_comune = $2;
      `;

      const result = await pool.query(query, [provincia, comune]);
      return res.json(result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] });
    }

    // CASO 3: IDENTIFICATORE MAPPA -> CONTORNA IL COMUNE
    if (identificatore) {
      const values = [];
      let whereClause = `WHERE codice_catastale = $1`;
      values.push(identificatore);

      if (provincia && comune) {
        whereClause += ` AND provincia = $2 AND nome_comune = $3`;
        values.push(provincia, comune);
      } else if (provincia) {
        whereClause += ` AND provincia = $2`;
        values.push(provincia);
      } else if (comune) {
        whereClause += ` AND nome_comune = $2`;
        values.push(comune);
      }

      const query = `
        SELECT DISTINCT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.0001))::jsonb,
              'id', 'mappa_ident_' || codice_catastale,
              'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0001))::jsonb,
                'properties', jsonb_build_object(
                  'contesto', 'mappa',
                  'tipo', 'comune',
                  'comune', nome_comune,
                  'provincia', provincia,
                  'sigla_provincia', sigla_provincia,
                  'codice_catastale', codice_catastale
                )
              )
            ),
            '[]'::jsonb
          )
        ) AS geojson
        FROM confini_comuni_veneto
        ${whereClause};
      `;

      const result = await pool.query(query, values);
      return res.json(result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] });
    }

    return res.json({ type: 'FeatureCollection', features: [] });
  } catch (err) {
    console.error('Errore ricerca_mappa:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ricerca_particella', async (req, res) => {
  try {
    const { provincia, comune, particella } = req.query;

    // CASO 1: SOLO PROVINCIA
    if (provincia && !comune && !particella) {
      const query = `
        SELECT DISTINCT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'Feature',
              'id', 'part_prov_' || sigla_provincia,
              'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.001))::jsonb,
                'properties', jsonb_build_object(
                  'contesto', 'particella',
                  'tipo', 'provincia',
                  'provincia', provincia,
                  'sigla_provincia', sigla_provincia
                )
              )
            ),
            '[]'::jsonb
          )
        ) AS geojson
        FROM confini_province_veneto
        WHERE provincia = $1;
      `;

      const result = await pool.query(query, [provincia]);
      return res.json(result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] });
    }

    // CASO 2: PROVINCIA + COMUNE
    if (provincia && comune && !particella) {
      const query = `
        SELECT DISTINCT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(geometry)::jsonb,
              'id', 'part_com_' || codice_catastale,
              'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0001))::jsonb,
                'properties', jsonb_build_object(
                  'contesto', 'particella',
                  'tipo', 'comune',
                  'comune', nome_comune,
                  'provincia', provincia,
                  'sigla_provincia', sigla_provincia
                )
              )
            ),
            '[]'::jsonb
          )
        ) AS geojson
        FROM confini_comuni_veneto
        WHERE provincia = $1
          AND nome_comune = $2;
      `;

      const result = await pool.query(query, [provincia, comune]);
      return res.json(result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] });
    }

    // CASO 3: PARTICELLA SPECIFICA
    if (provincia && comune && particella) {
      const query = `
        SELECT DISTINCT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type', 'Feature',
              'id', 'part_spec_' || id_db,
                'geometry', ST_AsGeoJSON(geometry)::jsonb,
                'properties', jsonb_build_object(
                  'contesto', 'particella',
                  'tipo', 'particella',
                  'id', id_db,
                  'label', nome_particella,
                  'nome_mappa', nome_mappa,
                  'comune', nome_comune,
                  'provincia', provincia,
                  'sigla_provincia', sigla_provincia,
                  'codice_catastale', codice_catastale
                )
              )
            ),
            '[]'::jsonb
          )
        ) AS geojson
        FROM (
          SELECT *
          FROM particelle_veneto_official 
          WHERE provincia = $1
            AND nome_comune = $2
            AND nome_particella = $3
          ORDER BY nome_particella ASC
          LIMIT 1
        ) AS sub;
      `;

      const result = await pool.query(query, [
        provincia,
        comune,
        particella,
      ]);

      return res.json(result.rows[0]?.geojson ?? { type: 'FeatureCollection', features: [] });
    }

    return res.json({ type: 'FeatureCollection', features: [] });
  } catch (err) {
    console.error('Errore ricerca_particella:', err);
    res.status(500).json({ error: err.message });
  }
});

// ricerca per identificatori
app.get('/api/identificatori_mappe_veneto', async (req, res) => {
  try {
    const { provincia, comune } = req.query;

    let query = `
      SELECT DISTINCT
        codice_catastale,
        nome_comune AS comune,
        provincia,
        sigla_provincia
      FROM confini_comuni_veneto
      WHERE codice_catastale IS NOT NULL
    `;
    const values = [];

    if (provincia) {
      query += ` AND provincia = $1`;
      values.push(provincia);
    }

    if (comune) {
      query += values.length === 0 ? ` AND nome_comune = $1` : ` AND nome_comune = $2`;
      values.push(comune);
    }

    query += ` ORDER BY codice_catastale ASC;`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/identificatori_mappe_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/identificatori_particelle_veneto', async (req, res) => {
  try {
    const { provincia, comune } = req.query;

    // Protezione: caricare le particelle di un'intera provincia è troppo lento.
    // Obblighiamo la selezione del comune per popolare questo dropdown.
    if (!comune) {
      return res.json([]);
    }

    let query = `
      SELECT DISTINCT
        nome_particella
      FROM particelle_veneto_official 
      WHERE nome_particella IS NOT NULL
    `;
    const values = []; 

    if (provincia) {
      query += ` AND provincia = $1`;
      values.push(provincia);
    }

    if (comune) {
      query += values.length === 0
        ? ` AND nome_comune = $1`
        : ` AND nome_comune = $2`;
      values.push(comune);
    }

    query += ` ORDER BY nome_particella ASC LIMIT 500;`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/identificatori_particelle_veneto:', err);
    res.status(500).json({ error: err.message });
  }
});




app.get('/api/dati_particella/:particellaId', async (req, res) => {
  const particellaId = Number(req.params.particellaId);

  try {
    await pool.query(`
      INSERT INTO particella_punti (particella_id, pos_index, geom)
      WITH p AS (
        SELECT id_db AS particella_id, ST_Transform(geometry, 32632) AS geom_m
        FROM particelle_veneto_official
        WHERE id_db = $1
      ),
      punti AS (
        SELECT
          p.particella_id,
          ST_PointOnSurface(ST_Intersection(c.geom, p.geom_m)) AS geom_m
        FROM p
        CROSS JOIN LATERAL ST_SquareGrid(10, p.geom_m) AS c
        WHERE ST_Intersects(c.geom, p.geom_m)
      ),
      ordinati AS (
        SELECT
          particella_id,
          ROW_NUMBER() OVER (ORDER BY ST_Y(geom_m) DESC, ST_X(geom_m)) AS pos_index,
          geom_m
        FROM punti
      )
      SELECT particella_id, pos_index, geom_m
      FROM ordinati
      ON CONFLICT (particella_id, pos_index) DO NOTHING;
    `, [particellaId]);

    await pool.query(`
      INSERT INTO punto_rilevazioni
        (punto_id, rilevato_at, temperatura, image_path)
      SELECT
        pp.punto_id,
        timestamp '2025-01-01 00:00:00' + (gs.n || ' hours')::interval,
        ROUND((15 + random() * 20)::numeric, 2),
        '/images/punti/particella_' || pp.particella_id ||
        '_pos_' || pp.pos_index ||
        '_ts_' || gs.n || '.jpg'
      FROM particella_punti pp
      CROSS JOIN generate_series(1, 10) AS gs(n)
      WHERE pp.particella_id = $1
      ON CONFLICT (punto_id, rilevato_at) DO NOTHING;
    `, [particellaId]);

    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
              'properties', jsonb_build_object(
                'punto_id', punto_id,
                'particella_id', particella_id,
                'pos_index', pos_index
              )
            )
            ORDER BY pos_index
          ),
          '[]'::jsonb
        )
      ) AS geojson
      FROM particella_punti
      WHERE particella_id = $1;
    `, [particellaId]);

    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('Errore /api/dati_particella:', err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/rilevazioni_punto/:puntoId', async (req, res) => {
  const puntoId = Number(req.params.puntoId);

  try {
    const result = await pool.query(`
      SELECT
        rilevazione_id,
        punto_id,
        rilevato_at,
        temperatura,
        image_path
      FROM punto_rilevazioni
      WHERE punto_id = $1
      ORDER BY rilevato_at DESC;
    `, [puntoId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Errore /api/rilevazioni_punto:', err);
    res.status(500).json({ error: err.message });
  }
});