import { initialData } from "../data/sampleData";
import type { AppData } from "../types";

const STORAGE_KEY = "odakom-oda-management-v1";

export interface DataRepository {
  load(): AppData;
  save(data: AppData): void;
  reset(): AppData;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const localStorageRepository: DataRepository = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(initialData);
    try {
      return { ...clone(initialData), ...JSON.parse(raw) };
    } catch {
      return clone(initialData);
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  reset() {
    const fresh = clone(initialData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
};
