import type { OperatingSystem, SearchResultItemAction } from "@common/Core";
import type { UeliModuleRegistry } from "@Core/ModuleRegistry";
import type { UeliCommandInvokedEvent } from "@Core/UeliCommand";
import { BrowserWindow } from "electron";

import type { BrowserWindowConstructorOptionsProvider } from "./BrowserWindowConstructorOptionsProvider";
import {
    DefaultBrowserWindowConstructorOptionsProvider,
    LinuxBrowserWindowConstructorOptionsProvider,
    MacOsBrowserWindowConstructorOptionsProvider,
    WindowsBrowserWindowConstructorOptionsProvider,
} from "./BrowserWindowConstructorOptionsProvider";
import { minWindowSize } from "./BrowserWindowConstructorOptionsProvider/defaultWindowSize";
import { BrowserWindowToggler } from "./BrowserWindowToggler";

export class SearchWindowModule {
    private static readonly DefaultHideWindowOnOptions = ["blur", "afterInvocation", "escapePressed"];

    public static async bootstrap(moduleRegistry: UeliModuleRegistry) {
        const app = moduleRegistry.get("App");
        const appIconFilePathResolver = moduleRegistry.get("AppIconFilePathResolver");
        const backgroundMaterialProvider = moduleRegistry.get("BrowserWindowBackgroundMaterialProvider");
        const eventSubscriber = moduleRegistry.get("EventSubscriber");
        const htmlLoader = moduleRegistry.get("BrowserWindowHtmlLoader");
        const ipcMain = moduleRegistry.get("IpcMain");
        const nativeTheme = moduleRegistry.get("NativeTheme");
        const operatingSystem = moduleRegistry.get("OperatingSystem");
        const screen = moduleRegistry.get("Screen");
        const settingsManager = moduleRegistry.get("SettingsManager");
        const vibrancyProvider = moduleRegistry.get("BrowserWindowVibrancyProvider");
        const browserWindowRegistry = moduleRegistry.get("BrowserWindowRegistry");
        const ueliCommandInvoker = moduleRegistry.get("UeliCommandInvoker");

        const defaultBrowserWindowOptions = new DefaultBrowserWindowConstructorOptionsProvider(
            app,
            settingsManager,
            appIconFilePathResolver,
            screen,
        ).get();

        const browserWindowConstructorOptionsProviders: Record<
            OperatingSystem,
            BrowserWindowConstructorOptionsProvider
        > = {
            Linux: new LinuxBrowserWindowConstructorOptionsProvider(defaultBrowserWindowOptions),
            macOS: new MacOsBrowserWindowConstructorOptionsProvider(defaultBrowserWindowOptions, vibrancyProvider),
            Windows: new WindowsBrowserWindowConstructorOptionsProvider(
                defaultBrowserWindowOptions,
                backgroundMaterialProvider,
            ),
        };

        const searchWindow = new BrowserWindow(browserWindowConstructorOptionsProviders[operatingSystem].get());

        searchWindow.on("close", () => browserWindowRegistry.getById("settings")?.close());

        // Distinguishes a resize we triggered ourselves (applying a persisted setting) from a manual drag-resize by
        // the user, so the two don't keep re-triggering each other in an infinite loop. This can't be done by
        // comparing sizes (Windows' DPI scaling can make `getSize()` return a slightly different value than what was
        // just passed to `setSize()`, which would let a self-triggered resize slip through as if it were a user one).
        let isApplyingProgrammaticResize = false;
        let resizeDebounceTimeout: NodeJS.Timeout;

        const applySize = (width: number, height: number) => {
            isApplyingProgrammaticResize = true;
            searchWindow.setSize(width, height);
            setImmediate(() => {
                isApplyingProgrammaticResize = false;
            });
        };

        searchWindow.on("resize", () => {
            if (isApplyingProgrammaticResize) {
                return;
            }

            clearTimeout(resizeDebounceTimeout);

            resizeDebounceTimeout = setTimeout(() => {
                const [width, height] = searchWindow.getSize();
                settingsManager.updateValue("window.width", width);
                settingsManager.updateValue("window.height", height);
            }, 300);
        });

        browserWindowRegistry.register("search", searchWindow);

        searchWindow.setVisibleOnAllWorkspaces(settingsManager.getValue("window.visibleOnAllWorkspaces", false));

        if (app.isPackaged) {
            searchWindow.removeMenu();
        }

        const browserWindowToggler = new BrowserWindowToggler(
            operatingSystem,
            app,
            searchWindow,
            browserWindowRegistry,
        );

        nativeTheme.on("updated", () => searchWindow.setIcon(appIconFilePathResolver.resolve()));

        const settingsWindowIsVisible = () => {
            const settingsWindow = browserWindowRegistry.getById("settings");
            return settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible();
        };

        const shouldHideWindowOnBlur = () =>
            settingsManager
                .getValue("window.hideWindowOn", SearchWindowModule.DefaultHideWindowOnOptions)
                .includes("blur") && !settingsWindowIsVisible();

        searchWindow.on("blur", () => shouldHideWindowOnBlur() && browserWindowToggler.hide());

        const shouldHideWindowAfterInvocation = (action: SearchResultItemAction) =>
            action.hideWindowAfterInvocation &&
            settingsManager
                .getValue("window.hideWindowOn", SearchWindowModule.DefaultHideWindowOnOptions)
                .includes("afterInvocation");

        const shouldHideWindowOnEscapePressed = () =>
            settingsManager
                .getValue("window.hideWindowOn", SearchWindowModule.DefaultHideWindowOnOptions)
                .includes("escapePressed");

        eventSubscriber.subscribe("settingsWindowClosed", () => {
            if (searchWindow.isVisible() && !searchWindow.isFocused()) {
                browserWindowToggler.showAndFocus();
            }
        });

        eventSubscriber.subscribe("actionInvocationStarted", ({ action }: { action: SearchResultItemAction }) => {
            if (shouldHideWindowAfterInvocation(action)) {
                browserWindowToggler.hide();
            }
        });

        eventSubscriber.subscribe("hotkeyPressed", () => browserWindowToggler.toggle());

        eventSubscriber.subscribe("settingUpdated", ({ key, value }: { key: string; value: unknown }) => {
            searchWindow.webContents.send(`settingUpdated[${key}]`, { value });
        });

        eventSubscriber.subscribe("settingUpdated[window.alwaysOnTop]", ({ value }: { value: boolean }) => {
            searchWindow.setAlwaysOnTop(value);
        });

        eventSubscriber.subscribe("settingUpdated[window.backgroundMaterial]", () => {
            const backgroundMaterial = backgroundMaterialProvider.get();

            if (backgroundMaterial) {
                searchWindow.setBackgroundMaterial(backgroundMaterial);
            }
        });

        eventSubscriber.subscribe("settingUpdated[window.vibrancy]", () => {
            searchWindow.setVibrancy(vibrancyProvider.get());
        });

        eventSubscriber.subscribe("settingUpdated[window.visibleOnAllWorkspaces]", ({ value }: { value: boolean }) => {
            searchWindow.setVisibleOnAllWorkspaces(value);
        });

        eventSubscriber.subscribe("settingUpdated[window.width]", ({ value }: { value: number }) => {
            if (Number.isFinite(value) && value >= minWindowSize.width) {
                applySize(value, searchWindow.getSize()[1]);
            }
        });

        eventSubscriber.subscribe("settingUpdated[window.height]", ({ value }: { value: number }) => {
            if (Number.isFinite(value) && value >= minWindowSize.height) {
                applySize(searchWindow.getSize()[0], value);
            }
        });

        ipcMain.on("escapePressed", () => shouldHideWindowOnEscapePressed() && browserWindowToggler.hide());
        ipcMain.on("rescanExtensionsKeyboardShortcutPressed", () =>
            ueliCommandInvoker.invokeUeliCommand("rescanExtensions"),
        );

        app.on("second-instance", (_, argv) => {
            if (argv.includes("--toggle")) {
                browserWindowToggler.toggle();
            } else {
                browserWindowToggler.showAndFocus();
            }
        });

        eventSubscriber.subscribe("ueliCommandInvoked", ({ ueliCommand }: UeliCommandInvokedEvent<unknown>) => {
            const map: Record<string, () => void> = {
                show: () => browserWindowToggler.showAndFocus(),
                centerWindow: () => searchWindow.center(),
            };

            if (Object.keys(map).includes(ueliCommand)) {
                map[ueliCommand]();
            }
        });

        await htmlLoader.loadHtmlFile(searchWindow, "search.html");
    }
}
