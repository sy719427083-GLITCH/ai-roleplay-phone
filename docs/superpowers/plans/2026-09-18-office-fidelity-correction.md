# Approved office fidelity correction

User rejected v0.3.35 on 2026-09-18 because it looked unlike the first selected mock and furniture appeared crooked.

Root cause: independent image generations changed perspective, furniture shape and object proportions; previous QA incorrectly treated substantive drift as minor polish.

Fix: retouch the actual approved mock to remove only avatars/labels. Use a shared raster atlas and source coordinate regions for object clicks, preserving all furniture. Crop source y96..1702; native React header/footer/avatar editor stay interactive. Use overflow:clip so focus cannot scroll the oversized atlas into view. Original profile and Work avatar stores remain unchanged.

Validation: side-by-side approved-vs-browser image at390x844; narrow320x568 check; last-avatar open/close then resize regression; 101 tests and build; independent geometry review; deploy patch version0.3.36 through existing main workflow.
