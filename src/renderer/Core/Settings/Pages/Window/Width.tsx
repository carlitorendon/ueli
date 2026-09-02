import { useSetting } from "@Core/Hooks";
import { Setting } from "@Core/Settings/Setting";
import { Input } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const minWidth = 300;

export const Width = () => {
    const { t } = useTranslation("settingsWindow");
    const { value, updateValue } = useSetting({ key: "window.width", defaultValue: 600 });
    const [draftValue, setDraftValue] = useState(value);

    // Keeps the field in sync when the width changes elsewhere, e.g. the user drag-resizing the search window.
    useEffect(() => setDraftValue(value), [value]);

    return (
        <Setting
            label={t("width")}
            control={
                <Input
                    value={`${draftValue}`}
                    min={minWidth}
                    type="number"
                    onChange={(_, { value: newValue }) => setDraftValue(Number(newValue))}
                    onBlur={() => {
                        if (Number.isNaN(draftValue) || draftValue < minWidth) {
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
