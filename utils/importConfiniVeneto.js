const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'deforestazioneVeneto',
  password: '12345678',
  port: 5432,
});


async function importaConfiniVeneto() {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'geojson', 'veneto.geojson');
    const rawData = fs.readFileSync(filePath, 'utf8');
    const geojson = JSON.parse(rawData);

    const features = geojson.features || [];

    const venetoFeature = features.find((f) => {
      const p = f.properties || {};
      const nome = String(
        p.nome || p.regione || p.reg_name || p.NAME_1 || ''
      ).toLowerCase();

      return nome === 'veneto';
    }) || features[0];

    if (!venetoFeature || !venetoFeature.geometry) {
      throw new Error('Nessuna geometria valida trovata per il Veneto');
    }

    const query = `
      INSERT INTO confini_veneto (nome, geometry)
      VALUES (
        $1,
        ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
      )
      RETURNING id;
    `;

    const result = await pool.query(query, [
      'Veneto',
      JSON.stringify(venetoFeature.geometry),
    ]);

    console.log('Confine Veneto importato con successo. ID:', result.rows[0].id);
  } catch (err) {
    console.error('Errore import confini Veneto:', err);
  } finally {
    await pool.end();
  }
}

importaConfiniVeneto();