import { join } from "path";

import type { AppIconFilePathResolver } from "@Core/AppIconFilePathResolver";
import type { SettingsManager } from "@Core/SettingsManager";
import type { App, Screen } from "electron";

import type { BrowserWindowConstructorOptionsProvider } from "./BrowserWindowConstructorOptionsProvider";
import { defaultWindowSize, minWindowSize } from "./defaultWindowSize";

// Guards against a persisted value that is missing, non-numeric (e.g. corrupted or hand-edited settings.json), or
// outside a sane range, and clamps it to the current display's work area so a size persisted on a larger display
// never overflows a smaller one (e.g. after switching monitors or resolutions).
const clamp = (value: number, min: number, max: number): number =>
    Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

export class DefaultBrowserWindowConstructorOptionsProvider implements BrowserWindowConstructorOptionsProvider {
    public constructor(
        private readonly app: App,
        private readonly settingsManager: SettingsManager,
        private readonly appIconFilePathResolver: AppIconFilePathResolver,
        private readonly screen: Screen,
    ) {}

    public get(): Electron.BrowserWindowConstructorOptions {
        const { width: maxWidth, height: maxHeight } = this.screen.getPrimaryDisplay().workAreaSize;

        return {
            width: clamp(
                this.settingsManager.getValue<number>("window.width", defaultWindowSize.width),
                minWindowSize.width,
                maxWidth,
            ),
            height: clamp(
                this.settingsManager.getValue<number>("window.height", defaultWindowSize.height),
                minWindowSize.height,
                maxHeight,
            ),
            frame: false,
            show: this.settingsManager.getValue<boolean>("window.showOnStartup", true),
            webPreferences: {
                preload: join(__dirname, "..", "dist-preload", "index.js"),
                spellcheck: false,

                // The dev tools should only be available in development mode. Once the app is packaged, the dev tools
                // should be disabled.
                devTools: !this.app.isPackaged,

                // The following options are needed for images with `file://` URLs to work during development
                allowRunningInsecureContent: !this.app.isPackaged,
                webSecurity: this.app.isPackaged,
            },
            alwaysOnTop: this.settingsManager.getValue<boolean>("window.alwaysOnTop", false),
            icon: this.appIconFilePathResolver.resolve(),
        };
    }
}
