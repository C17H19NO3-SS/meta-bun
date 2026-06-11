import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { PluginManager } from "../../plugin-system/manager";
import type { Timer } from "../../shared/types/bridge";

/**
 * Periodic Auto-Updater Service
 * 
 * Polls a remote URL for gamedata updates, stages them, and applies them on map change.
 */
export class UpdaterService {
    private url: string;
    private interval: number; // in hours
    private gamedataPath: string;
    private stagedPath: string;
    private timer: Timer | null = null;
    private hasStagedUpdate: boolean = false;

    /**
     * Creates a new instance of UpdaterService.
     * 
     * @param pluginManager The PluginManager instance for logging and events.
     * @param settings The application settings containing updater config.
     */
    constructor(private pluginManager: PluginManager, settings: any) {
        this.url = settings.updater?.url;
        this.interval = settings.updater?.interval || 24;
        
        // Paths relative to project root
        // Live file: addons/meta-bun/gamedata.txt
        const baseAddonPath = join(process.cwd(), "addons", "meta-bun");
        this.gamedataPath = join(baseAddonPath, "gamedata.txt");
        
        // Staged file: dist/staged_gamedata.txt
        this.stagedPath = join(process.cwd(), "dist", "staged_gamedata.txt");

        // Ensure addon path exists for live file
        if (!existsSync(baseAddonPath)) {
            mkdirSync(baseAddonPath, { recursive: true });
        }

        // Apply staged update on map change
        this.pluginManager.on("MapStart", () => {
            this.applyStagedUpdate();
        });
    }

    /**
     * Starts the periodic update polling.
     */
    public start(): void {
        if (!this.url) {
            this.pluginManager.LogMessage("[Updater] URL not configured, skipping auto-update.", "warn");
            return;
        }

        this.pluginManager.LogMessage(`[Updater] Service started. Polling every ${this.interval} hours.`, "info");
        
        // Check for staged updates that might have been left from a previous run
        if (existsSync(this.stagedPath)) {
            this.hasStagedUpdate = true;
            this.pluginManager.LogMessage("[Updater] Found previously staged update, it will be applied on next map change.", "info");
        }

        // Initial check
        this.checkForUpdates().catch(err => {
            this.pluginManager.LogMessage(`[Updater] Initial check failed: ${err}`, "error");
        });

        // Schedule periodic checks
        const intervalMs = this.interval * 60 * 60 * 1000;
        this.timer = setInterval(() => {
            this.checkForUpdates().catch(err => {
                this.pluginManager.LogMessage(`[Updater] Periodic check failed: ${err}`, "error");
            });
        }, intervalMs);
    }

    /**
     * Stops the periodic update polling.
     */
    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Checks for updates by fetching the remote gamedata and comparing hashes.
     */
    private async checkForUpdates(): Promise<void> {
        try {
            this.pluginManager.LogMessage(`[Updater] Checking for updates at ${this.url}...`, "info");
            const response = await fetch(this.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch gamedata: ${response.statusText} (${response.status})`);
            }

            const newContent = await response.text();
            if (!newContent || newContent.trim().length === 0) {
                throw new Error("Received empty content from updater URL");
            }

            const newHash = this.calculateHash(newContent);

            let currentHash = "";
            if (existsSync(this.gamedataPath)) {
                const currentContent = readFileSync(this.gamedataPath, "utf-8");
                currentHash = this.calculateHash(currentContent);
            }

            if (newHash !== currentHash) {
                this.pluginManager.LogMessage("[Updater] New gamedata detected! Staging update...", "success");
                
                // Ensure dist exists for staged file
                const distPath = join(process.cwd(), "dist");
                if (!existsSync(distPath)) {
                    mkdirSync(distPath, { recursive: true });
                }

                writeFileSync(this.stagedPath, newContent);
                this.hasStagedUpdate = true;
                this.pluginManager.LogMessage(`[Updater] Update staged at ${this.stagedPath}. It will be applied on the next map change.`, "info");
            } else {
                this.pluginManager.LogMessage("[Updater] Gamedata is up to date.", "info");
            }
        } catch (err) {
            this.pluginManager.LogMessage(`[Updater] Update check failed: ${err}`, "error");
        }
    }

    /**
     * Calculates the SHA256 hash of a string.
     */
    private calculateHash(content: string): string {
        return createHash("sha256").update(content).digest("hex");
    }

    /**
     * Swaps the staged gamedata with the live gamedata file.
     */
    private applyStagedUpdate(): void {
        if (this.hasStagedUpdate && existsSync(this.stagedPath)) {
            try {
                this.pluginManager.LogMessage("[Updater] Applying staged gamedata update...", "info");
                renameSync(this.stagedPath, this.gamedataPath);
                this.hasStagedUpdate = false;
                this.pluginManager.LogMessage("[Updater] Gamedata update applied successfully.", "success");
            } catch (err) {
                this.pluginManager.LogMessage(`[Updater] Failed to apply gamedata update: ${err}`, "error");
            }
        }
    }
}
