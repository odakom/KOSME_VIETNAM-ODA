import type { Role } from "../types";

const CLIENT_ACCESS_KEY = "odakom-client-access";
const ADMIN_ACCESS_KEY = "odakom-admin-access";

export type AuthRole = Extract<Role, "admin" | "client">;

export function isClientOnlyDeploy() {
  return import.meta.env.VITE_CLIENT_ONLY_DEPLOY === "true";
}

function getEnvPassword(key: "VITE_CLIENT_ACCESS_PASSWORD" | "VITE_ADMIN_ACCESS_PASSWORD") {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function hasClientPasswordConfigured() {
  return Boolean(getEnvPassword("VITE_CLIENT_ACCESS_PASSWORD"));
}

export function hasAdminPasswordConfigured() {
  return Boolean(getEnvPassword("VITE_ADMIN_ACCESS_PASSWORD"));
}

export function hasClientAccess() {
  return sessionStorage.getItem(CLIENT_ACCESS_KEY) === "granted";
}

export function hasAdminAccess() {
  return sessionStorage.getItem(ADMIN_ACCESS_KEY) === "granted";
}

export function verifyClientPassword(password: string) {
  const configuredPassword = getEnvPassword("VITE_CLIENT_ACCESS_PASSWORD");
  if (!configuredPassword) return false;
  const isValid = password === configuredPassword;
  if (isValid) sessionStorage.setItem(CLIENT_ACCESS_KEY, "granted");
  return isValid;
}

export function verifyAdminPassword(password: string) {
  const configuredPassword = getEnvPassword("VITE_ADMIN_ACCESS_PASSWORD");
  if (!configuredPassword) return false;
  const isValid = password === configuredPassword;
  if (isValid) sessionStorage.setItem(ADMIN_ACCESS_KEY, "granted");
  return isValid;
}

export function clearClientAccess() {
  sessionStorage.removeItem(CLIENT_ACCESS_KEY);
}

export function clearAdminAccess() {
  sessionStorage.removeItem(ADMIN_ACCESS_KEY);
}
