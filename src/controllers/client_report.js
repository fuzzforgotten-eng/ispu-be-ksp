import { prismaClient } from '../application/database.js';
import { logger } from '../application/logger.js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';

const exportDir = path.join(process.cwd(), 'public', 'export');
if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
}

export async function exportExcel2Menit(fromDate, toDate) {
  const rows = await prismaClient.datalogger_refrences_hourly.findMany({
    where: {
      datetime: { gte: fromDate.toJSDate(), lte: toDate.toJSDate() },
      message: { not: null }
    },
    orderBy: { datetime: "asc" }
  });

  

  let parsedData = [];
  rows.forEach(r => {
    try {
      const msg = JSON.parse(r.message.replace(/'/g, '"'));

      if (msg?.data && Array.isArray(msg.data)) {
        msg.data.forEach(d => {
          parsedData.push({
            datetime: DateTime.fromSeconds(d.datetime)
              .setZone("Asia/Jakarta")
              .toFormat("yyyy-MM-dd HH:mm:ss"),
            pH: parseFloat(d.pH) || null,
            cod: parseFloat(d.cod) || null,
            tss: parseFloat(d.tss) || null,
            nh3n: parseFloat(d.nh3n) || null,
            debit: parseFloat(d.debit) || null
          });
        });
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  });

  // Build Excel ke buffer
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data Message");

  sheet.addRow(["DATE", "pH", "COD", "TSS", "NH3-N", "Debit"]);
  parsedData.forEach(row => {
    sheet.addRow([row.datetime, row.pH, row.cod, row.tss, row.nh3n, row.debit]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportExcelPerJam(fromDate, toDate) {
  const rows = await prismaClient.datalogger_refrences_hourly.findMany({
    where: {
      datetime: { gte: fromDate.toJSDate(), lte: toDate.toJSDate() },
      message: { not: null }
    },
    orderBy: { datetime: "asc" }
  });

  let grouped = {};

  rows.forEach(r => {
    try {
      const msg = JSON.parse(r.message.replace(/'/g, '"'));
      if (msg?.data && Array.isArray(msg.data)) {
        msg.data.forEach(d => {
          // bundarkan ke jam
          const hourKey = DateTime.fromSeconds(d.datetime)
            .setZone("Asia/Jakarta")
            .startOf("hour")
            .toFormat("yyyy-MM-dd HH:mm:ss");

          if (!grouped[hourKey]) {
            grouped[hourKey] = {
              count: 0,
              pH: 0,
              cod: 0,
              tss: 0,
              nh3n: 0,
              debit: 0
            };
          }

          grouped[hourKey].count++;
          grouped[hourKey].pH += parseFloat(d.pH) || 0;
          grouped[hourKey].cod += parseFloat(d.cod) || 0;
          grouped[hourKey].tss += parseFloat(d.tss) || 0;
          grouped[hourKey].nh3n += parseFloat(d.nh3n) || 0;
          grouped[hourKey].debit += parseFloat(d.debit) || 0;
        });
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  });

  // rata-rata
  let averagedData = Object.entries(grouped).map(([hourKey, val]) => ({
    datetime: hourKey,
    pH: val.pH / val.count,
    cod: val.cod / val.count,
    tss: val.tss / val.count,
    nh3n: val.nh3n / val.count,
    debit: val.debit / val.count
  }));

  // Build Excel ke buffer
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data Rata-rata Per Jam");

  sheet.addRow(["DATE", "pH", "COD", "TSS", "NH3-N", "Debit"]);
  averagedData.forEach(row => {
    sheet.addRow([row.datetime, row.pH, row.cod, row.tss, row.nh3n, row.debit]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportExcelPerHari(fromDate, toDate) {
  const rows = await prismaClient.datalogger_refrences_hourly.findMany({
    where: {
      datetime: { gte: fromDate.toJSDate(), lte: toDate.toJSDate() },
      message: { not: null }
    },
    orderBy: { datetime: "asc" }
  });

  let grouped = {};

  rows.forEach(r => {
    try {
      const msg = JSON.parse(r.message.replace(/'/g, '"'));
      if (msg?.data && Array.isArray(msg.data)) {
        msg.data.forEach(d => {
          // --- OPSI 1: pakai datetime dari database (aman, sudah difilter)
          const dayKey = DateTime.fromJSDate(r.datetime)
            .setZone("Asia/Jakarta")
            .startOf("day")
            .toFormat("yyyy-MM-dd");

          // --- OPSI 2: kalau mau tetap pakai d.datetime, tambahkan filter
          /*
          const ts = DateTime.fromSeconds(d.datetime).setZone("Asia/Jakarta");
          if (ts < fromDate || ts > toDate) return; // skip kalau tidak sesuai range
          const dayKey = ts.startOf("day").toFormat("yyyy-MM-dd");
          */

          if (!grouped[dayKey]) {
            grouped[dayKey] = {
              count: 0,
              pH: 0,
              cod: 0,
              tss: 0,
              nh3n: 0,
              debit: 0
            };
          }

          grouped[dayKey].count++;
          grouped[dayKey].pH += parseFloat(d.pH) || 0;
          grouped[dayKey].cod += parseFloat(d.cod) || 0;
          grouped[dayKey].tss += parseFloat(d.tss) || 0;
          grouped[dayKey].nh3n += parseFloat(d.nh3n) || 0;
          grouped[dayKey].debit += parseFloat(d.debit) || 0;
        });
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  });

  let averagedData = Object.entries(grouped).map(([dayKey, val]) => ({
    datetime: dayKey,
    pH: val.pH / val.count,
    cod: val.cod / val.count,
    tss: val.tss / val.count,
    nh3n: val.nh3n / val.count,
    debit: val.debit / val.count
  }));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data Rata-rata Per Hari");

  sheet.addRow(["DATE", "pH", "COD", "TSS", "NH3-N", "Debit"]);
  averagedData.forEach(row => {
    sheet.addRow([row.datetime, row.pH, row.cod, row.tss, row.nh3n, row.debit]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}






function differenceTimeLastActivity(updatedAt) {
  return (
    DateTime.now().setZone('Asia/Jakarta').toMillis() -
    DateTime.fromJSDate(updatedAt).setZone('Asia/Jakarta').toMillis()
  ) / 60000; // hasil dalam menit
}
