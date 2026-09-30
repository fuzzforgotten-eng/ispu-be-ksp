import { logger } from '../application/logger.js';
import { DateTime } from 'luxon';
import { prismaClient } from '../application/database.js';

export async function processMonitorData(options = {}) {
  const { user_id, station, from_date, to_date, parameter } = options;

  if (!user_id || !station || !from_date || !to_date) {
    logger.info(`[SKIP] invalid params user_id: ${user_id}, station: ${station}`);
    return null;
  }

    const fromDate = DateTime.fromISO(from_date, { zone: "Asia/Jakarta" }).toUTC();
    const toDate   = DateTime.fromISO(to_date, { zone: "Asia/Jakarta" }).toUTC();



  if (!fromDate.isValid || !toDate.isValid) {
    logger.error(`[ERROR] Invalid DateTime: from=${fromDate.toISO()} to=${toDate.toISO()}`);
    return null;
  }

  const data = typeof station === 'string' ? JSON.parse(station) : station;

  const moduleApp = await prismaClient.module_apps.findUnique({
    where: { id: data.module_id }
  });
  const stationData = await prismaClient.stations.findUnique({
    where: { id: data.station_id }
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

  const ticks = await prismaClient.ticks.findMany({
    where: {
      sensor_id: { in: sensors.map(s => s.id) },
      created_at: { gte: fromDate.toJSDate(), lte: toDate.toJSDate() }
    },
    orderBy: { created_at: 'desc' },
    select: {
      created_at: true,
      value: true,
      sensor_id: true,
      sensors: { select: { name: true } }
    }
  });

  if (!ticks.length) return null;

  const results = {};
  let lastTime = null;

  for (const tick of ticks) {
    const sensorName = tick.sensors.name;
    if (!results[sensorName]) {
      results[sensorName] = parseFloat(tick.value);

      if (!lastTime || tick.created_at > lastTime) {
        lastTime = tick.created_at;
      }
    }
  }

  return {
    stasiun: stationData.name,
    waktu: DateTime.fromJSDate(lastTime).setZone("Asia/Jakarta").toFormat("dd/MM/yyyy HH:mm"),
    ...results
  };
}


export async function processChartMonitorData(options = {}) {
  const { user_id, station, from_date, to_date, parameter } = options;

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

  const moduleApp = await prismaClient.module_apps.findUnique({
    where: { id: data.module_id }
  });
  const stationData = await prismaClient.stations.findUnique({
    where: { id: data.station_id }
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

  const ticks = await prismaClient.ticks1.findMany({
    where: {
      sensor_id: { in: sensors.map(s => s.id) },
      created_at: { gte: fromDate.toJSDate(), lte: toDate.toJSDate() }
    },
    orderBy: { created_at: 'asc' },
    select: {
      created_at: true,
      value: true,
      sensor_id: true,
      sensors: { select: { name: true } }
    }
  });

  if (!ticks.length) return null;

  // Susun hasil jadi array per sensor
  const results = {};
  for (const tick of ticks) {
    const sensorName = tick.sensors.name;
    if (!results[sensorName]) results[sensorName] = [];
    results[sensorName].push({
      waktu: DateTime.fromJSDate(tick.created_at).setZone('Asia/Jakarta').toFormat('dd/MM/yyyy HH:mm'),
      value: parseFloat(tick.value)
    });
  }

  return {
    stasiun: stationData.name,
    data: results
  };
}

