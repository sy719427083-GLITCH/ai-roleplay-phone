import { useEffect, useRef, useState } from "react";

export default function OfficeCanvas({ world, visibleSceneId, onFrame, onDoorSelect, onActorSelect, onReady, onError }) {
  const [host, setHost] = useState(null);
  const rendererRef = useRef(null);
  const latestPropsRef = useRef({
    world,
    visibleSceneId,
    onFrame,
    onDoorSelect,
    onActorSelect,
    onReady,
    onError,
  });
  latestPropsRef.current = {
    world,
    visibleSceneId,
    onFrame,
    onDoorSelect,
    onActorSelect,
    onReady,
    onError,
  };

  useEffect(() => {
    if (!host) return undefined;
    let cancelled = false;

    const setup = async () => {
      try {
        const { createOfficeRenderer } = await import("./createOfficeRenderer.js");
        const renderer = await createOfficeRenderer({
          host,
          onFrame: (time) => latestPropsRef.current.onFrame?.(time),
          onDoorSelect: (door) => latestPropsRef.current.onDoorSelect?.(door),
          onActorSelect: (actor) => latestPropsRef.current.onActorSelect?.(actor),
        });
        if (!renderer) return;
        if (cancelled) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        renderer.sync(latestPropsRef.current.world);
        renderer.setVisibleScene(latestPropsRef.current.visibleSceneId);
        latestPropsRef.current.onReady?.(renderer);
      } catch (error) {
        if (!cancelled) latestPropsRef.current.onError?.(error);
      }
    };

    void setup();
    return () => {
      cancelled = true;
      const renderer = rendererRef.current;
      rendererRef.current = null;
      renderer?.destroy();
    };
  }, [host]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.sync(world);
    renderer.setVisibleScene(visibleSceneId);
  }, [world, visibleSceneId]);

  return <div ref={setHost} className="office-canvas-host" aria-hidden="true" />;
}
