import type { AppDefinition, AppId } from "@/core/types";
import appsData from "./apps.json";

/**
 * Central registry of every application Anchoran ships with, loaded
 * from apps.json — the same file `scripts/generate-webstore-registry.cjs`
 * reads to publish each release's Webstore catalog (see
 * src/applications/webstoreRegistry.ts). Keeping one JSON file as the
 * source for both means the Webstore's remote catalog and Anchoran's
 * own local app list can never drift apart.
 */
export const APP_LIST: AppDefinition[] = appsData as AppDefinition[];

export const APP_REGISTRY: Record<AppId, AppDefinition> = Object.fromEntries(
  APP_LIST.map((app) => [app.id, app])
) as Record<AppId, AppDefinition>;
