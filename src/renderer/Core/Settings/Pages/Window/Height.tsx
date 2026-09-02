import { useSetting } from "@Core/Hooks";
import { Setting } from "@Core/Settings/Setting";
import { Input } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const minHeight = 200;

export const Height = () => {
    const { t } = useTranslation("settingsWindow");
    const { value, updateValue } = useSetting({ key: "window.height", defaultValue: 400 });
    const [draftValue, setDraftValue] = useState(value);

    // Keeps the field in sync when the height changes elsewhere, e.g. the user drag-resizing the search window.
    useEffect(() => setDraftValue(value), [value]);

    return (
        <Setting
            label={t("height")}
            control={
                <Input
                    value={`${draftValue}`}
                    min={minHeight}
                    type="number"
                    onChange={(_, { value: newValue }) => setDraftValue(Number(newValue))}
                    onBlur={() => {
                        if (Number.isNaN(draftValue) || draftValue < minHeight) {
                            setDraftValue(value);
                        } else {
                            updateValue(draftValue);
                        }
                    }}
                />
            }
        />
    );
};
