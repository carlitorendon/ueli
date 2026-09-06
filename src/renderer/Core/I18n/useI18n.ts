import { use } from "i18next";
import { initReactI18next } from "react-i18next";

import { createResources } from "./createResources";
import { getCoreResources } from "./getCoreResources";
import { getExtensionResources } from "./getExtensionResources";

// i18next only needs to be initialized once per window. Live language changes are already handled separately via
// `i18next.changeLanguage` (see Language.tsx and App.tsx's `settingUpdated[general.language]` listener), so calling
// `.init()` again on every render is not just wasted work — it also triggers i18next's change events, which
// forces every `useTranslation()` consumer (including sibling components) to update while this component is still
// rendering. React can't apply a sibling's update mid-render, so it schedules a fresh render of the parent to
// reconcile it — which calls `useI18n()` again, `.init()` again, and repeats indefinitely.
let isInitialized = false;

export const useI18n = () => {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

    return use(initReactI18next).init({
        resources: createResources([
            ...getCoreResources(),
            ...getExtensionResources(window.ContextBridge.getExtensionResources()),
        ]),
        lng: window.ContextBridge.getSettingValue("general.language", "en-US"),
        fallbackLng: "en-US",
    });
};
