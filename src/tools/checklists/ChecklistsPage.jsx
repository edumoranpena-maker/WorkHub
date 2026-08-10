/**
 * ChecklistsPage.jsx
 *
 * The Checklist Tool's single entry point — wired into Tools.jsx's TOOLS
 * registry exactly like RiskCalculatorPage. Owns local navigation between
 * four screens (library / detail / create / edit) as plain component state,
 * same pattern Post.jsx uses for openThread/openSubtema — NOT a new
 * app-level route or portal system. ToolPortal (Tools.jsx) already supplies
 * the "← Tools" topbar and the fullscreen overlay chrome; this only adds a
 * lightweight "← Checklists" back link for its own internal library↔detail
 * navigation, same as how Thread has its own back arrow inside Post's
 * already-open portal.
 */
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { PageContainer } from "../../lib/layout.jsx";
import { fetchChecklists, fetchChecklistById, createChecklist, updateChecklist, deleteChecklist } from "../../lib/checklistsApi.js";
import ChecklistLibrary from "./ChecklistLibrary.jsx";
import ChecklistDetail from "./ChecklistDetail.jsx";
import ChecklistEditor from "./ChecklistEditor.jsx";

const font = "'DM Sans', sans-serif";
const C = { bg: "#000000", border: "#1c1c2e", text: "#fafafa", gold: "#d4a843" };

export default function ChecklistsPage({ isDesktop: isDesktopProp }) {
  // ToolPortal (Tools.jsx) already computes isDesktop once for the whole
  // portal and passes it down — this used to keep its own separate
  // window-resize listener on top of that, a straight-up duplicate of a
  // system that already exists one level up (Tools.jsx's own useIsDesktop,
  // AND ToolPortal's own second one — three concurrent listeners for the
  // exact same value). The `?? true` fallback only matters if this is ever
  // rendered standalone outside ToolPortal (e.g. in isolation for testing).
  const isDesktop = isDesktopProp ?? true;
  const [screen, setScreen] = useState("library"); // "library" | "detail" | "create" | "edit"
  const [checklists, setChecklists] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [active, setActive] = useState(null); // full checklist object, for detail/edit
  const [loadingActive, setLoadingActive] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    setChecklists(await fetchChecklists());
    setLoadingLibrary(false);
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const openChecklist = async (id) => {
    setScreen("detail");
    setLoadingActive(true);
    setActive(await fetchChecklistById(id));
    setLoadingActive(false);
  };

  const backToLibrary = () => {
    setScreen("library");
    setActive(null);
    loadLibrary(); // refresh counts/names in case the one just closed changed
  };

  const handleCreate = async (draft) => {
    const created = await createChecklist(draft);
    if (created) {
      setActive(created);
      setScreen("detail");
      loadLibrary();
    }
  };

  // null payload = "Cancelar" (discard field edits, just go back to detail);
  // an object = "Guardar" (persist name/description/completionMessage, then
  // reload the full checklist so detail reflects everything — steps/media
  // were already persisted immediately by the editor itself).
  const handleExitEdit = async (fields) => {
    if (fields) await updateChecklist(active.id, fields);
    setLoadingActive(true);
    setActive(await fetchChecklistById(active.id));
    setLoadingActive(false);
    setScreen("detail");
  };

  const handleDelete = async () => {
    await deleteChecklist(active.id);
    backToLibrary();
  };

  return (
    <PageContainer isDesktop={isDesktop} variant="workspace">
      {screen !== "library" && (
        <div style={{ padding: isDesktop ? "20px 0 0" : "12px 14px 0" }}>
          <button onClick={backToLibrary}
            style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", color: C.gold, fontFamily: font, fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
            <ChevronLeft size={16} strokeWidth={2.4} /> Checklists
          </button>
        </div>
      )}

      {screen === "library" && (
        <ChecklistLibrary
          checklists={checklists}
          loading={loadingLibrary}
          isDesktop={isDesktop}
          onOpenChecklist={openChecklist}
          onCreateNew={() => setScreen("create")}
        />
      )}

      {screen === "create" && (
        <ChecklistEditor mode="create" isDesktop={isDesktop} onCreate={handleCreate} />
      )}

      {screen === "detail" && (
        loadingActive || !active ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
            <span style={{ fontFamily: font, fontSize: 13, color: C.textMuted }}>Cargando…</span>
          </div>
        ) : (
          <ChecklistDetail
            checklist={active}
            isDesktop={isDesktop}
            onEdit={() => setScreen("edit")}
            onDelete={handleDelete}
          />
        )
      )}

      {screen === "edit" && active && (
        <ChecklistEditor mode="edit" checklistId={active.id} initial={active} isDesktop={isDesktop} onExitEdit={handleExitEdit} />
      )}
    </PageContainer>
  );
}
