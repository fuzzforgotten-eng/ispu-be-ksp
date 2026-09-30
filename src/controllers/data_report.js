import { logger } from '../application/logger.js';
import { DateTime } from 'luxon';
import { prismaClient } from '../application/database.js';


export async function processSensorTableData(options = {}) {
  const {
    user_id,
    station,
    from_date,
    to_date,
    parameter,
    page = 1,
    per_page = 20,
  } = options;

  if (!user_id || !station || !from_date || !to_date) {
    logger.info(`[SKIP] invalid params user_id: ${user_id}, station: ${station}`);
    return null;
  }

  const fromDate = DateTime.fromISO(from_date, { zone: 'utc' }).setZone('Asia/Jakarta');
  const toDate = DateTime.fromISO(to_date, { zone: 'utc' }).setZone('Asia/Jakarta');

  if (!fromDate.isValid || !toDate.isValid) {
    logger.error(`[ERROR] Invalid DateTime: from=${fromDate.toISO()} to=${toDate.toISO()}`);
    return null;
  }

  const data = typeof station === 'string' ? JSON.parse(station) : station;

  if (!data?.module_id || !data?.station_id) {
    logger.warn(`[SKIP] module_id or station_id is null. Payload: ${JSON.stringify(data)}`);
    return null;
  }

  const moduleApp = await prismaClient.module_apps.findUnique({
    where: { id: BigInt(data.module_id) }
  });
  const stationData = await prismaClient.stations.findUnique({
    where: { id: BigInt(data.station_id) }
  });

  if (!moduleApp || !stationData) {
    logger.warn(`[SKIP] Module or Station not found`);
    return null;
  }

  let sensors = await prismaClient.sensors.findMany({
    where: {
      module_app_id: data.module_id,
      station_id: data.station_id
    }
  });

  if (parameter) {
    const selected = sensors.find(s => s.name === parameter);
    if (!selected) {
      logger.warn(`Sensor ${parameter} tidak ditemukan`);
      return null;
    }
    sensors = [selected];
  }

  let ticks = await prismaClient.ticks3.findMany({
    where: {
      sensor_id: { in: sensors.map(s => s.id) },
      created_at: {
        gte: fromDate.toJSDate(),
        lte: toDate.toJSDate()
      }
    },
    orderBy: { created_at: 'desc' },
    select: {      
      created_at: true,
      value: true,
      sensors: { select: { name: true } }
    }
  });


  if (ticks.length === 0) {
    logger.info(`[INFO] Tidak ada data hari ini (${fromDate.toFormat('yyyy-MM-dd')}), ambil data terakhir per sensor...`);
  
    const lastTicks = [];
  
    for (const sensor of sensors) {
      const last = await prismaClient.ticks3.findFirst({
        where: { sensor_id: sensor.id },
        orderBy: { created_at: 'desc' },
        select: {
          created_at: true,
          value: true,
          sensors: { select: { name: true } }
        }
      });
      if (last) lastTicks.push(last);
    }
  
    ticks = lastTicks;
  }


  const grouped = {};

  for (const tick of ticks) {
    const time = DateTime.fromJSDate(tick.created_at)
      .setZone('Asia/Jakarta')
      .toFormat('dd/MM/yyyy HH:mm');

    const param = tick.sensors.name;
    const val = parseFloat(tick.value);

    if (!grouped[time]) grouped[time] = { waktu: time };
    grouped[time][param] = val;
  }

  const fullResult = Object.entries(grouped).map(([_, row]) => ({
    stasiun: stationData.name,
    ...row
  }));

  const total = fullResult.length;
  const total_pages = Math.ceil(total / per_page);
  const start = (page - 1) * per_page;
  const paginated = fullResult.slice(start, start + per_page);

  return {
    data: paginated,
    page,
    per_page,
    total,
    total_pages,
    last_updated: ticks[0] ? ticks[0].created_at : null
  };
}


export async function processSensorTableDataWeather(options = {}) {
  const {
    user_id,
    station,
    from_date,
    to_date,
    parameter,
    page = 1,
    per_page = 20,
  } = options;

  if (!user_id || !station || !from_date || !to_date) {
    logger.info(`[SKIP] invalid params user_id: ${user_id}, station: ${station}`);
    return null;
  }

  const fromDate = DateTime.fromISO(from_date, { zone: 'utc' }).setZone('Asia/Jakarta');
  const toDate = DateTime.fromISO(to_date, { zone: 'utc' }).setZone('Asia/Jakarta');

  if (!fromDate.isValid || !toDate.isValid) {
    logger.error(`[ERROR] Invalid DateTime: from=${fromDate.toISO()} to=${toDate.toISO()}`);
    return null;
  }

const data = typeof station === 'string' ? JSON.parse(station) : station;

if (!data?.module_id || !data?.station_id) {
  logger.warn(`[SKIP] module_id or station_id is null. Payload: ${JSON.stringify(data)}`);
  return null;
}

const moduleApp = await prismaClient.module_apps.findUnique({
  where: { id: BigInt(data.module_id) }
});
const stationData = await prismaClient.stations.findUnique({
  where: { id: BigInt(data.station_id) }
});

if (!moduleApp || !stationData) {
  logger.warn(`[SKIP] Module or Station not found`);
  return null;
}

  let sensors = await prismaClient.sensors.findMany({
    where: {
      module_app_id: data.module_id,
      station_id: data.station_id
    }
  });

  console.log("Sensor list:", sensors.map(s => s.name));

  if (parameter) {
    const selected = sensors.find(s => s.name === parameter);
    if (!selected) {
      logger.warn(`Sensor ${parameter} tidak ditemukan`);
      return null;
    }
    sensors = [selected];
  }

  const ticks = await prismaClient.ticks.findMany({
    where: {
      sensor_id: { in: sensors.map(s => s.id) },
      created_at: { gte: fromDate.toJSDate(), lte: toDate.toJSDate() }
    },
    orderBy: { created_at: 'desc' },
    select: {      
      created_at: true,
      value: true,
      sensors: { select: { name: true } }
    }
  });

  const grouped = {};

  for (const tick of ticks) {
    const time = DateTime.fromJSDate(tick.created_at).setZone('Asia/Jakarta').toFormat('dd/MM/yyyy HH:mm');
    const param = tick.sensors.name;
    const val = parseFloat(tick.value);

    if (!grouped[time]) grouped[time] = { waktu: time };
    grouped[time][param] = val;
  }

    const allParams = sensors.map(s => s.name);
    
    const fullResult = Object.entries(grouped).map(([_, row]) => {
      const filled = {};
      for (const param of allParams) {
        filled[param] = row[param] ?? null;
      }
      return {
        stasiun: stationData.name,
        ...row,
        ...filled,
      };
    });

  const total = fullResult.length;
  const total_pages = Math.ceil(total / per_page);
  const start = (page - 1) * per_page;
  const paginated = fullResult.slice(start, start + per_page);

  return {
    data: paginated,
    page,
    per_page,
    total,
    total_pages
  };
}