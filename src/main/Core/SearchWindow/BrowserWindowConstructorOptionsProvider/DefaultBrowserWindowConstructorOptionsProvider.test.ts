import { join } from "path";

import type { AppIconFilePathResolver } from "@Core/AppIconFilePathResolver";
import type { SettingsManager } from "@Core/SettingsManager";
import type { App, BrowserWindowConstructorOptions, Display, Screen } from "electron";
import { describe, expect, it, vi } from "vitest";

import { DefaultBrowserWindowConstructorOptionsProvider } from "./DefaultBrowserWindowConstructorOptionsProvider";
import { defaultWindowSize, minWindowSize } from "./defaultWindowSize";

const createScreen = (workAreaSize: { width: number; height: number }) =>
    <Screen>{ getPrimaryDisplay: () => <Display>{ workAreaSize } };

describe(DefaultBrowserWindowConstructorOptionsProvider, () => {
    describe(DefaultBrowserWindowConstructorOptionsProvider.prototype.get, () => {
        it("should use the default settings", () => {
            const getValueMock = vi.fn();

            const app = <App>{ isPackaged: true };
            const settingsManager = <SettingsManager>{
                getValue: (k: string, d: unknown) => {
                    getValueMock(k, d);
                    return ["window.width", "window.height"].includes(k) ? d : undefined;
                },
            };
            const appIconFilePathResolver = <AppIconFilePathResolver>{
                resolve: () => "appIconFilePath",
            };
            const screen = createScreen({ width: 1920, height: 1080 });

            expect(
                new DefaultBrowserWindowConstructorOptionsProvider(
                    app,
                    settingsManager,
                    appIconFilePathResolver,
                    screen,
                ).get(),
            ).toEqual(<BrowserWindowConstructorOptions>{
                width: defaultWindowSize.width,
                height: defaultWindowSize.height,
                alwaysOnTop: undefined,
                show: undefined,
                frame: false,
                icon: "appIconFilePath",
                webPreferences: {
                    spellcheck: false,
                    preload: join(__dirname, "..", "dist-preload", "index.js"),
                    allowRunningInsecureContent: false,
                    webSecurity: true,
                    devTools: false,
                },
            });

            expect(getValueMock).toHaveBeenCalledWith("window.showOnStartup", true);
            expect(getValueMock).toHaveBeenCalledWith("window.alwaysOnTop", false);
            expect(getValueMock).toHaveBeenCalledWith("window.width", defaultWindowSize.width);
            expect(getValueMock).toHaveBeenCalledWith("window.height", defaultWindowSize.height);
        });

        it("should allow insecure content and disable web security if app is not packaged", () => {
            const app = <App>{ isPackaged: false };
            const settingsManager = <SettingsManager>{
                getValue: (k: string, d: unknown) => (["window.width", "window.height"].includes(k) ? d : undefined),
            };
            const appIconFilePathResolver = <AppIconFilePathResolver>{
                resolve: () => "appIconFilePath",
            };
            const screen = createScreen({ width: 1920, height: 1080 });

            const { webPreferences } = new DefaultBrowserWindowConstructorOptionsProvider(
                app,
                settingsManager,
                appIconFilePathResolver,
                screen,
            ).get();

            expect(webPreferences?.webSecurity).toBe(false);
            expect(webPreferences?.allowRunningInsecureContent).toBe(true);
            expect(webPreferences?.devTools).toBe(true);
        });

        it("should clamp the persisted window size to the primary display's work area", () => {
            const settingsManager = <SettingsManager>{ getValue: () => 5000, updateValue: vi.fn() };
            const app = <App>{ isPackaged: true };
            const appIconFilePathResolver = <AppIconFilePathResolver>{ resolve: () => "appIconFilePath" };
            const screen = createScreen({ width: 1024, height: 768 });

            const { width, height } = new DefaultBrowserWindowConstructorOptionsProvider(
                app,
                settingsManager,
                appIconFilePathResolver,
                screen,
            ).get();

            expect(width).toBe(1024);
            expect(height).toBe(768);
        });

        it("should clamp a persisted size below the minimum window size", () => {
            const settingsManager = <SettingsManager>{ getValue: () => 10, updateValue: vi.fn() };
            const app = <App>{ isPackaged: true };
            const appIconFilePathResolver = <AppIconFilePathResolver>{ resolve: () => "appIconFilePath" };
            const screen = createScreen({ width: 1920, height: 1080 });

            const { width, height } = new DefaultBrowserWindowConstructorOptionsProvider(
                app,
                settingsManager,
                appIconFilePathResolver,
                screen,
            ).get();

            expect(width).toBe(minWindowSize.width);
            expect(height).toBe(minWindowSize.height);
        });

        it("should fall back to the minimum window size for a non-numeric persisted value", () => {
            const settingsManager = <SettingsManager>{ getValue: () => NaN, updateValue: vi.fn() };
            const app = <App>{ isPackaged: true };
            const appIconFilePathResolver = <AppIconFilePathResolver>{ resolve: () => "appIconFilePath" };
            const screen = createScreen({ width: 1920, height: 1080 });

            const { width, height } = new DefaultBrowserWindowConstructorOptionsProvider(
                app,
                settingsManager,
                appIconFilePathResolver,
                screen,
            ).get();

            expect(width).toBe(minWindowSize.width);
            expect(height).toBe(minWindowSize.height);
        });
    });
});
