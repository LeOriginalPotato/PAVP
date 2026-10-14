const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { query } = require('../db');

const BATCH_SIZE = 5000;
const PROGRESS_FLUSH_EVERY = 25000;

function normalize(value) {
  return String(value || '').trim();
}

function rowToValues(row) {
  return {
    province: normalize(row.Province),
    municipality: normalize(row.Municipality),
    ward_id: normalize(row.WardID),
    vd_number: normalize(row.VDNumber),
    vr_section: normalize(row.VRSection),
    seq_no: normalize(row.SeqNo),
    id_number: normalize(row.IDNumber),
    surname: normalize(row.Surname),
    full_name: normalize(row.FullName),
    voter_status: normalize(row['Voter Status']),
    street_number: normalize(row.StreetNumber),
    street_name: normalize(row.StreetName),
    street_type: normalize(row.StreetType),
    place_number: normalize(row.PlaceNumber),
    place_name: normalize(row.PlaceName),
    house_number: normalize(row.HouseNumber),
    farm_name: normalize(row.FarmName),
    farm_number: normalize(row.FarmNumber),
    location: normalize(row.Location),
    suburb: normalize(row.Suburb),
    town: normalize(row.Town),
    res_postal_code: normalize(row.ResPostalCode)
  };
}

async function flushBatch(batch, sourceFile) {
  if (!batch.length) return 0;

  const cols = [
    'province', 'municipality', 'ward_id', 'vd_number', 'vr_section', 'seq_no',
    'id_number', 'surname', 'full_name', 'voter_status', 'street_number', 'street_name',
    'street_type', 'place_number', 'place_name', 'house_number', 'farm_name', 'farm_number',
    'location', 'suburb', 'town', 'res_postal_code', 'source_file'
  ];

  const values = [];
  const placeholders = [];

  batch.forEach((record, idx) => {
    const base = idx * cols.length;
    placeholders.push(`(${cols.map((_, i) => `$${base + i + 1}`).join(',')})`);
    values.push(
      record.province,
      record.municipality,
      record.ward_id,
      record.vd_number,
      record.vr_section,
      record.seq_no,
      record.id_number,
      record.surname,
      record.full_name,
      record.voter_status,
      record.street_number,
      record.street_name,
      record.street_type,
      record.place_number,
      record.place_name,
      record.house_number,
      record.farm_name,
      record.farm_number,
      record.location,
      record.suburb,
      record.town,
      record.res_postal_code,
      sourceFile
    );
  });

  const sql = `
    INSERT INTO voters_roll (${cols.join(',')})
    VALUES ${placeholders.join(',')}
    ON CONFLICT (id_number, ward_id, vd_number, seq_no)
    DO UPDATE SET
      province = EXCLUDED.province,
      municipality = EXCLUDED.municipality,
      vr_section = EXCLUDED.vr_section,
      surname = EXCLUDED.surname,
      full_name = EXCLUDED.full_name,
      voter_status = EXCLUDED.voter_status,
      street_number = EXCLUDED.street_number,
      street_name = EXCLUDED.street_name,
      street_type = EXCLUDED.street_type,
      place_number = EXCLUDED.place_number,
      place_name = EXCLUDED.place_name,
      house_number = EXCLUDED.house_number,
      farm_name = EXCLUDED.farm_name,
      farm_number = EXCLUDED.farm_number,
      location = EXCLUDED.location,
      suburb = EXCLUDED.suburb,
      town = EXCLUDED.town,
      res_postal_code = EXCLUDED.res_postal_code,
      source_file = EXCLUDED.source_file,
      imported_at = NOW();
  `;

  await query(sql, values);
  return batch.length;
}

async function updateProgress(jobId, status, rowsProcessed, rowsInserted, rowsRejected, errorMessage = null) {
  await query(
    'UPDATE import_jobs SET status = $2, rows_processed = $3, rows_inserted = $4, rows_rejected = $5, error_message = $6 WHERE id = $1',
    [jobId, status, rowsProcessed, rowsInserted, rowsRejected, errorMessage]
  );
}

async function importCsv(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const startJob = await query(
    'INSERT INTO import_jobs (file_path, status) VALUES ($1, $2) RETURNING id',
    [resolvedPath, 'running']
  );
  const jobId = startJob.rows[0].id;

  let rowsProcessed = 0;
  let rowsInserted = 0;
  let rowsRejected = 0;
  let currentBatch = [];
  const sourceFile = path.basename(resolvedPath);

  try {
    const parser = fs.createReadStream(resolvedPath).pipe(csv());

    await new Promise((resolve, reject) => {
      let failed = false;

      const fail = (error) => {
        if (failed) return;
        failed = true;
        reject(error);
      };

      parser.on('data', (row) => {
        parser.pause();

        (async () => {
          const mapped = rowToValues(row);
          rowsProcessed += 1;

          if (!mapped.id_number || !mapped.ward_id || !mapped.vd_number || !mapped.seq_no) {
            rowsRejected += 1;
          } else {
            currentBatch.push(mapped);
          }

          if (currentBatch.length >= BATCH_SIZE) {
            const localBatch = currentBatch;
            currentBatch = [];
            rowsInserted += await flushBatch(localBatch, sourceFile);
          }

          if (rowsProcessed % PROGRESS_FLUSH_EVERY === 0) {
            await updateProgress(jobId, 'running', rowsProcessed, rowsInserted, rowsRejected);
          }

          parser.resume();
        })().catch(fail);
      });

      parser.on('end', async () => {
        try {
          rowsInserted += await flushBatch(currentBatch, sourceFile);
          resolve();
        } catch (error) {
          fail(error);
        }
      });

      parser.on('error', fail);
    });

    await query(
      'UPDATE import_jobs SET status = $2, rows_processed = $3, rows_inserted = $4, rows_rejected = $5, finished_at = NOW(), error_message = NULL WHERE id = $1',
      [jobId, 'completed', rowsProcessed, rowsInserted, rowsRejected]
    );

    return { jobId, rowsProcessed, rowsInserted, rowsRejected };
  } catch (error) {
    await query(
      'UPDATE import_jobs SET status = $2, rows_processed = $3, rows_inserted = $4, rows_rejected = $5, finished_at = NOW(), error_message = $6 WHERE id = $1',
      [jobId, 'failed', rowsProcessed, rowsInserted, rowsRejected, String(error.message || error)]
    );
    throw error;
  }
}

module.exports = {
  importCsv
};
