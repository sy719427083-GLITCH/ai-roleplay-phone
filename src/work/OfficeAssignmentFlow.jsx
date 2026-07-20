import { useEffect, useState } from "react";
import { ArrowLeft, Link as LinkIcon, Upload } from "lucide-react";
import { OFFICE_CHIBIS } from "./pixi/officeAssetManifest.js";
import { OFFICE_ANIMATION_REASON_MESSAGES } from "./officeAnimatedAssets.js";

const RADIO_PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);
const RADIO_NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const isAcceptedManifestSource = (value) => {
  const source = cleanText(value);
  if (!source) return true;
  return /^https?:\/\/\S+$/i.test(source)
    && !/\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(source);
};

const getNextRadioIndex = (currentIndex, key, itemCount) => {
  if (!itemCount) return -1;
  if (RADIO_PREVIOUS_KEYS.has(key)) return (currentIndex - 1 + itemCount) % itemCount;
  if (RADIO_NEXT_KEYS.has(key)) return (currentIndex + 1) % itemCount;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  return -1;
};

function AssignmentEditor({
  assignment,
  errorMessage,
  occupiedProfiles,
  onChibiChange,
  onCustomDraftChange,
  onCustomManifestSubmit,
  onProfileChange,
  onUpload,
  profiles,
  slot,
}) {
  const compatibleChibis = OFFICE_CHIBIS.filter((chibi) => chibi.kind === slot.kind).slice(0, 8);
  const profileOptions = slot.kind === "boss" ? profiles.bossOptions : profiles.employeeOptions;
  const selectedProfileId = assignment.profile?.generated ? "" : assignment.profileId;
  const [customDraft, setCustomDraft] = useState(assignment.customManifestUrl || "");
  const isInvalidDraft = !isAcceptedManifestSource(customDraft);
  const visibleError = isInvalidDraft ? OFFICE_ANIMATION_REASON_MESSAGES["still-image"] : cleanText(errorMessage);
  const errorId = `${slot.id}-asset-error`;
  const selectedChibiIndex = compatibleChibis.findIndex((chibi) => chibi.id === assignment.chibiId);
  const rovingChibiIndex = selectedChibiIndex >= 0 ? selectedChibiIndex : 0;

  useEffect(() => {
    setCustomDraft(assignment.customManifestUrl || "");
  }, [assignment.customManifestUrl]);

  const submitManifestDraft = () => {
    if (isInvalidDraft) return;
    onCustomManifestSubmit?.(slot.id, customDraft);
  };

  const handleChibiKeyDown = (event, index) => {
    const nextIndex = getNextRadioIndex(index, event.key, compatibleChibis.length);
    if (nextIndex < 0) return;
    event.preventDefault();
    onChibiChange(slot.id, compatibleChibis[nextIndex].id);
    event.currentTarget.parentElement
      ?.querySelectorAll("[role='radio']")
      ?.[nextIndex]
      ?.focus();
  };

  return (
    <div className="office-assignment-editor">
      <div className="office-assignment-row-heading">
        <div>
          <h3>{slot.label}</h3>
          <span>{assignment.profile?.name || "NPC"}</span>
        </div>
        <select
          aria-label={`${slot.label}角色`}
          value={selectedProfileId}
          onChange={(event) => onProfileChange(slot.id, event.target.value)}
        >
          <option value="">NPC</option>
          {profileOptions.map((profile) => {
            const occupiedSlot = occupiedProfiles.get(profile.id);
            const occupiedElsewhere = occupiedSlot && occupiedSlot !== slot.id;
            return (
              <option key={profile.id} value={profile.id} disabled={occupiedElsewhere}>
                {profile.name}{occupiedElsewhere ? "（已安排）" : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div className="office-chibi-picker" role="radiogroup" aria-label={`${slot.label}形象`}>
        {compatibleChibis.map((chibi, index) => (
          <button
            key={chibi.id}
            type="button"
            className="office-chibi-option"
            data-selected={assignment.chibiId === chibi.id}
            aria-checked={assignment.chibiId === chibi.id}
            aria-label={chibi.name}
            role="radio"
            tabIndex={index === rovingChibiIndex ? 0 : -1}
            title={chibi.name}
            onClick={() => onChibiChange(slot.id, chibi.id)}
            onKeyDown={(event) => handleChibiKeyDown(event, index)}
          >
            <span style={{
              backgroundImage: `url(${chibi.src})`,
              backgroundSize: "400% 100%",
              backgroundPosition: "0 0",
            }}></span>
          </button>
        ))}
      </div>

      <div className="office-custom-asset-controls">
        <label
          className="office-upload-command"
          title="上传动画清单或 ZIP 动画包"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.currentTarget.querySelector("input")?.click();
          }}
        >
          <Upload size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>上传动画包</span>
          <input
            type="file"
            accept="application/json,application/zip,.json,.zip"
            aria-label={`${slot.label}上传动画清单或 ZIP 动画包`}
            aria-describedby={visibleError ? errorId : undefined}
            tabIndex={-1}
            onChange={(event) => onUpload(slot.id, event)}
          />
        </label>
        <label className="office-asset-url-field" title="动画清单地址">
          <LinkIcon size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">{slot.label}动画清单地址</span>
          <input
            type="text"
            inputMode="url"
            value={customDraft}
            aria-label={`${slot.label}动画清单地址`}
            aria-invalid={isInvalidDraft || undefined}
            aria-describedby={visibleError ? errorId : undefined}
            placeholder="动画 manifest URL"
            onChange={(event) => {
              setCustomDraft(event.target.value);
              onCustomDraftChange(slot.id, event.target.value);
            }}
            onBlur={submitManifestDraft}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              submitManifestDraft();
            }}
          />
        </label>
      </div>
      {visibleError && <p className="office-field-error" id={errorId} role="alert">{visibleError}</p>}
    </div>
  );
}

export default function OfficeAssignmentFlow({
  view,
  selectedSlotId,
  slots,
  assignments,
  assignmentErrors = {},
  profiles,
  occupiedProfiles,
  onOpenSlot,
  onBack,
  onProfileChange,
  onChibiChange,
  onUpload,
  onCustomDraftChange,
  onCustomManifestSubmit,
}) {
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId);
  const showSelection = view === "selection" && selectedSlot;

  return (
    <>
      <header className="office-assignment-header">
        <button
          type="button"
          className="work-icon-button"
          aria-label={showSelection ? "返回员工安排" : "返回办公室"}
          title="返回"
          data-office-dialog-close="true"
          onClick={onBack}
        >
          <ArrowLeft size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <div>
          <h2>{showSelection ? selectedSlot.label : "员工安排"}</h2>
          <span>{showSelection ? "选择角色与形象" : `${slots.length} 个工位`}</span>
        </div>
        <span className="office-assignment-header-spacer" aria-hidden="true"></span>
      </header>

      {showSelection ? (
        <div className="office-assignment-scroll">
          <AssignmentEditor
            slot={selectedSlot}
            assignment={assignments[selectedSlot.id]}
            errorMessage={assignmentErrors[selectedSlot.id]}
            profiles={profiles}
            occupiedProfiles={occupiedProfiles}
            onProfileChange={onProfileChange}
            onChibiChange={onChibiChange}
            onUpload={onUpload}
            onCustomDraftChange={onCustomDraftChange}
            onCustomManifestSubmit={onCustomManifestSubmit}
          />
        </div>
      ) : (
        <div className="office-assignment-overview">
          {slots.map((slot) => (
            <button key={slot.id} type="button" onClick={() => onOpenSlot(slot.id)}>
              <span>{slot.label}</span>
              <strong>{assignments[slot.id]?.profile?.name || "NPC"}</strong>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
