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

  batch.forEach((record) => {
    placeholders.push(`(${cols.map(() => '?').join(',')})`);
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
    ON DUPLICATE KEY UPDATE
      province = VALUES(province),
      municipality = VALUES(municipality),
      vr_section = VALUES(vr_section),
      surname = VALUES(surname),
      full_name = VALUES(full_name),
      voter_status = VALUES(voter_status),
      street_number = VALUES(street_number),
      street_name = VALUES(street_name),
      street_type = VALUES(street_type),
      place_number = VALUES(place_number),
      place_name = VALUES(place_name),
      house_number = VALUES(house_number),
      farm_name = VALUES(farm_name),
      farm_number = VALUES(farm_number),
      location = VALUES(location),
      suburb = VALUES(suburb),
      town = VALUES(town),
      res_postal_code = VALUES(res_postal_code),
      source_file = VALUES(source_file),
      imported_at = CURRENT_TIMESTAMP
  `;

  await query(sql, values);
  return batch.length;
}

async function updateProgress(jobId, status, rowsProcessed, rowsInserted, rowsRejected, errorMessage = null) {
  await query(
    'UPDATE import_jobs SET status = ?, rows_processed = ?, rows_inserted = ?, rows_rejected = ?, error_message = ? WHERE id = ?',
    [status, rowsProcessed, rowsInserted, rowsRejected, errorMessage, jobId]
  );
}

async function importCsv(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const startJob = await query(
    'INSERT INTO import_jobs (file_path, status) VALUES (?, ?)',
    [resolvedPath, 'running']
  );
  const jobId = startJob.insertId;

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
      'UPDATE import_jobs SET status = ?, rows_processed = ?, rows_inserted = ?, rows_rejected = ?, finished_at = CURRENT_TIMESTAMP, error_message = NULL WHERE id = ?',
      ['completed', rowsProcessed, rowsInserted, rowsRejected, jobId]
    );

    return { jobId, rowsProcessed, rowsInserted, rowsRejected };
  } catch (error) {
    await query(
      'UPDATE import_jobs SET status = ?, rows_processed = ?, rows_inserted = ?, rows_rejected = ?, finished_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?',
      ['failed', rowsProcessed, rowsInserted, rowsRejected, String(error.message || error), jobId]
    );
    throw error;
  }
}

module.exports = {
  importCsv
};
