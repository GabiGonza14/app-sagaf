// lib/ros-number.ts — Generación de número único de ROS (RF-01 RE-01)
// Usa UUID v4 + timestamp. El número definitivo se vuelve inmutable al confirmar el envío.
import { randomUUID } from 'node:crypto';

function formatTimestamp(): string {
  const d = new Date();
  const Y = d.getFullYear().toString();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${Y}${M}${D}${h}${m}${s}${ms}`;
}

export function generateNumeroROS(): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 8);
  return `ROS-${uuid}-${formatTimestamp()}`;
}

export function generateNumeroBORRADOR(): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 8);
  return `ROS-BORRADOR-${uuid}`;
}

export function esNumeroBORRADOR(numero: string): boolean {
  return numero.startsWith('ROS-BORRADOR-');
}
