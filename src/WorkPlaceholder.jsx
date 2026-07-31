import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { clearWorkAppCache } from "./workPlaceholder.js";

export function WorkPlaceholder({ onClose }) {
  useEffect(() => {
    clearWorkAppCache(window.localStorage);
  }, []);

  return (
    <section className="full-page work-placeholder-page" aria-label="工作">
      <button className="work-placeholder-back" type="button" onClick={onClose} aria-label="返回桌面">
        <ChevronLeft size={22} />
      </button>
    </section>
  );
}
